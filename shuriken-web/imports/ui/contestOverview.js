'use strict';

// Libs.
import {getRouteContest, isValidContestRoute}
    from '../lib/routeContestUtils.js';
// Requires.
const should = require('should/as-function');
// UI fragments.
import './contestOverview.html';

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
Template.contestOverview.onCreated(function() {
  // Pass.
});

Template.contestOverview.helpers({
  /**
   * Returns true if everything is fine and we managed to retrieve all objects
   * and validate the models.
   *
   * @return {Boolean} True if ok, false otherwise.
   */
  'isValidContestRoute'() {
    return isValidContestRoute(this);
  },

  /**
   * Returns true if everything is fine and we managed to retrieve all objects
   * and validate the models.
   *
   * @return {Boolean} True if ok, false otherwise.
   */
  'routeContest'() {
    return getRouteContest(this);
  },
});
