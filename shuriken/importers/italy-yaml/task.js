'use strict';

const FileDB = require('shuriken-fs');

const fse = require('fs-extra');
const yaml = require('js-yaml');
const path = require('path');
const should = require('should');
const slug = require('slug');
const WebSocket = require('ws');


module.exports = class ItalyTaskImporter {
  constructor(packagePath, fileStoreRoot, revisionDescription) {
    this._path = packagePath;
    this._fileStoreRoot = fileStoreRoot;
    this._yaml = yaml.safeLoad(fse.readFileSync(
        path.join(this._path, 'task.yaml'), 'utf8'));

    /* jshint camelcase: false */
    this._codename = this._yaml.name;
    this._title = this._yaml.title;
    this._description = revisionDescription,
    this._evaluatorConf = {
      timeLimit: this._yaml.time_limit,
      memoryLimit: this._yaml.memory_limit,
      tcInputFileUriSchema: `shuriken://tasks/${this._yaml.name}/` +
          `${revisionDescription}/input%d.%d.txt`,
      tcOutputFileUriSchema: `shuriken://tasks/${this._yaml.name}/` +
          `${revisionDescription}/output%d.%d.txt`,
    };

    if (fse.readFileSync(path.join(this._path, 'gen', 'GEN'))
        .indexOf('#ST') !== -1) {
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
  }

  /**
   * Inserts a new TaskRevision document.
   *
   * @private
   * @returns {String} ObjectId.valueOf()
   */
  _insertTaskRevision(callback) {
  }

  /**
   * Imports task data into the file-store.
   *
   * @private
   */
  _uploadTaskData(taskRevisionId) {
    console.log(this)_;

    const genData = fse.readFileSync(path.join('gen', 'GEN')).split(/\r?\n/);

    let subtaskIndex = 0;
    let testcaseAbsIndex = -1;
    let testcaseRelIndex = 0;

    let thereAreSubtask = false;

    for (let line of genData) {
      line = line.trim();

      if (line.startsWith('#ST:')) {
        thereAreSubtask = true;
      }
    }

    if (!thereAreSubtask) {
      subtaskIndex = 1;
    }

    for (let line of genData) {
      line = line.trim();

      if (line.startsWith('#ST:')) {
        subtaskIndex += 1;
        testcaseRelIndex = 0;
      } else if (!line.startsWith('#') || line.startsWith('#COPY:')) {
        testcaseAbsIndex += 1;
        testcaseRelIndex += 1;

        const fileDB = new FileDB(this._fileStoreRoot);

        // Import input file
        let fileHandler = fileDB.get('shuriken://' +
            path.join('tasks', this._codename,
            slug(this._description + taskRevisionId),
            `input${subtaskIndex}.${testcaseRelIndex}.txt`));

        fileHandler.copyFromSync(path.join('input',
            `input${testcaseAbsIndex}.txt`));

        // Import output file
        fileHandler = fileDB.get('shuriken://' +
            path.join('tasks', this._codename,
            slug(this._description + taskRevisionId),
            `output${subtaskIndex}.${testcaseRelIndex}.txt`));

        fileHandler.copyFromSync(path.join('output',
            `output${testcaseAbsIndex}.txt`));

        // FIXME: could be 'checker.py' or 'checker.java' and so on...
        if (fse.ensureFileSync(path.join('cor', 'checker.cpp'))) {
          // Import output file.
          // FIXME: ditto.
          fileHandler = fileDB.get('shuriken://' +
              path.join('tasks', this._codename,
              slug(this._description + taskRevisionId),
              'checker.cpp');

          // FIXME: ditto.
          fileHandler.copyFromSync(path.join('output', 'checker.cpp'));

          this._checkerSourceUri = `shuriken://tasks/` +
              `${this._codename}/${this._description}/checker.cpp`;
        }
      }
    }
  }

  run() {
  }
};
