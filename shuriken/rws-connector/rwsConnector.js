'use strict';

const _ = require('lodash');
const http = require('http');
const should = require('should');
const url = require('url');

const ContestDataSubscriber = require('./contestDataSubscriber.js');

class RwsConnector {
  constructor(contestCodename, shurikenAddress, rwsAddress) {
    let self = this;

    this._contestCodename = contestCodename;
    this._shurikenAddress = shurikenAddress;
    this._rwsAddress = rwsAddress;
    this._throttledOnDataChange =
        _.throttle(this._onDataChange, 250, {trailing: true});

    this._contestDataSubscriber = new ContestDataSubscriber(
        contestCodename, shurikenAddress, function() {
      if (this.ready()) {
        self._throttledOnDataChange();
      }
    });

    this._lastScoreboard = {};
    this._sendContest();
  }

  _computeScoreboard() {
    const ready = this._contestDataSubscriber.ready();
    const dataStore = this._contestDataSubscriber.dataStore();

    should(ready).be.true();

    // Map user -> taskCodename -> score
    const users = dataStore.findAll('users');
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
          taskRevisionIdToTaskCodename[taskRevisionId] = task.codename;
        } else {
          taskRevisionIdToTaskCodename[taskRevisionId] = undefined;
        }
      } else {
        taskRevisionIdToTaskCodename[taskRevisionId] = undefined;
      }
    });


    if (!_.every(taskRevisionIdToTaskCodename)) {
      console.warn('[ ### ] Could not update scoreboard: not all task codenames are ' +
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
      const evaluations = dataStore.findAll(
          'evaluations', 'taskRevisionId', taskRevisionId);
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

    console.log('[*****] Scoreboard computed!');
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

  _sendContest() {
    const options = {
      host: this._rwsHost(),
      port: this._rwsPort(),
      path: '/contests/',
      method: 'PUT',
      auth: this._rwsAuth(),
      headers: {'content-type': 'application/json'},
    };

    const req = http.request(options, function(res) {
      if (res.statusCode >= 400) {
        console.log('STATUS: ' + res.statusCode);
        console.log('HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          console.log('BODY: ' + chunk);
        });
      } else {
        console.log(`[*****] Succesfully sent to rws.`);
      }
    });

    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });

    const contestData = _.zipObject([this._contestCodename], [{
      name: this._contestCodename,
      begin: 1000000000,
      end: 2000000000,
      'score_precision': 2,
    }]);
    req.end(JSON.stringify(contestData));
  }

  _sendUserList(users) {
    const options = {
      host: this._rwsHost(),
      port: this._rwsPort(),
      path: '/users/',
      method: 'PUT',
      auth: this._rwsAuth(),
      headers: {'content-type': 'application/json'},
    };

    const req = http.request(options, function(res) {
      if (res.statusCode >= 400) {
        console.log('STATUS: ' + res.statusCode);
        console.log('HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          console.log('BODY: ' + chunk);
        });
      } else {
        console.log(`[*****] Succesfully sent to rws.`);
      }
    });

    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });

    const digestedUsers = _.zipObject(users, _.map(users, (user) => {
      return {
        'f_name': user,
        'l_name': '',
        'team': null,
      };
    }));
    req.end(JSON.stringify(digestedUsers));
  }

  _sendTaskCodenames(taskCodenames) {
    const options = {
      host: this._rwsHost(),
      port: this._rwsPort(),
      path: '/tasks/',
      method: 'PUT',
      auth: this._rwsAuth(),
      headers: {'content-type': 'application/json'},
    };

    const req = http.request(options, function(res) {
      if (res.statusCode >= 400) {
        console.log('STATUS: ' + res.statusCode);
        console.log('HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          console.log('BODY: ' + chunk);
        });
      } else {
        console.log(`[*****] Succesfully sent to rws.`);
      }
    });

    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });

    const digestedTasks = _.zipObject(
        taskCodenames, _.map(taskCodenames, (taskCodename, index) => {
      return {
        'short_name': taskCodename,
        'name': '',
        'contest': this._contestCodename,
        'order': index,
        'max_score': 100.01,
        'extra_headers': ['x'],
        'score_precision': 2,
        'score_mode': 'max',
      };
    }));
    req.end(JSON.stringify(digestedTasks));
  }

  _onDataChange() {
    const scoreboard = this._computeScoreboard();
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
      console.log(`[*****] ${_.size(deltaAddUsers)} new user added: ` +
          `${JSON.stringify(deltaAddUsers)}`);
    }
    const deltaDelUsers = _.difference(lastUsers, users);
    if (_.size(deltaDelUsers)) {
      console.log(`[*****] ${_.size(deltaDelUsers)} new user added: ` +
          `${JSON.stringify(deltaDelUsers)}`);
    }

    const deltaAddTaskCodenames = _.difference(
        taskCodenames, lastTaskCodenames);
    if (_.size(deltaAddTaskCodenames)) {
      console.log(`[*****] ${_.size(deltaAddTaskCodenames)} new tasks added: ` +
          `${JSON.stringify(deltaAddTaskCodenames)}`);
    }
    const deltaDelTaskCodenames = _.difference(
        lastTaskCodenames, taskCodenames);
    if (_.size(deltaDelTaskCodenames)) {
      console.log(`[*****] ${_.size(deltaDelTaskCodenames)} new tasks added: ` +
          `${JSON.stringify(deltaDelTaskCodenames)}`);
    }

    if (_.size(deltaAddUsers) || _.size(deltaDelUsers)) {
      this._sendUserList(users);
    }
    if (_.size(deltaAddTaskCodenames) || _.size(deltaDelTaskCodenames)) {
      this._sendTaskCodenames(taskCodenames);
    }
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

  new RwsConnector(contestCodename, shurikenAddress, rwsAddress);
}
