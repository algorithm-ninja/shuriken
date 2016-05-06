'use strict';

// Libs.
import {ReactiveMap} from '../lib/reactiveMap';
import {getRouteContestCodename, getRouteContest, validateContestObjects}
    from '../lib/routeContestUtils.js';
// Requires.
const _ = require('lodash');
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

  this.routeContestCodename = new ReactiveVar(null);
  this.contestSubscriptionHandle = new ReactiveVar(null);
  this.subscriptionStatus = new ReactiveMap();

  // Every time Template.currentData() changes, update routeContestCodename.
  this.autorun(function() {
    self.routeContestCodename.set(getRouteContestCodename(
        Template.currentData()));
  });

  // Every time the routeContestCodename changes, stop all subscriptions and
  // subscribe to the right objects.
  this.autorun(function() {
    console.log('Starting dynamic subscription to contest objects.');

    if (!_.isNull(self.routeContestCodename.get())) {
      Tracker.nonreactive(_unsubscribeFromContestData.bind(self));
      Tracker.nonreactive(_subscribeToContestData.bind(self));
    }
  });
});

/**
 * Subscribes to all objects relevant to the given contest codename.
 *
 * Warning: run this nonreactively.
 *
 * @private (do not export)
 */
const _subscribeToContestData = function() {
  let self = this;

  const subscribeToTasksAndRevisions = function() {
    const routeContest = getRouteContest(self.data);

    if (routeContest) {
      // If we are here, the Contest is correctly loaded. Now let's load all
      // Task and TaskRevision objects related to the current Contest object.
      _.each(routeContest.tasks, (taskData) => {
        const taskId = taskData.taskId;
        const taskRevisionId = taskData.taskRevisionId;

        self.subscriptionStatus.set(taskId.valueOf(),
            self.subscribe('TaskById', taskId));
        console.log('Subscription to task id ' + taskId);

        self.subscriptionStatus.set(taskRevisionId.valueOf(),
            self.subscribe('TaskRevisionById', taskRevisionId));
        console.log('Subscription to task revision id ' + taskRevisionId);
      });
    }
  };

  this.contestSubscriptionHandle.set(this.subscribe('ContestByCodename',
      this.routeContestCodename.get(),
      {onReady: subscribeToTasksAndRevisions}));
};
/**
 * Unsubscribes from the contest collection and from all related tasks and
 * task revisions.
 *
 * Warning: run this nonreactively.
 *
 * @private (do not export)
 */
const _unsubscribeFromContestData = function() {
  if (!_.isNull(this.contestSubscriptionHandle.get())) {
    console.log('Unsubscribing from contest');
    this.contestSubscriptionHandle.get().stop();
  }

  if (!_.isNull(this.subscriptionStatus.get())) {
    _.each(this.subscriptionStatus.all(), (subscriptionHandle, key) => {
      console.log('Unsubscribing from object id ' + key);
      subscriptionHandle.stop();
    });
  }
};

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
    return validateContestObjects(this);
  },
});
