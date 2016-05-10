'use strict';

// const http = require('http');
const WebSocket = require('ws');
const _ = require('lodash');
const DDP = require('ddp.js').default;
const should = require('should/as-function');

class DynamicSubscription {
  constructor(func, sub, unsub, isReady) {
    this._func = func;
    this._sub = sub;
    this._unsub = unsub;
    this._isReady = isReady;
    this._activeSubscriptions = {};
    this._subscriptionBuffer = {};

    this._firstTime = true;
  }

  subscribe(name, args) {
    const key = _.join([name, JSON.stringify(args)], '__');
    if (_.has(this._subscriptionBuffer, key)) {
      console.warn(`Ignoring multiple subscriptions to ${key}`);
    } else {
      if (!_.has(this._activeSubscriptions, key)) {
        //console.info(`New subscription ${key}`);
        this._subscriptionBuffer[key] = this._sub(name, args);
      } else {
        // console.info(`Ignoring already existing subscription ${key}`);
        this._subscriptionBuffer[key] = null;
      }
    }
  }

  _flushSubscriptions() {
    _.each(this._activeSubscriptions, (sub, key) => {
      if (!_.has(this._subscriptionBuffer, key)) {
        //console.info(`Removing subscription ${key}`);
        this._unsub(sub);
        _.unset(this._activeSubscriptions, key);
      }
    });

    _.each(this._subscriptionBuffer, (sub, key) => {
      if (!_.has(this._activeSubscriptions, key)) {
        should(sub).be.not.null();
        this._activeSubscriptions[key] = sub;
      }
    });

    this._subscriptionBuffer = {};
    this._firstTime = false;
  }

  run(args) {
    this._func.apply(this, arguments);
    this._flushSubscriptions();
  }

  ready() {
    return !this._firstTime && _.every(this._activeSubscriptions, (sub) => {
      return this._isReady(sub);
    });
  }
}

class DataStore {
  constructor() {
    this._data = {};
  }

  add(collection, objectId, fields) {
    console.log(`New object in ${collection}, id ${objectId}`);
    if (!_.has(this._data, collection)) {
      this._data[collection] = {};
    }
    should(this._data[collection]).not.have.property(objectId);
    should(fields).not.have.property('_id');
    fields = _.mapValues(fields, (value) => {
      if (!_.has(value, '$type') || value['$type'] !== 'oid') {
        return value;
      } else {
        return value['$value'];
      }
    });
    fields._id = objectId;
    this._data[collection][objectId] = fields;
  }

  remove(collection, objectId) {
    console.log(`Deletion in ${collection}, id ${objectId}`);
    should(this._data).have.property(collection);
    should(this._data[collection]).have.property(objectId);
    this._data[collection] = _.omit(this._data[collection], objectId);
  }

  change(collection, objectId, fields, cleared) {
    console.log(`Change in ${collection}, id ${objectId}`);
    should(this._data).have.property(collection);
    should(this._data[collection]).have.property(objectId);

    fields = _.mapValues(fields, (value) => {
      if (!_.has(value, '$type') || value['$type'] !== 'oid') {
        return value;
      } else {
        return value['$value'];
      }
    });
    this._data[collection][objectId] = _.omit(
      _.assign(this._data[collection][objectId], fields), cleared);
  }

  findOne(collection, key, value) {
    if (!_.has(this._data, collection)) {
      return undefined;
    }

    if (_.isNil(key)) {
      return _.find(this._data[collection], true);
    } else if (key === '_id') {
      return _.get(this._data[collection], value, undefined);
    } else {
      return _.find(this._data[collection], (fields) => {
        return (_.get(fields, key, undefined) == value);
      });
    }
  }

  findAll(collection, key, value) {
    if (!_.has(this._data, collection)) {
      return undefined;
    }

    if (_.isNil(key)) {
      return _.map(this._data[collection], (obj) => {return obj;});
    } else if (key === '_id') {
      return _.get(this._data[collection], value, undefined);
    } else {
      return _.filter(this._data[collection], (fields) => {
        return (_.get(fields, key, undefined) == value);
      });
    }
  }
}

