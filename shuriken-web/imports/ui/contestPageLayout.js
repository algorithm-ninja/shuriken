'use strict';

// APIs and collections
import {ContestTasks} from '../api/contestTasks.js';
import {TaskRevisions} from '../api/taskRevisions.js';
// Libs.
import {getRouteContest, isValidContestRoute}
    from '../lib/routeContestUtils.js';
// Requires.
const _ = require('lodash');
const should = require('should');
// UI fragments
import './contestPageLayout.html';
import './contestSidebar.js';

class DynamicSubscription {
  constructor(func) {
    this._func = func;
    this._activeSubscriptions = {};
    this._subscriptionBuffer = {};

    this._firstTime = true;
  }

  subscribe(name, args) {
    const key = _.join([name, args], '__');
    if (_.has(this._subscriptionBuffer, key)) {
      console.warn(`Ignoring multiple subscriptions to ${key}`);
    } else {
      if (!_.has(this._activeSubscriptions, key)) {
        this._subscriptionBuffer[key] = Meteor.subscribe(name, args);
      } else {
        console.info(`Ignoring already existing subscription ${key}`);
        this._subscriptionBuffer[key] = null;
      }
    }
  }

  _flushSubscriptions() {
    _.each(this._activeSubscriptions, (sub, key) => {
      if (!_.has(this._subscriptionBuffer, key)) {
        console.info(`Removing subscription ${key}`);
        sub.stop();
        _.unset(this._activeSubscriptions, key);
      }
    });

    _.each(this._subscriptionBuffer, (sub, key) => {
      if (!_.has(this._activeSubscriptions, key)) {
        should(sub).be.not.null();
        console.info(`New subscription ${key}`);
        this._activeSubscriptions[key] = sub;
      }
    });

    this._subscriptionBuffer = {};
    this._firstTime = false;
  }

  run(args) {
    Tracker.nonreactive(() => {
      this._func.apply(this, arguments);
      this._flushSubscriptions();
    });
  }

  ready() {
    return !this._firstTime && _.every(this._activeSubscriptions, (sub) => {
      return sub.ready();
    });
  }
}

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

  this.contestSub = new DynamicSubscription(function(codename) {
    this.subscribe('ContestByCodename', codename);
  });

  this.contestTasksSub = new DynamicSubscription(function(contestId) {
    this.subscribe('ContestTasksByContestId', contestId);
  });

  this.taskRevisionsSub = new DynamicSubscription(function(taskRevionsIds) {
    _.each(taskRevionsIds, (taskRevisionId) => {
      this.subscribe('TaskRevisionById', taskRevisionId);
    });
  });

  this.tasksSub = new DynamicSubscription(function(taskIds) {
    _.each(taskIds, (taskId) => {
      this.subscribe('TaskById', taskId);
    });
  });

  this.autorun(function() {
    const context = Template.currentData();
    self.contestSub.run(context.routeContestCodename);

    const contest = getRouteContest(context);
    if (_.isNil(contest) || !contest.isLoaded()) {
      return;
    }

    const contestId = contest._id;
    self.contestTasksSub.run(contestId);

    const contestTasks = ContestTasks.find({contestId: contestId}).fetch();

    const taskRevisionIds = _.map(contestTasks, (contestTask) => {
      return contestTask.taskRevisionId;
    });
    self.taskRevisionsSub.run(taskRevisionIds);

    const taskIds = _.map(taskRevisionIds, (taskRevisionId) => {
      const taskRevision = TaskRevisions.findOne({_id: taskRevisionId});
      if (_.isNil(taskRevision) || !taskRevision.isLoaded()) {
        return undefined;
      } else {
        return taskRevision.taskId;
      }
    });
    self.tasksSub.run(_.compact(taskIds));
  });
});

/**
 * Checks if all the subscriptions (including the dynamic ones) are ready.
 *
 * @private (do not export)
 * @return {Boolean}
 */
const _isLoaded = function() {
  return this.contestSub.ready() &&
         this.contestTasksSub.ready() &&
         this.taskRevisionsSub.ready() &&
         this.tasksSub.ready();
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
  isValidContestRoute: function() {
    // Warning: we have to check that _isLoaded is true, otherwise we may
    //     trigger unwanted errors. If the revision of a task changes suddenly,
    //     for example, validateObjects may be called before isLoaded, leading
    //     to errors.
    if (_isLoaded.apply(Template.instance())) {
      return isValidContestRoute(this);
    } else {
      return false;
    }
  },
});
