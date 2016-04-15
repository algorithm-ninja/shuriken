import { Template } from 'meteor/templating';
import { Submissions } from '../api/evaluations.js';

import './evaluation.html';
const moment = require('moment');

Template.evaluation.onCreated(function(){
  if (this.data.id) {
    Meteor.call('evaluations.watchKueJob', this.data.id);
  }
  Meteor.subscribe('Evaluations');
});

Template.evaluation.helpers({
  'humanEvaluationDateTime'() {
    if (this.created_at) {
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
          return 'Evaluated';
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
          return "#7f7f7f";
        case 'active':
          return "#03a9f4";
        case 'failed':
          return "#7f7f7f";
        case 'complete':
          return "#4caf50"
      }
      return "#7f7f7f";
    }
  }
});
