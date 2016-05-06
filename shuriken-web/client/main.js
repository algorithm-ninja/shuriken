'use strict';

import '../imports/ui/body.js';
import '../imports/startup/accounts-config.js';

Template.registerHelper('equals', function (a, b) {
  return a === b;
});
