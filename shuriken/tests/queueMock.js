'use strict';

class QueueMock {
  constructor() {
    this.jobs = [];
  }

  create(jobName, jobData) {
    this.jobs.push({
      name: jobName,
      data: jobData
    });

    // Allow to do stuff like: queue.create(...).on(...).on(...).save()
    let obj = {
      on: () => obj,
      save: () => {}
    };

    return obj;
  }
}

module.exports = QueueMock;
