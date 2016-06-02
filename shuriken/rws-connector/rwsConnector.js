'use strict';

const _ = require('lodash');
const http = require('http');
const indentString = require('indent-string');
const Queue = require('queue');
const should = require('should/as-function');
const url = require('url');
const WebSocket = require('ws');

const DataStore = require('./dataStore.js');
const ShurikenData = require('./shurikenData.js');
const DdpWrapper = require('./ddpWrapper.js');

class RwsConnector {
  constructor(contestCodename, shurikenEndpoint, rwsAddress) {
    this._contestCodename = contestCodename;
    this._shurikenEndpoint = shurikenEndpoint;
    this._rwsAddress = rwsAddress;
    this._throttledOnDataChange =
        _.throttle(this._onDataChange, 250, {trailing: true});

    this._dataStore = new DataStore();
    const ddpOptions = {
        endpoint: this._shurikenEndpoint,
        SocketConstructor: WebSocket,
    };
    this._ddp = new DdpWrapper(ddpOptions, this._dataStore);
    this._ddp.setUser('contest-observer', 'secret');
    this._shurikenData = new ShurikenData(this._ddp, this._dataStore);

    this._requestQueue = new Queue();
    this._requestQueue.concurrency = 1;

    this._lastScoreboard = {};
    this._sendContest();

    this._shurikenData.need.allUsers();
    this._shurikenData.need.allContestTasksAndRevisions(this._contestCodename);
    this._shurikenData.need.allContestSubmissionsAndLiveEvaluations(
        this._contestCodename);
    this._shurikenData.autorun();

    this._ddp.on('documentAdded', () => {this._onDataChange();});
    this._ddp.on('documentChanged', () => {this._onDataChange();});
    this._ddp.on('documentRemoved', () => {this._onDataChange();});
    this._ddp.on('subscriptionReady', () => {this._onDataChange();});
  }

  /**
   * Computes the scoreboard for the given constest. A scoreboard is an Object
   * with the following mapping:
   *
   * username -> taskCodename -> score.
   *
   * @todo Make scoreboard an instance of class on its own.
   * @return {Object}
   */
  _computeScoreboard() {
    const dataStore = this._dataStore;

    // Map user -> taskCodename -> score
    const users = _.filter(dataStore.findAll('users'), function(user) {
      return _.indexOf(user.roles, 'contestant') !== -1;
    });
    const contest = dataStore.findOne(
        'contests', 'codename', this._contestCodename);
    if (_.isNil(contest)) {
      console.warn('[ ### ] Could not update scoreboard: contest is not ready');
      return;
    }
    const contestId = contest._id;
    const contestTasks = dataStore.findAll(
        'contestTasks', 'contestId', contestId);
    const taskRevisionIds = _.map(contestTasks, (contestTask) => {
      return contestTask.taskRevisionId;
    });

    const taskRevisionIdToTaskCodename = {};
    _.each(taskRevisionIds, (taskRevisionId) => {
      const taskRevision = dataStore.findOne(
          'taskRevisions', '_id', taskRevisionId);
      if (!_.isNil(taskRevision)) {
        const taskId = taskRevision.taskId;
        const task = dataStore.findOne('tasks', '_id', taskId);

        if (!_.isNil(task)) {
          taskRevisionIdToTaskCodename[taskRevisionId.$value] = task.codename;
        } else {
          taskRevisionIdToTaskCodename[taskRevisionId.$value] = undefined;
        }
      } else {
        taskRevisionIdToTaskCodename[taskRevisionId.$value] = undefined;
      }
    });

    if (!_.every(taskRevisionIdToTaskCodename)) {
      console.warn('[ ### ] Could not update scoreboard: not all task ' +
          'codenames are available');
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
      const evaluations = dataStore.findAll(
          'evaluations', 'taskRevisionId',
              {$type: 'oid', $value: taskRevisionId});
      _.each(evaluations, (evaluation) => {
        const submissionId = evaluation.submissionId;
        const isLive = evaluation.isLive;
        const kueState = evaluation.kueState;
        if (isLive && kueState === 'complete') {
          const score = evaluation.kueResult.score;
          const submission = dataStore.findOne(
              'submissions', '_id', submissionId);
          if (!_.isNil(submission)) {
            const userId = submission.userId;
            const user = dataStore.findOne('users', '_id', userId);
            if (!_.isNil(user)) {
              scoreboard[user.username][taskCodename] = Math.max(
                  scoreboard[user.username][taskCodename], score);
            } else {
              console.warn(`[ ### ] User Id ${userId} not loaded`);
            }
          } else {
            console.warn(`[ ### ] Submission Id ${submissionId} not loaded`);
          }
        }
      });
    });

