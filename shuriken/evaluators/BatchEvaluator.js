'use strict';

const kue = require('kue');
const queue = kue.createQueue();
const _ = require('lodash');
const mustache = require('mustache');
const domain = require('domain');
const should = require('should');

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
 * | timeLimit               | A real number indicating how many   |     Y     |
 * |                         | seconds the submissionFile may be   |           |
 * |                         | executed for.                       |           |
 * +-------------------------+-------------------------------------+-----------+
 * | memoryLimit             | A real number indicating how many   |     Y     |
 * |                         | MiB are available for the execution |           |
 * |                         | of submissionFile.                  |           |
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
   * @param {!Object} job The current Kue Job.
   * @param {function} doneCallback Callback to inform the queue manager that
   *                       the evaluation has finished.
   * @constructor
   */
  constructor(job, doneCallback) {
    this.kueJob = job;
    this.doneCallback = doneCallback;

    // Parse the configuration for this job (found in job.data()).
    // Step 0. jobConfig must be an Object.
    this._config = job.data;
    this._config.should.be.Object();

    // Step 1. Check all mandatory fields are there.
    this._config
        .should.have.properties('submissionFileUri')
        .and.have.properties('tcInputFileUriSchema')
        .and.have.properties('tcOutputFileUriSchema')
        .and.have.properties('evaluationStructure')
        .and.have.properties('timeLimit')
        .and.have.properties('memoryLimit');

    // Step 2. Set all non mandatory fields to the default values.
    this._config.checkerSourceUri =
        _.get(this._config, 'checkerSourceUri', null);
    this._config.intraSubtaskAggregation =
        _.get(this._config, 'intraSubtaskAggregation', 'sum');
    this._config.interSubtaskAggregation =
        _.get(this._config, 'interSubtaskAggregation', 'sum');

    // Step 3. For each field, check values are feasible.
    this._config.submissionFileUri
        .should.be.String();

    this._config.tcInputFileUriSchema
        .should.be.String();

    this._config.tcOutputFileUriSchema
        .should.be.String();

    if (this._config.checkerSourceUri) {
      this._config.checkerSourceUri
          .should.be.String();
    }

    this._config.timeLimit
        .should.be.Number()
        .and.not.be.Infinity()
        .and.be.above(0);

    this._config.memoryLimit
        .should.be.Number()
        .and.not.be.Infinity()
        .and.be.above(0);

    this._config.intraSubtaskAggregation
        .should.be.String()
        .and.equalOneOf('sum', 'min', 'max');

    this._config.interSubtaskAggregation
        .should.be.String()
        .and.equalOneOf('sum', 'min', 'max');

    this._validateUris().should.be.true();
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
    for (let subtaskIndex = 1;
        subtaskIndex <= this._config.evaluationStructure.length;
        ++subtaskIndex) {
      const nTestcasesForSubtask =
          this._config.evaluationStructure[subtaskIndex - 1];

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
     for (let subtaskIndex = 1;
         subtaskIndex <= this._config.evaluationStructure.length;
         ++subtaskIndex) {
       const nTestcasesForSubtask =
          this._config.evaluationStructure[subtaskIndex - 1];

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
    for (let subtaskIndex = 1;
         subtaskIndex <= this._config.evaluationStructure.length;
         ++subtaskIndex) {
      const nTestcasesForSubtask =
          this._config.evaluationStructure[subtaskIndex - 1];
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
   * Aggregates testcases and subtasks using the specified aggregation methods
   * and return the score for the current evaluations.
   *
   * @private
   * @return {float} The score for the current evaluation.
   */
  _calculateScore() {
    const aggregationFunctions = {
      'max': function(a, b) { return Math.max(a, b); },
      'min': function(a, b) { return Math.min(a, b); },
      'sum': function(a, b) { return a + b; },
    };
    const intraSubtaskLambda =
        aggregationFunctions[this._config.intraSubtaskAggregation];
    const interSubtaskLambda =
        aggregationFunctions[this._config.interSubtaskAggregation];

    let score = 0;
    for (let subtaskIndex = 1;
        subtaskIndex <= this._config.evaluationStructure.length;
        ++subtaskIndex) {
      const nTestcasesForSubtask =
          this._config.evaluationStructure[subtaskIndex - 1];

      let subtaskScore = 0;
      for (let testcaseIndex = 1; testcaseIndex <= nTestcasesForSubtask;
           ++testcaseIndex) {
        const testcaseScore =
            this._testcaseEvaluationProgress[subtaskIndex][testcaseIndex].score;
        if (testcaseIndex === 1) {
          subtaskScore = testcaseScore;
        } else {
          subtaskScore = intraSubtaskLambda(subtaskScore, testcaseScore);
        }
      }

      if (subtaskIndex === 1) {
        score = subtaskScore;
      } else {
        score = interSubtaskLambda(score, subtaskScore);
      }
    }

    return score;
  }

  /**
   * Updates the progress of the current evaluation job upstream, using Kue.
   *
   * @private
   */
  _notifyProgressUpstream() {
    this.kueJob.progress(0, 1, this._renderProgressToHtml());

    if (this._allTestcasesHaveFinished()) {
      if (this._someTestcaseFailed()) {
        //TODO: Return (more) meaningful error
        this.doneCallback('some testcases failed', {});
      } else {
        const score = this._calculateScore();
        this.doneCallback(null, {'score': score});
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
    progress
        .should.be.Object()
        .and.have.properties('state')
        .and.have.properties('score')
        .and.have.properties('message');

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
    for (let subtaskIndex = 1;
        subtaskIndex <= this._config.evaluationStructure.length;
        ++subtaskIndex) {
      const nTestcasesForSubtask =
          this._config.evaluationStructure[subtaskIndex - 1];

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
        result
            .should.be.Object()
            .and.have.properties('score')
            .and.have.properties('message');
        result.score
            .should.be.Number()
            .and.not.be.Infinity()
            .and.be.aboveOrEqual(0);
        result.message
            .should.be.String();

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
    this._initTestcaseStructure(this._config.evaluationStructure);

    for (let subtaskIndex = 1;
        subtaskIndex <= this._config.evaluationStructure.length;
        ++subtaskIndex) {
      const nTestcasesForSubtask =
          this._config.evaluationStructure[subtaskIndex - 1];
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
