'use strict';

// UI fragments.
import './newSubmissionForm.html';

/**
 * newSubmissionForm
 * =================
 *
 * Context
 * -------
 *
 * @todo complete section.
 *
 * Subscription contract
 * ---------------------
 * All relevant data has already been loaded by contestPageLayout.
 * We don't need to subscribe to anything.
 *
 * Furthermore, all Tasks and TaskRevisions have been found in the DB and
 * validated.
 */
Template.newSubmissionForm.onCreated(function(){
  // Pass.
});

Template.newSubmissionForm.events({
  'click .submit-submission'(event) {
    // Prevent default browser form submit
    event.preventDefault();

    const taskId = this.currentTask._id._str;

    Meteor.call('evaluations.enqueue', taskId, null);
    Router.go('/task/submissions/' + this.currentTask.codename);
  },
});
