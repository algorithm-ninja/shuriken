'use strict';

// APIs and collections.
import {Submissions} from '../api/submissions.js';
// Libs.
import {getRouteContest, isValidContestRoute}
    from '../lib/routeContestUtils.js';
import {getRouteTask, getRouteTaskRevision, isValidTaskRoute}
    from '../lib/routeTaskUtils.js';
// Model.
import {Submission} from '../models/Submission.js';
// Requires.
const should = require('should');
// UI fragments.
import './taskSubmissionsPage.html';
import './submissionStatus.js';
import './newSubmissionForm.js';

/**
 * #### Context
 *
 * @todo complete section.
 *
 * #### Subscription contract
 *
 * All relevant data from Contests, Tasks and TaskRevisions has already been
 * loaded by contestPageLayout.
 * Furthermore, all Tasks and TaskRevisions have been found in the DB and
 * validated.
 *
 * We only need to dynamically subscribe and validate data from Submissions and
 * Evaluations.
 */
Template.taskSubmissionsPage.onCreated(function() {
  let self = this;

  // If validateContestObjects is false, we shouldn't be here!
  should(isValidContestRoute(Template.currentData())).be.true();

  this.autorun(function() {
    // Listen for changes in the context.
    const context = Template.currentData();

    const routeContest = getRouteContest(context);
    if (isValidTaskRoute(context)) {
      const routeTask = getRouteTask(context);
      self.subscriptionStatus =
          self.subscribe('SubmissionsForUserAndContestAndTask',
              routeContest._id, routeTask._id);
    }
  });
});


Template.taskSubmissionsPage.helpers({
  /**
   * Returns true if everything is fine and we managed to retrieve all objects
   * and validate the models.
   *
   * @return {Boolean} True if ok, false otherwise.
   */
  'isValidTaskRoute'() {
    return isValidTaskRoute(this);
  },

  /**
   * Returns the Contest object relative to the current route.
   *
   * @return {!Contest}
   */
  'routeContest'() {
    return getRouteContest(this);
  },

  /**
   * Returns the Task object relative to the current route.
   *
   * @return {!Task}
   */
  'routeTask'() {
    return getRouteTask(this);
  },

  /**
   * Returns the taskRevision Object for the current (route-defined) task.
   * Will throw if validateObjects is false.
   *
   * @return {!ObjectId}
   */
  'taskRevision'() {
    should(isValidTaskRoute(this)).be.true();

    const routeTaskRevision = getRouteTaskRevision(this);
    return routeTaskRevision;
  },

  /**
   * Returns the title for the current (route-defined) task.
   * Will throw if validateObjects is false.
   *
   * @return {!ObjectId}
   */
  'taskTitle'() {
    should(isValidTaskRoute(this)).be.true();

    const routeTaskRevision = getRouteTaskRevision(this);
    return routeTaskRevision.title;
  },

  /**
   * Returns true if the SubmissionsForUserAndContestAndTask subscription is
   * ready.
   *
   * @return {Boolean} True if ready, false otherwise.
   */
  'submissionsLoaded'() {
    const templateInstance = Template.instance();
    return templateInstance.subscriptionStatus.ready();
  },

  /**
   * Returns a cursor to all submissions for the current (user, contest, task)
   * combination.
   *
   * @return {Object}
   */
  'submissions'() {
    const routeTask = getRouteTask(this);
    const routeContest = getRouteContest(this);

    return Submissions.find({
      userId: Meteor.userId(),
      taskId: routeTask._id,
      contestId: routeContest._id,
    }, {
      sort: {submissionTime: -1},
    });
  },
});
