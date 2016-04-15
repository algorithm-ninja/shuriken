var argv = require('minimist')(process.argv.slice(2));
var util = require('util');
var path = require('path');

var kue = require('kue');
var queue = kue.createQueue();

var testcasePrefix = argv['prefix'];
var inputSchema = argv['input'];
var outputSchema = argv['output'];
var numInput = argv['num'];
var checkerFilename = argv['checker'];

if (checkerFilename) {
  checkerFilename = path.resolve(checkerFilename);
}

queue.process('evaluate', function(job, done) {
  console.log("Took job: ");
  console.log(job);
  
  var jobs_done = {};

  var updateProgressUpstream = function() {
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
  };

  var enqueueSubjob = function(id) {
    queue.create('subjob', {
      'sourceFilename': job.data.sourceFilename,
      'inputFilename': path.join(testcasePrefix, util.format(inputSchema, id)),
      'outputFilename': path.join(testcasePrefix, util.format(outputSchema, id)),
      'checkerFilename': checkerFilename,
    }).on('complete', function() {
      if (!jobs_done[id]) {
        console.log('Job ' + id + ' completed');
        jobs_done[id] = true;
        updateProgressUpstream();
      }
    }).save();
  };

  for (var i = 0; i < numInput; ++i) {
    jobs_done[i] = false;
    enqueueSubjob(i);
  }
});