    console.log('[=====] Scoreboard computed!');
    return scoreboard;
  }

  /**
   * @todo not here!
   */
  _rwsHost() {
    return url.parse(this._rwsAddress).hostname;
  }

  /**
   * @todo not here!
   */
  _rwsPort() {
    return url.parse(this._rwsAddress).port;
  }

  /**
   * @todo not here!
   */
  _rwsAuth() {
    return 'usern4me:passw0rd';
  }

  _forwardToRws(path, data, finish) {
    should(_.endsWith(path, '/')).be.true();

    const options = {
      host: this._rwsHost(),
      port: this._rwsPort(),
      path: path,
      method: 'PUT',
      auth: this._rwsAuth(),
      headers: {'content-type': 'application/json'},
    };

    const req = http.request(options, function(res) {
      if (res.statusCode >= 400) {
        console.warn(`[#####] Request to RWS failed (path: ${path}, ` +
            `code: ${res.statusCode})`);
        console.warn(`[#####] >> Data: ${JSON.stringify(data, null, 2)}`);
        console.log(
            `[#####] >> Request header: ${JSON.stringify(res.headers)}`);
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          console.log(`[#####] >> Body ${chunk}`);
        });

      } else {
        console.log(`[=====] Succesful request to RWS (path: ${path}, ` +
            `code: ${res.statusCode})`);
      }
      finish();
    });

    req.on('error', function(e) {
      console.error(`[!!!!!] Error while forwarding to RWS (path: ${path}): ` +
          `${e.message}`);
      finish();
    });

    req.end(JSON.stringify(data));
  }

  _enqueueRwsRequest(path, data) {
    const self = this;

    this._requestQueue.push(
      function(finish) {
        self._forwardToRws(path, data, finish);
      });
  }

  _sendContest() {
    const contestData = _.zipObject([this._contestCodename], [{
      name: this._contestCodename,
      begin: 1000000000,
      end: 2000000000,
      'score_precision': 2,
    }]);

    this._enqueueRwsRequest('/contests/', contestData);
  }

  _sendUserList(users) {
    const digestedUsers = _.zipObject(users, _.map(users, (user) => {
      return {
        'f_name': user,
        'l_name': '',
        'team': null,
      };
    }));

    this._enqueueRwsRequest('/users/', digestedUsers);
  }

  _sendTaskCodenames(taskCodenames) {
    const digestedTasks = _.zipObject(
        taskCodenames, _.map(taskCodenames, (taskCodename, index) => {
      return {
        'short_name': taskCodename,
        'name': '',
        'contest': this._contestCodename,
        'order': index,
        'max_score': 100.001,
        'extra_headers': ['x'],
        'score_precision': 2,
        'score_mode': 'max',
      };
    }));

    this._enqueueRwsRequest('/tasks/', digestedTasks);
  }

  _sendScore(username, taskCodename, score) {
    // Step 1. Send in the submission.
    const nowTimestamp = new Date().getTime();
    const submissionId = `${nowTimestamp}${Math.random()}`;

    const submissionData = _.zipObject([submissionId], [{
      user: username,
      task: taskCodename,
      time: nowTimestamp,
    }]);

    const subchangeId = `${nowTimestamp}${Math.random()}`;
    const subchangeData = _.zipObject([subchangeId], [{
      submission: submissionId,
      time: nowTimestamp,
      token: true,
      score: score + 0.001,
    }]);

    this._enqueueRwsRequest('/submissions/', submissionData);
    this._enqueueRwsRequest('/subchanges/', subchangeData);
  }

  _onDataChange() {
    if (!this._shurikenData.allSubscriptionsReady()) {
      return;
    }

    const scoreboard = this._computeScoreboard();
    console.log(indentString(JSON.stringify(scoreboard, null, 2), ' ', 8));
    const lastScoreboard = this._lastScoreboard;

    const users = _.keys(scoreboard);
    const lastUsers = _.keys(lastScoreboard);

    let taskCodenames = [];
    let lastTaskCodenames = [];
    if (_.size(users)) {
      taskCodenames = _.keys(_.find(scoreboard));
    }
    if (_.size(lastUsers)) {
      lastTaskCodenames = _.keys(_.find(lastScoreboard));
    }

    const deltaAddUsers = _.difference(users, lastUsers);
    if (_.size(deltaAddUsers)) {
      console.log(`[=====] ${_.size(deltaAddUsers)} new user added: ` +
          `${JSON.stringify(deltaAddUsers)}`);
    }
    const deltaDelUsers = _.difference(lastUsers, users);
    if (_.size(deltaDelUsers)) {
      console.log(`[=====] ${_.size(deltaDelUsers)} new user added: ` +
          `${JSON.stringify(deltaDelUsers)}`);
    }

    const deltaAddTaskCodenames = _.difference(
        taskCodenames, lastTaskCodenames);
    if (_.size(deltaAddTaskCodenames)) {
      console.log(`[=====] ${_.size(deltaAddTaskCodenames)} new tasks added: ` +
          `${JSON.stringify(deltaAddTaskCodenames)}`);
    }
    const deltaDelTaskCodenames = _.difference(
        lastTaskCodenames, taskCodenames);
    if (_.size(deltaDelTaskCodenames)) {
      console.log(`[=====] ${_.size(deltaDelTaskCodenames)} new tasks added: ` +
          `${JSON.stringify(deltaDelTaskCodenames)}`);
    }

    if (_.size(deltaAddUsers) || _.size(deltaDelUsers)) {
      this._sendUserList(users);
    }
    if (_.size(deltaAddTaskCodenames) || _.size(deltaDelTaskCodenames)) {
      this._sendTaskCodenames(taskCodenames);
    }

    _.each(scoreboard, (scores, username) => {
      _.each(scores, (score, taskCodename) => {
        if (!_.has(lastScoreboard, username)) {
          this._sendScore(username, taskCodename, score);
        } else {
          const oldScores = _.get(lastScoreboard, username);
          if (!_.has(oldScores, taskCodename)) {
            this._sendScore(username, taskCodename, score);
          } else if (_.get(oldScores, taskCodename) !== score) {
            this._sendScore(username, taskCodename, score);
          }
        }
      });
    });

    this._requestQueue.start(function(err) {
      if (_.isNil(err)) {
        err = 'none';
      }
      console.log(`[  Q  ] All done (err: ${err}).`);
    });

    this._lastScoreboard = scoreboard;
  }
}

// If this is being called from a shell, listen to the queue.
if (!module.parent) {
  const program = require('commander');

  program
    .version('0.0.1')
    .option('--shuriken [address]', 'shuriken-web websocket endpoint',
        'ws://localhost:3000/websocket')
    .option('--rws [address]', 'Address to rws', 'http://localhost:8890')
    .option('--contest [codename]', 'Contest codename')
    .parse(process.argv);

  const shurikenEndpoint = program.shuriken;
  const rwsAddress = program.rws;
  const contestCodename = program.contest;

  if (!_.isString(contestCodename)) {
    throw new Error('Use --contest');
  }

  new RwsConnector(contestCodename, shurikenEndpoint, rwsAddress);
}
