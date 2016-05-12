'use strict';

const task1 = {
  submissionFileUri: 'shuriken://solution-ok.cpp',
  tcInputFileUriSchema: 'shuriken://input%d.%d.txt',
  tcOutputFileUriSchema: 'shuriken://output%d.%d.txt',
  checkerSourceUri: 'shuriken://checker-mod2.cpp',
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
