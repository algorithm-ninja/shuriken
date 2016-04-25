'use strict';

// Libs.
import {validateContestObjects} from '../lib/routeContestUtils.js';
import {getRouteTaskRevision, validateTaskObjects}
    from '../lib/routeTaskUtils.js';
// UI fragments.
import './taskStatementPage.html';
import './newSubmissionForm.html';
// Requires.
const should = require('should');

/**
 * taskStatementPage
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
 * validated. We revalidate them anyway, but only as a safety measure.
 */
Template.taskStatementPage.onCreated(function() {
  should(validateContestObjects.apply(this.data)).be.true();
  should(validateTaskObjects.apply(this.data)).be.true();
});


Template.taskStatementPage.helpers({
  /**
   * Returns true if everything is fine and we managed to retrieve all objects
   * and validate the models.
   *
   * @return {Boolean} True if ok, false otherwise.
   */
  validateObjects: function() {
    return validateTaskObjects.apply(this);
  },

  /**
   * Returns the taskRevision ObjectId for the current (route-defined) task.
   * Will throw if validateObjects is false.
   *
   * @return {!ObjectId}
   */
  taskRevisionId: function() {
    should(validateTaskObjects.apply(this)).be.true();

    const routeTaskRevision = getRouteTaskRevision.apply(this);
    return routeTaskRevision._id;
  },

  /**
   * Returns the title for the current (route-defined) task.
   * Will throw if validateObjects is false.
   *
   * @return {!ObjectId}
   */
  taskTitle: function() {
    should(validateTaskObjects.apply(this)).be.true();

    const routeTaskRevision = getRouteTaskRevision.apply(this);
    return routeTaskRevision.title;
  },

  /**
   * Returns the statement URI for the current (route-defined) task.
   * Will throw if validateObjects is false.
   *
   * @return {!ObjectId}
   */
  taskStatementPdfUri: function() {
    should(validateTaskObjects.apply(this)).be.true();

    const routeTaskRevision = getRouteTaskRevision.apply(this);
    return routeTaskRevision.statementPdfUri;
  }
});
