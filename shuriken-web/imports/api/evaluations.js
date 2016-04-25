'use strict';

import { Mongo } from 'meteor/mongo';
import { KueJobCollection } from '../KueJobCollection.js';
import { Submission } from '../models/Submission.js';
import { Submissions } from './submissions.js';

const kue = require('kue');
let queue = null;
if (Meteor.isServer) {
  queue = kue.createQueue();
}

export const Evaluations = new Mongo.Collection('evaluations');
const EvaluationsKueWrapper = new KueJobCollection(Evaluations);

if (Meteor.isServer) {
  /**
   * Publishes the live Evaluation object for a specific submission Id.
   *
   * @param {!ObjectId} submissionId The submission ObjectId.
   */
  Meteor.publish('LiveEvaluationForSubmission', function(submissionId) {
    if (!this.userId) {
      throw new Meteor.Error('Must be logged');
    }

    // Check that submission is owned by the current user.
    const submissionCursor = Submissions.find({_id: submissionId},
        {limit: 1});
    if (submissionCursor.count() !== 1) {
      throw new Meteor.Error('Requested live evaluation for submission `' +
          submissionId + '` but submission is not found.');
    }
    const submissionObject =
        new Submission.fromJson(submissionCursor.fetch()[0]);

    if (submissionObject.userId !== this.userId) {
      Meteor.Error('Requested live evaluation for submission `' +
        submissionId + '` from user `' + this.userId + '` but ' +
        'submission is owned by user `' + submissionObject.userId + '`.');
    } else {
      return Evaluations.find({
        'submissionId': submissionId,
        isLive: true,
      }, {
        limit: 1,
      });
    }
  });
}

/*Meteor.methods({
  'evaluations.enqueue'(revisionId) {
    if (Meteor.isServer) {
      const queueName = 'evaluation';

      //FIXME This is hardcoded just as a placeholder.
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

      const submission = Submissions.findOne({
        'submissionId': submissionId});
      if (submission.userId)
      EvaluationsKueWrapper.insertJob({
        'submissionId': submissionId,
        'taskRevisionId':,
      }, job);
    }
  },
});
*/
