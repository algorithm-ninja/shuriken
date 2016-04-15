import { Mongo } from 'meteor/mongo';
import { KueJobCollection } from '../KueJobCollection.js';

const kue = require('kue');

export const Evaluations = new Mongo.Collection('evaluations');
const EvaluationsKueWrapper = new KueJobCollection(Evaluations);

queue = null;
if (Meteor.isServer) {
  queue = kue.createQueue();
}

if (Meteor.isServer) {
  Meteor.publish('Evaluations', function() {
    return Evaluations.find({
      owner: this.userId,
    });
  });
}

Meteor.methods({
  'evaluations.watchKueJob'(kueJobId) {
    if (Meteor.isServer) {
      EvaluationsKueWrapper.watchJob(kueJobId);
    }
  },
  'evaluations.enqueue'(taskId, submissionContent) {
    if (Meteor.isServer) {
      const queueName = 'evaluation';
      let job = queue.create(queueName, {});
      EvaluationsKueWrapper.insertJob({
        owner: Meteor.userId(),
        taskId: taskId,
        submissionContent: submissionContent,
      }, job);
    }
  },
});