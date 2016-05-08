'use strict';

// UI fragments.
import './pdfViewer.html';

/**
 * #### Context
 *
 * The template receives a single parameter, named `uri`.
 *
 * #### Implementation notes.
 *
 * In order to force re-renders, we define a reactive variable `uriChanged`.
 * Whenever the template data changes, uriChanged is set to true, forcing the
 * <object> element to be removed from the DOM.
 */
Template.pdfViewer.onCreated(function(){
  const self = this;
  this.uriChanged = new ReactiveVar(false);

  this.autorun(function() {
    // Listen for changes in the template data.
    Template.currentData();
    self.uriChanged.set(true);
  });
});

Template.pdfViewer.helpers({
  'uriChanged'() {
    return Template.instance().uriChanged.get();
  },

  'setUriChangedFalse'() {
    Template.instance().uriChanged.set(false);
  }
});
