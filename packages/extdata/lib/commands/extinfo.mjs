/**
 * Definition for the `extinfo` command.
 */

import { homedir } from 'os';
import YAML from 'yaml';
import { findExtensions } from '../index.mjs';
import { logger } from '../log.mjs';
import { MANIFEST_BASENAME } from '../manifest.mjs';
import { showSummaryTable } from '../utils.mjs';

/**
 * @type {InfoCommandModule['command']}
 */
export const command = 'extinfo';

/**
 * @type {InfoCommandModule['describe']}
 */
export const describe = 'Show info about installed Appium extensions';

export const builder = /** @type {const} */({
  json: {
    boolean: true,
    describe: 'Output in JSON format',
  },
  yaml: {
    boolean: true,
    describe: 'Output in YAML format',
  },
  home: {
    string: true,
    describe: 'Path to Appium home directory ($APPIUM_HOME)',
    default: `${homedir()}/.appium`,
  },
  manifest: {
    describe: `Explicit path to ${MANIFEST_BASENAME}`,
    string: true,
    normalize: true,
    defaultDescription: '(search for it in $APPIUM_HOME)',
  },
});

/**
 * @type {InfoCommandModule['handler']}
 */
export async function handler (argv) {
  const {home, json, yaml, manifest: manifestPath} = argv;

  logger.info(`Using $APPIUM_HOME: ${home}`);

  const data = await findExtensions(home, {manifestPath});
  const summary = data.expected.compare(data.actual);

  if (json) {
    logger.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (yaml) {
    logger.log(YAML.stringify(summary));
    return;
  }

  showSummaryTable(summary);
}

/**
 * @typedef {import('./index.mjs').CmdModule<typeof builder>} InfoCommandModule
 */
