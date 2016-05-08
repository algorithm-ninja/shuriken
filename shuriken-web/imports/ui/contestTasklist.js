'use strict';

import {Template} from 'meteor/templating';

// APIs and collections.
import {Tasks} from '../api/tasks.js';
import {Submissions} from '../api/submissions.js';
// Libs.
import {getRouteContest} from '../lib/routeContestUtils.js';
// Models.
import {Task} from '../models/Task.js';
// Requires.
const _ = require('lodash');
const should = require('should');
// UI fragments.
import './contestTasklist.html';

/**
 * #### Context
 *
 * @todo complete section.
 *
 * #### Subscription contract
 *
 * All relevant data has already been loaded by contestPageLayout.
 * We don't need to subscribe to anything.
 *
 * Furthermore, all Tasks and TaskRevisions have been found in the DB and
 * validated.
 */
Template.contestTasklist.onCreated(function(){
  // Pass.
});

Template.tasklistTask.onCreated(function() {
  const context = Template.currentData();
  should(context)
      .have.properties('contestId', 'taskId');

  const contestId = context.contestId;
  const taskId = context.taskId;
  //FIXME subscribe to a counter, not the whole collection!
  this.subscribe('SubmissionsForUserAndContestAndTask', contestId, taskId);
});

Template.contestTasklist.helpers({
  /**
   * Returns a list of the Task objects relevant for the current contest.
   *
   * @return {Array<Task>}
   */
  contestTasks() {
    const context = this;
    const routeContest = getRouteContest(context);
    should(routeContest.isLoaded()).be.true();

    return _.map(routeContest.tasks, (taskData) => {
      const taskObj = new Task(
          Tasks.findOne({_id: taskData.taskId}));
      should(taskObj.isLoaded()).be.true();

      return taskObj;
    });
  },

  routeContest() {
    const context = this;
    return getRouteContest(context);
  }
});

Template.tasklistTask.helpers({
  'submissionCount'() {
    return Submissions.find({
      userId: Meteor.userId(),
      contestId: this.contestId,
      taskId: this.taskId,
    }).count();
  }
});
