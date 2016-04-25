'use strict';

// Libs.
import {ReactiveDict} from 'meteor/reactive-dict';
import {getRouteContest, validateContestObjects}
    from '../lib/routeContestUtils.js';
// UI fragments
import './contestPageLayout.html';
import './contestSidebar.js';
// Requires.
const _ = require('lodash');
const should = require('should');

/**
 * contestPageLayout
 * =================
 *
 * Main entry point for all contest-related pages.
 *
 * Context
 * -------
 *
 * - routeContestCodename
 * @todo complete section.
 *
 * Subscription contract
 * ---------------------
 *
 * @todo complete section.
 */
Template.contestPageLayout.onCreated(function() {
  let self = this;
  const ContestSubscriptionHandle =
      this.subscribe('ContestByCodename', this.data.routeContestCodename);

  this.data.subscriptionStatus = new ReactiveDict();
  this.data.subscriptionStatus.set('contestByCodename', false);

  // Before continuiung we dynamically subscribe to all Task objects related
  // to the current Contest object.
  this.autorun(function() {
    if (ContestSubscriptionHandle.ready()) {
      const routeContest = getRouteContest.apply(self.data);
      should(routeContest.isLoaded()).be.true();

      // If we are here, the Contest is correctly loaded. Now let's load all
      // Task and TaskRevision objects related to the current Contest object.
      _.each(routeContest.tasks, (taskData) => {
        const taskId = taskData.taskId;
        const taskRevisionId = taskData.taskRevisionId;

        self.data.subscriptionStatus.set(taskId.valueOf(), false);
        self.subscribe('TaskById', taskId, {onReady: () => {
          self.data.subscriptionStatus.set(taskId.valueOf(), true);
        }});

        self.data.subscriptionStatus.set(taskRevisionId.valueOf(), false);
        self.subscribe('TaskRevisionById', taskRevisionId, {onReady: () => {
          self.data.subscriptionStatus.set(taskRevisionId.valueOf(), true);
        }});
      });

      // Mark the contest subscription as ready after all other subscription
      // are queued. This avoids a possible race condition with isLoaded helper.
      self.data.subscriptionStatus.set('contestByCodename', true);
    }
  });
});

/**
 * Checks if all the subscriptions (including the dynamic ones) are ready.
 *
 * @private (do not export)
 * @return {Boolean}
 */
const _isLoaded = function() {
  const subscriptionStatus = this.subscriptionStatus.all();
  return _.every(subscriptionStatus);
};

Template.contestPageLayout.helpers({
  isLoaded: function() {
    return _isLoaded.apply(this);
  },

  /**
   * Returns true if everything is fine and we managed to retrieve all objects
   * and validate the models.
   *
   * @return {Boolean} True if ok, false otherwise.
   */
  validateObjects: function() {
    return validateContestObjects.apply(this);
  },
});
