'use strict';

import { Mongo } from 'meteor/mongo';

export const Contests = new Mongo.Collection('contests');

if (Meteor.isServer) {
  /**
   * Publishes all Contest objects.
   */
  Meteor.publish('AllContests', function() {
    return Contests.find({});
  });

  /**
   * Publishes the Contest object for a specific codename.
   *
   * @todo Check that the user is allowed to view the contest data.
   * @param {String} contestCodename The contest codename.
   */
  Meteor.publish('ContestByCodename', function(contestCodename) {
    return Contests.find({codename: contestCodename}, {limit: 1});
  });
}

Meteor.methods({});
