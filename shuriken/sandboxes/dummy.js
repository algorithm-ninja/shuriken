'use strict';

var fse = require('fs-extra');
var child_process = require('child_process');
var temp = require('temp').track();
var path = require('path');

module.exports = class Sandbox {
    constructor() {
      this._tempdir = temp.mkdirSync('sandbox');
      this._timeLimit = null;
      this._memoryLimit = null;
      this._stdin = null;
      this._stdout = null;
      this._stderr = null;
    }

    add(filename, newFilename) {
        try {
          newFilename = newFilename || path.basename(filename);
          newFilename = path.join(this._tempdir, newFilename);
          fse.copySync(filename, newFilename);
          console.log("success!")
        } catch (err) {
          console.error(err)
        }

        return this;
    }

    _redirect(stream, filename, mode) {
        this['_' + stream] = fse.openSync(path.join(this._tempdir, filename), mode);
        return this;
    }

    stdin(filename) {
        return this._redirect('stdin', filename, 'r');
    }

    stdout(filename) {
        return this._redirect('stdout', filename, 'w');
    }

    stderr(filename) {
        return this._redirect('stderr', filename, 'w');
    }

    timeLimit(time) {
        this._timeLimit = time;
        return this;
    }

    memoryLimit(memory) {
        this._memoryLimit = memory;
        return this;
    }

    executable(filename) {
        fse.chmodSync(path.join(this._tempdir, filename), 0o775);
        return this;
    }

    run(command, args, moreOptions) {
        var options = {
            'cwd': this._tempdir,
            'killSignal': 'SIGKILL',
            'stdio': [0, 1, 2],
        };

        if (this._timeLimit) {
            options['timeout'] = this._timeLimit;
        }

        if (this._memoryLimit) {
            // sorry, we can't do much
        }

        if (this._stdin) {
            options['stdio'][0] = this._stdin;
        }

        if (this._stdout) {
            options['stdio'][1] = this._stdout;
        }

        if (this._stderr) {
            options['stdio'][2] = this._stderr;
        }

        if (moreOptions) {
            Object.assign(options, moreOptions);
        }

        return child_process.spawnSync(command, args, options);
    }

    runRelative(command, args, moreOptions) {
        return this.run(path.join(this._tempdir, command), args, moreOptions);
    }
}
