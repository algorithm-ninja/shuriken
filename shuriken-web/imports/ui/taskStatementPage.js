import { Evaluations } from '../api/evaluations.js';

import './evaluation.js';
import './taskStatementPage.html';

Template.taskStatementPage.onCreated(function(){
  Meteor.subscribe('Evaluations');
});

Template.taskStatementPage.helpers({
  evaluationsForProblem() {
    return Evaluations.find({
      owner: Meteor.userId(),
      problemId: this.currentProblem._id._str,
    }, {
      sort: { created_at: -1 },
    });
  }
});
