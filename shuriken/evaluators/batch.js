var argv = require('minimist')(process.argv.slice(2));
var util = require('util');
var path = require('path');
var Evaluator = require('./base.js');

class Batch extends Evaluator {
  constructor(testcasePrefix, inputSchema, outputSchema, numInput, checkerFilename) {
    super();
    this.testcasePrefix = testcasePrefix;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
    this.numInput = numInput;
    if (checkerFilename) {
      this.checkerFilename = path.resolve(checkerFilename);
    } else {
      this.checkerFilename = checkerFilename;
    }
  }

  updateProgressUpstream() {
    var cnt = 0;
    for (var i = 0; i < numInput; ++i) {
      if (jobs_done[i]) {
        ++cnt;
      }
    }
    job.progress(cnt, numInput, 'Done ' + cnt + ' subjobs');
    if (cnt == job.data.num) {
      done(null, 'Done all jobs!');
    }
  }

  getJob() {
    return {
      'sourceFilename': job.data.sourceFilename,
      'inputFilename': path.join(testcasePrefix, util.format(inputSchema, id)),
      'outputFilename': path.join(testcasePrefix, util.format(outputSchema, id)),
      'checkerFilename': checkerFilename,
    };
  }
}

new Batch(argv['prefix'], argv['input'], argv['output'], argv['num'], argv['checker']).run();
