'use strict';

import {Mongo} from 'meteor/mongo';
// APIs and Collections.
import {Counts} from './counts.js';
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
   * Publishes all submissions for a specific user and task.
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

  /**
   * Publishes the number (count) of submissions for a specific user and task.
   * The counter gets published under the name
   * `submission_counter_{{contestId}}_{{taskId}}`.
   *
   * @throws {403} If the user is not logged in.
   * @throws {403} If the current user is not a contestant.
   * @throws {403} If the current user is a contestant but the submission does
   *               not belong to them.
   * @param {!ObjectId} contestId The contest ObjectId.
   * @param {!ObjectId} taskId The task ObjectId.
   */
  Meteor.publish('SubmissionsForCurrentParticipationAndTaskCounter',
      function(contestId, taskId) {
    if (!this.userId) {
      throw new Meteor.Error(403, 'User must be logged in.');
    }
    if (!Roles.userIsInRole(this.userId, 'contestant')) {
      throw new Meteor.Error(403, 'User is not a contestant.');
    }

    const counterName = `submission_counter_${contestId.valueOf()}_` +
        `${taskId.valueOf()}`;

    // Taken from http://docs.meteor.com/api/pubsub.html .
    var self = this;
    var count = 0;
    var initializing = true;

    // observeChanges only returns after the initial `added` callbacks
    // have run. Until then, we don't want to send a lot of
    // `self.changed()` messages - hence tracking the
    // `initializing` state.
    var handle = Submissions.find({
      userId: this.userId,
      contestId: contestId,
      taskId: taskId,
    }).observeChanges({
      added: function (id) {
        count++;
        if (!initializing)
          self.changed("counts", counterName, {count: count});
      },
      removed: function (id) {
        count--;
        self.changed("counts", counterName, {count: count});
      }
      // We don't care about changed.
    });

    // Instead, we'll send one `self.added()` message right after
    // observeChanges has returned, and mark the subscription as
    // ready.
    initializing = false;
    self.added("counts", counterName, {count: count});
    self.ready();

    // Stop observing the cursor when client unsubs.
    // Stopping a subscription automatically takes
    // care of sending the client any removed messages.
    self.onStop(function () {
      handle.stop();
    });
  });
}
