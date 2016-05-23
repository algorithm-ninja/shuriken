'use strict';

// UI fragments.
import './newSubmissionForm.html';
// Client-side imports.
import 'ace-builds/src-noconflict/ace.js';
import 'ace-builds/src-noconflict/theme-xcode.js';
import 'ace-builds/src-noconflict/mode-c_cpp.js';

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
Template.newSubmissionForm.onCreated(function() {
  // Pass.
});

Template.newSubmissionForm.onRendered(function() {
  const taskId = Template.currentData().taskId.valueOf();
  const editor = ace.edit(`ace-editor-${taskId}`);
  editor.setTheme('ace/theme/xcode');
  editor.getSession().setMode('ace/mode/c_cpp');
  editor.setValue(`#include <iostream>
int main() {
  unsigned int a, b;
  std::cin >> a >> b;
  std::cout << a + b << std::endl;
}`);
  editor.clearSelection();
});

Template.newSubmissionForm.helpers({
  'editorId'() {
    return this.taskId.valueOf();
  },
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
