'use strict';

const Sandbox = require('../sandboxes/dummy');

const kue = require('kue');
const domain = require('domain').create();
const queue = kue.createQueue();
const should = require('should');
const _ = require('lodash');

/**
 * BatchTestcaseEvaluator
 * ======================
 *
 * This class implements a testcase evaluator for the Batch problem type.
 *
 * Parameters:
 * - sourceFilename (mandatory) [URI of the source file]
 * - inputFilename (mandatory) [URI of the input file]
 * - correctOutputFilename (optional) [URI of the expected output file]
 * - languageID (optional) [Language ID of the source file]
 * - timeLimit (mandatory) [Time limit in seconds]
 * - memoryLimit (mandatory) [Memory limit in MiB]
 * - graderFilename (optional) [URI of additional source file]
 * - checkerSourceFilename (optional) [URI of checker program source]
 * - checkerLanguageID (optional) [Language ID of the checker program]
**/

class BatchTestcaseEvaluator {
    constructor(job, done) {
        this.done = done;
        this.job = job;
        this._config = job.data;

        this._config.should.be.Object();

        this._config
            .should.have.properties('sourceFilename')
            .and.have.properties('inputFilename')
            .and.have.properties('languageID')
            .and.have.properties('timeLimit')
            .and.have.properties('memoryLimit');

        this._config.correctOutputFilename =
            _.get(this._config, 'correctOutputFilename', null);

        this._config.graderFilename =
            _.get(this._config, 'graderFilename', null);

        this._config.checkerSourceFilename =
            _.get(this._config, 'checkerSourceFilename', null);

        this._config.checkerLanguageID =
            _.get(this._config, 'checkerLanguageID', null);

        this._config.sourceFilename.should.be.String();

        this._config.languageID =
            _.get(this._config, 'languageID', this._guessLanguageID(this._config.sourceFilename));

        this._config.inputFilename.should.be.String();

        if(this._config.correctOutputFilename) {
            this._config.correctOutputFilename.should.be.String();
        }

        this._config.languageID.should.be.String();

        if(this._config.checkerSourceFilename) {
            this._config.checkerSourceFilename.should.be.String();
        }

        if(this._config.graderFilename) {
            this._config.graderFilename.should.be.String();
        }

        if(this._config.checkerLanguageID) {
            this._config.checkerLanguageID.should.be.String();
        }

        this._config.timeLimit
            .should.be.Number()
            .and.not.be.Infinity()
            .and.be.above(0);

        this._config.memoryLimit
            .should.be.Number()
            .and.not.be.Infinity()
            .and.be.above(0);

        this.sandbox =
            new Sandbox()
            .timeLimit(this._config.timeLimit * 1000.0)
            .memoryLimit(this._config.memoryLimit);

        // Temporary uri handling
        this._config.sourceFilename.startsWith('file://').should.be.true();
        this._config.inputFilename.startsWith('file://').should.be.true();
        if(this._config.correctOutputFilename) {
            this._config.correctOutputFilename.startsWith('file://').should.be.true();
        }
        if(this._config.checkerSourceFilename) {
            this._config.checkerSourceFilename.startsWith('file://').should.be.true();
        }
        if(this._config.graderFilename) {
            this._config.graderFilename.startsWith('file://').should.be.true();
        }

        this._config.sourceFilename = this._config.sourceFilename.replace('file://', '');
        this._config.inputFilename = this._config.inputFilename.replace('file://', '');
        if(this._config.correctOutputFilename) {
            this._config.correctOutputFilename = this._config.correctOutputFilename.replace('file://', '');
        }
        if(this._config.checkerSourceFilename) {
            this._config.checkerSourceFilename = this._config.checkerSourceFilename.replace('file://', '');
        }
        if(this._config.graderFilename) {
            this._config.graderFilename = this._config.graderFilename.replace('file://', '');
        }
    }

    _guessLanguageID(sourceFilename) {
        sourceFilename.should.be.String();

        if(/^.*\.(c|C)$/.test(sourceFilename)) {
            return 'GCC_C';
        } else if(/^.*\.(cc|cpp|cxx)$/.test(sourceFilename)) {
            return 'GCC_CXX';
        } else if(/^.*\.java$/.test(sourceFilename)) {
            return 'JDK_JAVA';
        } else if(/^.*\.(py|py3)$/.test(sourceFilename)) {
            return 'CPYTHON_PYTHON3';
        } else if(/^.*\.cs$/.test(sourceFilename)) {
            return 'MONO_CSHARP';
        } else {
            return 'NONE';
        }
    }

