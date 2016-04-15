var Sandbox = require('../sandboxes/dummy');

var kue = require('kue');
var domain = require('domain').create();
var queue = kue.createQueue();

queue.process('subjob', function(job, done) {
  domain.on('error', function(err){
    console.error(err);
    done(err);
  });

  domain.run(function() {
    console.log('Processing: ' + job.data['sourceFilename']);
    console.log('Processing: ' + job.data['inputFilename']);

    var sandbox = new Sandbox().timeLimit(5000).memoryLimit(256);

    // Compile C++ file
    sandbox.add(job.data['sourceFilename']);
    var status = sandbox.run('g++', ['-Wall', '-O2', job.data['sourceFilename']]);
    if (status.status) {
      done("Compilation error", {});
      return;
    }

    // Run executable file with the input
    sandbox.add(job.data['inputFilename'], 'input.txt').stdin('input.txt').stdout('output.txt');
    status = sandbox.runRelative('a.out', []);
    if (status.status) {
      done('Runtime error. Exit code: ' + status.exitCode);
      return;
    }

    // Copy the correct output in the sandbox
    sandbox.add(job.data['outputFilename'], 'correct.txt');  // TODO: think about when 'correct.txt' exists

    // Run checker
    if (job.data['checkerFilename']) {
      sandbox.add(job.data['checkerFilename'], 'checker');  // TODO: think about when 'checker' exists
      sandbox.executable('checker');
      status = sandbox.runRelative('checker', ['output.txt', 'input.txt', 'correct.txt']);
    } else {
      status = sandbox.run('diff', ['--ignore-trailing-space', 'output.txt', 'correct.txt']);
    }
    if (status.status) {
      done('Wrong answer');
    } else {
      done(null, {
        'time': 1.0,
        'memory': 32.0,
      });
    }
  });
});
