'use strict';

// APIs and collections.
import {Tasks} from '../api/tasks.js';
import {TaskRevisions} from '../api/taskRevisions.js';
// Models.
import {Task} from '../models/Task.js';
import {TaskRevision} from '../models/TaskRevision.js';
// Libs.
import {getRouteContest} from './routeContestUtils.js';
// Requires.
const _ = require('lodash');
const should = require('should');

/**
 * Return the Task object for the given codename. If no task is found or
 * the task does not belong to the given contest, return null.
 *
 * Context
 * -------
 *
 * This assumes routeContestCodename and routeTaskCodename to be in the given
 * context.
 *
 * @return {?Task}
 */
export const getRouteTask = function() {
  should(this.routeContestCodename).be.String();
  should(this.routeTaskCodename).be.String();

  const routeContest = getRouteContest.apply(this);
  should(routeContest.isLoaded()).be.true();

  const routeTask = new Task(
    Tasks.findOne({codename: this.routeTaskCodename}));

  if (!routeTask.isLoaded()) {
    return null;
  } else {
    const isTaksInContest = _.some(routeContest.tasks, (taskData) => {
      return taskData.taskId.valueOf() === routeTask._id.valueOf();
    });
    if (isTaksInContest) {
      return Task;
    } else {
      return null;
    }
  }
};

/**
 * Return the TaskRevision object for the given task codename and contest.
 * If no task is found or the task does not belong to the given contest,
 * return null.
 *
 * Context
 * -------
 *
 * This assumes routeContestCodename and routeTaskCodename to be in the given
 * context.
 *
 * @return {?TaskRevision}
 */
export const getRouteTaskRevision = function() {
  should(this.routeContestCodename).be.String();
  should(this.routeTaskCodename).be.String();

  const routeContest = getRouteContest.apply(this);
  should(routeContest.isLoaded()).be.true();

  if (!getRouteTask.apply(this)) {
    return null;
  } else {
    const routeTask = new Task(
      Tasks.findOne({codename: this.routeTaskCodename}));
    should(routeTask.isLoaded()).be.true();

    const routeTaskData = _.find(routeContest.tasks, (taskData) => {
      return taskData.taskId.valueOf() === routeTask._id.valueOf();
    });
    should(routeTaskData).be.Object();

    const routeTaskRevision = new TaskRevision(TaskRevisions.findOne({
      _id: routeTaskData.taskRevisionId
    }));
    should(routeTaskRevision.isLoaded()).be.true();

    return routeTaskRevision;
  }
};

/**
 * Returns true if everything is fine and we managed to retrieve all objects
 * and validate the models.
 *
 * Context
 * -------
 *
 * This assumes routeContestCodename and routeTaskCodename to be in the given
 * context.
 *
 * @return {Boolean} True if ok, false otherwise.
 */
export const validateTaskObjects = function() {
  should(this.routeContestCodename).be.String();
  should(this.routeTaskCodename).be.String();

  const routeTask = getRouteTask.apply(this);
  const routeTaskRevision = getRouteTaskRevision.apply(this);

  return !_.isNull(routeTask) && !_.isNull(routeTaskRevision);
};
