import { Mongo } from 'meteor/mongo';
const kue = require('kue');

export const Tasks = new Mongo.Collection('tasks');

if (Meteor.isServer) {
  Meteor.publish('Tasks', function() {
    return Tasks.find({});
  });
}

Meteor.methods({});
