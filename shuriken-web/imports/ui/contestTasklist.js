'use strict';

import {Template} from 'meteor/templating';
// APIs and collections.
import {Tasks} from '../api/tasks.js';
// Models.
import {Task} from '../models/Task.js';
// Libs.
import {getRouteContest} from '../lib/routeContestUtils.js';
// UI fragments.
import './contestTasklist.html';
// Requires.
const _ = require('lodash');
const should = require('should');

/**
 * contestTasklist
 * ===============
 *
 * Context
 * -------
 *
 * @todo complete section.
 *
 * Subscription contract
 * ---------------------
 * All relevant data has already been loaded by contestPageLayout.
 * We don't need to subscribe to anything.
 *
 * Furthermore, all Tasks and TaskRevisions have been found in the DB and
 * validated.
 */
Template.contestTasklist.onCreated(function(){
  // Pass.
});

Template.contestTasklist.helpers({
  /**
   * Returns a list of the Task objects relevant for the current contest.
   *
   * @return {Array<Task>}
   */
  contestTasks() {
    const routeContest = getRouteContest.apply(this);
    should(routeContest.isLoaded()).be.true();

    return _.map(routeContest.tasks, (taskData) => {
      const taskObj = new Task(
          Tasks.findOne({_id: taskData.taskId}));
      should(taskObj.isLoaded()).be.true();

      return taskObj;
    });
  },
});
