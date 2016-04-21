'use strict';

const Sandbox = require('../sandboxes/dummy');

const kue = require('kue');
const domain = require('domain').create();
const queue = kue.createQueue();
const should = require('should');
const _ = require('lodash');

/**
 * BatchTestcaseEvaluator
 * ======================
 *
 * This class implements a testcase evaluator for the Batch problem type.
 *
 * Evaluator Configuration
 * -----------------------
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
 * | submissionLanguage      | A string identifying the language   |     N     |
 * |                         | used in the submissionFile. If null |           |
 * |                         | or not set, this will be guessed    |           |
 * |                         | from the file extension. Currently  |           |
 * |                         | we support the following languages: |           |
 * |                         | - 'GCC_C                            |           |
 * |                         | - 'GCC_CXX'                         |           |
 * |                         | - 'JAVA'                            |           |
 * |                         | - 'PYTHON3'                         |           |
 * |                         | - 'CSHARP'                          |           |
 * +-------------------------+-------------------------------------+-----------+
 * | graderSourceUri         | URI of the grader file.             |     N     |
 * +-------------------------+-------------------------------------+-----------+
 * | checkerSourceUri        | URI of the checker file.            |     N     |
 * +-------------------------+-------------------------------------+-----------+
 * | checkerLanguage         | Language for checker. See above for |     N     |
 * |                         | more information.                   |           |
 * +-------------------------+-------------------------------------+-----------+
**/

