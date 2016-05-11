'use strict';

const fse = require('fs-extra');
const childProcess = require('child_process');
const temp = require('temp').track();
const path = require('path');
const should = require('should/as-function');

/**
 * Sandbox
 * =======
 *
 * This class implements a dummy sandbox, i.e. a sandbox meant to test the
 * system (it exposes all the methods and properties needed by other services)
 * without the constraint of having to be secure (so it works everywhere, not
 * just on special system configurations).
 *
 * NOTE: no real world evaluator should ever use this sandbox.
 *
 *
 * API
 * ---
 *
 * In order to run a command inside the sandbox, a service will need to use the
 * following API. The API allows to initialize a new sandbox (when a Sandbox
 * object is created), to copy files inside the sandbox, and to execute them.
 *
 */
module.exports = class Sandbox {
  /**
   * Initializes a new Sandbox object by creating a temporary directory in the
   * local filesystem. This temporary directory will be used for all operations
   * and will be automatically deleted.
   *
   * @todo Check if the temp.track() command actually deletes the directory
   *       (it advertises that it does, but it doesn't seem to do it on my PC,
   *       maybe we need to introduce a Sandbox.delete() method).
   * @constructor
   */
  constructor() {
    this._tempdir = temp.mkdirSync('sandbox');
    this._timeLimit = null;
    this._memoryLimit = null;
    this._stdin = null;
    this._stdout = null;
    this._stderr = null;
  }

  /**
   * This method takes a file path and a file name. It makes a copy of the file
   * located at the specified path, and puts the copy into the sandbox with a
   * new name.
   *
   * @param {string} the absolute path of the file to copy.
   * @param {?string} the new name of the file. If not specified, the name is
                      left unchanged.
   */
  add(filename, newFilename) {
    // Sanity checks
    should(filename).be.a.String();
    should(fse.statSync(filename).isFile()).be.true();
    if (newFilename) {
      should(newFilename).be.a.String();
      should(newFilename.length).be.above(0);
    }

    try {
      newFilename = newFilename || path.basename(filename);
      newFilename = path.join(this._tempdir, newFilename);
      fse.copySync(filename, newFilename);
    } catch (err) {
      console.error(err);
    }

    return this;
  }

  /**
   * This method takes the name of a stream, a filename, and a mode. It's a
   * helper method that redirects the given stream to the given file.
   *
   * @private
   * @param {string} the stream to redirect: one of 'stdin', 'stdout', 'stderr'.
   * @param {string} the filename that will be used to redirect the stream.
   * @param {string} a valid file mode ('r', 'r+', 'w', 'a', and so on).
   */
  _redirect(stream, filename, mode) {
    // Sanity checks
    should(stream).be.equalOneOf(['stdin', 'stdout', 'stderr']);
    should(filename).be.a.String();
    should(filename.length).be.above(0);
    should(mode).be.a.String();
    should(mode.length).be.above(0);

    // Override stream
    this['_' + stream] = fse.openSync(path.join(this._tempdir, filename), mode);
    return this;
  }

  /**
   * This method takes the name of a file (that exists in the sandbox) and uses
   * it as the *standard input* stream for the next execution of a command.
   *
   * @param {string} the filename that will be used to redirect the data stream.
   */
  stdin(filename) {
    return this._redirect('stdin', filename, 'r');
  }

  /**
   * This method takes the name of a file (that exists in the sandbox) and uses
   * it as the *standard output* stream for the next execution of a command.
   *
   * @param {string} the filename that will be used to redirect the data stream.
   */
  stdout(filename) {
    return this._redirect('stdout', filename, 'w');
  }

  /**
   * This method takes the name of a file (that exists in the sandbox) and uses
   * it as the *standard error* stream for the next execution of a command.
   *
   * @param {string} the filename that will be used to redirect the data stream.
   */
  stderr(filename) {
    return this._redirect('stderr', filename, 'w');
  }

  /**
   * Set the amount of time that each next execution is allowed to consume.
   *
   * @param {number} amount of seconds.
   */
  timeLimit(time) {
    should(time)
        .be.a.Number()
        .and.not.be.Infinity()
        .and.be.above(0);

    this._timeLimit = time;
    return this;
  }

  /**
   * Set the amount of memory that each next execution is allowed to consume.
   *
   * @param {number} amount of MiB.
   */
  memoryLimit(memory) {
    should(memory)
        .be.a.Number()
        .and.not.be.Infinity()
        .and.be.above(0);

    this._memoryLimit = memory;
    return this;
  }

  /**
   * Set the "executable" permission bit to a given file inside the sandbox.
   *
   * @param {string} the name of the file that needs to be executable.
   */
  executable(filename) {
    fse.chmodSync(path.join(this._tempdir, filename), 0o775);
    return this;
  }

  /**
   * Run a file inside the sandbox.
   *
   * @param {string} the absolute path of the file to run.
   * @param {Array} a (possibly empty) array of strings, which will be passed
   *                as arguments to the command.
   * @param {Object} an object useful to override the default "options" Object
   *                 that it's passed to the spawn function.
   */
  run(command, args, moreOptions) {
    let options = {
      'cwd': this._tempdir,
      'killSignal': 'SIGKILL',
      'stdio': [0, 1, 2],
    };

    if (this._timeLimit) {
      options.timeout = this._timeLimit;
    }

    if (this._memoryLimit) {
      // sorry, we can't do much
      console.warn('The dummy sandbox is not able to limit memory!');
    }

    if (this._stdin) {
      options.stdio[0] = this._stdin;
    }

    if (this._stdout) {
      options.stdio[1] = this._stdout;
    }

    if (this._stderr) {
      options.stdio[2] = this._stderr;
    }

    if (moreOptions) {
      Object.assign(options, moreOptions);
    }

    return childProcess.spawnSync(command, args, options);
  }

  /**
   * Like Sandbox.run(), but the command is interpreted as a relative path to
   * the sandbox folder instead of an absolute path.
   */
  runRelative(command, args, moreOptions) {
    return this.run(path.join(this._tempdir, command), args, moreOptions);
  }
};
