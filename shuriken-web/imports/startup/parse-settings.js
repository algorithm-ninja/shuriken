if (Meteor.isServer) {
  const _ = require('lodash');

  if (!_.has(Meteor.settings, 'fileStoreRoot')) {
    process.exit(1);
  }
}
