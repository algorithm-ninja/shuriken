import './newSubmission.html';

Template.newSubmission.events({
  'click .submit-submission'(event) {
    // Prevent default browser form submit
    event.preventDefault();

    const taskId = this.currentTask._id._str;

    Meteor.call('evaluations.enqueue', taskId, null);
  },
});
