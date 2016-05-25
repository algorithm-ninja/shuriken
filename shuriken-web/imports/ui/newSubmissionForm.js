'use strict';

// UI fragments.
import './newSubmissionForm.html';
// Requires.
const bootbox = require('bootbox');
// Browser JS imports.
import 'ace-builds/src-min-noconflict/ace.js';
import 'ace-builds/src-min-noconflict/theme-xcode.js';
import 'ace-builds/src-min-noconflict/mode-c_cpp.js';

// FIXME This should depend on the language.
const DEFAULT_CODE = '// Write your code here.\n';

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
  const self = Template.instance();

  // NOTE We need to run the initialization code in an autorun, because of how
  //      iron-router handles the invalidation of templates. In particular,
  //      sometimes switching to a different task does not invalidate the old
  //      template (to avoid flickering), causing some side effects. By wrapping
  //      the code in an autorun and calling Template.currentData(), we make
  //      sure that whenever the Template data changes, the editor content is
  //      refreshed.
  this.autorun(() => {
    self.taskId = Template.currentData().taskId.valueOf();

    /* jshint -W117 */
    self.aceEditor = ace.edit(`ace-editor-${self.taskId}`);
    self.aceEditor.$blockScrolling = Infinity;

    // Restore old code, or set the default one.
    if (localStorage.getItem(`ace-editor-${self.taskId}`)) {
      self.aceEditor.setValue(
          localStorage.getItem(`ace-editor-${self.taskId}`));
    } else {
      self.aceEditor.setValue(DEFAULT_CODE);
    }

    // Aesthetic tweaks.
    self.aceEditor.setTheme('ace/theme/xcode');
    self.aceEditor.getSession().setMode('ace/mode/c_cpp');
    self.aceEditor.clearSelection();
  });

  // NOTE We have to take extra care about not attaching multiple event
  //      listeners to the editor.
  this.aceEditor.getSession().on('change', function() {
    // Save editor content to the localStorage.
    localStorage.setItem(`ace-editor-${self.taskId}`,
        self.aceEditor.getValue());
  });
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

  'click #reset-editor'() {
    const aceEditor = Template.instance().aceEditor;
    const taskId = Template.currentData().taskId.valueOf();

    bootbox.dialog({
      title: 'Warning',
      message: 'Your code will be deleted, do you want to proceed?',
      backdrop: true,
      onEscape: true,
      buttons: {
        cancel: {
          label: 'No, cancel',
          callback: () => {},
        },

        reset: {
          label: 'Yes, reset',
          callback: () => {
            localStorage.setItem(`ace-editor-${taskId}`, DEFAULT_CODE);

            aceEditor.setValue(localStorage.getItem(`ace-editor-${taskId}`));
            aceEditor.clearSelection();
          },
        },
      },
    });
  },

  'change #file-selector'(event) {
    const reader = new FileReader();
    const aceEditor = Template.instance().aceEditor;

    reader.addEventListener('load', event => {
      aceEditor.setValue(event.target.result);
      aceEditor.clearSelection();
    });

    reader.readAsText(event.target.files[0]);

    // XXX: this hack is needed to have a 'change' event fire even if the same
    //      file is selected twice (e.g. you select, then click "reset", then
    //      select again)
    event.target.value = null;
  },
});
