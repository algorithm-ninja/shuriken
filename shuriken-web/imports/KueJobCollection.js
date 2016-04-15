'use strict';

const kue = require('kue');

export const KueJobCollection = function(Collection) {
  this._monitoredJobs = {};
  this._collection = Collection;

  this._exportKueData = (jobData) => {
    //IDEA: prefix all fields from Kue with a recognizable prefix (such as
    //      'kue'. Furthermore, it would be nice to have them camelCase.
    //FIXME: we should filter the data, as it is not worth to have some of the
    //       fields in the Mongo collection.
    return jobData;
  };

  this._updateJobData =  (kueJobId) => {
    let self = this;

    if (!(kueJobId in this._monitoredJobs)) {
      return;
    }
    kue.Job.get(kueJobId, Meteor.bindEnvironment(function(err, job) {
      if (!err) {
        Collection.update(
          {id: kueJobId},
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
      console.log('[KueJobCollection] Watch new Kue job ' + kueJobId);

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
    let self = this;

    if (!data) {
      data = {};
    }
    if ('id' in data) {
      throw new Error(
          'id cannot be a key of data in KueJobCollection.insertJob');
    }

    data.id = null;
    let taskId = Collection.insert(data);

    if (Meteor.isServer) {
      job.on('enqueue', Meteor.bindEnvironment(function() {
        Collection.update(taskId, { $set: { id: job.id } });
        self.watchJob(job.id);
      })).save();
    }

    return taskId;
  };
};
