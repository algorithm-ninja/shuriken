'use strict';

// Collections.
import {Contests} from './contests.js';
import {ContestTasks} from './contestTasks.js';
import {Evaluations} from './evaluations.js';
import {Submissions} from './submissions.js';
import {Tasks} from './tasks.js';
import {TaskRevisions} from './taskRevisions.js';
// import {Users} from './users.js';  //FIXME
// Models.
import {Evaluation} from '../models/Evaluation.js';
import {Submission} from '../models/Submission.js';
// Requires.
const _ = require('lodash');
const should = require('should/as-function');
// const slug = require('slug');  //FIXME
const moment = require('moment');
const path = require('path');
const fs = require('fs');

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

    //FIXME check if user can submit to the current problem.

    // const user = Users.findOne({_id: this.userId});  //FIXME
    // should(user).be.ok().and.have.property('username');  //FIXME

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
        // `__${slug(user.username)}__${submissionId}.cpp`;  //FIXME
        `__${this.userId}__${submissionId}.cpp`;
    const submissionFileUri = 'shuriken://' +
        path.join('submissions', submissionFilename);
    const realSubmissionFileUri = path.join(Meteor.settings.fileStoreRoot,
        'submissions', submissionFilename);

    console.log(Meteor.settings);

    console.log(realSubmissionFileUri);
    fs.open(realSubmissionFileUri, 'w', Meteor.bindEnvironment((err, fd) => {
      should(err).not.be.ok();
      should(fd).be.a.Number();
      console.log(fd + ' ' + typeof fd);
      should(submissionData).be.a.String();
      fs.write(fd, submissionData, 0, 'utf-8', Meteor.bindEnvironment((error) => {
        should(error).not.be.ok();
        fs.close(fd, Meteor.bindEnvironment((error) => {
          should(error).not.be.ok();
          _addSubmission(submissionId, this.userId, contest, task,
              taskRevision, submissionFileUri, submissionTime.getTime());
        }));
      }));
    }));
  },
});
