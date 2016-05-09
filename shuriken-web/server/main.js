'use strict';

import '../imports/api/contests.js';
import '../imports/api/contestTasks.js';
import '../imports/api/evaluations.js';
import '../imports/api/submissions.js';
import '../imports/api/submissionMethods.js';
import '../imports/api/taskRevisions.js';
import '../imports/api/tasks.js';
import '../imports/api/users.js';

import {EvaluationWatcher} from './evaluationWatcher.js';
// Start the watcher.
new EvaluationWatcher();
