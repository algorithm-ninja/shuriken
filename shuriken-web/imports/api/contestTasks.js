'use strict';

import {Mongo} from 'meteor/mongo';
// Models.
import {ContestTask} from '../models/ContestTask.js';

export const ContestTasks = new Mongo.Collection('contestTasks', {
  idGeneration: 'MONGO',
  transform: (obj) => {return new ContestTask(obj);}
});

if (Meteor.isServer) {
  /**
   * Publishes all ContestTask objects for a specific contest id.
   *
   * @todo Check that the user is allowed to view the contest data.
   * @param {ObjectId} contestId The contest unique ObjectId.
   */
  Meteor.publish('ContestTasksByContestId', function(contestId) {
    return ContestTasks.find({contestId: contestId});
  });
}

Meteor.methods({});
