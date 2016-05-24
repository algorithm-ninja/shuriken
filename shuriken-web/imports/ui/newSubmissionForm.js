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
  Template.instance().aceEditor.setTheme('ace/theme/xcode');
  Template.instance().aceEditor.getSession().setMode('ace/mode/c_cpp');
  Template.instance().aceEditor.setValue(`#include <iostream>
int main() {
  unsigned int a, b;
  std::cin >> a >> b;
  std::cout << a + b << std::endl;
}`);
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

    Meteor.call('submissions.insert', contestId, taskId, submissionData);
  },

  'click #reset-editor'() {
    Template.instance().aceEditor.setValue(`#include <iostream>
int main() {
  unsigned int a, b;
  std::cin >> a >> b;
  std::cout << a + b << std::endl;
}`);
    Template.instance().aceEditor.clearSelection();
  },

  'change #file-selector'() {
    const reader = new FileReader();

    // FIXME: is a closure really needed?
    reader.onload = function(editor) {
      return function(e) {
        editor.setValue(e.target.result);
        editor.clearSelection();
      };
    }(Template.instance().aceEditor);

    reader.readAsText(event.target.files[0]);
  },

  'click #file-selector'(event) {
    // FIXME: this hack is needed to have a 'change' event fire even if the same
    //        file is selected twice (e.g. you select, then click "reset", then
    //        select again) however it does not seem to work at the moment (the
    //        'click' event is fired before 'change')
    // event.target.value = null;
  },
});
