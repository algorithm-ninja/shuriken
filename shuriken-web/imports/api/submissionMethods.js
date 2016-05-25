'use strict';

// Collections.
import {Contests} from './contests.js';
import {ContestTasks} from './contestTasks.js';
import {Evaluations} from './evaluations.js';
import {Submissions} from './submissions.js';
import {Tasks} from './tasks.js';
import {TaskRevisions} from './taskRevisions.js';
// Models.
import {Evaluation} from '../models/Evaluation.js';
import {Submission} from '../models/Submission.js';
// Requires.
const _ = require('lodash');
const should = require('should/as-function');
const slug = require('slug');
const moment = require('moment');
const path = require('path');

import FileDB from 'shuriken-fs';

// Define Kue's queue object.
const kue = require('kue');
let queue = null;
if (Meteor.isServer) {
  queue = kue.createQueue();
}

const _addSubmission = function(submissionId, userId, contest, task,
    taskRevision, submissionFileUri, submissionTime) {
  // Step 1. Create the submission object.
  const submission = new Submission({
    _id: submissionId,
    userId: userId,
    contestId: contest._id,
    taskId: task._id,
    submissionTime: submissionTime,
    submissionFileUri: submissionFileUri
  });

  // Wait for the submission to be inserted in the database.
  Submissions.insert(submission.toJson(), function(err, submissionId) {
    if (err) {
      throw err;
    }

    if (!err && Meteor.isServer) {
      const queueName = 'evaluation';

      let payload = taskRevision.evaluatorConf;
      Object.assign(payload, {
        submissionFileUri: submission.submissionFileUri
      });

      let job = queue.create(queueName, payload);

      job.on('enqueue', Meteor.bindEnvironment(function() {
        // Step 2. Create the evaluation object.
        //FIXME Update all kue-related fields merging the object with
        //      kue.get.
        const evaluation = new Evaluation({
          submissionId: submissionId,
          taskRevisionId: taskRevision._id,
          isLive: true,
          kueJobId: job.id,
          isLost: false,
          kueData: job.data,
          kueState: 'inactive',
          kueCreatedAt: new Date().getTime(),
          kueAttempts: 0,
          kueError: null,
          kueResult: null,
          kueProgress: 0,
          kueProgressData: null,
        });
        Evaluations.insert(evaluation.toJson());
      })).save();
    }
  });
};

Meteor.methods({
  /**
   * Creates a new submission for the (current user, contest, task) tuple. The
   * submission data is uploaded to the file-store and the path of the file
   * is written in the newly-created document.
   *
   * This method automatically enqueues an evaluation.
   *
   * @throws {403} If the user is not logged in.
   * @throws {403} If the current user is not a contestant.
   * @throws {404} If the contest is not found.
   * @throws {404} If the task is not found.
   * @throws {400} If the task is found, but does not belong to the contest.
   * @throws {500} If the given task does not have a valid revision.
   * @param {ObjectId} contestId
   * @param {ObjectId} taskId
   * @param {String} submissionData
   */
  'submissions.insertForCurrentUser'(contestId, taskId, submissionData) {
    if (!this.userId) {
      throw new Meteor.Error(403, 'User must be logged in.');
    }
    if (!Roles.userIsInRole(this.userId, 'contestant')) {
      throw new Meteor.Error(403, 'User is not a contestant');
    }

    // Record submission time (as early as possible)
    const submissionTime = new Date();
    const formattedSubmissionTime =
        moment(submissionTime).format('YYYY-MM-DD__HH-mm-ss-SSSSS');

    // Sanity check
    should(submissionData).be.a.String();
    should(submissionData.length).be.lessThan(50 * 1024);  // 50 KiB

    //FIXME check if user can submit to the current problem.

    const user = Meteor.users.findOne({_id: this.userId});
    should(user).be.ok().and.have.property('username');

    const contest = Contests.findOne({_id: contestId});
    if (_.isNil(contest)) {
      throw Meteor.Error(404, 'Contest not found.');
    }
    should(contest.isLoaded()).be.true();

    const task = Tasks.findOne({_id: taskId});
    if (_.isNil(contest)) {
      throw Meteor.Error(404, 'Task not found.');
    }
    should(task.isLoaded()).be.true();

    const contestTasks = ContestTasks.find({contestId: contestId});
    const contestTaskForTaskId = _.find(contestTasks.fetch(), (contestTask) => {
      const taskRevision = TaskRevisions.findOne({
        _id: contestTask.taskRevisionId
      });
      should(taskRevision.isLoaded()).be.true();

      return taskRevision.taskId.valueOf() === taskId.valueOf();
    });
    if (_.isNil(contestTaskForTaskId)) {
      throw Meteor.Error(400, 'Task not found in given contest.');
    }
    should(contestTaskForTaskId.isLoaded()).be.true();

    const taskRevision = TaskRevisions.findOne({
      _id: contestTaskForTaskId.taskRevisionId
    });
    if (_.isNil(taskRevision)) {
      throw Meteor.Error(500, 'No task revision found for given task.');
    }
    should(taskRevision.isLoaded()).be.true();

    // Save the data to a new file (in the filesystem) and create a submission
    const submissionId = new Mongo.ObjectID();
    const submissionFilename = `${formattedSubmissionTime}__${task.codename}` +
        `__${slug(user.username)}__${submissionId}.cpp`;
    const submissionFileUri = 'shuriken://' +
        path.join('submissions', submissionFilename);

    const fileHandle = new FileDB(Meteor.settings.fileStoreRoot)
        .get(submissionFileUri);

    fileHandle.write(submissionData, Meteor.bindEnvironment((err) => {
      should(err).not.be.ok(`Can't open file: could it be a file system ` +
          `error or a lack of space? [shuriken://${submissionFileUri}]`);

      _addSubmission(submissionId, this.userId, contest, task, taskRevision,
          submissionFileUri, submissionTime.getTime());
    }));
  },

  /**
   * Returns the content of the submissionFile for the given submissios id.
   *
   * @throws {404} If the id is not found in the collection.
   * @throws {403} If the current user is not a contestant.
   * @throws {403} If the submission does not belong to the current user.
   *
   * @param {ObjectId} submissionId The unique object if for the submission.
   * @return {String} raw file content.
   */
  'submissions.submissionFileForSubmissionId'(submissionId) {
    if (!this.userId) {
      throw new Meteor.Error(403, 'User must be logged in.');
    }
    if (!Roles.userIsInRole(this.userId, 'contestant') &&
        !Roles.userIsInRole(this.userId, 'contest-observer')) {
      throw new Meteor.Error(403, 'User is not a contestant nor a ' +
          'contest-observer');
    }

    const submission = Submissions.findOne({_id: submissionId});
    if (_.isNil(submission)) {
      throw new Meteor.Error(404, 'Submission not found.');
    }
    should(submission.isLoaded()).be.true();

    const submissionFileUri = submission.submissionFileUri;
    const fileHandle = new FileDB(Meteor.settings.fileStoreRoot)
        .get(submissionFileUri);
    return fileHandle.readSync();
  }
});
