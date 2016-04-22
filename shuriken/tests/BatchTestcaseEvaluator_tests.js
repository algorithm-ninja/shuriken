'use strict';

import test from 'ava';
import BatchTestcaseEvaluator from '../evaluators/BatchTestcaseEvaluator';

//TODO Add tests

test('BatchTestcaseEvaluator checks job.data is Object', t => {
    const job = {data: 'string'};
    t.throws(() => {new BatchTestcaseEvaluator({}, null);});
});
