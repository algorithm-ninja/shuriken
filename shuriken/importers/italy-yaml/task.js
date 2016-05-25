'use strict';

const _ = require('lodash');
const DDP = require('ddp.js').default;
const FileDB = require('shuriken-fs');
const WebSocket = require('ws');
const fse = require('fs-extra');
const yaml = require('js-yaml');
const path = require('path');
const should = require('should');
const slug = require('slug');


class DdpWrapper {
  constructor(ddpOptions) {
    this._callbacks = {};
    this._ddp = new DDP(ddpOptions);

    this._ddp.on('result', (msg) => {
      const id = msg.id, result = msg.result, error = msg.error;
      should(this._callbacks).have.property(id);
      this._callbacks[id](error, result);
    });
  }

  onConnected(callback) {
    this._ddp.on('connected', callback);
  }

  method(name, params, callback) {
    const resultHandle = this._ddp.method(name, params);
    this._callbacks[resultHandle] = callback;
  }

  disconnect() {
    this._ddp.disconnect();
  }
}

// FIXME Move this to the right place.
class FileHandlerWrapper {
  constructor(destPath, fileHandler) {
    this._destPath = destPath;
    this._fileHandler = fileHandler;
  }

  copyFromSync(path) {
    console.log(`[  >  ] Uploading ${this._destPath}`);
    this._fileHandler.copyFromSync(path);
  }
}

// FIXME Move this to the right place.
class FileDBWrapper {
  constructor(root) {
    this._FileDB = new FileDB(root);
  }

  get(path) {
    return new FileHandlerWrapper(path, this._FileDB.get(path));
  }
}

