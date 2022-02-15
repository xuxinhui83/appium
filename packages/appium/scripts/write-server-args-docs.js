#!/usr/bin/env node
/* eslint-disable no-console */

// @ts-check

const {writeFileSync} = require('fs');
const path = require('path');
const parser = require('../build/cli/parser.js');

/** @type {import('../lib/cli/args').ArgumentDefinitions} */
const appiumArguments = parser.getParser().rawArgs;
const docFile = path.normalize(
  path.join(
    __dirname,
    '..',
    '..',
    '..',
    'docs',
    'en',
    'writing-running-appium',
    'server-args.md',
  ),
);
let md = '# Appium server arguments\n\n';
md += 'Many Appium 1.5 server arguments have been deprecated in favor of the ';
md +=
  '[--default-capabilities flag](/docs/en/writing-running-appium/default-capabilities-arg.md).';
md += '\n\nUsage: `node . [flags]`\n\n';
md += '## Server flags\n';
md +=
  'All flags are optional, but some are required in conjunction with ' +
  'certain others.\n\n';
md += '\n\n<expand_table>\n\n';
md += '|Flag|Default|Description|Example|\n';
md += '|----|-------|-----------|-------|\n';
appiumArguments.forEach(function handleArguments (argOpts, argNames) {
  // handle empty objects
  if (JSON.stringify(argOpts.default) === '{}') {
    argOpts.default = '{}';
  }

  md += '|`' + argNames.join('`, `') + '`';
  md += '|' + (typeof argOpts.default === 'undefined' ? '' : argOpts.default);
  md += '|' + argOpts.help;
  md += '|';
  md += '|\n';
});

try {
  writeFileSync(docFile, md);
  console.error(
    'New docs written! Do not forget to commit:\ngit add -A %s && git commit -m "Update %s"',
    path.relative(process.cwd(), docFile),
    path.basename(docFile),
  );
} catch (err) {
  console.error('Could not write to file %s: %s', docFile, err);
  process.exitCode = 1;
}
