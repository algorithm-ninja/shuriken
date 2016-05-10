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
 * ContestTask
 * ===========
 *
 * Specifies which taskRevisions are associated with a specific contest.
 *
 * Fields
 * ------
 *
 * +-------------------------+-------------------------------------+-----------+
 * | Field name              | Description                         |  Client?  |
 * +-------------------------+-------------------------------------+-----------+
 * | _id                     | ContestTask unique ObjectId.        |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | contestId               | Contest unique ObjectId.            |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | taskRevisionId          | taskRevision unique ObjectId.       |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 *
 */
export class ContestTask {
  /**
   * Constructs a ContestTask object.
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
   * Initializes a ContestTask from JSON object.
   *
   * @param {!Object} json
   */
  fromJson(json) {
    should(json)
        .be.Object()
        .and.have.properties('contestId')
        .and.have.properties('taskRevisionId');

    if (_.has(json, '_id')) {
      should(json._id).be.ObjectId();
    }
    should(json.contestId).be.ObjectId();
    should(json.taskRevisionId).be.ObjectId();

    if (_.has(json, '_id')) {
      this._id = json._id;
    }
    this.contestId = json.contestId;
    this.taskRevisionId = json.taskRevisionId;

    this._loaded = _.has(json, '_id');
  }

  /**
   * Exports a ContestTask as JSON object, stripping away the _id field.
   *
   * @return The json object.
   */
  toJson() {
    return {
      contestId: this.contestId,
      taskRevisionId: this.taskRevisionId,
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
