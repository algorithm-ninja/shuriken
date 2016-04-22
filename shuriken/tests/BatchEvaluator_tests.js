'use strict';

import test from 'ava';
import BatchEvaluator from '../evaluators/BatchEvaluator';

//TODO Add tests

test('BatchEvaluator checks job.data is Object', t => {
    const job = {data: 'string'};
    t.throws(() => {new BatchEvaluator({}, null);});
});
