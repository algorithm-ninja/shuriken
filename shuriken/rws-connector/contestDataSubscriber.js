const _ = require('lodash');
const should = require('should');
const WebSocket = require('ws');
const DDP = require('ddp.js').default;

const DynamicSubscription = require('./dynamicSubscription.js');
const DataStore = require('./dataStore.js');

module.exports = class ContestDataSubscriber {
  constructor(contestCodename, shurikenAddress, func) {
    this._contestCodename = contestCodename;
    this._shurikenAddress = shurikenAddress;
    this._dataStore = new DataStore();
    this._submissionStatus = {};
    this._func = func;

    //IDEA Check if rws is reachable.
    const ddpOptions = {
        endpoint: this._shurikenAddress,
        SocketConstructor: WebSocket,
    };
    this._ddp = new DDP(ddpOptions);

    this._ddp.on('ready', message => {
      const subs = message.subs;
      _.each(subs, (subId) => {
        should(this._submissionStatus).have.property(subId);
        this._submissionStatus[subId] = true;
      });
      this._onChange();
    });

    this._ddp.on('added', message => {
      const collection = message.collection;
      const objectId = message.id;
      const fields = message.fields;

      this._dataStore.add(collection, objectId, fields);
      this._updateSubscriptions(collection);
      this._onChange();
    });

    this._ddp.on('changed', message => {
      const collection = message.collection;
      const objectId = message.id;
      const fields = message.fields;
      const cleared = message.cleared;

      this._dataStore.change(collection, objectId, fields, cleared);
      this._updateSubscriptions(collection);
      this._onChange();
    });

    this._ddp.on('removed', message => {
      const collection = message.collection;
      const objectId = message.id;

      this._dataStore.remove(collection, objectId);
      this._updateSubscriptions(collection);
      this._onChange();
    });

    this._ddp.on('connected', () => {
      console.log('[ DDP ] DDP connected.');
      this._resetAllSubscriptions();
      this._updateSubscriptions();

      console.log(`[ DDP ] Logging in`);
      const loginParameters = {
          user: {username: 'contest-observer'},
          password: 'secret'
      };
      this._ddp.method('login', [loginParameters]);
    });

    this._ddp.on('result', message => {
      const id = message.id;
      const error = message.error;
      const result = message.result;

      if (!error) {
        console.log(`[ DDP ] Logged in!`);
      }
    });

    this._ddp.on('disconnected', () => {
      console.log('[ DDP ] DDP disconnected.');
    });

    this._ddp.on('nosub', message => {
      const id = message.id;
      const error = message.error;

      console.log(`[  E  ] Subscription ID ${id} failed:`);
      console.log(JSON.stringify(error, null, 2));
    });

    const subscribe = (name, params) => {
      const paramsArray = _.castArray(params);
      const subId = this._ddp.sub(name, paramsArray);
      console.log(`[ SUB ] New subscription to ${name} (ID: ${subId})`);
      should(this._submissionStatus).not.have.property(subId);
      // Set as not ready.
      this._submissionStatus[subId] = false;
      return subId;
    };

    const unsubscribe = (subId) => {
      console.log(`[UNSUB] Delete subscription ID ${subId}`);
      should(this._submissionStatus).have.property(subId);
      this._submissionStatus = _.omit(this._submissionStatus, subId);
      this._ddp.unsub(subId);
    };

    const isReady = (subId) => {
      return this._submissionStatus[subId];
    };

    this._usersSub = new DynamicSubscription(function() {
      this.subscribe('Users', []);
    }, subscribe, unsubscribe, isReady);

    this._contestSub = new DynamicSubscription(function(codename) {
      this.subscribe('ContestByCodename', codename);
    }, subscribe, unsubscribe, isReady);

    this._contestTasksSub = new DynamicSubscription(function(contestId) {
      contestId = {'$type': 'oid', '$value': contestId};
      this.subscribe('ContestTasksByContestId', contestId);
    }, subscribe, unsubscribe, isReady);

    this._taskRevisionsSub = new DynamicSubscription(function(taskRevionsIds) {
      _.each(taskRevionsIds, (taskRevisionId) => {
        taskRevisionId = {'$type': 'oid', '$value': taskRevisionId};
        this.subscribe('TaskRevisionById', taskRevisionId);
      });
    }, subscribe, unsubscribe, isReady);

    this._tasksSub = new DynamicSubscription(function(taskIds) {
      _.each(taskIds, (taskId) => {
        taskId = {'$type': 'oid', '$value': taskId};
        this.subscribe('TaskById', taskId);
      });
    }, subscribe, unsubscribe, isReady);

    this._submissionsSub = new DynamicSubscription(function(contestId) {
      contestId = {'$type': 'oid', '$value': contestId};
      this.subscribe('SubmissionsForContestId', contestId);
    }, subscribe, unsubscribe, isReady);

    this._evaluationsSub = new DynamicSubscription(function(taskRevisionIds) {
      _.each(taskRevisionIds, (taskRevisionId) => {
        taskRevisionId = {'$type': 'oid', '$value': taskRevisionId};
        this.subscribe('LiveEvaluationsForTaskRevisionId', taskRevisionId);
      });
    }, subscribe, unsubscribe, isReady);
  }

  _resetAllSubscriptions() {
    this._usersSub.reset();
    this._contestSub.reset();
    this._contestTasksSub.reset();
    this._taskRevisionsSub.reset();
    this._tasksSub.reset();
    this._submissionsSub.reset();
    this._evaluationsSub.reset();
  }

  _updateSubscriptions() {
    this._usersSub.run();
    this._contestSub.run(this._contestCodename);

    const contest = this._dataStore
        .findOne('contests', 'codename', this._contestCodename);
    if (_.isNil(contest)) {
      return;
    }

    const contestId = contest._id;
    this._contestTasksSub.run(contestId);
    this._submissionsSub.run(contestId);

    const contestTasks = this._dataStore
        .findAll('contestTasks', 'contestId', contestId);

    const taskRevisionIds = _.map(contestTasks, (contestTask) => {
      return contestTask.taskRevisionId;
    });
    this._taskRevisionsSub.run(taskRevisionIds);
    this._evaluationsSub.run(taskRevisionIds);

    const taskIds = _.map(taskRevisionIds, (taskRevisionId) => {
      const taskRevision = this._dataStore
          .findOne('taskRevisions', '_id', taskRevisionId);
      if (_.isNil(taskRevision)) {
        return undefined;
      } else {
        return taskRevision.taskId;
      }
    });
    this._tasksSub.run(_.filter(taskIds));
  }

  dataStore() {
    return this._dataStore;
  }

  ready() {
    return this._usersSub.ready() &&
           this._contestSub.ready() &&
           this._contestTasksSub.ready() &&
           this._taskRevisionsSub.ready() &&
           this._tasksSub.ready() &&
           this._submissionsSub.ready() &&
           this._evaluationsSub.ready();
  }

  _onChange() {
    this._func.apply(this);
  }
};
