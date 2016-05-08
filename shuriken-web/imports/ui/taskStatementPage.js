'use strict';

// Libs.
import {getRouteContest, validateContestObjects}
    from '../lib/routeContestUtils.js';
import {getRouteTask, getRouteTaskRevision, validateTaskObjects}
    from '../lib/routeTaskUtils.js';
// Requires.
const should = require('should');
// UI fragments.
import './taskStatementPage.html';
import './newSubmissionForm.js';
import './pdfViewer.js';

/**
 * #### Context
 *
 * @todo complete section.
 *
 * #### Subscription contract
 *
 * All relevant data has already been loaded by contestPageLayout.
 * We don't need to subscribe to anything.
 *
 * Furthermore, all Tasks and TaskRevisions have been found in the DB and
 * validated. We revalidate them anyway, but only as a safety measure.
 */
Template.taskStatementPage.onCreated(function() {
  const context = Template.currentData();

  should(validateContestObjects(context)).be.true();
});


Template.taskStatementPage.helpers({
  /**
   * Returns true if everything is fine and we managed to retrieve all objects
   * and validate the models.
   *
   * @return {Boolean} True if ok, false otherwise.
   */
  validateObjects: function() {
    return validateTaskObjects(this);
  },

  /**
   * Returns the Contest object relative to the current route.
   *
   * @return {!Contest}
   */
  routeContest: function() {
    return getRouteContest(this);
  },

  /**
   * Returns the Task object relative to the current route.
   *
   * @return {!Task}
   */
  routeTask: function() {
    return getRouteTask(this);
  },

  /**
   * Returns the taskRevision ObjectId for the current (route-defined) task.
   * Will throw if validateObjects is false.
   *
   * @return {!ObjectId}
   */
  taskRevisionId: function() {
    should(validateTaskObjects(this)).be.true();

    const routeTaskRevision = getRouteTaskRevision(this);
    return routeTaskRevision._id;
  },

  /**
   * Returns the title for the current (route-defined) task.
   * Will throw if validateObjects is false.
   *
   * @return {!ObjectId}
   */
  taskTitle: function() {
    should(validateTaskObjects(this)).be.true();

    const routeTaskRevision = getRouteTaskRevision(this);
    return routeTaskRevision.title;
  },

  /**
   * Returns the statement URI for the current (route-defined) task.
   * Will throw if validateObjects is false.
   *
   * @return {!ObjectId}
   */
  taskStatementPdfUri: function() {
    should(validateTaskObjects(this)).be.true();

    const routeTaskRevision = getRouteTaskRevision(this);
    return routeTaskRevision.statementPdfUri;
  }
});
