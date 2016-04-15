const kue = require('kue');

export const KueJobCollection = function(Collection) {
  this._monitoredJobs = {};
  this._collection = Collection;

  this._updateJobData =  (kueJobId) => {
    if (!(kueJobId in this._monitoredJobs)) {
      console.error("WTF");
      return;
    }
    kue.Job.get(kueJobId, Meteor.bindEnvironment(function(err, job) {
      if (!err) {
        Collection.update(
          {id: kueJobId},
          {$set: job.toJSON()},
          {upsert: true},
        );
      } else {
        console.error(err);
      }
    }));
  };

  this.watchJob = (kueJobId) => {
    var self = this;

    if (!(kueJobId in this._monitoredJobs)) {
      console.log('[KueJobCollection] Watch new Kue job ' + kueJobId);

      kue.Job.get(kueJobId, Meteor.bindEnvironment(function(err, job) {
        if (!err) {
          self._updateJobData(kueJobId);

          // Subscribe to Redis events via Kue.
          job.subscribe(() => {});
          job.on('change', Meteor.bindEnvironment(() => { self._updateJobData(kueJobId) }));
        } else {
          console.error(err);
        }
      }));
    }

    let now = new Date();
    this._monitoredJobs[kueJobId] = now;
  };

  this.insertJob = (data, job) => {
    var self = this;

    if (!data) {
      data = {};
    }
    if ('id' in data) {
      throw new error('id cannot be a key of data in KueJobCollection.insertJob');
    }

    data.id = null;
    let taskId = Collection.insert(data);

    if (Meteor.isServer) {
      job.on('enqueue', Meteor.bindEnvironment(function(type) {
        Collection.update(taskId, { $set: { id: job.id } });
        self.watchJob(job.id);
      })).save();
    }

    return taskId;
  }
};
