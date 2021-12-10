/**
 * Definition for the `fix` command.
 */

import { findManifest, fixExtensionManifest } from '../index.mjs';
import { logger } from '../log.mjs';
import { MANIFEST_BASENAME } from '../manifest.mjs';
import { DEFAULT_APPIUM_HOME } from '../system.mjs';

/**
 * @type {FixCommandModule['command']}
 */
export const command = 'fix';

/**
 * @type {FixCommandModule['command']}
 */
export const aliases = ['sync'];

/**
 * @type {FixCommandModule['describe']}
 */
export const describe = 'Modify manifest to reflect installed extensions';

export const builder = /** @type {const} */({
  dryRun: {
    describe: 'Do not modify any files',
    type: 'boolean'
  },
  home: {
    describe: 'Path to Appium home directory ($APPIUM_HOME)',
    default: DEFAULT_APPIUM_HOME,
  },
  manifest: {
    describe: `Explicit path to ${MANIFEST_BASENAME}`,
    type: 'string',
    normalize: true,
    defaultDescription: '(search for it in $APPIUM_HOME)',
  },
});

/**
 * @type {FixCommandModule['handler']}
 */
export async function handler ({dryRun, home, manifest: manifestPath}) {
  if (dryRun) {
    logger.warn('DRY RUN: Enabled');
  }

  logger.info(`Using $APPIUM_HOME: ${home}`);

  if (manifestPath) {
    logger.info(`Using manifest at ${manifestPath}`);
  } else {
    manifestPath = await findManifest(home);
  }
  await fixExtensionManifest(home, manifestPath, {dryRun});
}

/**
 * @typedef {import('./index.mjs').CmdModule<typeof builder>} FixCommandModule
 */
