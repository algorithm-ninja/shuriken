'use strict';

import {Mongo} from 'meteor/mongo';
// Models.
import {Submission} from '../models/Submission.js';

export const Submissions = new Mongo.Collection('submissions', {
  idGeneration: 'MONGO',
  transform: (obj) => {return new Submission(obj);}
});


if (Meteor.isServer) {
  /**
   * Publishes all Submissions objects for a given ContestId.
   *
   * @throws {403} If the user is not logged in.
   * @throws {403} It the current user is not a contest-observer.
   * @param {ObjectId} contestId The contest unique identifier.
   */
  Meteor.publish('SubmissionsForContestId', function(contestId) {
    if (!this.userId) {
      throw new Meteor.Error(403, 'User must be logged in.');
    }
    if (!Roles.userIsInRole(this.userId, 'contest-observer')) {
      throw new Meteor.Error(403, 'User is not a contest-observer');
    }

    return Submissions.find({contestId: contestId},
        {fields: {submissionFileUri: false}});
  });

  /**
   * Publishes all Submissions objects for the current user.
   *
   * @throws {403} If the user is not logged in.
   * @throws {403} If the current user is not a contestant.
   * @throws {403} If the current user is a contestant but the submission does
   *               not belong to them.
   */
  Meteor.publish('SubmissionsForCurrentUser', function() {
    if (!this.userId) {
      throw new Meteor.Error(403, 'User must be logged in.');
    }
    if (!Roles.userIsInRole(this.userId, 'contestant')) {
      throw new Meteor.Error(403, 'User is not a contestant.');
    }

    return Submissions.find({userId: this.userId},
        {fields: {submissionFileUri: false}});
  });

  /**
   * Publishes all Submissions objects for the current user and given ContestId.
   *
   * @throws {403} If the user is not logged in.
   * @throws {403} If the current user is not a contestant.
   * @throws {403} If the current user is a contestant but the submission does
   *               not belong to them.
   * @param {!ObjectId} contestId The contest unique ObjectId.
   */
  Meteor.publish('SubmissionsForCurrentParticipation', function(contestId) {
    if (!this.userId) {
      throw new Meteor.Error(403, 'User must be logged in.');
    }
    if (!Roles.userIsInRole(this.userId, 'contestant')) {
      throw new Meteor.Error(403, 'User is not a contestant.');
    }

    return Submissions.find({
      userId: this.userId,
      contestId: contestId,
    }, {fields: {submissionFileUri: false}});
  });

  /**
   * Publishes all submissions for a specific user and task
   *
   * @throws {403} If the user is not logged in.
   * @throws {403} If the current user is not a contestant.
   * @throws {403} If the current user is a contestant but the submission does
   *               not belong to them.
   * @param {!ObjectId} contestId The contest ObjectId.
   * @param {!ObjectId} taskId The task ObjectId.
   */
  Meteor.publish(
      'SubmissionsForCurrentParticipationAndTask', function(contestId, taskId) {
    if (!this.userId) {
      throw new Meteor.Error(403, 'User must be logged in.');
    }
    if (!Roles.userIsInRole(this.userId, 'contestant')) {
      throw new Meteor.Error(403, 'User is not a contestant.');
    }

    return Submissions.find({
      userId: this.userId,
      contestId: contestId,
      taskId: taskId,
    }, {fields: {submissionFileUri: false}});
  });
}
