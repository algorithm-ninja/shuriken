'use strict';

// UI fragments.
import './newSubmissionForm.html';

/**
 * #### Context
 *
 * - contestId
 * - taskId
 * @todo complete section.
 *
 * #### Subscription contract
 *
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

    const contestId = this.contestId;
    const taskId = this.taskId;
    const submissionData = document.getElementById('submission-data').value;

    Meteor.call('submissions.insert', contestId, taskId, submissionData);
  },
});
