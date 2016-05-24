'use strict';

import {Mongo} from 'meteor/mongo';
// Models.
import {TaskRevision} from '../models/TaskRevision.js';

export const TaskRevisions = new Mongo.Collection('taskRevisions', {
  idGeneration: 'MONGO',
  transform: (obj) => {return new TaskRevision(obj);}
});

if (Meteor.isServer) {
  /**
   * Publishes the TaskRevision object for a specific taskRevisionId.
   *
   * @todo Check that the user is allowed to view the task.
   * @param {!ObjectId} taskRevisionId The task revision ObjectId.
   */
  Meteor.publish('TaskRevisionById', function(taskRevisionId) {
    return TaskRevisions.find({_id: taskRevisionId}, {
      limit: 1,
      fields: {
        description: false,
      },
    });
  });
}

Meteor.methods({});
