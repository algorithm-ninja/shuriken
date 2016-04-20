'use strict';

import { Template } from 'meteor/templating';

import './evaluation.html';
const moment = require('moment');
const _ = require('lodash');

Template.evaluation.onCreated(function(){
  if (this.data.id) {
    Meteor.call('evaluations.watchKueJob', this.data.id);
  }

  //FIXME: if a task has an unreasonable number of submissions, subscribing
  //       to the whole collection without limit can be a bad idea. In the future,
  //       consider using a pagination system, such as
  //       https://atmospherejs.com/percolate/paginated-subscription.
  Meteor.subscribe('Evaluations');
});

Template.evaluation.helpers({
  'jobConfiguration'() {
    return JSON.stringify(this.data, null, 2);
  },

  'humanEvaluationDateTime'() {
    if (this.created_at) {
      //IDEA: in the future, use fromNow() instead of printing the absolute
      //      dateTime. In order for this to work reactively, .fromNow() should
      //      invalidate the template on change, via Tracker.
      return moment(+this.created_at).local().format('D MMM YYYY, HH:mm:ss');
    } else {
      return 'Unknown';
    }
  },

  'humanState'() {
    if (this.state) {
      switch (this.state) {
        case 'inactive':
          return 'Queued';
        case 'active':
          return 'Evaluating...';
        case 'failed':
          return 'Evaluation failed';
        case 'complete':
          const score = _.get(this.result, 'score', undefined);
          const maxScore = _.get(this.result, 'maxScore', undefined);
          return 'Evaluated (score: ' + score + '/' + maxScore + ')';
        default:
          return this.state;
      }
    } else {
      return 'Lost';
    }
  },

  'humanProgress'() {
    if (!this.id) {
      return 'Queuing...';
    } else {
      if ('progress' in this) {
        return this.progress;
      } else {
        return 'Submission lost';
      }
    }
  },

  'headingColor'() {
    if (this.state) {
      switch (this.state) {
        case 'inactive':
          return '#7f7f7f';
        case 'active':
          return '#03a9f4';
        case 'failed':
          return '#7f7f7f';
        case 'complete':
          return '#4caf50';
      }
      return '#7f7f7f';
    }
  }
});
