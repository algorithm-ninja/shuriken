'use strict';

import {Template} from 'meteor/templating';

// APIs and collections.
import {ContestTasks} from '../api/contestTasks.js';
import {Submissions} from '../api/submissions.js';
import {Tasks} from '../api/tasks.js';
import {TaskRevisions} from '../api/taskRevisions.js';
// Libs.
import {getRouteContest} from '../lib/routeContestUtils.js';
// Requires.
const should = require('should/as-function');
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
  this.subscribe('SubmissionsForCurrentParticipationAndTask', contestId, taskId);
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

    const contestTasks = ContestTasks.find({contestId: routeContest._id});
    return contestTasks.map((contestTask) => {
      const taskRevisionId = contestTask.taskRevisionId;
      const taskRevision = TaskRevisions.findOne({_id: taskRevisionId});
      should(taskRevision.isLoaded()).be.true();

      const taskId = taskRevision.taskId;
      const task = Tasks.findOne({_id: taskId});
      should(task.isLoaded()).be.true();

      return task;
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
