/* eslint-disable no-console */
import _ from 'lodash';
import {readPackage} from 'read-pkg';
import {logger} from './log.mjs';

export {readPackage};

/**
 * Given a `package.json` return `true` if it represents an Appium Extension (either a driver or plugin).
 *
 * The `package.json` must have an `appium` property which is an object.
 * @param {any} value
 * @returns {value is ExtensionPackageJson<ExternalDriverData|ExternalPluginData>}
 */
export function isExtension (value) {
  return _.isPlainObject(value) && _.isPlainObject(value.appium);
}

/**
 * Given a `package.json`, return `true` if it represents an Appium Driver.
 *
 * To be considered a driver, a `package.json` must have a fields
 * `appium.driverName`, `appium.automationName` and `appium.platformNames`.
 * @param {any} value - Value to test
 * @returns {value is DriverPackageJson}
 */
export function isDriver (value) {
  return (
    isExtension(value) &&
    _.has(value, 'appium.driverName') &&
    _.has(value, 'appium.automationName') &&
    _.has(value, 'appium.platformNames')
  );
}

/**
 * Given a `package.json`, return `true` if it represents an Appium Plugin.
 *
 * To be considered a plugin, a `package.json` must have an `appium.pluginName` field.
 * @param {any} value - Value to test
 * @returns {value is PluginPackageJson}
 */
export function isPlugin (value) {
  return isExtension(value) && _.has(value, 'appium.pluginName');
}


/**
 * Reoslve w/ `true` if cwd contains a project which depends upon Appium.
 *
 * Another strategy would just be to use `npm ls appium` to check if it's
 * installed.  Which one is more correct?  I'm not sure, but I'm leaning towards
 * this.
 * @param {string|NormalizedPackageJson} cwd - Typically `$APPIUM_HOME`
 * @returns {Promise<boolean>} `true` if `appium` is in deps
 */
export async function hasLocalAppium (cwd) {
  const pkg = _.isString(cwd) ? await readPackageInDir(cwd) : cwd;
  return Boolean(
      pkg &&
        (pkg.dependencies?.appium ??
          pkg.devDependencies?.appium ??
          pkg.bundleDependencies?.appium ??
          pkg.bundleDependencies?.includes('appium') ??
          pkg.bundledDependencies?.includes('appium')),
  );
}

/**
 *
 * @param {NormalizedPackageJson} pkg
 * @returns {string|undefined}
 */
export function appiumDependencyVersion (pkg) {
  return (pkg.dependencies?.appium ??
    pkg.devDependencies?.appium ??
    pkg.bundleDependencies?.appium);
}


/**
 * Attempt to read a `package.json` in `dir`.  If it doesn't exist, resolves w/ `undefined`.
 * @param {string} cwd
 * @returns {Promise<NormalizedPackageJson|undefined>}
 */
export async function readPackageInDir (cwd) {
  try {
    return await readPackage({cwd});
  } catch (err) {
    // ignore if missing.
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
 * Logs a table of the summary of actual/expected installed extensions.
 * @param {import('./manifest.mjs').Summary[]} summary - As created by {@link }
 */
export function showSummaryTable (summary) {
  if (summary.length) {
    logger.log('Appium Extensions:');
    logger.table(summary);

    const missing = _.filter(summary, ({status}) => status === 'missing');
    const extraneous = _.filter(summary, ({status}) => status === 'extraneous');

    if (!(missing.length + extraneous.length)) {
      logger.ok('No problems detected.');
    } else {
      if (missing.length) {
        logger.warn(`${missing.length} extensions should be installed!`);
      }
      if (extraneous.length) {
        logger.warn(
          `${extraneous.length} extensions are installed but do not appear in the manifest`,
        );
      }
    }
  } else {
    logger.info('No extensions installed.');
  }
}

/**
 * A type-safe "omit" function.
 * @template O
 * @template {keyof O} K
 * @param {O} value
 * @param {K} key
 * @returns {Omit<O, K>}
 */
export function omit (value, key) {
  const clone = {...value};
  delete clone[key];
  return value;
}

/**
 * @template T
 * @typedef {import('./manifest.mjs').ManifestData<T>} ExtensionData
 */

/**
 * @typedef {import('./manifest.mjs').ExternalPluginData} ExternalPluginData
 * @typedef {import('./manifest.mjs').ExternalDriverData} ExternalDriverData
 * @typedef {import('./manifest.mjs').DriverPackageJson} DriverPackageJson
 * @typedef {import('./manifest.mjs').PluginPackageJson} PluginPackageJson
 * @typedef {import('./manifest.mjs').Manifest} Manifest
 * @typedef {import('./manifest.mjs').NormalizedPackageJson} NormalizedPackageJson
 */

/**
 * @template T
 * @typedef {import('./manifest.mjs').ExtensionPackageJson<T>} ExtensionPackageJson
 */

/**
 * @typedef {import('./manifest.mjs').AppiumExtManifest} AppiumExtManifest
 */
