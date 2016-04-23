'use strict';

import test from 'ava';
import BatchTestcaseEvaluator from '../evaluators/BatchTestcaseEvaluator';

test('BatchTestcaseEvaluator checks job.data is Object', t => {
  const job = {
    data: 'some string'
  };

  t.throws(() => {
    new BatchTestcaseEvaluator(job, null);
  }, /to be an object/);
});

test('BatchTestcaseEvaluator checks missing properties', t => {
  const job = {};
  job.data = {
    submissionFileUri: 'file:///tmp/source.cpp',
    tcOutputFileUri: 'file:///tmp/input.txt',
    timeLimit: 1.0,
    memoryLimit: 256
  };

  t.throws(() => {
    new BatchTestcaseEvaluator(job, null);
  }, /to have property tcInputFileUri/);
});

test('BatchTestcaseEvaluator checks invalid properties', t => {
  const job = {};
  job.data = {
    submissionFileUri: 'file:///tmp/source.cpp',
    submissionLanguage: 'some inexistent language',
    tcInputFileUri: 'file:///tmp/input.txt',
    tcOutputFileUri: 'file:///tmp/input.txt',
    evaluationStructure: [],
    timeLimit: 1.0,
    memoryLimit: 256
  };

  t.throws(() => {
    new BatchTestcaseEvaluator(job, null);
  }, /to be equals one of Array/);
});
