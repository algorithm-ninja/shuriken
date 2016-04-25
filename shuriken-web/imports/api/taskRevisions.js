'use strict';

import { Mongo } from 'meteor/mongo';

export const TaskRevisions = new Mongo.Collection('taskRevisions');

if (Meteor.isServer) {
  /**
   * Publishes the TaskRevision object for a specific taskRevisionId.
   *
   * @todo Check that the user is allowed to view the task.
   * @param {String} taskRevisionId The task revision ObjectId.
   */
  Meteor.publish('TaskRevisionById', function(taskRevisionId) {
    return TaskRevisions.find({_id: taskRevisionId}, {limit: 1});
  });
}

Meteor.methods({});
