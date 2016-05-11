'use strict';

const _ = require('lodash');
const should = require('should/as-function');

should.Assertion.add('ObjectId', function() {
  this.params = { operator: 'to be ObjectId' };

  should(this.obj)
      .be.Object()
      .and.have.properties('_str');
});

/**
 * TaskRevision
 * ============
 *
 * Task revisions.
 *
 * Fields
 * ------
 *
 * +-------------------------+-------------------------------------+-----------+
 * | Field name              | Description                         |  Client?  |
 * +-------------------------+-------------------------------------+-----------+
 * | _id                     | Revision unique ObjectId.           |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | taskId                  | Task unique ObjectId.               |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | title                   | A string representing the title of  |     Y     |
 * |                         | the task                            |           |
 * +-------------------------+-------------------------------------+-----------+
 * | statementPdfUri         | An URI to the statement pdf file.   |     Y     |
 * |                         | *WARNING*: the URI is passed to the |           |
 * |                         | clients and therefore must be       |           |
 * |                         | reachable from them.                |           |
 * +-------------------------+-------------------------------------+-----------+
 * | evaluatorConf           | An object representing the conf to  |     N     |
 * |                         | be dispatched to the evaluators     |           |
 * |                         | when an evalation of this revision  |           |
 * |                         | is requested.                       |           |
 * +-------------------------+-------------------------------------+-----------+
 *
 */
export class TaskRevision {
  /**
   * Constructs a TaskRevision object.
   *
   * @param {?Object} json If not nil, parse json and initialize object.
   */
  constructor(json) {
    this._loaded = false;

    if (!_.isNil(json)) {
      this.fromJson(json);
    }
  }

  /**
   * Initializes a TaskRevision from JSON object.
   *
   * @param {!Object} json
   */
  fromJson(json) {
    should(json)
        .be.Object()
        .and.have.properties('taskId')
        .and.have.properties('title')
        .and.have.properties('statementPdfUri')
        .and.have.properties('evaluatorConf');

    if (_.has(json, '_id')) {
      should(json._id).be.ObjectId();
    }
    should(json.taskId).be.ObjectId();
    should(json.title).be.String();
    should(json.statementPdfUri).be.String();
    if (_.isNull(json.evaluatorConf)) {
      should(json.evaluatorConf).be.Object();
    }

    if (_.has(json, '_id')) {
      this._id = json._id;
    }
    this.taskId = json.taskId;
    this.title = json.title;
    this.statementPdfUri = json.statementPdfUri;
    this.evaluatorConf = json.evaluatorConf;

    this._loaded = _.has(json, '_id');
  }

  /**
   * Exports a TaskRevision as JSON object, stripping away the _id field.
   *
   * @return The json object.
   */
  toJson() {
    return {
      taskId: this.taskId,
      title: this.title,
      statementPdfUri: this.statementPdfUri,
      evaluatorConf: this.evaluatorConf,
    };
  }

  /**
   * Returns the value of this._loaded.
   *
   * @return {Boolean}
   */
  isLoaded() {
    return this._loaded;
  }
}