module.exports = class ItalyTaskImporter {
  constructor(packagePath, fileStoreRoot, shurikenEndpoint,
        revisionDescription) {
    this._path = packagePath;
    this._fileStoreRoot = fileStoreRoot;
    this._shurikenEndpoint = shurikenEndpoint;
    this._yaml = yaml.safeLoad(fse.readFileSync(
        path.join(this._path, 'task.yaml'), 'utf8'));

    /* jshint camelcase: false */
    this._codename = this._yaml.name;
    this._title = this._yaml.title;
    this._description = revisionDescription,
    /* jshint -W030 */
    this._evaluatorConf = {
      timeLimit: this._yaml.time_limit,
      memoryLimit: this._yaml.memory_limit,
      tcInputFileUriSchema: `shuriken://tasks/${this._codename}/` +
          `${revisionDescription}/input%d.%d.txt`,
      tcOutputFileUriSchema: `shuriken://tasks/${this._codename}/` +
          `${revisionDescription}/output%d.%d.txt`,
      evaluationStructure: [],
    };

    // Parse 'gen/GEN' to construct this._evaluatorConf.evaluationStructure.
    const genData = fse.readFileSync(path.join(this._path, 'gen', 'GEN'))
        .toString('utf-8');
    const thereAreSubtasks = (genData.indexOf('#ST:') !== -1);

    if (!thereAreSubtasks) {
      this._evaluatorConf.evaluationStructure.push({
        nTestcases: 0
      });
    }

    for (let line of genData.split(/\r?\n/)) {
      line = line.trim();

      // Ignore blank lines.
      if (line.length === 0) {
        continue;
      }

      if (line.startsWith('#ST:')) {
        console.log(this._evaluatorConf.evaluationStructure.length);
        this._evaluatorConf.evaluationStructure.push({
          subtaskValue: parseInt(line.substr(4)),
          nTestcases: 0
        });
      } else if (!line.startsWith('#') || line.startsWith('#COPY:')) {
        _.last(this._evaluatorConf.evaluationStructure).nTestcases += 1;
      }
    }

    if (thereAreSubtasks) {
      this._evaluatorConf.intraSubtaskAggregation = 'min';
      this._evaluatorConf.interSubtaskAggregation = 'sum';
    } else {
      this._evaluatorConf.intraSubtaskAggregation = 'sum';
      this._evaluatorConf.interSubtaskAggregation = 'sum';
    }
  }

  /**
   * Inserts a new Task document if it doesn't already exist, otherwise it
   * returns the ID of the existing one.
   *
   * @private
   * @returns {String} ObjectId.valueOf()
   */
  _insertTask(callback) {
    this._ddpWrapper.method('tasks.insertIfNotExisting', [this._codename],
        (err, result) => {
          if (!err) {
            callback(result);
          } else {
            console.error('[  !  ] Could not insert task.');
            throw new Error(JSON.stringify(err));
          }
        });
  }

  /**
   * Inserts a new TaskRevision document.
   *
   * @private
   * @returns {String} ObjectId.valueOf()
   */
  _insertTaskRevision(callback) {
    this._ddpWrapper.method('taskRevisions.insertByCodename',
        [
          this._codename,
          this._title,
          'http://www.pdf995.com/samples/pdf.pdf', //FIXME
          this._evaluatorConf,
          this._description,
        ], (err, result) => {
          if (!err) {
            callback(result);
          } else {
            console.error('[  !  ] Could not insert taskRevision.');
            throw new Error(JSON.stringify(err));
          }
        });
  }

  /**
   * Imports task data into the file-store.
   *
   * @private
   */
  _uploadTaskData(taskRevisionId) {
    const revisionDirname = slug(`${this._description}__${taskRevisionId}`);

    let subtaskIndex = 0;
    let testcaseAbsIndex = -1;

    for (let subtask of this._evaluatorConf.evaluationStructure) {
      subtaskIndex += 1;

      for (let testcaseRelIndex = 1; testcaseRelIndex <= subtask.nTestcases;
          testcaseRelIndex++) {
        // Move to the next testcase
        testcaseAbsIndex += 1;

        const fileDB = new FileDBWrapper(this._fileStoreRoot);

        // Import input file
        let fileHandler = fileDB.get('shuriken://' +
            path.join('tasks', this._codename,
            revisionDirname,
            `input${subtaskIndex}.${testcaseRelIndex}.txt`));

        fileHandler.copyFromSync(path.join(this._path, 'input',
            `input${testcaseAbsIndex}.txt`));

        // Import output file
        fileHandler = fileDB.get('shuriken://' +
            path.join('tasks', this._codename,
            revisionDirname,
            `output${subtaskIndex}.${testcaseRelIndex}.txt`));

        fileHandler.copyFromSync(path.join(this._path, 'output',
            `output${testcaseAbsIndex}.txt`));

        // Import checker source file.
        // FIXME: there could be a 'checker.py' or 'checker.sh' and so on.
        if (fse.ensureFileSync(path.join(this._path, 'cor', 'checker.cpp'))) {
          // FIXME: ditto.
          fileHandler = fileDB.get('shuriken://' +
              path.join('tasks', this._codename,
              revisionDirname,
              'checker.cpp'));

          // FIXME: ditto.
          fileHandler.copyFromSync(path.join(this._path, 'cor', 'checker.cpp'));

          this._checkerSourceUri = `shuriken://tasks/` +
              `${this._codename}/${revisionDirname}/` +
              `checker.cpp`;
        }
      }
    }
  }

  run() {
    this._ddpWrapper = new DdpWrapper({
      endpoint: this._shurikenEndpoint,
      SocketConstructor: WebSocket,
    });

    console.log(
        `[     ] Connecting to DDP endpoint ${this._shurikenEndpoint}...`);

    this._ddpWrapper.onConnected(() => {
      console.log('[ DDP ] Connected');

      console.log(`[     ] Checking for task ${this._codename}`);
      this._insertTask((taskOId) => {
        // Workaround for EJSON.
        const taskId = taskOId.$value;

        console.log(`[  *  ] Task has ID ${taskId}`);
        console.log(`[     ] Inserting task revision ` +
            `(description: ${this._description})`);
        this._insertTaskRevision((taskRevisionOId) => {
          // Workaround for EJSON.
          const taskRevisionId = taskRevisionOId.$value;
          console.log(`[  *  ] Task revision has ID ${taskRevisionId}`);

          console.log(`[     ] Uploading problem data`);
          this._uploadTaskData(taskRevisionId);
          console.log('[=====] Import complete, disconnecting');

          this._ddpWrapper.disconnect();
        });
      });
    });
  }
};
