if (Meteor.isServer) {
  const _ = require('lodash');

  if (!_.has(Meteor.settings, 'fileStoreRoot')) {
    console.log('Missing setting: fileStoreRoot');
    process.exit(1);
  }
}
