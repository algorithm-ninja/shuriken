import { Template } from 'meteor/templating';
import { Tasks } from '../api/tasks.js';

import './tasklist.html';

Template.tasklist.onCreated(function(){
  Meteor.subscribe('Tasks');
});

Template.tasklist.helpers({
  tasks() {
    return Tasks.find();
  },
});
