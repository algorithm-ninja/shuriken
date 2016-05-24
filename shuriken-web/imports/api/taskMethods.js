'use strict';

// Collections.
import {Tasks} from './tasks.js';
// Models.
import {Task} from '../models/Task.js';
// Requires.
const _ = require('lodash');
const should = require('should/as-function');

Meteor.methods({
  /**
   * Inserts a new Task object having the given codename, if it is not already
   * in the db. Returns the object id of the created or found object.
   *
   * @param {String} codename Task codename.
   * @return {ObjectId}
   */
  'tasks.insertIfNotExisting'(codename) {
    const task = Tasks.findOne({codename: codename});

    if (_.isNil(task)) {
      return Tasks.insert(new Task({
        codename: codename,
      }).toJson());
    } else {
      should(task.isLoaded()).be.true();
      return task._id;
    }
  },
});
