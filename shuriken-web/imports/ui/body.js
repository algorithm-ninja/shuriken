import { Template } from 'meteor/templating';
import { Tasks } from '../api/tasks.js';

import './body.html';
import './sidebar.js'
import './taskSubmissionPage.js';
import './taskStatementPage.js';

import '../styles/material-icons/material-icons.css';

Template.registerHelper('equals', function (a, b) {
  return a === b;
});

Router.route('/', function () {
  if (Meteor.userId()) {
    this.layout('loggedLayout');
  } else {
    this.render('loginPage');
  }
});

Router.route('/task/statement/:codename', function () {
  if (Meteor.userId()) {
    this.layout('loggedLayout');
    let codename = this.params.codename;
    let taskObj = Tasks.findOne({codename: codename});

    if (taskObj) {
      this.render('taskStatementPage', {
        data: {
          currentTask: taskObj,
      }});
    } else {
      this.render('notFound');
    }
  } else {
    this.render('loginPage');
  }
});

Router.route('/task/submissions/:codename', function () {
  if (Meteor.userId()) {
    this.layout('loggedLayout');
    let codename = this.params.codename;
    let taskObj = Tasks.findOne({codename: codename});

    if (taskObj) {
      this.render('taskSubmissionPage', {
        data: {
          currentTask: taskObj,
      }});
    } else {
      this.render('notFound');
    }
  } else {
    this.render('loginPage');
  }
});
