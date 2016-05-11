'use strict';

import test from 'ava';
import _ from 'lodash';

import BatchEvaluator from '../evaluators/BatchEvaluator';
import BatchTestcaseEvaluator from '../evaluators/BatchTestcaseEvaluator';
import task1 from './tasks';
import QueueMock from './queueMock';

test('BatchEvaluator correctly creates each subjob, which is correctly ' +
      'evaluated by BatchTestcaseEvaluator', t => {
  function doTest(job, expectedScores) {
    const queue = new QueueMock();
    new BatchEvaluator(queue, job);

    t.is(queue.jobs.length, 9, 'The number of subjobs created does not match ' +
        'the number of testcases');

    function subTest(i, job) {
      let promise = new BatchTestcaseEvaluator(job).getPromise();

      promise.then(function(info) {
        t.is(info.score, expectedScores[i], 'Unexpected score');
      }, function(error) {
        if (_.isNull(error)) {
          t.fail('The evaluation failed unexpectedly');
        }
      });

      return promise;
    }

    let promises = [];
    let i = 0;

    for (const job of queue.jobs) {
      if (job.name !== 'subjob') {
        t.fail(`A subjob was created with an unexpected name: ${job.name}`);
      }

      if (!_.isObject(job.data)) {
        t.fail(`The subjob configuration is not an object: ${job}`);
      }

      promises.push(subTest(i, job));
      i += 1;
    }

    return promises;
  }

  let allPromises = [];

  let job = {progress: function(){}};
  job.data = _.clone(task1);
  delete job.data.checkerSourceUri;
  allPromises = allPromises.concat(doTest(job, [1, 1, 1, 1, 1, 1, 1, 1, 1]));

  job.data = _.clone(task1);
  delete job.data.checkerSourceUri;
  job.data.submissionFileUri = job.data.submissionFileUri.replace('solution-ok',
      'solution-wa');
  allPromises = allPromises.concat(doTest(job, [1, 1, 1, 1, 1, 1, 0, 1, 1]));

  job.data = _.clone(task1);
  allPromises = allPromises.concat(doTest(job, [0, 0, 0, 1, 1, 1, 0, 1, 1]));

  job.data = _.clone(task1);
  job.data.checkerSourceUri.replace('checker-mod2.cpp', 'checker-mod2.py');
  allPromises = allPromises.concat(doTest(job, [0, 0, 0, 1, 1, 1, 0, 1, 1]));

  return Promise.all(allPromises);
});
