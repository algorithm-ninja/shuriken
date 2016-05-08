'use strict';

// Collections.
import {Contests} from './contests.js';
import {Evaluations} from './evaluations.js';
import {Submissions} from './submissions.js';
import {Tasks} from './tasks.js';
import {TaskRevisions} from './taskRevisions.js';
// Models.
import {Evaluation} from '../models/Evaluation.js';
import {Submission} from '../models/Submission.js';
// Requires.
const should = require('should');
const temp = require('temp');
const fs = require('fs');

// Define Kue's queue object.
const kue = require('kue');
let queue = null;
if (Meteor.isServer) {
  queue = kue.createQueue();
}

const _addSubmission = function(userId, contest, task, taskRevision,
    submissionFileUri, submissionTime) {
  // Step 1. Create the submission object.
  const submission = new Submission({
    userId: userId,
    contestId: contest._id,
    taskId: task._id,
    submissionTime: submissionTime,
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
        submissionFileUri: 'file://' + submissionFileUri
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
    const submissionTime = new Date().getTime();

    //FIXME check if user can submit to the current problem.

    const contest = Contests.findOne({_id: contestId});
    should(contest.isLoaded()).be.true();
    // Let's load the task to make sure it exists.
    const task = Tasks.findOne({_id: taskId});
    should(task.isLoaded()).be.true();

    const taskRevisionId = contest.taskRevisionIdForTaskId(taskId);
    // Let's load the taskRevision to make sure it exists.
    const taskRevision = TaskRevisions.findOne({_id: taskRevisionId});
    should(taskRevision.isLoaded()).be.true();

    // Save the data to a new file (in the filesystem) and create a submission
    //FIXME save this file using the filesystem wrapper?
    temp.open({
      prefix: 'submission',
      suffix: '.cpp'
    }, Meteor.bindEnvironment((err, info) => {
      if (!err) {
        fs.write(info.fd, submissionData);
        fs.close(info.fd, Meteor.bindEnvironment((err) => {
          if (!err) {
            _addSubmission(this.userId, contest, task, taskRevision, info.path,
                submissionTime);
          }
        }));
      }
    }));
  },
});
