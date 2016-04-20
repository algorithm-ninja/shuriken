'use strict';

const kue = require('kue');
const queue = kue.createQueue();
const assert = require('assert');
const _ = require('lodash');
const mustache = require('mustache');
const domain = require('domain');

/**
 * BatchEvaluator
 * ==============
 *
 * This class implements a Batch Evaluator, i.e. a worker meant to evaluate
 * submissions tested against a known set of testcases.
 *
 * The evaluation of the testcases is delegated to specialized workers
 * (see BatchTestcaseEvaluator), the results being aggregated by this class
 * according to some function.
 *
 *
 * Evaluation Structure
 * --------------------
 *
 * We expect testcases for a task requiring Batch correction to be partitioned
 * into M subtasks. Subtask i (1 <= i <= M) contains N_i testcases.
 *
 * Let T_{i,j} be j-th testcase of the i-th subtask, and let S_{i,j} be its
 * score. The final score for the i-th subtask is calculated as
 *
 *     X_i = intraSubtaskAggregation(S_{i,1}, S_{i,2}, ..., S_{i,N_i}).
 *
 * In turn, the scores of the subtasks are aggregated into a final score for the
 * submission, namely
 *
 *     Score = interSubtaskAggregation(X_1, X_2, ..., X_M).
 *
 *
 * Evaluator Configuration
 * -----------------------
 *
 * These are the fields currently expected by BatchEvaluator:
 *
 * +-------------------------+-------------------------------------+-----------+
 * | Field name              | Description                         | Mandatory |
 * +-------------------------+-------------------------------------+-----------+
 * | submissionFileUri       | An URI to the submission file.      |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | tcInputFileUriSchema    | A string containing two `%d` wild-  |     Y     |
 * |                         | wildcards. This represent the URI   |           |
 * |                         | schema for the testcase input       |           |
 * |                         | files. The first wildcard will be   |           |
 * |                         | substituted by the subtast index,   |           |
 * |                         | the second one by the testcase      |           |
 * |                         | index.                              |           |
 * +-------------------------+-------------------------------------+-----------+
 * | tcOutputFileUriSchema   | A string containing two `%d` wild-  |     Y     |
 * |                         | wildcards. This represent the URI   |           |
 * |                         | schema for the testcase output      |           |
 * |                         | files. The first wildcard will be   |           |
 * |                         | substituted by the subtast index,   |           |
 * |                         | the second one by the testcase      |           |
 * |                         | index.                              |           |
 * +-------------------------+-------------------------------------+-----------+
 * | evaluationStructure     | A list of positive integers. The    |     Y     |
 * |                         | i-th of these integers represents   |           |
 * |                         | N_i, the number of testcases in the |           |
 * |                         | i-th subtask.                       |           |
 * +-------------------------+-------------------------------------+-----------+
 * | checkerSourceUri        | An URI to the checker source. If    |     N     |
 * |                         | this field is set to null or it is  |           |
 * |                         | not present, it is assumed that no  |           |
 * |                         | checker is necessary in order to    |           |
 * |                         | validate the contestant output      |           |
 * +-------------------------+-------------------------------------+-----------+
 * | intraSubtaskAggregation | A string representing the aggrega-  |     N     |
 * |                         | tion function inside subtasks (see  |           |
 * |                         | above). Currently, only the         |           |
 * |                         | following functions are accepted:   |           |
 * |                         |   - sum                             |           |
 * |                         |   - max                             |           |
 * |                         |   - min                             |           |
 * |                         | If null or not present, the default |           |
 * |                         | is chosen.                          |           |
 * +-------------------------+-------------------------------------+-----------+
 * | interSubtaskAggregation | A string representing the aggrega-  |     N     |
 * |                         | tion function for subtasks (see     |           |
 * |                         | above). Currently, only the         |           |
 * |                         | following functions are accepted:   |           |
 * |                         |   - sum                             |           |
 * |                         |   - max                             |           |
 * |                         |   - min                             |           |
 * |                         | If null or not present, the default |           |
 * |                         | is chosen.                          |           |
 * +-------------------------+-------------------------------------+-----------+
 *
 *
 * @todo Provide a way to specify a baseuri corresponding to phony protocol
 *           shuriken://.
 * @todo Accept timeLimit and memoryLimit as config parameters.
 * @todo Provide a way to configure the connection to Redis (e.g.
 *           authentication).
 * @todo Provide a way to specify a global timeLimit multiplier (via command
 *           line). This is necessary to compensate for different cpu speeds
 *           among the machines running the evaluators, making evaluations
 *           fairer.
 */