class rwsConnector {
  constructor(contestCodename, shurikenAddress, rwsAddress) {
    this._contestCodename = contestCodename;
    this._shurikenAddress = shurikenAddress;
    this._rwsAddress = rwsAddress;
    this._store = new DataStore();
    this._submissionStatus = {};
    this._throttledUpdateScoreboard =
        _.throttle(this._updateScoreboard, 250, {trailing: true});

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
      })
    })

    this._ddp.on('added', message => {
      const collection = message.collection;
      const objectId = message.id;
      const fields = message.fields;

      this._store.add(collection, objectId, fields);
      this._updateSubscriptions(collection);
      this._throttledUpdateScoreboard();
    });

    this._ddp.on('changed', message => {
      const collection = message.collection;
      const objectId = message.id;
      const fields = message.fields;
      const cleared = message.cleared;

      this._store.change(collection, objectId, fields, cleared);
      this._updateSubscriptions(collection);
      this._throttledUpdateScoreboard();
    });

    this._ddp.on('removed', message => {
      const collection = message.collection;
      const objectId = message.id;

      this._store.remove(collection, objectId);
      this._updateSubscriptions(collection);
      this._throttledUpdateScoreboard();
    });

    this._ddp.on('connected', () => {
      console.log('DDP connected.');
      this._updateSubscriptions();
    });

    this._ddp.on('disconnected', () => {
      console.log('DDP disconnected.');
    });

    const subscribe = (name, params) => {
      const paramsArray = _.castArray(params);
      const subId = this._ddp.sub(name, paramsArray);
      console.log(`New subscription to ${name} (ID: ${subId})`);
      should(this._submissionStatus).not.have.property(subId);
      // Set as not ready
      this._submissionStatus[subId] = false;
      return subId;
    };

    const unsubscribe = (subId) => {
      console.log(`Delete subscription ID ${subId}`);
      should(this._submissionStatus).have.property(subId);
      this._submissionStatus = _.omit(this._submissionStatus, subId);
      this._ddp.unsub(subId);
    };

    const isReady = (subId) => {
      return this._submissionStatus[subId];
    }

    this._usersSub = new DynamicSubscription(function() {
      this.subscribe('Users', []);
    }, subscribe, unsubscribe);

    this._contestSub = new DynamicSubscription(function(codename) {
      this.subscribe('ContestByCodename', codename);
    }, subscribe, unsubscribe);

    this._contestTasksSub = new DynamicSubscription(function(contestId) {
      contestId = {'$type': 'oid', '$value': contestId};
      this.subscribe('ContestTasksByContestId', contestId);
    }, subscribe, unsubscribe);

    this._taskRevisionsSub = new DynamicSubscription(function(taskRevionsIds) {
      _.each(taskRevionsIds, (taskRevisionId) => {
        taskRevisionId = {'$type': 'oid', '$value': taskRevisionId};
        this.subscribe('TaskRevisionById', taskRevisionId);
      });
    }, subscribe, unsubscribe);

    this._tasksSub = new DynamicSubscription(function(taskIds) {
      _.each(taskIds, (taskId) => {
        taskId = {'$type': 'oid', '$value': taskId};
        this.subscribe('TaskById', taskId);
      });
    }, subscribe, unsubscribe);

    this._submissionsSub = new DynamicSubscription(function(contestId) {
      contestId = {'$type': 'oid', '$value': contestId};
      this.subscribe('SubmissionsForContestId', contestId);
    }, subscribe, unsubscribe);

    this._evaluationsSub = new DynamicSubscription(function(taskRevisionIds) {
      _.each(taskRevisionIds, (taskRevisionId) => {
        taskRevisionId = {'$type': 'oid', '$value': taskRevisionId};
        this.subscribe('LiveEvaluationsForTaskRevisionId', taskRevisionId);
      });
    }, subscribe, unsubscribe);
  }

  _updateSubscriptions() {
    this._usersSub.run();
    this._contestSub.run(this._contestCodename);

    const contest = this._store
        .findOne('contests', 'codename', this._contestCodename);
    if (_.isNil(contest)) {
      return;
    }

    const contestId = contest._id;
    this._contestTasksSub.run(contestId);
    this._submissionsSub.run(contestId);

    const contestTasks = this._store
        .findAll('contestTasks', 'contestId', contestId);

    const taskRevisionIds = _.map(contestTasks, (contestTask) => {
      return contestTask.taskRevisionId;
    });
    this._taskRevisionsSub.run(taskRevisionIds);
    this._evaluationsSub.run(taskRevisionIds);

    const taskIds = _.map(taskRevisionIds, (taskRevisionId) => {
      const taskRevision = this._store
          .findOne('taskRevisions', '_id', taskRevisionId);
      if (_.isNil(taskRevision)) {
        return undefined;
      } else {
        return taskRevision.taskId;
      }
    });
    this._tasksSub.run(_.filter(taskIds));
  }

  _isDataReady() {
    return this._usersSub.ready() &&
           this._contestSub.ready() &&
           this._contestTasksSub.ready() &&
           this._taskRevisionsSub.ready() &&
           this._tasksSub.ready() &&
           this._submissionsSub.ready() &&
           this._evaluationsSub.ready();
  }

  _updateScoreboard() {
    if (!_.isDataReady) {
      console.warn('Could not update scoreboard: data is not ready');
    }

    // Map user -> taskCodename -> score
    const users = this._store.findAll('users');
    const contest = this._store.findOne(
        'contests', 'codename', this._contestCodename);
    if (_.isNil(contest)) {
      console.warn('Could not update scoreboard: contest is not ready');
      return;
    }
    const contestId = contest._id;
    const contestTasks = this._store.findAll(
        'contestTasks', 'contestId', contestId);
    const taskRevisionIds = _.map(contestTasks, (contestTask) => {
      return contestTask.taskRevisionId;
    });

    const taskRevisionIdToTaskCodename = {}
    _.each(taskRevisionIds, (taskRevisionId) => {
      const taskRevision = this._store.findOne(
          'taskRevisions', '_id', taskRevisionId);
      if (!_.isNil(taskRevision)) {
        const taskId = taskRevision.taskId;
        const task = this._store.findOne('tasks', '_id', taskId);

        if (!_.isNil(task)) {
          taskRevisionIdToTaskCodename[taskRevisionId] = task._id;
        } else {
          taskRevisionIdToTaskCodename[taskRevisionId] = undefined;
        }
      } else {
        taskRevisionIdToTaskCodename[taskRevisionId] = undefined;
      }
    });


    if (!_.every(taskRevisionIdToTaskCodename)) {
      console.warn('Could not update scoreboard: not all task codenames are ' +
          'available');
      return;
    }

    let scoreboard = {};
    _.each(users, (user) => {
      scoreboard[user.username] = {};
      _.each(taskRevisionIdToTaskCodename, (taskCodename) => {
        scoreboard[user.username][taskCodename] = 0;
      });
    });

    _.each(taskRevisionIdToTaskCodename, (taskCodename, taskRevisionId) => {
      const evaluations = this._store.findAll(
          'evaluations', 'taskRevisionId', taskRevisionId);
      console.log(JSON.stringify(evaluations, null, 2));
      _.each(evaluations, (evaluation) => {
        const submissionId = evaluation.submissionId;
        const isLive = evaluation.isLive;
        const kueState = evaluation.kueState;
        if (isLive && kueState === 'complete') {
          const score = evaluation.kueResult.score;
          const submission = this._store.findOne(
              'submissions', '_id', submissionId);
          if (!_.isNil(submission)) {
            const userId = submission.userId;
            const user = this._store.findOne('users', '_id', userId);
            if (!_.isNil(user)) {
              scoreboard[user.username][taskCodename] = Math.max(
                  scoreboard[user.username][taskCodename], score);
            } else {
              console.warn(`Warning: user Id ${userId} not loaded`);
            }
          } else {
            console.warn(`Warning: submission Id ${submissionId} not loaded`);
          }
        }
      })
    });

    console.log('Scoreboard updated!');
    console.log(JSON.stringify(scoreboard));
  }
}

// If this is being called from a shell, listen to the queue.
if (!module.parent) {
  const program = require('commander');

  program
    .version('0.0.1')
    .option('--shuriken [address]', 'Address to shuriken-web',
            'ws://localhost:3000/websocket')
    .option('--rws [address]', 'Address to rws', 'http://localhost:8890')
    .option('--contest [codename]', 'Contest codename')
    .parse(process.argv);

  const shurikenAddress = program.shuriken;
  const rwsAddress = program.rws;
  const contestCodename = program.contest;

  if (!_.isString(contestCodename)) {
    throw new Error('Use --contest');
  }

  new rwsConnector(contestCodename, shurikenAddress, rwsAddress);
}
