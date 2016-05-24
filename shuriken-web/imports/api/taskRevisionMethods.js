'use strict';

// Collections.
import {Tasks} from './tasks.js';
import {TaskRevisions} from './taskRevisions.js';
// Models.
import {TaskRevision} from '../models/TaskRevision.js';
// Requires.
const should = require('should/as-function');

Meteor.methods({
  /**
   * Inserts a new TaskRevision object having the given fields. The taskId is
   * inferred from the taskCodename. If no task for the given codename is
   * found, an exception is thrown.
   *
   * @param {String} taskCodename Task codename.
   * @param {String} title See TaskRevision model.
   * @param {String} statementPdfUri See TaskRevision model.
   * @param {Object} evaluatorConf See TaskRevision model.
   * @param {String} description See TaskRevision model.
   *
   * @return {ObjectId}
   */
  'taskRevisions.insert'(taskCodename, title, statementPdfUri, evaluatorConf,
      description) {
    should(taskCodename).be.String();
    should(title).be.String();
    should(statementPdfUri).be.String();
    should(evaluatorConf).be.Object();
    should(description).be.String();

    const task = Tasks.findOne({codename: taskCodename});
    should(task.isLoaded()).be.true();

    return TaskRevisions.insert(new TaskRevision({
      taskId: task._id.valueOf(),
      title: title,
      statementPdfUri: statementPdfUri,
      evaluatorConf: evaluatorConf,
      description: description,
    }).toJson());
  },
});
