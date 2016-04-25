'use strict';

// APIs and collections.
import { Contests } from '../api/contests.js';
import { Tasks } from '../api/tasks.js';
import { TaskRevisions } from '../api/taskRevisions.js';
// Models.
import { Contest } from '../models/Contest.js';
import { Task } from '../models/Task.js';
import { TaskRevision } from '../models/TaskRevision.js';
// Requires.
const _ = require('lodash');
const should = require('should');

/**
 * Return the TaskRevision object for the given task codename and contest.
 * If no task is found or the task does not belong to the given contest,
 * return null.
 *
 * Context
 * -------
 *
 * This assumes routeContestCodename to be in the given context.
 *
 * @return {?Contest}
 */
export const getRouteContest = function() {
  should(this.routeContestCodename).be.String();

  const routeContest = new Contest(
    Contests.findOne({codename: this.routeContestCodename}));
  return routeContest;
}

/**
 * Returns true if everything is fine and we managed to retrieve all objects
 * and validate the models.
 *
 * Context
 * -------
 *
 * This assumes routeContestCodename to be in the given context.
 *
 * @return {Boolean} True if ok, false otherwise.
 */
export const validateContestObjects = function() {
  should(this.routeContestCodename).be.String();
  
  // Check the Contest exists.
  const routeContest = getRouteContest.apply(this);

  if (!routeContest.isLoaded()) {
    console.error('No Contest found for given codename "' +
        this.routeContestCodename + '".');
    return false;
  }

  const taskErrors = _.map(routeContest.tasks, (taskData) => {
    const taskId = taskData.taskId;
    const taskRevisionId = taskData.taskRevisionId;

    const taskObj = new Task(Tasks.findOne({_id: taskId}));
    const taskRevisionObj = new TaskRevision(
        TaskRevisions.findOne({_id: taskRevisionId}));

    if (!taskObj.isLoaded()) {
      console.error('[validateContestObjects] No Task found for given id "' +
          taskId.valueOf() + '".');
      return false;
    }
    if (!taskRevisionObj.isLoaded()) {
      console.error('[validateContestObjects] No TaskRevision found for ' +
          'given id "' + taskRevisionId.valueOf() + '".');
      return false;
    }

    return true;
  });

  return _.some(taskErrors);
};
