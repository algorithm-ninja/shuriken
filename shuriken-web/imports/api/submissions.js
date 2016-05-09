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
   */
  Meteor.publish('SubmissionsForContestId', function(contestId) {
    return Submissions.find({contestId: contestId},
        {fields: {submissionFileUri: false}});
  });

  /**
   * Publishes all Submissions objects for the current user.
   */
  Meteor.publish('SubmissionsForUser', function() {
    if (!this.userId) {
      throw new Meteor.Error('Must be logged in.');
    }

    return Submissions.find({userId: this.userId},
        {fields: {submissionFileUri: false}});
  });

  /**
   * Publishes all Submissions objects for the current user and given ContestId.
   *
   * @param {!ObjectId} contestId The contest unique ObjectId.
   */
  Meteor.publish('SubmissionsForUserAndContest', function(contestId) {
    if (!this.userId) {
      throw new Meteor.Error('Must be logged in.');
    }

    return Submissions.find({
      userId: this.userId,
      contestId: contestId,
    }, {fields: {submissionFileUri: false}});
  });

  /**
   * Publishes all submissions for a specific user and task
   *
   * @param {!ObjectId} contestId The contest ObjectId.
   * @param {!ObjectId} taskId The task ObjectId.
   */
  Meteor.publish(
      'SubmissionsForUserAndContestAndTask', function(contestId, taskId) {
    if (!this.userId) {
      throw new Meteor.Error('Must be logged in.');
    }

    return Submissions.find({
      userId: this.userId,
      contestId: contestId,
      taskId: taskId,
    }, {fields: {submissionFileUri: false}});
  });
}
