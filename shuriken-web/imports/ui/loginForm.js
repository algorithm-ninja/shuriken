'use strict';

// Libs.
// Requires.
// UI fragments.
import './loginForm.html';

Template.loginForm.onCreated(function() {
  // Pass.
});

Template.loginForm.helpers({
  //
});

Template.loginForm.events({
  'click #logout': function(event){
    event.preventDefault();
    Meteor.logout();
  }
});
