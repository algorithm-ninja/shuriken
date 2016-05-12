'use strict';

import path from 'path';
import test from 'ava';
import BatchTestcaseEvaluator from '../evaluators/BatchTestcaseEvaluator';

const testcaseEvaluatorOptions = {
  fsRoot: path.join(__dirname, 'task1-a-plus-b'),
  timeLimitMultiplier: 1,
  memoryLimitMultiplier: 1,
};


test('BatchTestcaseEvaluator checks job.data is Object', t => {
  const job = {
    data: 'some string'
  };

  t.throws(() => {
    new BatchTestcaseEvaluator({}, job, testcaseEvaluatorOptions);
  }, /to be an object/);
});

test('BatchTestcaseEvaluator checks missing properties', t => {
  const job = {};
  job.data = {
    submissionFileUri: 'shuriken://source.cpp',
    tcOutputFileUri: 'shuriken://input.txt',
    timeLimit: 1.0,
    memoryLimit: 256
  };

  t.throws(() => {
    new BatchTestcaseEvaluator({}, job, testcaseEvaluatorOptions);
  }, /to have property tcInputFileUri/);
});

test('BatchTestcaseEvaluator checks invalid properties', t => {
  const job = {};
  job.data = {
    submissionFileUri: 'shuriken://source.cpp',
    submissionLanguage: 'some inexistent language',
    tcInputFileUri: 'shuriken://input.txt',
    tcOutputFileUri: 'shuriken://input.txt',
    evaluationStructure: [],
    timeLimit: 1.0,
    memoryLimit: 256
  };

  t.throws(() => {
    new BatchTestcaseEvaluator({}, job, testcaseEvaluatorOptions);
  }, /to be equals one of Array/);
});
