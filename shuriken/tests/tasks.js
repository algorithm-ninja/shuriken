'use strict';

const path = require('path');

const task1dir = 'file://' + path.join(__dirname, 'task1-a-plus-b');

const task1 = {
  submissionFileUri: task1dir + '/solution-ok.cpp',
  tcInputFileUriSchema: task1dir + '/input%d.%d.txt',
  tcOutputFileUriSchema: task1dir + '/output%d.%d.txt',
  checkerSourceUri: task1dir + '/checker-mod2.cpp',
  intraSubtaskAggregation: 'sum',
  interSubtaskAggregation: 'sum',
  evaluationStructure: [
    { nTestcases: 4 },
    { nTestcases: 3, scoreMultiplier: 1.5 },
    { nTestcases: 2 }
  ],
  timeLimit: 1,
  memoryLimit: 256
};

module.exports = task1;
