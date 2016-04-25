'use strict';

import { Mongo } from 'meteor/mongo';
export const Submissions = new Mongo.Collection('submissions');

if (Meteor.isServer) {
  /**
   * Publishes all Submissions objects for the current user.
   */
  Meteor.publish('AllSubmissionsForUser', function() {
    if (!this.userId) {
      throw new Meteor.Error('Must be logged in.');
    }

    return Submissions.find({userId: this.userId});
  });

  /**
   * Publishes all Submissions objects for the current user and given ContestId.
   *
   * @param {String} contestId The contest unique ObjectId.
   */
  Meteor.publish('AllSubmissionsForUserAndContest', function(contestId) {
    if (!this.userId) {
      throw new Meteor.Error('Must be logged in.');
    }

    return Submissions.find({
      userId: this.userId,
      constestId: contestId,
    });
  });

  /**
   * Publishes all submissions for a specific user and task
   *
   * @param {String} contestId The contest ObjectId.
   * @param {String} taskId The task ObjectId.
   */
  Meteor.publish(
      'SubmissionsForUserAndContestAndTask', function(contestId, taskId) {
    if (!this.userId) {
      throw new Meteor.Error('Must be logged in.');
    }

    return Submissions.find({
      userId: this.userId,
      constestId: contestId,
      taskId: taskId,
    });
  });
}

Meteor.methods({});
