const TaskImporter = require('./italy-yaml/task.js');

const _ = require('lodash');
const randomWords = require('random-words');
const should = require('should');

// If this is being called from a shell, listen to the queue.
if (!module.parent) {
  const program = require('commander');

  program
    .version('0.0.1')
    .arguments('<path>', 'The path of the file or directory to import.')
    .option('--fs-root [path]', 'Root of the network file system.')
    .option('--description [description]', 'A human-readable string.',
        randomWords({ exactly: 2, join: '-' }))
    .parse(process.argv);

  if (_.isNil(program.fsRoot)) {
    throw new Error('Use --fs-root');
  }

  should(program.args).have.lengthOf(1);
  new TaskImporter(program.args[0], program.fsRoot, program.description).run();
}
