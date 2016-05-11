'use strict';

// APIs and collections.
import {Evaluations} from '../imports/api/evaluations.js';
// Requires.
const kue = require('kue');
const should = require('should/as-function');

/**
 * Monitors the Evaluation collections. Whenever a new evaluation is added,
 * it automatically subscribes to updates from kue, and keeps the data in
 * Mongo in sync with that in Redis, managed by Kue.
 */
export class EvaluationWatcher {
  constructor() {
    console.log('[EvaluationWatcher] Starting watcher');
    this._monitoredJobs = new Set();

    // Subscribe to add
    let self = this;
    let evaluations = Evaluations.find();
    evaluations.observe({
      'added'(document) {
        should(document.isLoaded()).be.true();
        self._watchJob(document.kueJobId);
      }
    });
  }

  /**
   * Updates the Mongo representation of the job.
   *
   * @private
   * @param {Number} kueJobId
   */
  _updateJobData(kueJobId) {
    kue.Job.get(kueJobId, Meteor.bindEnvironment(function(err, job) {
      if (!err) {
        let evaluation = Evaluations.findOne({kueJobId: kueJobId});
        should(evaluation.isLoaded()).be.true();

        // Update the evaluation in Mongo.
        evaluation.updateFromKueJob(job);
        Evaluations.update({kueJobId: kueJobId}, {$set: evaluation.toJson()});
      } else {
        console.error(err);
        console.log('[EvaluationWatcher] Marking job ' + kueJobId +
            ' as lost.');
        Evaluations.update({kueJobId: kueJobId}, {$set: {
          isLost: true,
        }});
      }
    }));
  }

  /**
   * Subscribes to Redis changes for the given job id.
   *
   * @private
   * @param {Number} kueJobId
   */
  _watchJob(kueJobId) {
    let self = this;

    if (!this._monitoredJobs.has(kueJobId)) {
      console.log('[EvaluationWatcher] Watch new Kue job ' + kueJobId);
      this._monitoredJobs.add(kueJobId);

      kue.Job.get(kueJobId, Meteor.bindEnvironment(function(err, job) {
        // Run this even if there was an error, so that the job is marked as
        // `removed`.
        self._updateJobData(kueJobId);

        if (!err) {
          // Subscribe to Redis events via Kue.
          job.subscribe(() => {});
          job.on('change',
              Meteor.bindEnvironment(() => { self._updateJobData(kueJobId); }));
        }
      }));
    } else {
      console.warn('[EvaluationWatcher] Asked to monitor job ' + kueJobId +
          ', but job was already monitored (bug?).');
    }
  }
}
