'use strict';

import test from 'ava';
import _ from 'lodash';

import BatchEvaluator from '../evaluators/BatchEvaluator';
import task1 from './tasks';

test('BatchEvaluator checks job.data is Object', t => {
  const job = {
    data: 'some string'
  };

  t.throws(() => {
    new BatchEvaluator({}, job, null);
  }, /to be an object/);
});

test('BatchEvaluator checks missing properties', t => {
  const job = {};
  job.data = {
    submissionFileUri: 'file:///tmp/source.cpp',
    tcInputFileUriSchema: 'file:///tmp/input.%d.%d.txt',
    evaluationStructure: [],
    timeLimit: 1.0,
    memoryLimit: 256
  };

  t.throws(() => {
    new BatchEvaluator({}, job, null);
  }, /to have property tcOutputFileUriSchema/);
});

test('BatchEvaluator checks invalid properties', t => {
  const job = {};
  job.data = {
    submissionFileUri: 'file:///tmp/source.cpp',
    tcInputFileUriSchema: 'file:///tmp/input.%d.%d.txt',
    tcOutputFileUriSchema: 'file:///tmp/input.%d.%d.txt',
    evaluationStructure: [],
    timeLimit: -1.0,
    memoryLimit: 256
  };

  t.throws(() => {
    new BatchEvaluator({}, job, null);
  }, /to be above 0/);
});

test('BatchEvaluator correctly creates each subjob', t => {
  const job = {};
  job.data = _.clone(task1);

  const queueMock = {
    jobCount: 0,

    create(jobName, job) {
      if (jobName !== 'subjob') {
        t.fail(`A subjob was created with an unexpected name: ${jobName}`);
      }

      if (!_.isObject(job)) {
        t.fail(`The subjob configuration is not an object: ${job}`);
      }

      this.jobCount++;
    }
  };

  new BatchEvaluator(queueMock, job, function() {
    if (queueMock.jobCount !== 9) {
      t.fail(`The number of subjobs created does not match the number of ` +
          `testcases: ${queueMock} !== 9`);
    }
  });

  t.pass();
});
