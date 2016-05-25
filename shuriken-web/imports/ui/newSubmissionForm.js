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
  /* jshint -W117 */
  Template.instance().aceEditor = ace.edit(`ace-editor-${taskId}`);

  // Restore old code, or set the default one.
  if (localStorage.getItem(`ace-editor-${taskId}`)) {
    Template.instance().aceEditor.setValue(
        localStorage.getItem(`ace-editor-${taskId}`));
  } else {
    Template.instance().aceEditor.setValue(`#include <iostream>
int main() {
  unsigned int a, b;
  std::cin >> a >> b;
  std::cout << a + b << std::endl;
}`);
  }

  // Set up change event, to save the code.
  Template.instance().aceEditor.getSession().on('change', () => {
    localStorage.setItem(`ace-editor-${taskId}`,
        // FIXME: maybe we could always just use ace.edit(id) like this:
        ace.edit(`ace-editor-${taskId}`).getValue());
  });

  // Aesthetic tweaks.
  Template.instance().aceEditor.setTheme('ace/theme/xcode');
  Template.instance().aceEditor.getSession().setMode('ace/mode/c_cpp');
  Template.instance().aceEditor.clearSelection();
});

Template.newSubmissionForm.helpers({
  'editorId'() {
    return this.taskId.valueOf();
  },
});

Template.newSubmissionForm.events({
  'click #submit-submission'(event) {
    // Prevent default browser form submit
    event.preventDefault();

    const contestId = this.contestId;
    const taskId = this.taskId;
    const submissionData = Template.instance().aceEditor.getValue();

    Meteor.call('submissions.insertForCurrentUser', contestId, taskId,
        submissionData);
  },

  'click #reset-editor'(event) {
    // FIXME: do this with a bootstrap dialog?
    if (!confirm('Your code will be deleted, do you want to proceed?')) {
      return;
    }

    const taskId = Template.currentData().taskId.valueOf();
    localStorage.setItem(`ace-editor-${taskId}`, `#include <iostream>
int main() {
  unsigned int a, b;
  std::cin >> a >> b;
  std::cout << a + b << std::endl;
}`);

    Template.instance().aceEditor.setValue(
        localStorage.getItem(`ace-editor-${taskId}`));
    Template.instance().aceEditor.clearSelection();
  },

  'change #file-selector'(event) {
    const reader = new FileReader();

    // FIXME: is a closure really needed?
    reader.onload = function(editor) {
      return function(e) {
        editor.setValue(e.target.result);
        editor.clearSelection();
      };
    }(Template.instance().aceEditor);

    reader.readAsText(event.target.files[0]);

    // XXX: this hack is needed to have a 'change' event fire even if the same
    //      file is selected twice (e.g. you select, then click "reset", then
    //      select again)
    event.target.value = null;
  },
});
