'use strict';

// APIs and collections.
import {Evaluations} from '../api/evaluations.js';
// Libs.
import {Template} from 'meteor/templating';
// UI fragments.
import './submissionStatus.html';
// Requires.
const _ = require('lodash');
const bootbox = require('bootbox');
const he = require('he');
const moment = require('moment');
const should = require('should/as-function');

/**
 * #### Context
 *
 * @todo complete section.
 *
 * #### Subscription contract
 *
 * This template is responsible for subscribing to the live evaluation for the
 * given submissionId. It has no other dependencies.
 */
Template.submissionStatus.onCreated(function(){
  const context = Template.currentData();
  should(context)
      .have.properties('submission')
      .and.have.properties('taskRevision');

  this.evaluationSubscriptionHandle =
      this.subscribe('LiveEvaluationForSubmission', context.submission._id);
});

/**
 * Returns the live evaluation for the submission. If none is found, nil is
 * returned.
 *
 * @private
 * @param {Object} context
 * @return {?Evaluation}
 */
const _liveEvaluation = function(context) {
  //FIXME What if there is more than one live evaluation?
  //FIXME Sort by creation time (desc).
  return Evaluations.findOne({
    submissionId: context.submission._id,
    isLive: true,
  });
};

/**
 * Returns the live evaluation for the submission and the task revision. If none
 * is found, nil is returned.
 *
 * @private
 * @param {Object} context
 * @return {?Evaluation}
 */
const _liveEvaluationForTaskRevisionId = function(context) {
  //FIXME What if there is more than one live evaluation?
  return Evaluations.findOne({
    submissionId: context.submission._id,
    taskRevisionId: context.taskRevision._id,
    isLive: true,
  });
};

/**
 * Checks if the given submission has a live evaluation.
 *
 * @private
 * @param {Object} context
 * @return {Boolean}
 */
const _hasLiveEvaluation = function(context) {
  const evaluation = _liveEvaluation(context);
  return (!_.isNil(evaluation) && evaluation.isLoaded());
};

/**
 * Checks if the given submission has a live evaluation matching the given
 * revision id.
 *
 * @private
 * @param {Object} context
 * @return {Boolean}
 */
const _hasLiveEvaluationForTaskRevisionId = function(context) {
  const liveEvaluationForTaskRevisionId =
      _liveEvaluationForTaskRevisionId(context);
  return (!_.isNil(liveEvaluationForTaskRevisionId) &&
      liveEvaluationForTaskRevisionId.isLoaded());
};

/**
 * Returns the live evaluation for the given revision id. If none is found,
 * returns any live evaluation for the given task. If none is found, returns
 * null.
 *
 * @private
 * @param {Object} context
 * @return {?Evaluation}
 */
const _selectLiveEvaluation = function(context) {
  if (_hasLiveEvaluationForTaskRevisionId(context)) {
    return _liveEvaluationForTaskRevisionId(context);
  } else if (_hasLiveEvaluation(context)) {
    return _liveEvaluation(context);
  } else {
    return undefined;
  }
};

