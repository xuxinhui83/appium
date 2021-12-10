/**
 * Definition for the `sysinfo` command.
 */

import { bold } from 'colorette';
import sysinfo from 'path';
import YAML from 'yaml';
import { logger } from '../log.mjs';
import { getAppiumExecutableInfo, resolveAppiumHome } from '../system.mjs';

/**
 * @type {SysinfoCommandModule['command']}
 */
export const command = 'sysinfo';

export const builder = /** @type {const} */ ({
  json: {
    boolean: true,
    describe: 'Output in JSON format',
  },
  yaml: {
    boolean: true,
    describe: 'Output in YAML format',
  },
  cwd: {
    string: true,
    normalize: true,
    describe: 'Path to local JS project (if applicable)',
    defaultDescription: '(current working directory)',
    default: process.cwd(),
  },
});

/**
 * @type {SysinfoCommandModule['describe']}
 */
export const describe =
  'Show location of "appium" executable, APPIUM_HOME, etc.';

/**
 * @type {SysinfoCommandModule['handler']}
 */
export async function handler ({cwd, json, yaml}) {
  const status = await getAppiumExecutableInfo(sysinfo.resolve(cwd));
  const {home, fromEnv} = await resolveAppiumHome(cwd, status);

  if (json || yaml) {
    const data = {
      ...status,
      appiumHomePath: home,
      appiumHomeFromEnv: fromEnv,
    };
    if (json) {
      logger.log(JSON.stringify(data));
    } else {
      logger.log(YAML.stringify(data));
    }
    return;
  }

  logger.info('CWD: %s', bold(cwd));
  if (status.dependencyVersion) {
    logger.info(
      'Package in CWD has Appium dependency of: %s',
      bold(status.dependencyVersion),
    );
  }
  if (status.localExecutable) {
    logger.info('appium executable in CWD: %s', bold(status.localExecutable));
    if (status.localExecutableLink) {
      logger.info(
        'appium executable in CWD linked to: %s',
        bold(status.localExecutableLink),
      );
    } else {
      logger.warn('%s symbolic link is orphaned!', status.localExecutableLink);
    }
  } else {
    logger.info('Appium in CWD: %s', bold('not found'));
  }
  if (status.globalExecutable) {
    logger.info(
      'globally-installed appium executable: %s',
      bold(status.globalExecutable),
    );
    if (status.globalExecutableLink) {
      logger.info(
        'globally-installed appium executable linked to: %s',
        bold(status.globalExecutableLink),
      );
    } else {
      logger.warn('%s symbolic link is orphaned!', status.globalExecutable);
    }
  } else {
    logger.info('globally-installed Appium %s', bold('not found'));
  }
  if (status.envExecutable) {
    logger.info(
      'appium executable found in $PATH: %s',
      bold(status.envExecutable),
    );
    if (status.envExecutableLink) {
      logger.info(
        'appium executable found in $PATH linked to: %s',
        bold(status.envExecutableLink),
      );
    } else {
      logger.warn('%s symbolic link is orphaned!', status.envExecutable);
    }
  } else {
    logger.info('appium executable in $PATH %s', bold('not found'));
  }

  logger.info('Path to Appium "home" directory:', bold(home));
  logger.info(
    'Using $APPIUM_HOME from environment?',
    bold(fromEnv ? 'YES' : 'NO'),
  );
}

/**
 * @typedef {import('./index.mjs').CmdModule<typeof builder>} SysinfoCommandModule
 */
