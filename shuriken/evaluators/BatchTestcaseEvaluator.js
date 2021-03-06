'use strict';

const Sandbox = require('cotton');
const FileDB = require('shuriken-fs');

const _ = require('lodash');
const kue = require('kue');
const path = require('path');
const should = require('should/as-function');

/**
 * BatchTestcaseEvaluator
 * ======================
 *
 * This class implements a testcase evaluator for the Batch problem type.
 *
 * #### Evaluator options
 *
 * +-------------------------+-------------------------------------+-----------+
 * | Field name              | Description                         | Mandatory |
 * +-------------------------+-------------------------------------+-----------+
 * | fileStoreRoot           | Path of the file store root dir,    |     Y     |
 * |                         | corresponding to the shuriken://    |           |
 * |                         | prefix.                             |           |
 * +-------------------------+-------------------------------------+-----------+
 * | timeLimitMultiplier     | The time limit multiplier used by   |     Y     |
 * |                         | this process.                       |           |
 * +-------------------------+-------------------------------------+-----------+
 * | memoryLimitMultiplier   | The memory limit multiplier used by |     Y     |
 * |                         | this process.                       |           |
 * +-------------------------+-------------------------------------+-----------+
 * | redisConnectionString   | URL of the Redis instance to use.   |     N     |
 * +-------------------------+-------------------------------------+-----------+
 *
 * #### Job Configuration
 *
 * These are the fields currently expected by BatchEvaluator:
 *
 * +-------------------------+-------------------------------------+-----------+
 * | Field name              | Description                         | Mandatory |
 * +-------------------------+-------------------------------------+-----------+
 * | submissionFileUri       | An URI to the submission file.      |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | tcInputFileUri          | URI of the input file.              |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | tcOutputFileUri         | URI of the output file.             |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | timeLimit               | A real number indicating how many   |     Y     |
 * |                         | seconds the submissionFile may be   |           |
 * |                         | executed for.                       |           |
 * +-------------------------+-------------------------------------+-----------+
 * | memoryLimit             | A real number indicating how many   |     Y     |
 * |                         | MiB are available for the execution |           |
 * |                         | of submissionFile.                  |           |
 * +-------------------------+-------------------------------------+-----------+
 * | internalTimeLimit       | A real number indicating how many   |     Y     |
 * |                         | seconds the internal operations     |           |
 * |                         | (e.g. compilation and checking) may |           |
 * |                         | be executed for.                    |           |
 * +-------------------------+-------------------------------------+-----------+
 * | internalMemoryLimit     | A real number indicating how many   |     Y     |
 * |                         | MiB are available for the execution |           |
 * |                         | of internal operations.             |           |
 * +-------------------------+-------------------------------------+-----------+
 * | submissionLanguage      | A string identifying the language   |     N     |
 * |                         | used in the submissionFile. If null |           |
 * |                         | or not set, this will be guessed    |           |
 * |                         | from the file extension. Currently  |           |
 * |                         | we support the following languages: |           |
 * |                         | - 'GCC_C                            |           |
 * |                         | - 'GCC_CXX'                         |           |
 * |                         | - 'JDK_JAVA'                        |           |
 * |                         | - 'CPYTHON_PYTHON3'                 |           |
 * |                         | - 'MONO_CSHARP'                     |           |
 * +-------------------------+-------------------------------------+-----------+
 * | graderSourceUri         | URI of the grader file.             |     N     |
 * +-------------------------+-------------------------------------+-----------+
 * | checkerSourceUri        | URI of the checker file.            |     N     |
 * +-------------------------+-------------------------------------+-----------+
 * | checkerLanguage         | Language for checker. For more info |     N     |
 * |                         | see: submissionLanguage.            |           |
 * +-------------------------+-------------------------------------+-----------+
 *
 * Published result
 * ----------------
 *
 * When the evaluation job is finished a score and a message are published.
 * They are published in the form of an object having the following fields:
 * - score: a number in [0, 1],
 * - message: a string,
 * - elapsedTime: a number (or null, in case of error),
 * - memoryPeak: the peak amount of RAM used during execution (or null, in case
 *               of error).
 *
**/

