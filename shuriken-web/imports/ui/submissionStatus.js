'use strict';

// APIs and collections.
import {Evaluations} from '../api/evaluations.js';
// Libs.
import {Template} from 'meteor/templating';
// UI fragments.
import './submissionStatus.html';
// Requires.
const moment = require('moment');
const _ = require('lodash');
const should = require('should');

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
 * Returns the live evaluation for the submission. If none is found, a non
 * loaded object is returned.
 *
 * @private
 * @param {Object} context
 * @return {Evaluation}
 */
const _liveEvaluation = function(context) {
  //FIXME What if there is more than one live evaluation?
  return Evaluations.findOne({
    submissionId: context.submission._id,
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
const _hasLiveEvalution = function(context) {
  const evaluation = _liveEvaluation(context);
  return (!_.isNil(evaluation) && evaluation.isLoaded());
};

/**
 * Checks if the given submission has a live evaluation.
 *
 * @private
 * @param {Object} context
 * @return {Boolean}
 */
const _hasLiveEvalutionForGivenRevisionId = function(context) {
  const liveEvaluation = _liveEvaluation(context);

  if (!liveEvaluation) {
    return false;
  } else {
    return (liveEvaluation.taskRevisionId.valueOf() ===
        context.taskRevision._id.valueOf());
  }
};


Template.submissionStatus.helpers({
  'isLoaded'() {
    return Template.instance().evaluationSubscriptionHandle.ready();
  },

  'hasLiveEvalutionForGivenRevisionId'() {
    return _hasLiveEvalutionForGivenRevisionId(this);
  },

  'hasLiveEvalution'() {
    return _hasLiveEvalution(this);
  },

  'liveEvaluation'() {
    return _liveEvaluation(this);
  },

  'jobConfiguration'() {
    const evaluation = _liveEvaluation(this);

    return JSON.stringify(evaluation.kueData, null, 2);
  },

  'humanEvaluationDateTime'() {
    const evaluation = _liveEvaluation(this);
    should(_hasLiveEvalutionForGivenRevisionId(this)).be.true();

    if (evaluation.kueCreatedAt) {
      //IDEA: in the future, use fromNow() instead of printing the absolute
      //      dateTime. In order for this to work reactively, .fromNow() should
      //      invalidate the template on change, via Tracker.
      return moment(+evaluation.kueCreatedAt).local()
          .format('D MMM YYYY, HH:mm:ss');
    } else {
      return 'Unknown';
    }
  },

  //FIXME Improve this
  'humanState'() {
    const evaluation = _liveEvaluation(this);
    should(_hasLiveEvalutionForGivenRevisionId(this)).be.true();

    if (evaluation.isLost) {
      return 'LOST';
    }

    switch (evaluation.kueState) {
      case 'inactive':
        return 'Queued';
      case 'active':
        return 'Evaluating...';
      case 'failed':
        return 'Evaluation failed';
      case 'complete':
        const score = evaluation.kueResult.score;
        const maxScore = evaluation.kueResult.maxScore;
        return 'Evaluated (score: ' + score + '/' + maxScore + ')';
    }
  },

  //FIXME Improve this
  'progressData'() {
    const evaluation = _liveEvaluation(this);

    switch (evaluation.kueState) {
      case 'active':
      case 'complete':
        return evaluation.kueProgressData;
      case 'failed':
        return evaluation.kueError;
      case 'inactive':
        //TODO Make this part of the HTML template, by exposising a kueState
        //     helper.
        return '<i style="font-size:800%;" class="material-icons">loop</i>';
      case 'removed':
        //TODO Make this part of the HTML template, by exposising a kueState
        //     helper.
        return '<i style="font-size:800%;" class="material-icons">error_outline</i>';
    }
  },

  //FIXME Improve this
  'headingColor'() {
    if (_hasLiveEvalutionForGivenRevisionId(this)) {
      const evaluation = _liveEvaluation(this);
      if (evaluation.isLost && evaluation.kueState !== 'complete') {
        return '#7f7f7f';
      }

      switch (evaluation.kueState) {
        case 'inactive':
          return '#7f7f7f';
        case 'active':
          return '#03a9f4';
        case 'failed':
          return '#9d000d';
        case 'complete':
          return '#4caf50';
      }
    } else {
      return '#7f7f7f';
    }
  },
});
