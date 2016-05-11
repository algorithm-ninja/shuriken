'use strict';

// APIs and collections.
import {ContestTasks} from '../api/contestTasks.js';
import {Tasks} from '../api/tasks.js';
import {TaskRevisions} from '../api/taskRevisions.js';
// Libs.
import {getRouteContest} from './routeContestUtils.js';
// Requires.
const _ = require('lodash');
const should = require('should/as-function');

/**
 * Return the Task object for the given codename. If no task is found or
 * the task does not belong to the given contest, return undefined.
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

  if (_.isNil(routeTask) || !routeTask.isLoaded()) {
    return undefined;
  } else {
    const taskId = routeTask._id;
    const contestTasks = ContestTasks.find({contestId: routeContest._id});

    const isTaksInContest = _.some(contestTasks.fetch(), (contestTask) => {
      const taskRevisionId = contestTask.taskRevisionId;
      const taskRevision = TaskRevisions.findOne({_id: taskRevisionId});

      if (!_.isNil(taskRevision) && taskRevision.isLoaded()) {
        return taskRevision.taskId.valueOf() === taskId.valueOf();
      } else {
        return false;
      }
    });
    if (isTaksInContest) {
      return routeTask;
    } else {
      return undefined;
    }
  }
};

/**
 * Return the TaskRevision object for the given task codename and contest.
 * If no task is found or the task does not belong to the given contest,
 * return undefined.
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
    return undefined;
  } else {
    const routeTask = Tasks.findOne({codename: context.routeTaskCodename});
    should(routeTask.isLoaded()).be.true();

    const taskId = routeTask._id;
    const contestTasks = ContestTasks.find({contestId: routeContest._id});
    const contestTaskForTaskId = _.find(contestTasks.fetch(), (contestTask) => {
      const taskRevisionId = contestTask.taskRevisionId;
      const taskRevision = TaskRevisions.findOne({_id: taskRevisionId});

      if (!_.isNil(taskRevision) && taskRevision.isLoaded()) {
        return taskRevision.taskId.valueOf() === taskId.valueOf();
      } else {
        return false;
      }
    });

    if (!_.isNil(contestTaskForTaskId) && contestTaskForTaskId.isLoaded()) {
      const revisionId = contestTaskForTaskId.taskRevisionId;
      return TaskRevisions.findOne({_id: revisionId});
    } else {
      return undefined;
    }
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
export const isValidTaskRoute = function(context) {
  should(context.routeContestCodename).be.String();
  should(context.routeTaskCodename).be.String();

  const routeTask = getRouteTask(context);
  const routeTaskRevision = getRouteTaskRevision(context);

  if (_.isNil(routeTask) || !routeTask.isLoaded()) {
    console.warn('[isValidTaskRoute] routeTask is not loaded');
  }
  if (_.isNil(routeTaskRevision) || !routeTaskRevision.isLoaded()) {
    console.warn('[isValidTaskRoute] routeTaskRevision is not loaded');
  }

  return !_.isNil(routeTask) && routeTask.isLoaded() &&
         !_.isNil(routeTaskRevision) && routeTaskRevision.isLoaded();
};
