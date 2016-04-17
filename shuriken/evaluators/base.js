var util = require('util');
var path = require('path');

module.exports = class Evaluator {
  constructor() {
    this.queue = require('kue').createQueue();
  }

  enqueueSubjob(id) {
    queue.create('subjob', this.getJob()).on('complete', function() {
      if (!jobs_done[id]) {
        console.log('Job ' + id + ' completed');
        jobs_done[id] = true;
        this.updateProgressUpstream();
      }
    }).save();
  }

  run() {
    queue.process('evaluate', function(job, done) {
      console.log("Took job: ");
      console.log(job);

      var jobs_done = {};

      for (var i = 0; i < numInput; ++i) {
        jobs_done[i] = false;
        enqueueSubjob(i);
      }
    });
  }
}