Template.submissionStatus.helpers({
  'isLoaded'() {
    return Template.instance().evaluationSubscriptionHandle.ready();
  },

  'hasLiveEvaluationForTaskRevisionId'() {
    return _hasLiveEvaluationForTaskRevisionId(this);
  },

  'hasLiveEvaluation'() {
    return _hasLiveEvaluation(this);
  },

  'liveEvaluation'() {
    return _selectLiveEvaluation(this);
  },

  'humanSubmissionDateTime'() {
    //IDEA: in the future, use fromNow() instead of printing the absolute
    //      dateTime. In order for this to work reactively, .fromNow() should
    //      invalidate the template on change, via Tracker.
    return moment(+this.submission.submissionTime).local()
        .format('D MMM YYYY, HH:mm:ss');
  },

  'headingIcon'() {
    if (_hasLiveEvaluation(this)) {
      const evaluation = _selectLiveEvaluation(this);

      switch (evaluation.kueState) {
        case 'inactive':
          return evaluation.isLost ? 'remove_circle_outline' : 'change_history';
        case 'active':
          return evaluation.isLost ? 'remove_circle_outline' : 'cached';
        case 'failed':
          return 'error_outline';
        case 'delayed':
          return evaluation.isLost ? 'remove_circle_outline' : 'schedule';
        case 'complete':
          return 'done_all';
      }
    } else {
      return 'compare_arrows';
    }
  },

  'humanState'() {
    if (_hasLiveEvaluation(this)) {
      const evaluation = _selectLiveEvaluation(this);

      switch (evaluation.kueState) {
        case 'inactive':
          return 'Queued';
        case 'active':
          return 'Evaluating...';
        case 'failed':
          return 'Evaluation failed';
        case 'delayed':
          return 'Evaluation delayed';
        case 'complete':
          const score = evaluation.kueResult.score;
          const maxScore = evaluation.kueResult.maxScore;
          return 'Evaluated (score: ' + score + '/' + maxScore + ')';
      }
    } else {
      return 'No evaluation scheduled';
    }
  },

  'kueState'() {
    if (_hasLiveEvaluation(this)) {
      const evaluation = _selectLiveEvaluation(this);
      return evaluation.kueState;
    } else {
      return undefined;
    }
  },

  'isLost'() {
    if (_hasLiveEvaluation(this)) {
      const evaluation = _selectLiveEvaluation(this);
      return evaluation.isLost;
    } else {
      return false;
    }
  },

  'hasProgressData'() {
    if (_hasLiveEvaluation(this)) {
      const evaluation = _selectLiveEvaluation(this);
      if (!_.isNull(evaluation.kueProgressData)) {
        return evaluation.kueProgressData.trim().length > 0;
      } else {
        return false;
      }
    } else {
      return false;
    }
  },

  'progressData'() {
    if (_hasLiveEvaluation(this)) {
      const evaluation = _selectLiveEvaluation(this);
      return evaluation.kueProgressData;
    } else {
      return '';
    }
  },

  'headingColor'() {
    if (_hasLiveEvaluationForTaskRevisionId(this)) {
      const evaluation = _selectLiveEvaluation(this);

      switch (evaluation.kueState) {
        case 'inactive':
          return '#7f7f7f';
        case 'active':
          return evaluation.isLost ? '#7f7f7f' : '#03a9f4';
        case 'failed':
          return '#7f7f7f';
        case 'complete':
          const score = evaluation.kueResult.score;
          const maxScore = evaluation.kueResult.maxScore;
          let h = 120, s = 70, l = 40;
          if (maxScore > 0) {
            h = 0 + (120 - 0) * (score / maxScore);
          }
          return `hsl(${h}, ${s}%, ${l}%)`;
        case 'delayed':
          return '#7f7f7f';
      }
    } else {
      return '#7f7f7f';
    }
  },
});

Template.submissionStatus.events({
  'click .shuriken-show-submission-file'(event) {
    event.preventDefault();

    const submissionId = this.submission._id;
    Meteor.call('submissions.submissionFileForSubmissionId', submissionId,
        function(err, data) {
      if (!err) {
        bootbox.alert({
          title: 'Source code for submission',
          size: 'large',
          message: `<pre style="max-height: 600px;">${he.escape(data)}</pre>`,
          backdrop: true,
        });
      } else {
        bootbox.alert({
          title: 'Error',
          message: `<pre style="max-height: 600px;">${he.escape(err)}</pre>`,
          backdrop: true,
        });
      }
    });
  },

  'click .shuriken-show-configuration'(event) {
    event.preventDefault();

    const evaluation = _selectLiveEvaluation(this);
    const jobConfiguration = JSON.stringify(evaluation.kueData, null, 2);

    bootbox.alert({
      title: 'Evaluator configuration',
      size: 'large',
      message: `<pre style="max-height: 600px;">${he.escape(jobConfiguration)}</pre>`,
      backdrop: true,
    });
  }
});