class BatchTestcaseEvaluator {
  /**
   * Receive a link to the Kue Job.
   *
   * @param {!Object} job The current Kue Job.
   * @constructor
   */
  constructor(queue, job, options) {
    this._queue = queue;
    this._kueJob = job;

    this._config = job.data;
    this._options = options;

    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });

    // Parse the options.
    should(options).have.properties(['fileStoreRoot', 'timeLimitMultiplier',
        'memoryLimitMultiplier', 'redisConnectionString']);

    should(this._options.fileStoreRoot)
        .be.String();

    should(this._options.timeLimitMultiplier)
        .be.Number()
        .and.not.be.Infinity()
        .and.be.above(0);

    should(this._options.memoryLimitMultiplier)
        .be.Number()
        .and.not.be.Infinity()
        .and.be.above(0);

    // Parse the configuration for this job (found in job.data()).
    // Step 0. jobConfig must be an Object.
    should(this._config).be.Object();

    // Step 1. Check all mandatory fields are there.
    should(this._config).have.properties(['submissionFileUri', 'tcInputFileUri',
        'tcOutputFileUri', 'timeLimit', 'memoryLimit']);

    // Step 2. Set all non mandatory fields to the default values.
    this._config.graderSourceUri =
        _.get(this._config, 'graderSourceUri', null);

    this._config.checkerSourceUri =
        _.get(this._config, 'checkerSourceUri', null);

    this._config.submissionLanguage = _.get(this._config, 'submissionLanguage',
        this._guessLanguageFromFileExtension(this._config.submissionFileUri));

    if (_.isNull(this._config.checkerSourceUri)) {
      this._config.checkerLanguage = null;
    } else {
      this._config.checkerLanguage = _.get(this._config,
          'checkerLanguage',
          this._guessLanguageFromFileExtension(this._config.checkerSourceUri));
    }

    // Step 3. For each field, check values are feasible.
    should(this._config.submissionFileUri).be.String();
    should(this._config.tcInputFileUri).be.String();
    should(this._config.tcOutputFileUri).be.String();

    should(this._config.submissionLanguage)
        .be.String()
        .and.equalOneOf(['GCC_C', 'GCC_CXX', 'JDK_JAVA', 'CPYTHON_PYTHON3',
            'MONO_CSHARP']);

    if (this._config.checkerLanguage) {
      should(this._config.checkerLanguage)
          .be.String()
          .and.equalOneOf(['GCC_C', 'GCC_CXX', 'JDK_JAVA', 'CPYTHON_PYTHON3',
              'MONO_CSHARP']);
    }

    if (this._config.checkerSourceUri) {
      should(this._config.checkerSourceUri).be.String();
    }

    if (this._config.graderSourceUri) {
      should(this._config.graderSourceUri).be.String();
    }

    this._config.timeLimit *= this._options.timeLimitMultiplier;
    this._config.internalTimeLimit *= this._options.timeLimitMultiplier;
    this._config.memoryLimit *= this._options.memoryLimitMultiplier;
    this._config.internalMemoryLimit *= this._options.memoryLimitMultiplier;

    // Step 4. Check all URIs as a pre-check.
    should(this._validateUris()).be.true();

    // Step 5. Create the fileDB and sandbox objects.
    this._fileDB = new FileDB(this._options.fileStoreRoot);
    this._sandbox = new Sandbox('NamespaceSandbox');

    // Step 6. Start evaluation.
    this._run();
  }

  /**
   * Mark the current job as complete and notify Kue of the outcome of the
   * evaluation.
   *
   * @private
   * @param {Number} score The score (\in [0, 1]) for this submission.
   * @param {string} message The message.
   * @param {?Number} elapsedTime The time (in seconds) took to evaluate. Use
   *                              null when not appicable.
   * @param {?Number} memoryPeak The max amount of memory (in MiBs) used at some
   *                             point of the evaluation. Use null when not
   *                             applicable.
   */
  _publishEvaluation(score, message, elapsedTime, memoryPeak) {
    should(score)
        .be.Number()
        .and.be.within(0, 1);
    if (!_.isNull(elapsedTime)) {
      should(elapsedTime)
          .be.Number()
          .and.be.aboveOrEqual(0);
    }

    if (!_.isNull(memoryPeak)) {
      should(memoryPeak)
          .be.Number()
          .and.be.aboveOrEqual(0);
    }
    should(message).be.String();

    this._resolve({
      'score': score,
      'message': message,
      'elapsedTime': elapsedTime,
      'memoryPeak': memoryPeak,
    });
  }

  /**
   * Mark the current job as failed, with a custom debug message.
   *
   * @private
   * @param {string} message The debug message.
   * @param {Object} err Error to throw (for chaining).
   */
  _fail(message, err) {
    should(message).be.String();

    this._reject(message);
    throw err;
  }

  /**
   * Check that we can access all uris specified in the configuration.
   *
   * @todo Implement this.
   * @private
   * @return {bool} True if all Uris are valid, False otherwise.
   */
  _validateUris() {
    //FIXME This is just temporary, until we finally support shuriken://
    should(this._config.submissionFileUri).startWith('shuriken://');
    should(this._config.tcInputFileUri).startWith('shuriken://');

    if (this._config.tcOutputFileUri) {
      should(this._config.tcOutputFileUri).startWith('shuriken://');
    }

    if (this._config.checkerSourceUri) {
      should(this._config.checkerSourceUri).startWith('shuriken://');
    }

    if (this._config.graderSourceUri) {
      should(this._config.graderSourceUri).startWith('shuriken://');
    }

    return true;
  }


  /**
   * Try to guess the submissionLanguage used from the filename.
   *
   * @private
   * @param {string} submissionFileUri The filename.
   * @return {string} Language code.
   */
  _guessLanguageFromFileExtension(sourceFileUri) {
    should(sourceFileUri).be.String();

    if (/^.*\.c$/.test(sourceFileUri)) {
      return 'GCC_C';
    } else if (/^.*\.(cc|cpp|cxx|c\+\+|C)$/.test(sourceFileUri)) {
      return 'GCC_CXX';
    } else if (/^.*\.java$/.test(sourceFileUri)) {
      return 'JDK_JAVA';
    } else if (/^.*\.(py|py3)$/.test(sourceFileUri)) {
      return 'CPYTHON_PYTHON3';
    } else if (/^.*\.cs$/.test(sourceFileUri)) {
      return 'MONO_CSHARP';
    } else {
      throw new Error('Unrecognized file extensions. Please set ' +
          'submissionLanguage and/or checkerLanguage manually in the task ' +
          'configuration.');
    }
  }

  /**
   * Procedure to copy a file from the file-store to an arbitrary location.
   *
   * @param sourceRelativePath the source path, in the file store root
   * @param destinationAbsolutePath the destination path
   * @private
   */
  _copy(sourceRelativePath, destinationAbsolutePath) {
    try {
      this._fileDB.get(sourceRelativePath).copyToSync(destinationAbsolutePath);
    } catch (err) {
      // FIXME Temporary fix until we finally have proper error handling inside
      //       shuriken-fs.
      throw new Error(`Can't copy file ${sourceRelativePath} to file ` +
          `${destinationAbsolutePath} (error ${err})`);
    }
  }

  /**
   * If necessary, compile the source and the grader. For languages such as
   * Python, this is a no-op.
   *
   * @todo Actually deal with URIs. For now URIs and file paths are the same.
   *
   * @private
   * @param {string} entryPointUri Uri to the "main" file.
   * @param {?Array} helperFileUris Other files to copy to the working dir.
   * @param {string} language The language string (see class doc).
   * @return {Object} The status returned by the sandbox, with an additional
                          'executableFilename' field.
   */
  _compileFile(entryPointUri, helperFileUris, language) {
    let status = {};
    let args = [];

    if (helperFileUris) {
      helperFileUris = _.castArray(helperFileUris);
    } else {
      helperFileUris = [];
    }

    this._copy(entryPointUri,
        path.join(this._sandbox.getRoot(), path.basename(entryPointUri)));

    _.each(helperFileUris, (helperFileUri) => {
      this._copy(helperFileUri,
          path.join(this._sandbox.getRoot(), path.basename(helperFileUri)));
    });

    const relativeEntryPointPath = path.basename(entryPointUri);
    const relativeHelperFilePaths = _.map(helperFileUris, (helperFileUri) => {
      return path.basename(helperFileUri);
    });

    this._sandbox
        .timeLimit(this._config.internalTimeLimit)
        .memoryLimit(this._config.internalMemoryLimit);

    switch (language) {
      case 'GCC_CXX':
        status.executableFilename = relativeEntryPointPath + '.bin';
        args = _.concat(['-Wall', '-Wextra', '-std=c++14', '-O3', '-o',
            status.executableFilename,
            relativeEntryPointPath], relativeHelperFilePaths);

        Object.assign(status, this._sandbox.run('/usr/bin/g++', args));
        break;

      case 'GCC_C':
        status.executableFilename = relativeEntryPointPath + '.bin';
        args = _.concat(['-Wall', '-Wextra', '-std=c11', '-O3', '-o',
            relativeEntryPointPath + '.bin',
            relativeEntryPointPath], relativeHelperFilePaths);

        Object.assign(status, this._sandbox.run('/usr/bin/gcc', args));
        break;

      case 'JDK_JAVA':
        args = _.concat([relativeEntryPointPath], relativeHelperFilePaths);

        if (this._config.graderSourceUri) {
          status.executableFilename = this._config.graderSourceUri;
        } else {
          status.executableFilename = this._config.submissionFileUri;
        }

        // Remove file extension: http://stackoverflow.com/a/4250408/747654
        status.executableFilename.replace(/\.[^/.]+$/, '');

        Object.assign(status, this._sandbox.run('/usr/bin/javac', args));
        break;

      case 'CPYTHON_PYTHON3':
      case 'BASH':
        status.executableFilename = relativeEntryPointPath;
        break;

      case 'MONO_CSHARP':
        status.executableFilename = relativeEntryPointPath + '.exe';
        args = _.concat(['-out:' + status.executableFilename,
            relativeEntryPointPath], relativeHelperFilePaths);

        Object.assign(status, this._sandbox.run('/usr/bin/mcs', args));
        break;
    }

    return status;
  }

  /**
   * Runs a generic executable file.
   *
   * @todo Actually deal with URIs. For now URIs and file paths are the same.
   *
   * @private
   * @param {string} executableFilename The path of the file to be run, relative
   *                     to the sandbox.
   * @param {string} language The language string (see class doc).
   * @param {?Array} additionalArgs Additional arguments to pass.
   * @return {Object} The status returned by the sandbox.
   */
  _runExecutable(executableFilename, language, additionalArgs) {
    let status;

    if (additionalArgs) {
      additionalArgs = _.castArray(additionalArgs);
    } else {
      additionalArgs = [];
    }

    switch (language) {
      case 'GCC_CXX':
      case 'GCC_C':
        status = this._sandbox.run(executableFilename, additionalArgs);
        break;

      case 'JDK_JAVA':
        status = this._sandbox.run('/usr/bin/java',
            _.concat([executableFilename], additionalArgs));
        break;

      case 'BASH':
        status = this._sandbox.run('/bin/bash',
            _.concat([executableFilename], additionalArgs));
        break;

      case 'CPYTHON_PYTHON3':
        status = this._sandbox.run('/usr/bin/python3',
            _.concat([executableFilename], additionalArgs));
        break;

      case 'MONO_CSHARP':
        status = this._sandbox.run('/usr/bin/mono',
            _.concat([executableFilename], additionalArgs));
        break;

      default:
        throw new Error('Unknown language ' + language);
    }

    return status;
  }

  /**
   * Runs a *user* executable file.
   *
   * @see _runExecutable
   *
   * @private
   */
  _runUserExecutable(executableFilename, language, additionalArgs) {
    this._sandbox
        .timeLimit(this._config.timeLimit)
        .memoryLimit(this._config.memoryLimit);

    return this._runExecutable(executableFilename, language, additionalArgs);
  }

  /**
   * Runs an *internal* executable file.
   *
   * @see _runExecutable
   *
   * @private
   */
  _runInternalExecutable(executableFilename, language, additionalArgs) {
    this._sandbox
        .timeLimit(this._config.internalTimeLimit)
        .memoryLimit(this._config.internalMemoryLimit);

    return this._runExecutable(executableFilename, language, additionalArgs);
  }

  /**
   * Main entry point. Evaluate the submission.
   *
   * @private
   */
  _run() {
    // Mount directories
    this._sandbox.mountRO('/usr', '/usr');
    this._sandbox.mountRO('/bin', '/bin');
    this._sandbox.mountRO('/lib', '/lib');
    this._sandbox.mountRO('/lib64', '/lib64');

    // Compile contestant solution.
    let status = this._compileFile(this._config.submissionFileUri,
        this._config.graderSourceUri,
        this._config.submissionLanguage);

    if (_.isNull(status.status) || !_.isNil(status.error)) {
      return this._fail('Exception while compiling source file.', status);
    }

    if (!_.isNull(status.status) && status.status !== 0) {
      return this._publishEvaluation(0.0,
          'Compilation error, exit code ' + status.status, null, null);
    }

    // Run contestant solution.
    this._copy(this._config.tcInputFileUri,
        path.join(this._sandbox.getRoot(), 'input.txt'));

    this._sandbox.stdin('input.txt').stdout('output.txt');

    status = this._runUserExecutable(status.executableFilename,
        this._config.submissionLanguage);

    if (_.isNull(status.status) || !_.isNil(status.error)) {
      return this._fail('Exception while executing solution, code ' +
          status.error.code, status);
    }

    if (!_.isNull(status.status) && status.status !== 0) {
      return this._publishEvaluation(0.0,
          'Execution failed with exit code ' + status.status, status.wallTime,
          status.memory);
    }
    if (!_.isNull(status.signal) && status.signal !== 0) {
      return this._publishEvaluation(0.0,
          'Execution killed with signal ' + status.signal, status.wallTime,
          status.memory);
    }

    // Check if solution is correct.
    if (this._config.tcOutputFileUri) {
      this._copy(this._config.tcOutputFileUri,
          path.join(this._sandbox.getRoot(), 'correct.txt'));
    }

    if (this._config.checkerSourceUri) {
      status = this._compileFile(this._config.checkerSourceUri, null,
          this._config.checkerLanguage);

      // Restore the original input file (the user might have tampered with it)
      this._copy(this._config.tcInputFileUri,
          path.join(this._sandbox.getRoot(), 'input.txt'));

      status = this._runInternalExecutable(status.executableFilename,
          this._config.checkerLanguage,
          ['output.txt', 'correct.txt', 'input.txt']);
    } else {
      this._sandbox
          .timeLimit(this._config.internalTimeLimit)
          .memoryLimit(this._config.internalMemoryLimit);

      status = this._sandbox.run('diff',
          ['--ignore-trailing-space', 'output.txt', 'correct.txt']);
    }

    // Delete everything.
    this._sandbox.teardown();

    //FIXME Look at output instead of exit code.
    if (_.isNull(status.status) || !_.isNil(status.error)) {
      return this._fail('Exception while checking the answer.', status);
    }

    if (!_.isNull(status.status) && status.status !== 0) {
      return this._publishEvaluation(0.0, 'Wrong answer', status.wallTime,
          status.memory);
    } else {
      return this._publishEvaluation(1.0, 'Correct answer', status.wallTime,
          status.memory);
    }
  }

  /**
   * Return a promise for the evaluation completion.
   *
   * @return {Promise}
   */
  getPromise() {
    return this._promise;
  }
}

