const _ = require('lodash');
const should = require('should');
const DynamicSubscriptionManager = require('./dynamicSubscriptionManager.js');

module.exports = class ShurikenData {
  /**
   * @param {!DataStore} dataStore
   * @param {!DdpWrapper} ddp
   */
  constructor(ddp, dataStore) {
    this._dataStore = dataStore;
    this._ddp = ddp;
    this._dynamicSubscriptionManager = new DynamicSubscriptionManager(ddp);
    this._subscribers = [];

    // Used for transparent chaining.
    this.need = this;
  }

  /**
   * All users registered.
   */
  allUsers() {
    this._registerDynamicSubscription(function() {
      this._subscribe('Users', []);
    });
  }

  /**
   * Contest given its codename.
   *
   * @param {String} constestCodename
   */
  contest(contestCodename) {
    should(contestCodename).be.String();

    this._registerDynamicSubscription(function() {
      this._subscribe('ContestByCodename', contestCodename);
    });
  }

  /**
   * All Tasks in the given contest.
   *
   * @param {String} constestCodename
   */
  allContestTasksAndRevisions(contestCodename) {
    should(contestCodename).be.String();

    this.need.contest(contestCodename);

    this._registerDynamicSubscription(function() {
      const contest = this._dataStore
          .findOne('contests', 'codename', contestCodename);


      // If the Contest object is not ready yet, return.
      if (_.isNil(contest)) {
        return;
      }

      this._subscribe('ContestTasksByContestId', contest._id);
      const contestTasks = this._dataStore
          .findAll('contestTasks', 'contestId', contest._id);
      const taskRevisionIds = _.map(contestTasks, (contestTask) => {
        return contestTask.taskRevisionId;
      });

      _.each(taskRevisionIds, (taskRevisionId) => {
        this._subscribe('TaskRevisionById', taskRevisionId);
      });
      _.each(taskRevisionIds, (taskRevisionId) => {
        const taskRevision = this._dataStore
            .findOne('taskRevisions', '_id', taskRevisionId);

        // If the taskRevision object is not ready yet, return.
        if (_.isNil(taskRevision)) {
          return undefined;
        } else {
          this._subscribe('TaskById', taskRevision.taskId);
        }
      });
    });
  }

  /**
   * All Submissions in the given contest.
   *
   * @param {String} contestCodename
   */
  allContestSubmissions(contestCodename) {
    should(contestCodename).be.String();

    this.need.contest(contestCodename);

    this._registerDynamicSubscription(function() {
      const contest = this._dataStore
          .findOne('contests', 'codename', contestCodename);

      // If the Contest object is not ready yet, return.
      if (_.isNil(contest)) {
        return;
      }
      this._subscribe('SubmissionsForContestId', contest._id);
    });
  }

  /**
   * All Submissions and live Evaluations in the given contest.
   *
   * @param {String} contestCodename
   */
  allContestSubmissionsAndLiveEvaluations(contestCodename) {
    should(contestCodename).be.String();

    this.need.contest(contestCodename);
    this.need.allContestSubmissions(contestCodename);
    this.need.allContestTasksAndRevisions(contestCodename);

    this._registerDynamicSubscription(function() {
      const contest = this._dataStore
          .findOne('contests', 'codename', contestCodename);

      // If the Contest object is not ready yet, return.
      if (_.isNil(contest)) {
        return;
      }

      const contestTasks = this._dataStore
          .findAll('contestTasks', 'contestId', contest._id);
      const taskRevisionIds = _.map(contestTasks, (contestTask) => {
        return contestTask.taskRevisionId;
      });

      _.each(taskRevisionIds, (taskRevisionId) => {
        this._subscribe('LiveEvaluationsForTaskRevisionId', taskRevisionId);
      });
    });
  }

  updateSubscriptions() {
    this._dynamicSubscriptionManager.start();
    _.each(this._subscribers, (subscriber) => {
      subscriber.apply(this);
    });
    this._dynamicSubscriptionManager.flushSubscriptions();
  }

  allSubscriptionsReady() {
    return this._dynamicSubscriptionManager.allSubscriptionsReady();
  }

  autorun() {
    this._ddp.on('loggedIn', () => {this._maybeUpdateSubscriptions();});
    this._ddp.on('documentAdded', () => {this._maybeUpdateSubscriptions();});
    this._ddp.on('documentChanged', () => {this._maybeUpdateSubscriptions();});
    this._ddp.on('documentRemoved', () => {this._maybeUpdateSubscriptions();});
  }

  _maybeUpdateSubscriptions() {
    if (this._ddp.isLoggedIn()) {
      this.updateSubscriptions();
    }
  }

  _registerDynamicSubscription(callback) {
    this._subscribers.push(callback);
  }

  _subscribe(name, args) {
    this._dynamicSubscriptionManager.subscribe(name, args);
  }
};
