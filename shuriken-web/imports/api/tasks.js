'use strict';

import { Mongo } from 'meteor/mongo';

export const Tasks = new Mongo.Collection('tasks');

if (Meteor.isServer) {
  Meteor.publish('Tasks', function() {
    return Tasks.find({});
  });
}

Meteor.methods({});