module.exports = BatchTestcaseEvaluator;

// If this is being called from a shell, listen to the queue.
if (!module.parent) {
  const program = require('commander');

  program
      .version('0.0.1')
      .option('--fs-root [path]', 'Root of the network file system.')
      .option('--time-limit-multiplier [factor]', 'Time limit multiplier.', 1)
      .option('--memory-limit-multiplier [factor]', 'Memory limit multiplier.',
          1)
      .option('--redis-url [URL]', 'Redis connection string',
          'redis://localhost:6379')
      .parse(process.argv);

  if (_.isNil(program.fsRoot)) {
    throw new Error('Use --fs-root');
  }

  const testcaseEvaluatorOptions = {
    fileStoreRoot: program.fsRoot,
    timeLimitMultiplier: program.timeLimitMultiplier,
    memoryLimitMultiplier: program.memoryLimitMultiplier,
    redisConnectionString: program.redisUrl,
  };

  const queue = kue.createQueue({
    redis: testcaseEvaluatorOptions.redisConnectionString
  });

  queue.process('subjob', function(job, done) {
    try{
      const evaluator = new BatchTestcaseEvaluator(queue, job,
          testcaseEvaluatorOptions);
      evaluator.getPromise().then(function(result) {
        done(null, result);
      }, function(error) {
        done(error);
      });
    } catch (error) {
      console.error('Unhandled exception');
      console.error(error);
      done(error);
    }
  });
}
