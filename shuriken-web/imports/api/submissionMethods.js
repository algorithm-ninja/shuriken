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

// Define Kue's queue object.
const kue = require('kue');
let queue = null;
if (Meteor.isServer) {
  queue = kue.createQueue();
}

Meteor.methods({
  'submissions.insert'(contestId, taskId) {
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

    // Step 1. Create the submission object.
    const submission = new Submission({
      userId: this.userId,
      contestId: contestId,
      taskId: taskId,
      submissionTime: new Date().getTime(),
    });
    Submissions.insert(submission.toJson(), function(err, submissionId) {
      if (err) {
        throw err;
      }

      if (!err && Meteor.isServer) {
        // Step 2. Create the KueJob.
        //FIXME This is all hardcoded just as a placeholder.
        const queueName = 'evaluation';
        let job = queue.create(queueName, {
          submissionFileUri: '',
          tcInputFileUriSchema: '',
          tcOutputFileUriSchema: '',
          intraSubtaskAggregation: 'sum',
          interSubtaskAggregation: 'sum',
          evaluationStructure: [
            {nTestcases: 2},
            {nTestcases: 3, scoreMultiplier: 1.5},
            {nTestcases: 2}
          ],
          timeLimit: 1.0,
          memoryLimit: 256.0,
        });

        job.on('enqueue', Meteor.bindEnvironment(function() {
          // Step 2. Create the evaluation object.
          //FIXME Update all kue-related fields merging the object with
          //      kue.get.
          const evaluation = new Evaluation({
            submissionId: submissionId,
            taskRevisionId: taskRevisionId,
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
  },
});
