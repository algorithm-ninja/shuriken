'use strict';

import { Mongo } from 'meteor/mongo';

export const Tasks = new Mongo.Collection('tasks');

if (Meteor.isServer) {
  /**
   * Publishes all Task objects.
   *
   * @todo Check that the user is allowed to view the task.
   */
  Meteor.publish('AllTasks', function() {
    return Tasks.find({});
  });

  /**
   * Publishes the Task object for a specific ObjectId.
   *
   * @todo Check that the user is allowed to view the task.
   * @param {String} taskId The task ObjectId.
   */
  Meteor.publish('TaskById', function(taskId) {
    return Tasks.find({_id: taskId}, {limit: 1});
  });

  /**
   * Publishes the Task object for a specific taskCodename.
   *
   * @todo Check that the user is allowed to view the task.
   * @param {String} taskCodename The task codename.
   */
  Meteor.publish('TaskByCodename', function(taskCodename) {
    return Tasks.find({codename: taskCodename}, {limit: 1});
  });
}

Meteor.methods({});
