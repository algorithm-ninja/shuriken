'use strict';

import path from 'path';
import test from 'ava';
import BatchEvaluator from '../evaluators/BatchEvaluator';

const evaluatorOptions = {
  fileStoreRoot: path.join(__dirname, 'task1-a-plus-b'),
  internalTimeLimit: 10,
  internalMemoryLimit: 256,
  redisConnectionString: 'redis://localhost:6379',
};

test('BatchEvaluator checks job.data is Object', t => {
  const job = {
    data: 'some string'
  };

  t.throws(() => {
    new BatchEvaluator({}, job, evaluatorOptions);
  }, /to be an object/);
});

test('BatchEvaluator checks missing properties', t => {
  const job = {};
  job.data = {
    submissionFileUri: 'shuriken://source.cpp',
    tcInputFileUriSchema: 'shuriken://input.%d.%d.txt',
    evaluationStructure: [],
    timeLimit: 1.0,
    memoryLimit: 256
  };

  t.throws(() => {
    new BatchEvaluator({}, job, evaluatorOptions);
  }, /to have property tcOutputFileUriSchema/);
});

test('BatchEvaluator checks invalid properties', t => {
  const job = {};
  job.data = {
    submissionFileUri: 'shuriken://source.cpp',
    tcInputFileUriSchema: 'shuriken://input.%d.%d.txt',
    tcOutputFileUriSchema: 'shuriken://input.%d.%d.txt',
    evaluationStructure: [],
    timeLimit: -1.0,
    memoryLimit: 256
  };

  t.throws(() => {
    new BatchEvaluator({}, job, evaluatorOptions);
  }, /to be above 0/);
});
