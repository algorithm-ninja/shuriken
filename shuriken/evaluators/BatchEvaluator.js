'use strict';

const _ = require('lodash');
const kue = require('kue');
const mustache = require('mustache');
const should = require('should/as-function');
const util = require('util');


/**
 * This class implements a Batch Evaluator, i.e. a worker meant to evaluate
 * submissions tested against a known set of testcases.
 *
 * The evaluation of the testcases is delegated to specialized workers
 * (see BatchTestcaseEvaluator), the results being aggregated by this class
 * according to some function.
 *
 *
 * #### Evaluation Structure
 *
 * We expect testcases for a task requiring Batch correction to be partitioned
 * into M subtasks. Subtask `i` (`1 <= i <= M`) contains N_i testcases.
 *
 * Let `T_{i,j}` be j-th testcase of the `i`-th subtask, and let `S_{i,j}` be
 * its score. The final score for the i-th subtask is calculated as
 *
 * > `X_i = intraSubtaskAggregation(S_{i,1}, S_{i,2}, ..., S_{i,N_i}).`
 *
 * In turn, the scores of the subtasks are aggregated into a final score for the
 * submission, namely
 *
 * > `Score = interSubtaskAggregation(X_1, X_2, ..., X_M).`
 *
 *
 * #### Evaluator options
 *
 * +-------------------------+-------------------------------------+-----------+
 * | Field name              | Description                         | Mandatory |
 * +-------------------------+-------------------------------------+-----------+
 * | fileStoreRoot           | Path of the file store root dir,    |     Y     |
 * |                         | corresponding to the shuriken://    |           |
 * |                         | prefix.                             |           |
 * +-------------------------+-------------------------------------+-----------+
 * | internalTimeLimit       | see BatchTestcaseEvaluator.         |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | internalMemoryLimit     | see BatchTestcaseEvaluator.         |     Y     |
 * +-------------------------+-------------------------------------+-----------+
 * | redisConnectionString   | URL of the Redis instance to use.   |     N     |
 * +-------------------------+-------------------------------------+-----------+
 *
 *
 * #### Job Configuration
 *
 * These are the job fields currently expected by BatchEvaluator:
 *
 * +-------------------------+-------------------------------------+-----------+
 * | Field name              | Description                         | Mandatory |
 * +-------------------------+-------------------------------------+-----------+
 * | tcInputFileUriSchema    | A string containing two `%d` wild-  |     Y     |
 * |                         | wildcards. This represent the URI   |           |
 * |                         | schema for the testcase input       |           |
 * |                         | files. The first wildcard will be   |           |
 * |                         | substituted by the subtask index,   |           |
 * |                         | the second one by the testcase      |           |
 * |                         | index.                              |           |
 * +-------------------------+-------------------------------------+-----------+
 * | tcOutputFileUriSchema   | A string containing two `%d` wild-  |     Y     |
 * |                         | wildcards. This represent the URI   |           |
 * |                         | schema for the testcase output      |           |
 * |                         | files. The first wildcard will be   |           |
 * |                         | substituted by the subtask index,   |           |
 * |                         | the second one by the testcase      |           |
 * |                         | index.                              |           |
 * +-------------------------+-------------------------------------+-----------+
 * | evaluationStructure     | A list of subtask objects. The      |     Y     |
 * |                         | i-th of these objects represents    |           |
 * |                         | the i-th subtask.                   |           |
 * +-------------------------+-------------------------------------+-----------+
 * | timeLimit               | Forwarded field, see:               |     Y     |
 * |                         |   BatchTestcaseEvaluator            |           |
 * +-------------------------+-------------------------------------+-----------+
 * | memoryLimit             | Forwarded field, see:               |     Y     |
 * |                         |   BatchTestcaseEvaluator            |           |
 * +-------------------------+-------------------------------------+-----------+
 * | submissionFileUri       | Forwarded field, see:               |     Y     |
 * |                         |   BatchTestcaseEvaluator            |           |
 * +-------------------------+-------------------------------------+-----------+
 * | submissionLanguage      | Forwarded field, see:               |     Y     |
 * |                         |   BatchTestcaseEvaluator            |           |
 * +-------------------------+-------------------------------------+-----------+
 * | checkerSourceUri        | Forwarded field, see:               |     N     |
 * |                         |   BatchTestcaseEvaluator            |           |
 * +-------------------------+-------------------------------------+-----------+
 * | checkerLanguage         | Forwarded field, see:               |     N     |
 * |                         |   BatchTestcaseEvaluator            |           |
 * +-------------------------+-------------------------------------+-----------+
 * | graderSourceUri         | Forwarded field, see:               |     N     |
 * |                         |   BatchTestcaseEvaluator            |           |
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
 * #### Subtask Configuration
 *
 * These are the fields currently expected by each subtask object:
 *
 * +-------------------------+-------------------------------------+-----------+
 * | Field name              | Description                         | Mandatory |
 * +-------------------------+-------------------------------------+-----------+
 * | nTestcases              | An integer number representing how  |     Y     |
 * |                         | many testcases there are.           |           |
 * +-------------------------+-------------------------------------+-----------+
 * | scoreMultiplier         | Multiplier to be applied to the     |     N     |
 * |                         | subtask score (e.g. if the subtask  |           |
 * |                         | has 10 TCs and the scoreMultiplier  |           |
 * |                         | is 1.5, then solving all 10 TCs     |           |
 * |                         | will yield a score of 15 instead of |           |
 * |                         | the normal score of 10).            |           |
 * +-------------------------+-------------------------------------+-----------+
 * | subtaskValue            | A value that overrides the normal   |     N     |
 * |                         | subtask score (e.g. if the subtask  |           |
 * |                         | has 10 TCs and the subtaskValue is  |           |
 * |                         | 37, then solving all 10 TCs will    |           |
 * |                         | yield a score of 37 instead of the  |           |
 * |                         | normal score of 10).                |           |
 * +-------------------------+-------------------------------------+-----------+
 *
 * #### Published result
 *
 * When the evaluation job is finished a score and a message are published. See
 * the class doc in BatchTestcaseEvaluator.js for a complete list of returned
 * values.
 *
 */
