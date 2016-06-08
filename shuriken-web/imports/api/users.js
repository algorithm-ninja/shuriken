'use strict';

/**
 * Publish all users.
 */
Meteor.publish('Users', function () {
  return Meteor.users.find({}, {
      fields: {username: true, roles: true, profile: true}});
});
