'use strict';

const path = require('path');

const task1dir = path.join('file://', __dirname, 'task1-a-plus-b');

const task1 = {
  submissionFileUri: path.join(task1dir, 'solution-ok.cpp'),
  tcInputFileUriSchema: path.join(task1dir, 'input.%d.%d.cpp'),
  tcOutputFileUriSchema: path.join(task1dir, 'output.%d.%d.cpp'),
  checkerSourceUri: path.join(task1dir, 'checker-rnd.cpp'),
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