class BatchEvaluator {
  /**
   * Receive a link to the Kue Job.
   *
   * @param {Queue} queue The Kue queue to use.
   * @param {!Object} job The current Kue Job.
   * @param {!Object} options.
   * @constructor
   */
  constructor(queue, job, options) {
    this._queue = queue;
    this._kueJob = job;

    this._config = job.data;
    this._options = options;

    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });

    // Parse the options.
    should(options).have.properties(['fileStoreRoot', 'internalTimeLimit',
        'internalMemoryLimit', 'redisConnectionString']);

    should(this._options.fileStoreRoot)
        .be.String();

    should(this._options.internalTimeLimit)
        .be.Number()
        .and.not.be.Infinity()
        .and.be.above(0);

    should(this._options.internalMemoryLimit)
        .be.Number()
        .and.not.be.Infinity()
        .and.be.above(0);

    // Parse the configuration for this job (found in job.data()).
    // Step 0. jobConfig must be an Object.
    should(this._config).be.Object();

    // Step 1. Check that all mandatory fields are there.
    should(this._config).have.properties(['submissionFileUri',
        'tcInputFileUriSchema', 'tcOutputFileUriSchema', 'evaluationStructure',
        'timeLimit', 'memoryLimit']);

    // Step 2. Set all non mandatory fields to the default values.
    this._config.intraSubtaskAggregation =
        _.get(this._config, 'intraSubtaskAggregation', 'sum');
    this._config.interSubtaskAggregation =
        _.get(this._config, 'interSubtaskAggregation', 'sum');

    // Step 3. For each field, check values are feasible.
    should(this._config.tcInputFileUriSchema).be.String();
    should(this._config.tcInputFileUriSchema.match(/%d/g)).have.length(2);
    should(this._config.tcOutputFileUriSchema).be.String();
    should(this._config.tcOutputFileUriSchema.match(/%d/g)).have.length(2);

    should(this._config.timeLimit)
        .be.Number()
        .and.not.be.Infinity()
        .and.be.above(0);

    should(this._config.memoryLimit)
        .be.Number()
        .and.not.be.Infinity()
        .and.be.above(0);

    should(this._config.intraSubtaskAggregation)
        .be.String()
        .and.equalOneOf('sum', 'min', 'max');

    should(this._config.interSubtaskAggregation)
        .be.String()
        .and.equalOneOf('sum', 'min', 'max');

    for (let subtask of this._config.evaluationStructure) {
      should(subtask).have.properties('nTestcases');

      //FIXME Also check that it is integer
      should(subtask.nTestcases)
          .be.Number()
          .and.not.be.Infinity()
          .and.be.above(0);

      if (_.has(subtask, 'subtaskValue')) {
        should(subtask).not.have.property('scoreMultiplier', `You can't ` +
            `specify scoreMultiplier and subtaskValue.`);
      }

      subtask.scoreMultiplier = _.get(subtask, 'scoreMultiplier', 1.0);

      should(subtask.scoreMultiplier)
          .be.Number()
          .and.not.be.Infinity()
          .and.be.aboveOrEqual(0);
    }

    should(this._validateUris()).be.true();

    // Step 4. Start evaluation.
    this._run();
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
          this._config.evaluationStructure[subtaskIndex - 1].nTestcases;

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
          this._config.evaluationStructure[subtaskIndex - 1].nTestcases;

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
    const reportId = `report-${Math.floor(Math.random() * 1e6)}`;

    //FIXME: switch to a logic-ful template language, and move the code below
    //       somewhere else.
    let s = `
      <style>
        #${reportId} td.tc-score > span {
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
          width: 100%;
        }

        #${reportId} tr.subtask {
          background-color: #eee;
          text-transform: uppercase;
        }

        #${reportId} tr.subtask td {
          text-align: center;
          line-height: 5px;
        }

        #${reportId} tr.testcase td {
          vertical-align: middle;
        }

        #${reportId} td.tc-score > span.solved {
          background-color: hsla(120, 50%, 50%, 1);
        }

        #${reportId} td.tc-score > span.unsolved {
          background-color: hsla(0, 70%, 70%, 1);
        }

        #${reportId} td.tc-score > span.subsolved {
          background-color: hsla(60, 70%, 70%, 1);
        }
      </style>
    `;

    let tcRow = (subtaskIndex, testcaseIndex, testcaseEvaluationProgress) => {
      let message = '', score = null, time = null, memory = null;
      switch (testcaseEvaluationProgress.state) {
        case 'unknown':
          message = 'Connecting...';
          break;
        case 'active':
          message = 'Evaluating...';
          break;
        case 'inactive':
          message = 'In queue';
          break;
        case 'failed':
          message = 'Evaluation failed';
          const error = testcaseEvaluationProgress.error;
          if (!_.isNil(error)) {
            message += ': ' + JSON.stringify(error);
          }
          break;
        case 'complete':
          message = testcaseEvaluationProgress.message;
          score = testcaseEvaluationProgress.score;
          time = testcaseEvaluationProgress.elapsedTime;
          memory = testcaseEvaluationProgress.memoryPeak;
          break;
      }

      let scoreClass = '';
      if (_.isNull(score)) {
        score = '–';
      } else {
        score = score.toFixed(2);
        if (score > 1-1e-2) {
          scoreClass = 'solved';
        } else if (score < 1e-2) {
          scoreClass = 'unsolved';
        } else {
          scoreClass = 'subsolved';
        }
      }

      if (_.isNull(time)) {
        time = 'N/A';
      } else {
        time = time.toFixed(3);
      }
      if (_.isNull(memory)) {
        memory = 'N/A';
      } else {
        memory = memory.toFixed(2);
      }

      return mustache.render(`
        <tr class="testcase">
          <td style="width: 10%">{{subtaskIndex}}.{{testcaseIndex}}</td>
          <td style="width: 40%">{{message}}</td>
          <td style="width: 20%">{{time}} s</td>
          <td style="width: 20%">{{memory}} MiB</td>
          <td style="width: 10%" class="tc-score"><span class="${scoreClass}">{{score}}</span></td>
        </tr>`, {
          'subtaskIndex': subtaskIndex,
          'testcaseIndex': testcaseIndex,
          'message': message,
          'score': score,
          'time': time,
          'memory': memory,
        });
    };

    s += `<table id="${reportId}" class="table nomargin">
            <tbody>
              <tr>
                <th>#</th>
                <th>Status</th>
                <th>
                  <i style="font-size: 15pt; vertical-align: middle;" class="material-icons">timer</i> Time
                </th>
                <th>
                  <i style="font-size: 15pt; vertical-align: middle;" class="material-icons">memory</i> Memory
                </th>
                <th>Score</th>
              </tr>`;
    for (let subtaskIndex = 1;
         subtaskIndex <= this._config.evaluationStructure.length;
         ++subtaskIndex) {
      const nTestcasesForSubtask =
          this._config.evaluationStructure[subtaskIndex - 1].nTestcases;
      s += '    <tr class="subtask"><td colspan="5">Subtask ';
      s += subtaskIndex + '</td></tr>\n';
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
   * @return {Object} An object containing two fiels:
   *             - `score` The score for the current evaluation
   *             - `maxScore` The score of the submassion if all testcases were
   *                    given a score of 1.0.
   */
  _computeScore() {
    const aggregationFunctions = {
      'max': function(a, b) { return Math.max(a, b); },
      'min': function(a, b) { return Math.min(a, b); },
      'sum': function(a, b) { return a + b; },
    };
    const intraSubtaskLambda =
        aggregationFunctions[this._config.intraSubtaskAggregation];
    const interSubtaskLambda =
        aggregationFunctions[this._config.interSubtaskAggregation];

    let score = 0, maxScore = 0;
    for (let subtaskIndex = 1;
        subtaskIndex <= this._config.evaluationStructure.length;
        ++subtaskIndex) {
      const nTestcasesForSubtask =
          this._config.evaluationStructure[subtaskIndex - 1].nTestcases;

      let subtaskScore = 0, maxSubtaskScore = 0;
      for (let testcaseIndex = 1; testcaseIndex <= nTestcasesForSubtask;
           ++testcaseIndex) {
        const testcaseScore =
            this._testcaseEvaluationProgress[subtaskIndex][testcaseIndex].score;
        if (testcaseIndex === 1) {
          subtaskScore = testcaseScore;
          maxSubtaskScore = 1.0;
        } else {
          subtaskScore = intraSubtaskLambda(subtaskScore, testcaseScore);
          maxSubtaskScore = intraSubtaskLambda(maxSubtaskScore, 1.0);
        }
      }

      subtaskScore *=
          this._config.evaluationStructure[subtaskIndex - 1].scoreMultiplier;
      maxSubtaskScore *=
          this._config.evaluationStructure[subtaskIndex - 1].scoreMultiplier;

      const subtaskValue =
          this._config.evaluationStructure[subtaskIndex - 1].subtaskValue;

      if (subtaskValue) {
        if (maxSubtaskScore > 0) {
          subtaskScore *= subtaskValue / maxSubtaskScore;
        } else {
          console.warn(`The maxSubtaskScore value is 0, subtaskScore = ` +
              `${subtaskScore}, subtaskValue = ${subtaskValue}.`);
          subtaskScore = 0;
        }
        maxSubtaskScore = subtaskValue;
      }

      if (subtaskIndex === 1) {
        score = subtaskScore;
        maxScore = maxSubtaskScore;
      } else {
        score = interSubtaskLambda(score, subtaskScore);
        maxScore = interSubtaskLambda(maxScore, maxSubtaskScore);
      }
    }

    return {'score': score, 'maxScore': maxScore};
  }

  /**
   * Updates the progress of the current evaluation job upstream, using Kue.
   *
   * @private
   */
  _notifyProgressUpstream() {
    this._kueJob.progress(0, 1, this._renderProgressToHtml());

    if (this._allTestcasesHaveFinished()) {
      if (this._someTestcaseFailed()) {
        //TODO: Return (more) meaningful error
        this._reject('some testcases failed');
      } else {
        this._resolve(this._computeScore());
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
    should(progress)
        .be.Object()
        .and.have.properties(['state', 'error', 'score', 'message',
            'elapsedTime', 'memoryPeak']);

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
          this._config.evaluationStructure[subtaskIndex - 1].nTestcases;

      this._testcaseEvaluationProgress[subtaskIndex] = {};
      for (let testcaseIndex = 1; testcaseIndex <= nTestcasesForSubtask;
           ++testcaseIndex) {
        this._updateTestcaseProgress(subtaskIndex, testcaseIndex, {
          state: 'unknown',
          error: null,
          score: 0,
          message: 'Connecting...',
          elapsedTime: null,
          memoryPeak: null,
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
      error: null,
      score: null,
      message: 'In queue',
      elapsedTime: null,
      memoryPeak: null,
    });

    this._queue.create('subjob', _.clone(testcaseEvaluationConfiguration))
      .on('complete', function(result) {
        should(result)
            .be.Object()
            .and.have.properties(['score', 'message', 'elapsedTime',
                'memoryPeak']);
        should(result.score)
            .be.Number()
            .and.not.be.Infinity()
            .and.be.aboveOrEqual(0)
            .and.be.belowOrEqual(1);
        should(result.message)
            .be.String();
        if (!_.isNull(result.elapsedTime)) {
          should(result.elapsedTime)
              .be.Number()
              .and.not.be.Infinity()
              .and.be.aboveOrEqual(0);
        }
        if (!_.isNull(result.memoryPeak)) {
          should(result.memoryPeak)
              .be.Number()
              .and.not.be.Infinity()
              .and.be.aboveOrEqual(0);
        }

        this._updateTestcaseProgress(subtaskIndex, testcaseIndex, {
          state: 'complete',
          error: null,
          score: result.score,
          message: result.message,
          elapsedTime: result.elapsedTime,
          memoryPeak: result.memoryPeak,
        });
      }.bind(this))
      .on('failed', function(error) {
        this._updateTestcaseProgress(subtaskIndex, testcaseIndex, {
          state: 'failed',
          error: error,
          score: null,
          message: 'Evaluation failed',
          elapsedTime: null,
          memoryPeak: null,
        });
      }.bind(this))
      .on('start', function() {
        this._updateTestcaseProgress(subtaskIndex, testcaseIndex, {
          state: 'active',
          error: null,
          score: null,
          message: 'Evaluating...',
          elapsedTime: null,
          memoryPeak: null,
        });
      }.bind(this)).save();
  }

  /**
   * Main entry point. Evaluates the submission.
   *
   * @private
   */
  _run() {
    this._initTestcaseStructure(this._config.evaluationStructure);

    for (let subtaskIndex = 1;
        subtaskIndex <= this._config.evaluationStructure.length;
        ++subtaskIndex) {

      const nTestcasesForSubtask =
          this._config.evaluationStructure[subtaskIndex - 1].nTestcases;
      let conf = {
        timeLimit: this._config.timeLimit,
        memoryLimit: this._config.memoryLimit,
        internalTimeLimit: this._options.internalTimeLimit,
        internalMemoryLimit: this._options.internalMemoryLimit,
        submissionFileUri: this._config.submissionFileUri,
        submissionLanguage: this._config.submissionLanguage
      };

      if (this._config.graderSourceUri) {
        conf.graderSourceUri = this._config.graderSourceUri;
      }

      if (this._config.checkerSourceUri) {
        conf.checkerSourceUri = this._config.checkerSourceUri;
      }

      if (this._config.checkerLanguage) {
        conf.checkerLanguage = this._config.checkerLanguage;
      }

      for (let testcaseIndex = 1; testcaseIndex <= nTestcasesForSubtask;
           ++testcaseIndex) {
        // Update information about test data
        Object.assign(conf, {
          tcInputFileUri: util.format(this._config.tcInputFileUriSchema,
              subtaskIndex, testcaseIndex),
          tcOutputFileUri: util.format(this._config.tcOutputFileUriSchema,
              subtaskIndex, testcaseIndex)
        });

        this._enqueueTestcase(subtaskIndex, testcaseIndex, conf);
      }
    }
  }

  /**
   * Return a promise for the evaluation completion.
   *
   * @return {Promise}
   */
  getPromise() {
    return this._promise;
  }
}

module.exports = BatchEvaluator;

// If this is being called from a shell, listen to the queue.
if (!module.parent) {
  const program = require('commander');

  program
    .version('0.0.1')
    .option('--fs-root [path]', 'Root of the network file system.')
    .option('--internal-time-limit [seconds]',
        'Time limit for internal operations.', 10)
    .option('--internal-memory-limit [MiBs]',
        'Memory limit for internal operations', 256)
    .option('--redis-url [URL]', 'Redis connection string',
        'redis://localhost:6379')
    .parse(process.argv);

  if (_.isNil(program.fsRoot)) {
    throw new Error('Use --fs-root');
  }

  const evaluatorOptions = {
    fileStoreRoot: program.fsRoot,
    internalTimeLimit: program.internalTimeLimit,
    internalMemoryLimit: program.internalMemoryLimit,
    redisConnectionString: program.redisUrl,
  };

  const queue = kue.createQueue({
    redis: evaluatorOptions.redisConnectionString
  });

  queue.process('evaluation', function(job, done) {
    try {
      const evaluator = new BatchEvaluator(queue, job, evaluatorOptions);
      evaluator.getPromise().then(function(result) {
        done(null, result);
      }, function(error) {
        done(error);
      });
    } catch (error) {
      console.error('Unhandled exception');
      console.error(error);
      done(error);
    }
  });
}
