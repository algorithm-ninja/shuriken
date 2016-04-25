'use strict';

// APIs and collections.
import {Submissions} from '../api/submissions.js';
// Libs.
import {ReactiveVar} from 'meteor/reactive-var';
import {getRouteContest, validateContestObjects}
    from '../lib/routeContestUtils.js';
import {getRouteTask, validateTaskObjects}
    from '../lib/routeTaskUtils.js';
// UI fragments.
import './taskSubmissionsPage.html';
import './submissionStatus.js';
import './newSubmissionForm.js';
// Requires.
const should = require('should');

/**
 * taskStatementPage
 * =================
 *
 * Context
 * -------
 *
 * @todo complete section.
 *
 * Subscription contract
 * ---------------------
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
  should(validateContestObjects.apply(this.data)).be.true();
  const routeContest = getRouteContest.apply(this.data);

  if (validateTaskObjects.apply(this.data)) {
    const routeTask = getRouteTask.apply(this.data);
    this.data.subscriptionStatus = new ReactiveVar(false);

    this.subscribe('SubmissionsForUserAndContestAndTask', routeContest._id,
        routeTask._id, {onReady: () => {
          self.data.subscriptionStatus.set(true);}
        });
  }
});


Template.taskSubmissionsPage.helpers({
  /**
   * Returns true if everything is fine and we managed to retrieve all objects
   * and validate the models.
   *
   * @return {Boolean} True if ok, false otherwise.
   */
  validateObjects: function() {
    return validateTaskObjects.apply(this);
  },

  /**
   * Returns true if the SubmissionsForUserAndContestAndTask subscription is
   * ready.
   *
   * @return {Boolean} True if ready, false otherwise.
   */
  submissionsLoaded: function() {
    return this.subscriptionStatus.get();
  },

  /**
   * Returns a cursor to all submissions for the current (user, contest, task)
   * combination.
   *
   * @return {Object}
   */
  submissions: function() {
    const routeTask = getRouteTask.apply(this);
    const routeContest = getRouteContest.apply(this);

    return Submissions.find({
      userId: Meteor.userId(),
      taskId: routeTask._id,
      contestId: routeContest._id,
    }, {
      sort: {submissionTime: -1},
    });
  },
});