    _compileSource(sourceFilename, graderFilename, languageID) {
        sourceFilename.should.be.String();
        if(graderFilename) {
            graderFilename.should.be.String();
        }
        languageID.should.be.String();

        let status;
        let args = [];

        this.sandbox.add(this._config.sourceFilename);

        switch (languageID) {
            case 'GCC_CXX':
                args = ['-Wall', '-Wextra', '-std=c++14', '-O3', '-o',
                        sourceFilename + '.bin', sourceFilename];
                if(graderFilename) {
                    args.push(graderFilename);
                }
                status = this.sandbox.run('g++', args);
                break;

            case 'GCC_C':
                args = ['-Wall', '-Wextra', '-std=c11', '-O3', '-o',
                        sourceFilename + '.bin', sourceFilename];
                if(graderFilename) {
                    args.push(graderFilename);
                }
                status = this.sandbox.run('gcc', args);
                break;

            case 'JDK_JAVA':
                args = [sourceFilename];
                if(graderFilename) {
                    args.push(graderFilename);
                }
                status = this.sandbox.run('javac', args);
                break;

            case 'CPYTHON_PYTHON3':
                break;

            case 'MONO_CSHARP':
                args = ['-out:' + sourceFilename + '.exe', sourceFilename];
                if(graderFilename) {
                    args.push(graderFilename);
                }
                status = this.sandbox.run('mcs', args);
                break;

            case 'NONE':
                break;

            default:
                this.done({score: 0.0,
                           message: languageID + ' is not supported'});
                break;
        }

        if(status.status) {
            this.done({score: 0.0,
                  message: 'Compilation error, exit code ' + status.status});
        }
        return status;
    }

    _evaluateProgram(sourceFilename, graderFilename, languageID) {
        languageID.should.be.String();
        if(graderFilename) {
            graderFilename.should.be.String();
        }sourceFilename.should.be.String();

        let status;
        let args = [];

        switch (languageID) {
            case 'GCC_CXX':
            case 'GCC_C':
                status = this.sandbox.runRelative(sourceFilename + '.bin', args);
                break;

            case 'JDK_JAVA':
                if(graderFilename) {
                    args = [graderFilename.substr(0, graderFilename.length - 5)];
                } else {
                    args = [sourceFilename.substr(0, sourceFilename.length - 5)];
                }
                status = this.sandbox.run('java', args);
                break;

            case 'CPYTHON_PYTHON3':
                if(graderFilename) {
                    args = [graderFilename];
                } else {
                    args = [sourceFilename];
                }
                status = this.sandbox.run('python3', args);
                break;

            case 'MONO_CSHARP':
                args = [sourceFilename + '.exe'];
                status = this.sandbox.run('mono', args);
                break;

            case 'NONE':
                status = this.sandbox.runRelative(sourceFilename, args);
                break;

            default:
                this.done({score: 0.0,
                           message: languageID + ' is not supported'});
                break;
        }

        if(status.status) {
            this.done({score: 0.0,
                  message: 'Program ended with non-zero exit code'});
        }
        return status;
    }

    run() {
        this._compileSource(this._config.sourceFilename,
                            this._config.graderFilename,
                            this._config.languageID);

        this.sandbox.add(this._config.inputFilename, 'input.txt')
               .stdin('input.txt')
               .stdout('output.txt');

        this._evaluateProgram(this._config.sourceFilename,
                              this._config.graderFilename,
                              this._config.languageID);

        if(this._config.correctOutputFilename) {
            this.sandbox.add(this._config.correctOutputFilename, 'correct.txt');
        }

        let status;

        if(this._config.checkerSourceFilename) {
            if(!this._config.checkerLanguageID) {
                this._config.checkerLanguageID = this._guessLanguageID(this._config.checkerSourceFilename);
            }
            this._compileSource(this._config.checkerSourceFilename, null, this._config.checkerLanguageID);
            status = this._evaluateProgram(this._config.sourceFilename, null, this._config.checkerLanguageID);
        } else {
            status = this.sandbox.run('diff', ['--ignore-trailing-space', 'output.txt', 'correct.txt']);

        }

        if(status.status) {
            this.done({score: 0.0, message: 'Wrong Answer'});
        } else {
            this.done({score: 1.0, message: 'Correct Answer'});
        }
    }
}

queue.process('subjob', function(job, done) {
    let d = domain.create();
    d.on('error', (err) => {
        done(err);
    });
    d.run(() => {
        let evaluator = new BatchTestcaseEvaluator(job, done);
        evaluator.run();
    });
});