class BatchEvaluator {
  /**
   * Receive a link to the Kue Job and the callback to inform the queue manager
   * that the evaluation has finished.
   *
   * @param {!Object} job The current Kue Job.s
   * @param {function} doneCallback Callback to inform the queue manager that
   *                       the evaluation has finished.
   * @constructor
   */
  constructor(job, doneCallback) {
    this.kueJob = job;
    this.doneCallback = doneCallback;

    // Parse the configuration for this job (found in job.data()).
    // Step 0. jobConfig must be an Object.
    const jobConfig = job.data;
    assert(_.isObject(jobConfig));

    // Step 1. Check all mandatory fields are there.
    assert(_.has(jobConfig, 'submissionFileUri'));
    assert(_.has(jobConfig, 'tcInputFileUriSchema'));
    assert(_.has(jobConfig, 'tcOutputFileUriSchema'));
    assert(_.has(jobConfig, 'evaluationStructure'));

    // Step 2. For each field, assert values are feasible.
    //   2a. submissionFileUri
    this.submissionFileUri = jobConfig.submissionFileUri;
    assert(_.isString(this.submissionFileUri));

    //   2b. tcInputFileUriSchema
    this.tcInputFileUriSchema = jobConfig.tcInputFileUriSchema;
    assert(_.isString(this.tcInputFileUriSchema));

    //   2c. tcOutputFileUriSchema
    this.tcOutputFileUriSchema = jobConfig.tcOutputFileUriSchema;
    assert(_.isString(this.tcOutputFileUriSchema));

    //   2d. evaluationStructure
    this.evaluationStructure = jobConfig.evaluationStructure;
    assert(_.isArray(this.evaluationStructure));
    _.each(this.evaluationStructure, (num) => {
      assert(_.isInteger(num));
    });

    //   2e. checkerSourceUri
    this.checkerSourceUri = _.get(jobConfig, 'checkerSourceUri', null);
    assert(_.isNull(this.checkerSourceUri) ||
        _.isString(this.checkerSourceUri));

    //   2f. intraSubtaskAggregation
    this.intraSubtaskAggregation = _.get(jobConfig, 'intraSubtaskAggregation',
                                         'sum');
    assert(_.indexOf(['sum', 'min', 'max'], this.intraSubtaskAggregation) >= 0);

    //   2g. interSubtaskAggregation
    this.interSubtaskAggregation = _.get(jobConfig, 'interSubtaskAggregation',
                                         'sum');
    assert(_.indexOf(['sum', 'min', 'max'], this.interSubtaskAggregation) >= 0);

    assert(this._validateUris());
  }

  /**
   * Check that we can access all uris specified in the configuration.
   *
   * @todo Implement this.
   * @private
   * @return {bool} True if all Uris are valid, False otherwise.
   */
  _validateUris() {
    return true;
  }

