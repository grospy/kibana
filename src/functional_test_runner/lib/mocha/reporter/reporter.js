/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { format } from 'util';

import Mocha from 'mocha';

import { setupJUnitReportGeneration } from '../../../../dev';
import * as colors from './colors';
import * as symbols from './symbols';
import { ms } from './ms';
import { writeEpilogue } from './write_epilogue';

export function MochaReporterProvider({ getService }) {
  const log = getService('log');
  const config = getService('config');

  return class MochaReporter extends Mocha.reporters.Base {
    constructor(runner, options) {
      super(runner, options);
      runner.on('start', this.onStart);
      runner.on('hook', this.onHookStart);
      runner.on('hook end', this.onHookEnd);
      runner.on('test', this.onTestStart);
      runner.on('suite', this.onSuiteStart);
      runner.on('pending', this.onPending);
      runner.on('pass', this.onPass);
      runner.on('fail', this.onFail);
      runner.on('test end', this.onTestEnd);
      runner.on('suite end', this.onSuiteEnd);
      runner.on('end', this.onEnd);

      if (config.get('junit.enabled') && config.get('junit.reportName')) {
        setupJUnitReportGeneration(runner, {
          reportName: config.get('junit.reportName'),
          rootDirectory: config.get('junit.rootDirectory')
        });
      }
    }

    onStart = () => {
      log.write('');
    }

    onHookStart = hook => {
      log.write('-> ' + colors.suite(hook.title));
      log.indent(2);
    }

    onHookEnd = () => {
      log.indent(-2);
    }

    onSuiteStart = suite => {
      if (!suite.root) {
        log.write('-: ' + colors.suite(suite.title));
      }

      log.indent(2);
    }

    onSuiteEnd = () => {
      if (log.indent(-2) === '') {
        log.write();
      }
    }

    onTestStart = test => {
      log.write(`-> ${test.title}`);
      log.indent(2);
    }

    onTestEnd = () => {
      log.indent(-2);
    }

    onPending = test => {
      log.write('-> ' + colors.pending(test.title));
      log.indent(2);
    }

    onPass = test => {

      let time = '';
      if (test.speed !== 'fast') {
        time = colors.speed(test.speed, ` (${ms(test.duration)})`);
      }

      const pass = colors.pass(`${symbols.ok} pass`);
      log.write(`- ${pass} ${time}`);
    }

    onFail = test => {
      // NOTE: this is super gross
      //
      //  - I started by trying to extract the Base.list() logic from mocha
      //    but it's a lot more complicated than this is horrible.
      //  - In order to fix the numbering and indentation we monkey-patch
      //    console.log and parse the logged output.
      //
      let output = '';
      const realLog = console.log;
      console.log = (...args) => output += `${format(...args)}\n`;
      try {
        Mocha.reporters.Base.list([test]);
      } finally {
        console.log = realLog;
      }

      log.write(
        `- ${symbols.err} ` +
        colors.fail(`fail: "${test.fullTitle()}"`) +
        '\n' +
        output
          .split('\n')
          // drop the first two lines, (empty + test title)
          .slice(2)
          // move leading colors behind leading spaces
          .map(line => line.replace(/^((?:\[.+m)+)(\s+)/, '$2$1'))
          .map(line => ` ${line}`)
          .join('\n')
      );
    }

    onEnd = () => {
      writeEpilogue(log, this.stats);
    }
  };
}
