'use strict';

// APIs and collections.
import {Contests} from '../api/contests.js';
import {Tasks} from '../api/tasks.js';
import {TaskRevisions} from '../api/taskRevisions.js';
// Requires.
const _ = require('lodash');
const should = require('should');

/**
 * Returns the codename of the contest in the current route, if any.
 *
 * #### Context
 *
 * This uses routeContestCodename.
 *
 * @param {Object} context Context object.
 * @return {?string}
 */
export const getRouteContestCodename = function(context) {
  return _.get(context, 'routeContestCodename', null);
};

/**
 * Return the Contest object for the contest codename in the context.
 *
 * #### Context
 *
 * This assumes routeContestCodename to be in the given context.
 *
 * @param {Object} context Context object.
 * @return {?Contest}
 */
export const getRouteContest = function(context) {
  should(getRouteContestCodename(context)).be.String();

  const routeContest =
      Contests.findOne({codename: getRouteContestCodename(context)});
  return routeContest;
};

/**
 * Returns true if everything is fine and we managed to retrieve all objects
 * and validate the models.
 *
 * #### Context
 *
 * This assumes routeContestCodename to be in the given context.
 *
 * @param {Object} context Context object.
 * @return {Boolean} True if ok, false otherwise.
 */
export const validateContestObjects = function(context) {
  should(getRouteContestCodename(context)).be.String();

  // Check the Contest exists.
  const routeContest = getRouteContest(context);

  if (!routeContest) {
    console.error('No Contest found for given codename "' +
        getRouteContestCodename(context) + '".');
    return false;
  }

  const taskErrors = _.map(routeContest.tasks, (taskData) => {
    const taskId = taskData.taskId;
    const taskRevisionId = taskData.taskRevisionId;

    const taskObj = Tasks.findOne({_id: taskId});
    const taskRevisionObj = TaskRevisions.findOne({_id: taskRevisionId});

    if (!taskObj) {
      console.error('[validateContestObjects] No Task found for given id "' +
          taskId.valueOf() + '".');
      return false;
    }
    if (!taskRevisionObj) {
      console.error('[validateContestObjects] No TaskRevision found for ' +
          'given id "' + taskRevisionId.valueOf() + '".');
      return false;
    }

    return true;
  });

  return _.some(taskErrors);
};
