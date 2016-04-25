'use strict';

const kue = require('kue');
const should = require('should');

export const KueJobCollection = function(Collection) {
  this._monitoredJobs = {};

  this._exportKueData = (jobData) => {
    return {
      kueState: jobData.state,
      kueCreatedAt: jobData.created_at,
      kueAttempts: jobData.attempts,
      kueError: jobData.error,
      kueResult: jobData.result,
      kueProgress: jobData.progress,
      kueProgressData: jobData.progress_data,
    }
  };

  this._updateJobData =  (kueJobId) => {
    let self = this;

    if (!(kueJobId in this._monitoredJobs)) {
      return;
    }
    kue.Job.get(kueJobId, Meteor.bindEnvironment(function(err, job) {
      if (!err) {
        Collection.update(
          {'kueJobId': kueJobId},
          {$set: self._exportKueData(job.toJSON())},
          {upsert: true}
        );
      } else {
        console.error(err);
      }
    }));
  };

  this.watchJob = (kueJobId) => {
    let self = this;

    if (!(kueJobId in this._monitoredJobs)) {
      console.log('[KueEvaluationJob] Watch new Kue job ' + kueJobId);

      kue.Job.get(kueJobId, Meteor.bindEnvironment(function(err, job) {
        if (!err) {
          self._updateJobData(kueJobId);

          // Subscribe to Redis events via Kue.
          job.subscribe(() => {});
          job.on('change',
              Meteor.bindEnvironment(() => { self._updateJobData(kueJobId); }));
        } else {
          console.error(err);
        }
      }));
    }

    let now = new Date();
    this._monitoredJobs[kueJobId] = now;
  };

  this.insertJob = (data, job) => {
    should(data).be.Object();
    should(job).be.Object();

    let self = this;

    // Insert in the collection
    Object.assign(data, {
      kueJobId: '',
      kueState: 'inactive',
      kueCreatedAt: new Date(),
      kueAttempts: 0,
      kueError: null,
      kueResult: null,
      kueProgress: null,
      kueProgressData: null,
    })
    let mongoId = Collection.insert(data);

    if (Meteor.isServer) {
      job.on('enqueue', Meteor.bindEnvironment(function() {
        Collection.update(mongoId, { $set: { kueJobId: job.id } });
        self.watchJob(job.id);
      })).save();
    }

    return mongoId;
  };
};
