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
  'submissions.insert'(contestId, taskId, submissionData) {
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
    should(contest.isLoaded()).be.true();

    const task = Tasks.findOne({_id: taskId});
    should(task.isLoaded()).be.true();

    const contestTasks = ContestTasks.find({contestId: contestId});
    const contestTaskForTaskId = _.find(contestTasks.fetch(), (contestTask) => {
      const taskRevision =
          TaskRevisions.findOne({_id: contestTask.taskRevisionId});
      should(taskRevision.isLoaded()).be.true();

      return taskRevision.taskId.valueOf() === taskId.valueOf();
    });
    should(contestTaskForTaskId.isLoaded()).be.true();

    const taskRevision = TaskRevisions.findOne({
        _id: contestTaskForTaskId.taskRevisionId});
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
});
