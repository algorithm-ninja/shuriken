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
 * Contest
 * =======
 *
 * Represents a contest.
 *
 * Fields
 * ------
 *
 * +-------------------------+-------------------------------------+-----------+
 * | Field name              | Description                         |  Client?  |
 * +-------------------------+-------------------------------------+-----------+
 * | _id                     | Contest unique ObjectId, defined    |     Y     |
 * |                         | by mongo.                           |           |
 * +-------------------------+-------------------------------------+-----------+
 * | codename                | Contest (unique) codename, meant to |     Y     |
 * |                         | be a human-friendly string.         |           |
 * +-------------------------+-------------------------------------+-----------+
 * | title                   | Contest title.                      |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 *
 * @todo Add support for users.
 * @todo Add start/end date.
 */
export class Contest {
  /**
   * Constructs a Contest object.
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
        .and.have.properties('codename')
        .and.have.properties('title');

    if (_.has(json, '_id')) {
      should(json._id).be.ObjectId();
    }
    should(json.codename).be.String();
    should(json.title).be.String();

    if (_.has(json, '_id')) {
      this._id = json._id;
    }
    this.codename = json.codename;
    this.title = json.title;

    this._loaded = _.has(json, '_id');
  }

  /**
   * Exports a Contest object as JSON object, stripping away the _id field.
   *
   * @return The json object.
   */
  toJson() {
    return {
      codename: this.codename,
      title: this.title,
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
