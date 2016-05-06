'use strict';

import {Mongo} from 'meteor/mongo';
// Models.
import {Contest} from '../models/Contest.js';

export const Contests = new Mongo.Collection('contests', {
  idGeneration: 'MONGO',
  transform: (obj) => {return new Contest(obj);}
});

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
