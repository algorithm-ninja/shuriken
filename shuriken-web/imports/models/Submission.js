'use strict';

const _ = require('lodash');
const should = require('should');

should.Assertion.add('ObjectId', function() {
  this.params = { operator: 'to be ObjectId' };

  should(this.obj)
      .be.Object()
      .and.have.properties('_str');
});

/**
 * Submission
 * ==========
 *
 * Represents a submission.
 *
 * Fields
 * ------
 *
 * +-------------------------+-------------------------------------+-----------+
 * | Field name              | Description                         |  Client?  |
 * +-------------------------+-------------------------------------+-----------+
 * | _id                     | Submission unique ObjectId,         |     Y     |
 * |                         | defined by mongo.                   |           |
 * +-------------------------+-------------------------------------+-----------+
 * | userId                  | User unique ObjectId.               |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | contestId               | Contest unique ObjectId.            |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | taskId                  | Task unique ObjectId.               |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | submissionTime          | Submission datetime.                |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 *
 * @todo Add support for date/time and submission file.
 */
export class Submission {
  /**
   * Constructs a Submission object.
   *
   * @param {?Object} json If not nil, parse json and initialize object.
   */
  constructor(json) {
    this._loaded = false;

    if (!_.isNil(json)) {
      this.fromJson(json);
    }
  }

  fromJson(json) {
    should(json)
        .be.Object()
        .and.have.properties('_id')
        .and.have.properties('userId')
        .and.have.properties('contestId')
        .and.have.properties('taskId')
        .and.have.properties('submissionTime');

    should(json._id).be.ObjectId();
    should(json.userId).be.ObjectId();
    should(json.contestId).be.ObjectId();
    should(json.taskId).be.ObjectId();
    //FIXME: better type?
    should(json.submissionTime).be.Number();

    this._id = json._id;
    this.userId = json.userId;
    this.contestId = json.contestId;
    this.taskId = json.taskId;
    this.submissionTime = json.submissionTime;

    this._loaded = true;
  }

  /**
   * Exports a Submission object as JSON object.
   *
   * @return The json object.
   */
  toJson() {
    return {
      _id: this._id,
      userId: this.userId,
      contestId: this.contestId,
      taskId: this.taskId,
      submissionTime: this.submissionTime,
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
