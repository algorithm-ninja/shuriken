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
 * | tasks                   | A list of objects. Every object     |     Y     |
 * |                         | represents one task in the contest, |           |
 * |                         | having the following fields:        |           |
 * |                         | - taskId: task unique ObjectId,     |           |
 * |                         | - taskRevisionId: revision ObjectId |           |
 * |                         | See also Task.                      |           |
 * +-------------------------+-------------------------------------+-----------+
 *
 * @todo Add support for users.
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
        .and.have.properties('title')
        .and.have.properties('tasks');

    if (_.has(json, '_id')) {
      should(json._id).be.ObjectId();
    }
    should(json.codename).be.String();
    should(json.title).be.String();
    should(json.tasks).be.Array();

    _.each(json.tasks, (taskDescription) => {
      should(taskDescription)
          .be.Object()
          .and.have.properties('taskId')
          .and.have.properties('taskRevisionId');

      should(taskDescription.taskId).be.ObjectId();
      should(taskDescription.taskRevisionId).be.ObjectId();
    });

    if (_.has(json, '_id')) {
      this._id = json._id;
    }
    this.codename = json.codename;
    this.title = json.title;
    this.tasks = json.tasks;

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
      tasks: this.tasks,
    };
  }

  /**
   * Returns the taskRevision ObjectId associated to the given task ObjectId.
   *
   * @param {ObjectId} taskId
   * @return {ObjectId}
   */
  taskRevisionIdForTaskId(taskId) {
    should(this._loaded).be.true();

    const taskDescription = _.find(this.tasks, (taskDesc) => {
      return taskDesc.taskId.valueOf() === taskId.valueOf();
    });
    should(taskDescription).be.Object();
    return taskDescription.taskRevisionId;
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