class BatchTestcaseEvaluator {
  /**
   * Receive a link to the Kue Job and the callback to inform the queue manager
   * that the evaluation has finished.
   *
   * @param {!Object} job The current Kue Job.
   * @param {function} doneCallback Callback to inform the queue manager that
   *                       the evaluation has finished.
   * @constructor
   */
  constructor(job, done) {
    this.kueJob = job;
    this.doneCallback = doneCallback;

    // Parse the configuration for this job (found in job.data()).
    // Step 0. jobConfig must be an Object.
    this._config = job.data;
    this._config.should.be.Object();

    // Step 1. Check all mandatory fields are there.
    this._config
        .should.have.properties('submissionFileUri')
        .and.have.properties('tcInputFileUri')
        .and.have.properties('tcOutputFileUri')
        .and.have.properties('timeLimit')
        .and.have.properties('memoryLimit');

    // Step 2. Set all non mandatory fields to the default values.
    this._config.submissionLanguage = _.get(this._config, 'submissionLanguage',
        this._guessLanguageFromFileExtension(this._config.submissionFileUri));

    this._config.checkerLanguage = _.get(this._config, 'checkerLanguage',
        this._guessLanguageFromFileExtension(this._config.checkerSourceUri));

    this._config.graderSourceUri =
        _.get(this._config, 'graderSourceUri', null);

    this._config.checkerSourceUri =
        _.get(this._config, 'checkerSourceUri', null);

    // Step 3. For each field, check values are feasible.
    this._config.submissionFileUri.should.be.String();

    this._config.tcInputFileUri.should.be.String();

    this._config.tcOutputFileUri.should.be.String();

    this._config.timeLimit
        .should.be.Number()
        .and.not.be.Infinity()
        .and.be.above(0);

    this._config.memoryLimit
        .should.be.Number()
        .and.not.be.Infinity()
        .and.be.above(0);

    this._config.submissionLanguage
        .should.be.String()
        .and.equalOneOf(['GCC_C', 'GCC_CXX', 'JDK_JAVA', 'CPYTHON_PYTHON3',
            'MONO_CSHARP']);

    this._config.checkerLanguage
        .should.be.String()
        .and.equalOneOf(['GCC_C', 'GCC_CXX', 'JDK_JAVA', 'CPYTHON_PYTHON3',
            'MONO_CSHARP']);

    if (this._config.checkerSourceUri) {
      this._config.checkerSourceUri.should.be.String();
    }

    if (this._config.graderSourceUri) {
      this._config.graderSourceUri.should.be.String();
    }

    // Step 4. Check all URIs as a pre-check.
    this._validateUris().should.be.true();

    // Step 5. Create the sandbox object.
    this._sandbox = new Sandbox()
        .timeLimit(this._config.timeLimit * 1000.0)
        .memoryLimit(this._config.memoryLimit);
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
    this._config.submissionFileUri.startsWith('file://').should.be.true();
    this._config.tcInputFileUri.startsWith('file://').should.be.true();

    if (this._config.tcOutputFileUri) {
      this._config.tcOutputFileUri.startsWith('file://').should.be.true();
    }

    if (this._config.checkerSourceUri) {
      this._config.checkerSourceUri.startsWith('file://').should.be.true();
    }

    if (this._config.graderSourceUri) {
      this._config.graderSourceUri.startsWith('file://').should.be.true();
    }

    this._config.submissionFileUri =
        this._config.submissionFileUri.replace('file://', '');

    this._config.tcInputFileUri =
        this._config.tcInputFileUri.replace('file://', '');

    if (this._config.tcOutputFileUri) {
      this._config.tcOutputFileUri =
          this._config.tcOutputFileUri.replace('file://', '');
    }

    if (this._config.checkerSourceUri) {
      this._config.checkerSourceUri =
          this._config.checkerSourceUri.replace('file://', '');
    }

    if (this._config.graderSourceUri) {
      this._config.graderSourceUri =
          this._config.graderSourceUri.replace('file://', '');
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
    sourceFileUri.should.be.String();

    if (/^.*\.(c|C)$/.test(sourceFileUri)) {
      return 'GCC_C';
    } else if (/^.*\.(cc|cpp|cxx)$/.test(sourceFileUri)) {
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
   * If necessary, compile the source and the grader. For languages such as
   * Python, this is a no-op.
   *
   * @todo Actually deal with URIs. For now URIs and file paths are the same.
   *
   * @private
   * @param {string} entryPointUri Uri to the "main" file.
   * @param {?Array} helperFileUris Other files to copy to the working dir.
   * @param {string} language The language string (see class doc).
   * @return {Object} The status returned by the sandbox.
   */
  _compileFile(entryPointUri, helperFileUris, language) {
    let status;
    let args = [];

    if (helperFileUris) {
      helperFileUris = _.castArray(helperFileUris);
    } else {
      helperFileUris = [];
    }

    this._sandbox.add(this._config.submissionFileUri);

    switch (this._config.submissionLanguage) {
      case 'GCC_CXX':
        args = _.concat(['-Wall', '-Wextra', '-std=c++14', '-O3', '-o',
            entryPointUri + '.bin',
            entryPointUri], helperFileUris);

        status = this._sandbox.run('g++', args);
        break;

      case 'GCC_C':
        args = _.concat(['-Wall', '-Wextra', '-std=c11', '-O3', '-o',
            entryPointUri + '.bin',
            entryPointUri], helperFileUris);

        status = this._sandbox.run('gcc', args);
        break;

      case 'JDK_JAVA':
        args = _.concat([entryPointUri], helperFileUris);

        status = this._sandbox.run('javac', args);
        break;

      case 'CPYTHON_PYTHON3':
        break;

      case 'MONO_CSHARP':
        args = _.concat(['-out:' + entryPointUri + '.exe', entryPointUri],
            helperFileUris);

        status = this._sandbox.run('mcs', args);
        break;
    }

    return status;
  }

  /**
   * Runs the submission executable file.
   *
   * @todo Actually deal with URIs. For now URIs and file paths are the same.
   *
   * @private
   * @param {string} executableFileUri The file to run.
   * @param {string} language The language string (see class doc).
   * @return {Object} The status returned by the sandbox.
   */
  _runExecutable(executableFileUri, language) {
    let status;
    let args = [];

    switch (language) {
      case 'GCC_CXX':
      case 'GCC_C':
        status = this._sandbox.runRelative(executableFileUri, []);
        break;

      case 'JDK_JAVA':
        status = this._sandbox.run('java', [executableFileUri]);
        break;

      case 'CPYTHON_PYTHON3':
        status = this._sandbox.run('python3', [executableFileUri]);
        break;

      case 'MONO_CSHARP':
        status = this._sandbox.run('mono', [executableFileUri]);
        break;
    }

    return status;
  }

  /**
   * Main entry point. Evaluate the submission.
   */
  run() {
    // Compile contestant solution.
    let status = this._compileFile(this._config.submissionFileUri,
        this._config.this._config.graderFileUri,
        this._config.submissionLanguage);

    if (status.status) {
      this.done({
          score: 0.0,
          message: 'Compilation error, exit code ' + status.status});
      return;
    }

    // Run contestant solution.
    this._sandbox.add(this._config.tcInputFileUri, 'input.txt')
        .stdin('input.txt')
        .stdout('output.txt');

    let executableFileUri;
    switch (this._config.submissionLanguage) {
      case 'GCC_CXX':
      case 'GCC_C':
        executableFileUri = this._config.submissionFileUri + '.bin';
        break;

      case 'JDK_JAVA':
        if (this._config.graderFileUri) {
          executableFileUri = this._config.graderFileUri.substr(0, this._config.graderFileUri.length - 5);
        } else {
          executableFileUri = this._config.submissionFileUri.substr(0, this._config.submissionFileUri.length - 5);
        }
        break;

      case 'CPYTHON_PYTHON3':
        if (this._config.graderFileUri) {
          executableFileUri = this._config.graderFileUri;
        } else {
          executableFileUri = this._config.submissionFileUri;
        }
        break;

      case 'MONO_CSHARP':
        executableFileUri = this._config.submissionFileUri + '.exe';
        break;
    }
    status = this._runExecutable(executableFileUri,
        this._config.submissionFileUri);

    if (status.status) {
      this.done({
          score: 0.0,
          message: 'Execution failed with exit code ' + status.status});
      return;
    }

    // Check if solution is correct.
    if (this._config.tcOutputFileUri) {
      this._sandbox.add(this._config.tcOutputFileUri, 'correct.txt');
    }

    if (this._config.checkerSourceUri) {
      this._compileFile(this._config.checkerSourceUri, null,
          this._config.checkerLanguage);
      status = this._evaluateSubmissionFile(this._config.submissionFileUri,
          null, this._config.checkerLanguage);
    } else {
      status = this._sandbox.run('diff',
          ['--ignore-trailing-space', 'output.txt', 'correct.txt']);
    }

    //FIXME Look at output instead of exit code.
    if (status.status) {
      this.done({
          score: 0.0,
          message: 'Wrong Answer'});
      return;
    } else {
      this.done({
          score: 1.0,
          message: 'Correct Answer'});
      return;
    }
  }
}

queue.process('subjob', function(job, done) {
  let d = domain.create();
  d.on('error', (err) => {
    done(err);
  });
  d.run(() => {
    let evaluator = new BatchTestcaseEvaluator(job, done);
    evaluator.run();
  });
});
