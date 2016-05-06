'use strict';

const _ = require('lodash');
const sanitizeHtml = require('sanitize-html');
const should = require('should');

should.Assertion.add('ObjectId', function() {
  this.params = { operator: 'to be ObjectId' };

  should(this.obj)
      .be.Object()
      .and.have.properties('_str');
});

/**
 * Evaluation
 * ==========
 *
 * Represents an evaluation of a Submission. As this is tightly coupled with
 * Kue, we export some fields owned by the corresponding Kue job evaluating
 * the submission to the Evaluation object.
 *
 * Fields
 * ------
 *
 * +-------------------------+-------------------------------------+-----------+
 * | Field name              | Description                         |  Client?  |
 * +-------------------------+-------------------------------------+-----------+
 * | _id                     | Evaluation unique ObjectId,         |     Y     |
 * |                         | defined by mongo.                   |           |
 * +-------------------------+-------------------------------------+-----------+
 * | submissionId            | Submission unique ObjectId          |     Y     |
 * |                         | (see Submission object).            |           |
 * +-------------------------+-------------------------------------+-----------+
 * | taskRevisionId          | Task revision ObjectId.             |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | isLive                  | Boolean. If True, this is the       |     Y     |
 * |                         | evaluation whose score is shown to  |           |
 * |                         | the user for the associtated        |           |
 * |                         | submission.                         |           |
 * +-------------------------+-------------------------------------+-----------+
 * | isLost                  | Used to indicate that the job id    |     Y     |
 * |                         | was not found in Kue.               |           |
 * +-------------------------+-------------------------------------+-----------+
 *
 * Kue-related fields:
 * +-------------------------+-------------------------------------+-----------+
 * | kueJobId                | An integer representing the job id  |     Y     |
 * |                         | in Kue.                             |           |
 * +-------------------------+-------------------------------------+-----------+
 * | kueData                 | Configuration data for the job.     |           |
 * +-------------------------+-------------------------------------+-----------+
 * | kueState                | A string representing the job       |     Y     |
 * |                         | status. The possible states are:    |           |
 * |                         | - 'complete'                        |           |
 * |                         | - 'active'                          |           |
 * |                         | - 'failed'                          |           |
 * |                         | - 'inactive' (queued)               |           |
 * |                         | - 'delayed'                         |           |
 * +-------------------------+-------------------------------------+-----------+
 * | kueCreatedAt            | A UNIX timestamp representing the   |     Y     |
 * |                         | job creation time.                  |           |
 * +-------------------------+-------------------------------------+-----------+
 * | kueAttempts             | An integer representing the number  |     Y     |
 * |                         | of attempts so far.                 |           |
 * +-------------------------+-------------------------------------+-----------+
 * | kueError                | An error object representing the    |     Y     |
 * |                         | last occurring error. May be null.  |           |
 * +-------------------------+-------------------------------------+-----------+
 * | kueResult               | A on object with this structure     |     Y     |
 * |                         | - score: score given to the         |           |
 * |                         |          submission.                |           |
 * |                         | - maxScore: max achievable score.   |           |
 * |                         |          May be null if not         |           |
 * |                         |          applicable.                |           |
 * |                         | May be null when no result is       |           |
 * |                         | available yet.                      |           |
 * +-------------------------+-------------------------------------+-----------+
 * | kueProgress             | An integer from 0 to 100.           |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | kueProgressData         | An HTML string. May be null.        |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 */
