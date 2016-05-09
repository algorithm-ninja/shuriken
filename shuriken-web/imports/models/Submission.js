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
 * | userId                  | User unique idenfier (STRING).      |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | contestId               | Contest unique ObjectId.            |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | taskId                  | Task unique ObjectId.               |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | submissionTime          | Submission datetime.                |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | submissionFileUri       | The path to the actual file.        |     N     |
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
        .and.have.properties('userId')
        .and.have.properties('contestId')
        .and.have.properties('taskId')
        .and.have.properties('submissionTime');
    if (Meteor.isServer) {
      should(json).have.properties('submissionFileUri');
    }

    if (_.has(json, '_id')) {
      should(json._id).be.ObjectId();
    }
    should(json.userId).be.String();
    should(json.contestId).be.ObjectId();
    should(json.taskId).be.ObjectId();
    should(json.submissionTime).be.Number();  //FIXME: better type?
    if (Meteor.isServer) {
      should(json.submissionFileUri).be.String();
    }

    if (_.has(json, '_id')) {
      this._id = json._id;
    }
    this.userId = json.userId;
    this.contestId = json.contestId;
    this.taskId = json.taskId;
    this.submissionTime = json.submissionTime;

    // Note: on the client this will be undefined.
    this.submissionFileUri = json.submissionFileUri;

    this._loaded = _.has(json, '_id');
  }

  /**
   * Exports a Submission object as JSON object, stripping away the _id field.
   *
   * @return The json object.
   */
  toJson() {
    return {
      userId: this.userId,
      contestId: this.contestId,
      taskId: this.taskId,
      submissionTime: this.submissionTime,
      submissionFileUri: this.submissionFileUri
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
