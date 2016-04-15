import { Template } from 'meteor/templating';
import { Tasks } from '../api/tasks.js';

import './body.html';
import './tasklist.js'
import './taskSubmissionPage.js';
import './taskStatementPage.js';

import '../styles/material-icons/material-icons.css';

Template.registerHelper('equals', function (a, b) {
  return a === b;
});

Router.route('/', function () {
  this.layout('loggedLayout');
  this.render('notFound');
});

Router.route('/dummy', function () {
  this.layout('loggedLayout');
  this.render('notFound');
});

Router.route('/task/statement/:codename', function () {
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
});

Router.route('/task/submissions/:codename', function () {
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
});