export class Evaluation {
  /**
   * Constructs an Evaluation object.
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
   * Initializes an Evaluation object from JSON object.
   *
   * @param {!Object} json
   */
  fromJson(json) {
    should(json)
        .be.Object()
        .and.have.properties('submissionId')
        .and.have.properties('taskRevisionId')
        .and.have.properties('isLive')
        .and.have.properties('isLost')
        .and.have.properties('kueJobId')
        .and.have.properties('kueData')
        .and.have.properties('kueState')
        .and.have.properties('kueCreatedAt')
        .and.have.properties('kueAttempts')
        .and.have.properties('kueError')
        .and.have.properties('kueResult')
        .and.have.properties('kueProgress')
        .and.have.properties('kueProgressData');

    if (_.has(json, '_id')) {
      should(json._id).be.ObjectId();
    }
    should(json.submissionId).be.ObjectId();
    should(json.taskRevisionId).be.ObjectId();
    should(json.isLive).be.Boolean();
    should(json.isLost).be.Boolean();

    should(json.kueJobId).be.Number();
    should(json.kueData).be.Object();
    should(json.kueState)
        .be.String()
        .and.equalOneOf('complete', 'active', 'failed', 'inactive', 'delayed');

    should(json.kueCreatedAt).be.Number();
    should(json.kueAttempts).be.Number();

    if (!_.isNull(json.kueResult)) {
      should(json.kueResult)
          .be.Object()
          .and.have.properties('score')
          .and.have.properties('maxScore');
    }
    should(json.kueProgress).be.Number();
    if (!_.isNull(json.kueProgressData)) {
      should(json.kueProgressData).be.String();
    }

    if (_.has(json, '_id')) {
      this._id = json._id;
    }
    this.submissionId = json.submissionId;
    this.taskRevisionId = json.taskRevisionId;
    this.isLive = json.isLive;
    this.isLost = json.isLost;
    this.kueJobId = json.kueJobId;
    this.kueData = json.kueData;
    this.kueState = json.kueState;
    this.kueCreatedAt = json.kueCreatedAt;
    this.kueAttempts = json.kueAttempts;
    this.kueError = json.kueError;
    this.kueResult = json.kueResult;
    this.kueProgress = json.kueProgress;
    //FIXME Sanitize HTML, something like:
    // this.kueProgressData = sanitizeHtml(json.kueProgressData, {
    //     allowedTags: sanitizeHtml.defaults.allowedTags.concat(['style']),
    // });
    this.kueProgressData = json.kueProgressData;
    this._loaded = _.has(json, '_id');
  }

  /**
   * Exports an Evaluation object as JSON object, stripping away the _id field.
   *
   * @return The json object.
   */
  toJson() {
    return {
      submissionId: this.submissionId,
      taskRevisionId: this.taskRevisionId,
      isLive: this.isLive,
      isLost: this.isLost,
      kueJobId: this.kueJobId,
      kueState: this.kueState,
      kueData: this.kueData,
      kueCreatedAt: this.kueCreatedAt,
      kueAttempts: this.kueAttempts,
      kueError: this.kueError,
      kueResult: this.kueResult,
      kueProgress: this.kueProgress,
      kueProgressData: this.kueProgressData,
    };
  }

  /**
   * Update all kue* fields from the associated Kue Job.
   *
   * @param {!Object} kueJob The Kue Job.
   */
  updateFromKueJob(kueJob) {
   should(kueJob).be.Object();

   const json = kueJob.toJSON();
   should(json).be.Object();
   should(json.id).be.equal(this.kueJobId);

   if (!_.isNil(json.state)) {
     should(json.state)
         .be.String()
         .and.equalOneOf('complete', 'active', 'failed', 'inactive', 'delayed');
     this.kueState = json.state;
   }
   if (!_.isNil(json.created_at)) {
     should(+json.created_at).be.Number();
     this.kueCreatedAt = +json.created_at;
   }
   if (!_.isNil(json.attempts)) {
     should(json.attempts.made).be.Number();
     this.kueAttempts = json.attempts.made;
   }
   if (!_.isNil(json.error)) {
     this.kueError = json.error;
   }
   if (!_.isNil(json.result)) {
     should(json.result)
         .be.Object()
         .and.have.properties('score')
         .and.have.properties('maxScore');
     this.kueResult = json.result;
   }
   if (!_.isNil(json.progress)) {
     should(+json.progress).be.Number();
     this.kueProgress = +json.progress;
   }
   if (!_.isNil(json.progress_data)) {
     should(json.progress_data).be.String();
     //FIXME Sanitize HTML!
     // this.kueProgressData = sanitizeHtml(json.progress_data, {
     //    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['style']),
     // });
     this.kueProgressData = json.progress_data;
   }
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
