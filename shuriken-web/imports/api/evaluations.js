'use strict';

import {Mongo} from 'meteor/mongo';
// APIs and collections.
import {Submissions} from './submissions.js';
// Models.
import {Evaluation} from '../models/Evaluation.js';

export const Evaluations = new Mongo.Collection('evaluations', {
  idGeneration: 'MONGO',
  transform: (obj) => {return new Evaluation(obj);}
});

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
    const submission = Submissions.findOne({_id: submissionId});
    if (!submission.isLoaded()) {
      throw new Meteor.Error('Requested live evaluation for submission `' +
          submissionId + '` but submission is not found.');
    }

    if (submission.userId !== this.userId) {
      Meteor.Error('Requested live evaluation for submission `' +
        submissionId + '` from user `' + this.userId + '` but ' +
        'submission is owned by user `' + submission.userId + '`.');
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
