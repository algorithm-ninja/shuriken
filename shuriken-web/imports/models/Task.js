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
 * Task
 * ====
 *
 * A Task object represents a ``problem to be solved''.
 *
 * Fields
 * ------
 *
 * +-------------------------+-------------------------------------+-----------+
 * | Field name              | Description                         |  Client?  |
 * +-------------------------+-------------------------------------+-----------+
 * | _id                     | Task unique ObjectId, defined by    |     Y     |
 * |                         | mongo.                              |           |
 * +-------------------------+-------------------------------------+-----------+
 * | codename                | Task (unique) codename, meant to be |     Y     |
 * |                         | a human-friendly string.            |           |
 * +-------------------------+-------------------------------------+-----------+
 *
 */
export class Task {
  /**
   * Constructs a Task object.
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
   * Initializes a Task from JSON object.
   *
   * @param {!Object} json
   */
  fromJson(json) {
    should(json)
        .be.Object()
        .and.have.properties('_id')
        .and.have.properties('codename');

    should(json._id).be.ObjectId();
    should(json.codename).be.String();

    this._id = json._id;
    this.codename = json.codename;

    this._loaded = true;
  }

  /**
   * Exports a Task as JSON object.
   *
   * @return The json object.
   */
  toJson() {
    return {
      _id: this._id,
      codename: this.codename,
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
