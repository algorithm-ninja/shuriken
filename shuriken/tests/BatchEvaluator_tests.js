'use strict';

import test from 'ava';
import BatchEvaluator from '../evaluators/BatchEvaluator';

test('BatchEvaluator checks job.data is Object', t => {
  const job = {
    data: 'some string'
  };

  t.throws(() => {
    new BatchEvaluator({}, job);
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
    new BatchEvaluator({}, job);
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
    new BatchEvaluator({}, job);
  }, /to be above 0/);
});
