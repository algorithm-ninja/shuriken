'use strict';

import { Accounts } from 'meteor/accounts-base';

Accounts.ui.config({
  passwordSignupFields: 'USERNAME_ONLY',
});

// Deny all client-side updates to user documents.
Meteor.users.deny({
  update() { return true; }
});
