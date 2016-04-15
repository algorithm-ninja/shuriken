import { Evaluations } from '../api/evaluations.js';

import './evaluation.js';
import './newSubmission.js';
import './taskSubmissionPage.html';

Template.taskSubmissionPage.onCreated(function(){
  Meteor.subscribe('Evaluations');
});

Template.taskSubmissionPage.helpers({
  evaluationsForTask() {
    return Evaluations.find({
      owner: Meteor.userId(),
      taskId: this.currentTask._id._str,
    }, {
      sort: { created_at: -1 },
    });
  }
});
