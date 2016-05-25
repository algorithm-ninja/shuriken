'use strict';

import {Accounts} from 'meteor/accounts-base';
const _ = require('lodash');

if (Meteor.isClient) {
  Accounts.ui.config({
    passwordSignupFields: 'USERNAME_ONLY',
  });
}

if (Meteor.isServer) {
  // Deny all client-side updates to user documents.
  Meteor.users.deny({
    update() { return true; }
  });

  Accounts.validateNewUser(function() {
    //throw new Meteor.Error(403, 'Not authorized to create new users');
    return true;
  });

  const contestants = [
    {username: 'obag', roles: ['contestant']},
    {username: 'wil93', roles: ['contestant']},
    {username: 'contest-observer', roles: ['contest-observer']}
  ];

  _.each(contestants, function (user) {
    if (Meteor.users.findOne({username: user.username})) {
      return;
    }

    console.log(`Creating user ${user.username}.`);
    const id = Accounts.createUser({
      username: user.username,
      createdAt: new Date().toISOString(),
      password: 'secret',
      profile: {name: user.username}
    });

    if (user.roles.length > 0) {
      // Need _id of existing user record so this call must come
      // after `Accounts.createUser` or `Accounts.onCreate`
      Roles.addUsersToRoles(id, user.roles);
    }
  });
}
