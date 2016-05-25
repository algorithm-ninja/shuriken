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
   * @throws {403} If the user is not logged in.
   * @throws {403} If the current user is not a contestant nor a
                   contest-observer.
   * @throws {403} If the current user is a contestant but the submission does
   *               not belong to them.
   * @param {!ObjectId} submissionId The submission ObjectId.
   */
  Meteor.publish('LiveEvaluationForSubmission', function(submissionId) {
    if (!this.userId) {
      throw new Meteor.Error(403, 'User must be logged in.');
    }
    if (!Roles.userIsInRole(this.userId, 'contestant') &&
        !Roles.userIsInRole(this.userId, 'contest-observer')) {
      throw new Meteor.Error(403, 'User is not a contestant nor a ' +
          'contest-observer');
    }

    const submission = Submissions.findOne({_id: submissionId});
    if (!submission.isLoaded()) {
      return this.ready();
    }

    // Check that submission is owned by the current user.
    if (Roles.userIsInRole(this.userId, 'contestant') &&
        submission.userId !== this.userId) {
      throw new Meteor.Error(403, `Live evaluation for submission ` +
        `${submissionId} from user ${this.userId} but submission is not ` +
        `owned by them.`);
    } else {
      return Evaluations.find({
        'submissionId': submissionId,
        isLive: true,
      }, {
        limit: 1,
      });
    }
  });

  /**
   * Publishes all live Evaluation objects for a specific task revision id.
   * This only publishes:
   * - submissionId
   * - isLost
   * - kueState
   * - kueResult
   * - isLive,
   * - taskRevisionId
   *
   * @throws {403} If the user is not logged in.
   * @throws {403} It the current user is not a contest-observer.
   * @param {!ObjectId} submissionId The submission ObjectId.
   */
  Meteor.publish('LiveEvaluationsForTaskRevisionId', function(taskRevisionId) {
    if (!this.userId) {
      throw new Meteor.Error(403, 'User must be logged in.');
    }
    if (!Roles.userIsInRole(this.userId, 'contest-observer')) {
      throw new Meteor.Error(403, 'User is not a contest-observer');
    }

    return Evaluations.find({
      taskRevisionId: taskRevisionId,
    }, {fields: {
      submissionId: true,
      taskRevisionId: true,
      isLost: true,
      isLive: true,
      kueState: true,
      kueResult: true
    }});
  });
}
