'use strict';

import { Template } from 'meteor/templating';

// UI elements.
import './body.html';
import './contestPageLayout.js';
import './taskStatementPage.js';
import './taskSubmissionsPage.js';
import '../styles/material-icons/material-icons.css';

Template.registerHelper('equals', function (a, b) {
  return a === b;
});

Router.route('/', function () {
  if (Meteor.userId()) {
    this.layout('loggedContestantContestPage');
  } else {
    this.render('loginPage');
  }
});

Router.route('/contest/:contestCodename/task/:taskCodename', function () {
  if (Meteor.userId()) {
    let contestCodename = this.params.contestCodename;
    let taskCodename = this.params.taskCodename;

    this.layout('contestPageLayout', {data: {
      routeContestCodename: contestCodename,
    }});

    this.render('taskStatementPage', {data: {
      routeContestCodename: contestCodename,
      routeTaskCodename: taskCodename,
    }});
  } else {
    this.render('loginPage');
  }
});

Router.route('/contest/:contestCodename/task/:taskCodename/submissions', function () {
  if (Meteor.userId()) {
    let contestCodename = this.params.contestCodename;
    let taskCodename = this.params.taskCodename;

    this.layout('contestPageLayout', {data: {
      routeContestCodename: contestCodename,
    }});

    this.render('taskSubmissionsPage', {data: {
      routeContestCodename: contestCodename,
      routeTaskCodename: taskCodename,
    }});
  } else {
    this.render('loginPage');
  }
});
