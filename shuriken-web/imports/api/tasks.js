'use strict';

import {Mongo} from 'meteor/mongo';
// Models.
import {Task} from '../models/Task.js';

export const Tasks = new Mongo.Collection('tasks', {
  idGeneration: 'MONGO',
  transform: (obj) => {return new Task(obj);}
});

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
   * @param {!ObjectId} taskId The task ObjectId.
   */
  Meteor.publish('TaskById', function(taskId) {
    return Tasks.find({_id: taskId}, {limit: 1});
  });

  /**
   * Publishes the Task object for a specific taskCodename.
   *
   * @todo Check that the user is allowed to view the task.
   * @param {!ObjectId} taskCodename The task codename.
   */
  Meteor.publish('TaskByCodename', function(taskCodename) {
    return Tasks.find({codename: taskCodename}, {limit: 1});
  });
}

Meteor.methods({});
