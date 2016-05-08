'use strict';

// Libs.
import {ReactiveMap} from '../lib/reactiveMap';
import {getRouteContestCodename, getRouteContest, validateContestObjects}
    from '../lib/routeContestUtils.js';
// Requires.
const _ = require('lodash');
const should = require('should');
// UI fragments
import './contestPageLayout.html';
import './contestSidebar.js';

/**
 * Main entry point for all contest-related pages.
 *
 * #### Context
 *
 * - routeContestCodename
 * @todo complete section.
 *
 * #### Subscription contract
 *
 * @todo complete section.
 */
Template.contestPageLayout.onCreated(function() {
  let self = this;

  // Note: non-reactive variable.
  this.lastRouteContestCodename = null;
  // Note: reactive variables.
  this.contestSubscriptionHandle = new ReactiveVar(null);
  this.subscriptionStatus = new ReactiveMap();

  // Every time the route contest changes, stop the previous subscription
  // to the Contest object (if any), and subscribe to the updated object.
  this.autorun(function() {
    const routeContestCodename = getRouteContestCodename(
        Template.currentData());

    if (_.isNull(self.lastRouteContestCodename) ||
        (routeContestCodename !== self.lastRouteContestCodename)) {
      Tracker.nonreactive(function() {
        self.lastRouteContestCodename = routeContestCodename;

        if (!_.isNull(self.contestSubscriptionHandle.get())) {
          console.log('Stopping old subscription to ContestByCodename');
          self.contestSubscriptionHandle.get().stop();
        }
        console.log(
            `New subscription to ContestByCodename(${routeContestCodename})`);
        self.contestSubscriptionHandle.set(self.subscribe('ContestByCodename',
            routeContestCodename));
      });
    }
  });

  // Every time the Contest object changes, subscribe to the updated Task and
  // TaskRevision objects.
  this.autorun(function() {
    const routeContestCodename = Tracker.nonreactive(
        () => {return getRouteContestCodename(Template.currentData());});
    should(routeContestCodename)
        .equal(self.lastRouteContestCodename)
        .and.be.not.null();

    Tracker.nonreactive(function() {
      //FIXME Make this a little smarter, so that we don't renew all
      //      submissions every time. For example, if only one of the tasks
      //      changes, there is little point in stopping all other
      //      subscriptions.
      console.log(`Stopping dynamic subscription to contest objects ` +
          `(${self.subscriptionStatus.size()} objects).`);

      _.each(self.subscriptionStatus.all(), (subscriptionHandle, key) => {
        console.log(`Unsubscribing from object id ${key}`);
        subscriptionHandle.stop();
      });

      self.subscriptionStatus.clear();
    });

    // This subscribes to all changes in the Contest object.
    const routeContest = getRouteContest(self.data);
    if (routeContest) {
      console.log('Starting dynamic subscription to contest objects.');

      // If we are here, the Contest is correctly loaded. Now let's load all
      // Task and TaskRevision objects related to the current Contest object.
      _.each(routeContest.tasks, (taskData) => {
        const taskId = taskData.taskId;
        const taskRevisionId = taskData.taskRevisionId;

        self.subscriptionStatus.set(taskId.valueOf(),
            self.subscribe('TaskById', taskId));
        console.log(`Subscription to task id ${taskId}`);

        self.subscriptionStatus.set(taskRevisionId.valueOf(),
            self.subscribe('TaskRevisionById', taskRevisionId));
        console.log(`Subscription to task revision id ${taskRevisionId}`);
      });
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
  const contestSubscriptionHandle = this.contestSubscriptionHandle.get();
  const subscriptionStatus = this.subscriptionStatus.all();

  if (_.isNull(contestSubscriptionHandle) ||
      !contestSubscriptionHandle.ready()) {
    return false;
  }
  return _.every(subscriptionStatus, (subscriptionHandle) => {
    return subscriptionHandle.ready();
  });
};

Template.contestPageLayout.helpers({
  isLoaded: function() {
    return _isLoaded.apply(Template.instance());
  },

  /**
   * Returns true if everything is fine and we managed to retrieve all objects
   * and validate the models.
   *
   * @return {Boolean} True if ok, false otherwise.
   */
  validateObjects: function() {
    // Warning: we have to check that _isLoaded is true, otherwise we may
    //     trigger unwanted errors. If the revision of a task changes suddenly,
    //     for example, validateObjects may be called before isLoaded, leading
    //     to errors.
    if (_isLoaded.apply(Template.instance())) {
      return validateContestObjects(this);
    } else {
      return false;
    }
  },
});
