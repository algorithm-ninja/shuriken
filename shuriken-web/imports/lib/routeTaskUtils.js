'use strict';

// APIs and collections.
import {Tasks} from '../api/tasks.js';
import {TaskRevisions} from '../api/taskRevisions.js';
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
 * @param {Object} context Context object.
 * @return {?Task}
 */
export const getRouteTask = function(context) {
  should(context.routeContestCodename).be.String();
  should(context.routeTaskCodename).be.String();

  const routeContest = getRouteContest(context);
  should(routeContest.isLoaded()).be.true();

  const routeTask = Tasks.findOne({codename: context.routeTaskCodename});

  if (!routeTask) {
    return null;
  } else {
    const isTaksInContest = _.some(routeContest.tasks, (taskData) => {
      return taskData.taskId.valueOf() === routeTask._id.valueOf();
    });
    if (isTaksInContest) {
      return routeTask;
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
 * @param {Object} context Context object.
 * @return {?TaskRevision}
 */
export const getRouteTaskRevision = function(context) {
  should(context.routeContestCodename).be.String();
  should(context.routeTaskCodename).be.String();

  const routeContest = getRouteContest(context);
  should(routeContest.isLoaded()).be.true();

  if (!getRouteTask(context)) {
    return null;
  } else {
    const routeTask = Tasks.findOne({codename: context.routeTaskCodename});
    should(routeTask.isLoaded()).be.true();

    const routeTaskData = _.find(routeContest.tasks, (taskData) => {
      return taskData.taskId.valueOf() === routeTask._id.valueOf();
    });
    should(routeTaskData).be.Object();

    const routeTaskRevision =
        TaskRevisions.findOne({_id: routeTaskData.taskRevisionId});
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
 * @param {Object} context Context object.
 * @return {Boolean} True if ok, false otherwise.
 */
export const validateTaskObjects = function(context) {
  should(context.routeContestCodename).be.String();
  should(context.routeTaskCodename).be.String();

  const routeTask = getRouteTask(context);
  const routeTaskRevision = getRouteTaskRevision(context);

  return !_.isNull(routeTask) && !_.isNull(routeTaskRevision);
};
