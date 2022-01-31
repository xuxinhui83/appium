// @ts-check
import _ from 'lodash';
import B from 'bluebird';
import { homedir } from 'os';
import path from 'path';
import readPackage from 'read-pkg';
import resolveFrom from 'resolve-from';

/**
 * Path to the default `APPIUM_HOME` dir (`~/.appium`).
 * @type {string}
 */
export const DEFAULT_APPIUM_HOME = path.resolve(homedir(), '.appium');

/**
 * Basename of extension manifest file.
 * @type {string}
 */
export const MANIFEST_BASENAME = 'extensions.yaml';

/**
 * Relative path to extension manifest file from `APPIUM_HOME`.
 * @type {string}
 */
export const MANIFEST_RELATIVE_PATH = path.join('node_modules', '.cache', 'appium', MANIFEST_BASENAME);

/**
 * Finds an installation of `appium` in some directory.
 * @param {string} cwd - Directory ostensibly containing `node_modules/appium`
 * @returns {boolean}
 */
function hasLocalAppium (cwd) {
  try {
    // this _seems_ OK
    resolveFrom(cwd, 'appium/package.json');
    return true;
  } catch {}
  return false;
}

/**
 * Finds `appium` in a `package.json` file, if `cwd` contains a `package.json` file.
 * @param {import('read-pkg').NormalizedPackageJson} [pkg] - Directory to search for `package.json` file
 * @returns {string|undefined}
 */
function getAppiumDependencyFromPackage (pkg) {
  return (
    pkg?.dependencies?.appium ??
    pkg?.devDependencies?.appium ??
    pkg?.bundleDependencies?.appium
  );
}

/**
 * Attempt to read a `package.json` in `dir`.  If it doesn't exist, resolves w/ `undefined`.
 */
export const readPackageInDir = _.memoize(
  /**
   * @param {string} cwd
   * @todo better error handling
   * @returns {Promise<import('read-pkg').NormalizedPackageJson|undefined>}
   */
  async function readPackageInDir (cwd) {
    return await readPackage({cwd});
  },
);
/**
 * Finds `appium` if installed locally _or_ if a dep in a local `package.json` (and just not installed yet)
 */
const getLocalAppiumInfo = _.memoize(
  /**
   * @param {import('read-pkg').NormalizedPackageJson} [pkg]
   * @param {string} [cwd]
   * @returns {Promise<LocalAppiumInfo>}
   */
  async (pkg, cwd = process.cwd()) => {
    const [hasLocalInstall, dependencyVersion] = await B.all([
      hasLocalAppium(cwd),
      getAppiumDependencyFromPackage(pkg),
    ]);
    return {hasLocalInstall, cwd, dependencyVersion};
  },
);

/**
 * Determines location of Appium's "home" dir
 *
 * - If `APPIUM_HOME` is set, use that
 * - If we have an `extensions.yaml` in `DEFAULT_APPIUM_HOME`, then use that.
 * - If we have `appium` installed as a dependency in a local project, use the local dir
 * - Otherwise, use `DEFAULT_APPIUM_HOME`
 */
export const resolveAppiumHome = _.memoize(
  /**
   * @param {string} [cwd] - Current working directory
   */
  async (cwd) => {
    if (cwd && !path.isAbsolute(cwd)) {
      throw new TypeError('Path to cwd must be absolute');
    }

    if (process.env.APPIUM_HOME) {
      return process.env.APPIUM_HOME;
    }

    try {
      cwd = cwd ?? process.cwd();
      const pkg = await readPackageInDir(cwd);
      const status = await getLocalAppiumInfo(pkg, cwd);
      if (status?.hasLocalInstall || status?.dependencyVersion) {
        return cwd;
      }
    } catch {}
    return DEFAULT_APPIUM_HOME;
  },
);

/**
 * Figure out manifest path based on `appiumHome``.
 *
 * @param {string} [appiumHome] - Appium home directory
 * @returns {Promise<string>}
 */
export async function resolveManifestPath (appiumHome) {
  appiumHome = appiumHome ?? await resolveAppiumHome();
  return path.join(appiumHome, MANIFEST_RELATIVE_PATH);
}

/**
 * Some metadata about an Appium installation.
 *
 * @typedef {Object} LocalAppiumInfo
 * @property {boolean} hasLocalInstall - If `true`, then `appium` is resolvable locally
 * @property {string} cwd - Current working directory
 * @property {string} [dependencyVersion] - If `appium` is in a `package.json`, this is its version
 */