  /**
   * Check if all testcase jobs have finished. A job is considered to be
   * finished when its state is either 'complete' or 'failed'.
   *
   * @private
   * @return {bool} Whether all testcase jobs have finished.
   */
  _allTestcasesHaveFinished() {
    for (let subtaskIndex = 1; subtaskIndex <= this.evaluationStructure.length;
         ++subtaskIndex) {
      let nTestcasesForSubtask = this.evaluationStructure[subtaskIndex - 1];

      for (let testcaseIndex = 1; testcaseIndex <= nTestcasesForSubtask;
           ++testcaseIndex) {
        const testcaseState =
            this._testcaseEvaluationProgress[subtaskIndex][testcaseIndex].state;
        if (testcaseState !== 'complete' && testcaseState !== 'failed') {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Checks if at least one testcase evaluation is marked as failed.
   *
   * @private
   * @return {bool} True iff at least one testcase evaluation has failed.
   */
   _someTestcaseFailed() {
     for (let subtaskIndex = 1; subtaskIndex <= this.evaluationStructure.length;
          ++subtaskIndex) {
       let nTestcasesForSubtask = this.evaluationStructure[subtaskIndex - 1];

       for (let testcaseIndex = 1; testcaseIndex <= nTestcasesForSubtask;
            ++testcaseIndex) {
         const testcaseState =
            this._testcaseEvaluationProgress[subtaskIndex][testcaseIndex].state;
         if (testcaseState === 'failed') {
           return true;
         }
       }
     }
     return false;
   }

  /**
   * Returns the current evaluation status as an HTML string.
   *
   * @private
   * @return {string} An HTML representation of the current evaluation status.
   */
  _renderProgressToHtml() {
    //FIXME: switch to a logic-ful template language, and move the code below
    //       somewhere else.
    let s = `
      <style>
        td.tc-score {
          width: 55px;
        }

        td.tc-score span {
          display: inline-block;
          height: 20px;
          line-height: 20px;
          border-radius: 5px;
          -moz-box-sizing: border-box;
          box-sizing: border-box;
          color: white;
          background-color: #ddd;
          text-align: center;
          padding: 0 5px;
          min-width: 35px;
        }

        td.tc-index {
          width: 100px;
        }

        tr.subtask {
          background-color: #eee;
          text-transform: uppercase;
        }

        tr.subtask td {
          padding-bottom: 1px !important;
        }
      </style>
    `;

    let tcRow = (subtaskIndex, testcaseIndex, testcaseEvaluationProgress) => {
      let message = '', score = '–';
      switch (testcaseEvaluationProgress.state) {
        case 'unknown':
          message = 'Connecting...';
          break;
        case 'inactive':
          message = 'In queue';
          break;
        case 'failed':
          message = 'Evaluation failed';
          break;
        case 'complete':
          message = testcaseEvaluationProgress.message;
          score = testcaseEvaluationProgress.score.toFixed(2);
          break;
      }

      return mustache.render(`
        <tr class="testcase">
          <td class="tc-index">Testcase {{testcaseIndex}}</td>
          <td class="tc-message">{{message}}</td>
          <td class="tc-score"><span>{{score}}</span></td>
        </tr>`, {
          'testcaseIndex': testcaseIndex,
          'message': message,
          'score': score,
        });
    };

    s +=  `<table class="table nomargin">\n`;
    s += `  <tbody>\n`;
    for (let subtaskIndex = 1; subtaskIndex <= this.evaluationStructure.length;
         ++subtaskIndex) {
      let nTestcasesForSubtask = this.evaluationStructure[subtaskIndex - 1];
      s += '    <tr class="subtask"><td colspan="2">Subtask ';
      s += subtaskIndex + '</td><td></td></tr>\n';
      for (let testcaseIndex = 1; testcaseIndex <= nTestcasesForSubtask;
           ++testcaseIndex) {
        const testcaseEvaluationProgress =
            this._testcaseEvaluationProgress[subtaskIndex][testcaseIndex];
        s += tcRow(subtaskIndex, testcaseIndex, testcaseEvaluationProgress);
      }
    }
    s += `  </tbody>`;
    s += `</table>`;

    return s;
  }

  /**
   * Update the progress of the current evaluation job upstream, using Kue.
   *
   * @private
   */
  _notifyProgressUpstream() {
    this.kueJob.progress(0, 1, this._renderProgressToHtml());

    if (this._allTestcasesHaveFinished()) {
      if (this._someTestcaseFailed()) {
        //TODO: Return meaningful error
        this.doneCallback('some testcases failed', {});
      } else {
        //TODO: Calculate score
        this.doneCallback(null, {});
      }
    }
  }

  /**
   * Update the internal state, setting the progress for a specific testcase.
   *
   * @private
   * @param {number} subtaskIndex The index of the subtask (1-based).
   * @param {number} testcaseIndex The index of the testcase (inside the given
   *                     subtask) (1-based).
   * @param {?bool} notifyUpstream Falsey value. If true, don't make a call to
   *                    _notifyProgressUpstream.
   */
  _updateTestcaseProgress(subtaskIndex, testcaseIndex, progress,
                          preventUpdate) {
    assert(_.isInteger(subtaskIndex) && _.isInteger(testcaseIndex));
    assert(_.has(progress, 'state'));
    assert(_.has(progress, 'score'));
    assert(_.has(progress, 'message'));

    this._testcaseEvaluationProgress[subtaskIndex][testcaseIndex] = progress;
    if (!preventUpdate) {
      this._notifyProgressUpstream();
    }
  }

  /**
   * Init the internal testcase state.
   *
   * @private
   */
  _initTestcaseStructure() {
    this._testcaseEvaluationProgress = {};
    for (let subtaskIndex = 1; subtaskIndex <= this.evaluationStructure.length;
         ++subtaskIndex) {
      let nTestcasesForSubtask = this.evaluationStructure[subtaskIndex - 1];

      this._testcaseEvaluationProgress[subtaskIndex] = {};
      for (let testcaseIndex = 1; testcaseIndex <= nTestcasesForSubtask;
           ++testcaseIndex) {
        this._updateTestcaseProgress(subtaskIndex, testcaseIndex, {
          state: 'unknown',
          score: 0,
          message: 'Connecting...',
        }, true);
      }
    }
    this._notifyProgressUpstream();
  }

  /**
   * Enqueue an evaluation job for the given testcase using Kue.
   *
   * @private
   * @param {number} subtaskIndex The index of the subtask (1-based).
   * @param {number} testcaseIndex The index of the testcase (inside the given
   *                     subtask) (1-based).
   * @param {!Object} testcaseEvaluationConfiguration The data to pass to the
   *                     worker processing the job.
   */
  _enqueueTestcase(subtaskIndex, testcaseIndex,
                   testcaseEvaluationConfiguration) {
    this._updateTestcaseProgress(subtaskIndex, testcaseIndex, {
      state: 'inactive',
      score: 0,
      message: 'In queue',
    });

    queue.create('subjob', testcaseEvaluationConfiguration)
      .on('complete', function(result) {
        assert(_.isObject(result));
        assert(_.has(result, 'score'));
        assert(_.has(result, 'message'));

        this._updateTestcaseProgress(subtaskIndex, testcaseIndex, {
          state: 'complete',
          score: result.score,
          message: result.message,
        });
      }.bind(this))
      .on('failed', function() {
        this._updateTestcaseProgress(subtaskIndex, testcaseIndex, {
          state: 'failed',
          score: 0.0,
          message: 'Evaluation failed',
        });
      }.bind(this)).save();
  }

  /**
   * Main entry point. Evaluate the submission.
   */
  run() {
    this._initTestcaseStructure(this.evaluationStructure);

    for (let subtaskIndex = 1; subtaskIndex <= this.evaluationStructure.length;
         ++subtaskIndex) {
      let nTestcasesForSubtask = this.evaluationStructure[subtaskIndex - 1];
      for (let testcaseIndex = 1; testcaseIndex <= nTestcasesForSubtask;
           ++testcaseIndex) {
        this._enqueueTestcase(subtaskIndex, testcaseIndex, {});
      }
    }
  }
}

queue.process('evaluation', function(job, done) {
  let d = domain.create();
  d.on('error', (err) => {
    done(err, {});
  });
  d.run(() => {
    let evaluator = new BatchEvaluator(job, done);
    evaluator.run();
  });
});
