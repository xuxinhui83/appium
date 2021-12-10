/**
 * Contains a class for working with Appium extension manifest files
 */

import { fs } from '@appium/support';
import _ from 'lodash';
import path from 'path';
import semver from 'semver';
import YAML from 'yaml';
import { logger } from './log.mjs';
import { isDriver, isPlugin } from './utils.mjs';

/**
 * The basename of the manifest file.
 */
export const MANIFEST_BASENAME = 'extensions.yaml';

/**
 * Default, empty manifest data.
 * @type {Readonly<Manifest>}
 */
const DEFAULT_MANIFEST = Object.freeze({drivers: {}, plugins: {}});

/**
 * Represents an Appium extension manifest file and operations on/around it.
 *
 * This should not be exposed directly to package consumers.
 */
export class AppiumExtManifest {
  /**
   * Path to `extensions.yaml`
   * @type {Readonly<string>}
   * @private
   */
  _filepath;

  /**
   * Current working directory (typically `$APPIUM_HOME`)
   * @type {Readonly<string>}
   * @private
   */
  _cwd;

  /**
   * Manifest data.
   *
   * Will only be persisted to disk if {@link AppiumExtManifest.write} is explicitly called.
   * @type {Manifest}
   * @private
   */
  _data;

  /**
   *
   * @param {string} cwd - The current working directory (typically `$APPIUM_HOME`)
   * @param {string} [filepath] - Path to manifest file (`extensions.yaml`).  Defaults to `$APPIUM_HOME/extensions.yaml`.
   * @param {Manifest} [manifest] - Manifest data, if we have it.
   * @private
   */
  constructor (cwd, filepath, manifest) {
    this._cwd = cwd;
    this._filepath = filepath ?? path.join(cwd, MANIFEST_BASENAME);
    this._data = manifest ?? _.cloneDeep(DEFAULT_MANIFEST);
  }

  /**
   * If no drivers or plugins found, this is `true`.
   */
  get isEmpty () {
    return _.isEmpty(this._data.drivers) && _.isEmpty(this._data.plugins);
  }

  /**
   * Manifest data. Cloned because deeply freezing an object is painful
   */
  get data () {
    return _.cloneDeep(this._data);
  }

  get filepath () {
    return this.filepath;
  }

  get cwd () {
    return this.cwd;
  }

  /**
   * Given path to `package.json`, determine the `installPath` property, which is relative to `this.cwd`
   * @param {string} pkgPath
   * @returns {string}
   * @private
   */
  toInstallPath (pkgPath) {
    const modulePath = path.dirname(pkgPath);
    const relative = path.relative(this._cwd, modulePath);
    const parts = relative.split(path.sep);
    return parts.lastIndexOf('node_modules') === -1
      ? parts.join('/')
      : parts.slice(0, parts.lastIndexOf('node_modules')).join('/');
  }

  /**
   * Given an extension's `package.json`, add it to the manifest.
   *
   * If extension name already exists in the manifest for the extension type
   * (driver/plugin), the existing data will be overwritten.
   *
   * Does not write to disk; call {@link AppiumExtManifest.write} to do that.
   * @throws {TypeError} When extension type is unrecognized
   * @template {ExternalPluginData | ExternalDriverData} ExternalData
   * @param {ExtensionPackageJson<ExternalData>} pkg - Contents of extensions `package.json`
   * @param {string} pkgPath - Path to extension's `package.json`
   * @returns {void}
   */
  addExtension (pkg, pkgPath) {
    /**
     * @type {InternalData}
     */
    const internal = {
      pkgName: pkg.name,
      version: pkg.version,
      installPath: this.toInstallPath(pkgPath),
    };

    if (isDriver(pkg)) {
      this._data.drivers[pkg.appium.driverName] = {
        ...internal,
        ..._.omit(pkg.appium, 'driverName'),
      };
    } else if (isPlugin(pkg)) {
      this._data.plugins[pkg.appium.pluginName] = {
        ...internal,
        ..._.omit(pkg.appium, 'pluginName'),
      };
    } else {
      logger.error(
        `Package at ${pkgPath} is not a valid Appium extension:\n%O`,
        pkg.appium,
      );
      throw new TypeError(
        `Package at ${pkgPath} is not a valid Appium extension`,
      );
    }
  }

  /**
   * Compares this manifest to another manifest and returns a list of differences.
   *
   * Used by the `info` command.
   * @param {AppiumExtManifest} other - The other object
   * @returns {Summary[]} Summary of differences in a tabular format (array of objects)
   */
  compare (other) {
    /**
     * @template {'driver'|'plugin'} ExtType
     * @param {ExtType} type
     * @param {Manifest[`${ExtType}s`]} value
     */
    const munge = (type, value) =>
      _.mapKeys(
        _.mapValues(value, ({pkgName, version}, name) => ({
          pkgName,
          version,
          name,
          type,
        })),
        'pkgName',
      );

    /**
     * Compares version(s) of a collection of extensions using semver.
     * @param {ReturnType<typeof munge>} a
     * @param {ReturnType<typeof munge>} b
     * @returns {Summary[]}
     */
    const compareVersions = (a, b) =>
      _.map(a, (data, pkgName) => {
        if (!b[pkgName]) {
          return {...data, status: 'missing'};
        }
        if (semver.lt(b[pkgName].version, data.version)) {
          return {...data, status: 'outdated', note: `(${b[pkgName].version})`};
        }
        if (semver.gt(b[pkgName].version, data.version)) {
          return {...data, status: 'newer', note: `(${b[pkgName].version})`};
        }
        return {...data, status: 'installed'};
      });
    /**
     * Returns a {@link Summary} object for each "extraneous" extension.
     *
     * "Extraneous" is defined as an extension which is present in `b` but not `a`.
     * @param {ReturnType<typeof munge>} b
     * @param {ReturnType<typeof munge>} a
     * @returns {Summary[]}
     */
    const extraneousSummary = (b, a) =>
      _.reduce(
        b,
        (extraneous, data, pkgName) => {
          if (!a[pkgName]) {
            extraneous.push({...data, status: 'extraneous'});
          }
          return extraneous;
        },
        /** @type {Summary[]} */ ([]),
      );

    const thisDrivers = munge('driver', this.data.drivers);
    const otherDrivers = munge('driver', other.data.drivers);
    const thisPlugins = munge('plugin', this.data.plugins);
    const otherPlugins = munge('plugin', other.data.plugins);

    const table = [
      ...compareVersions(thisDrivers, otherDrivers),
      ...compareVersions(thisPlugins, otherPlugins),
      ...extraneousSummary(otherDrivers, thisDrivers),
      ...extraneousSummary(otherPlugins, thisPlugins),
    ];

    return table;
  }

  /**
   * Writes YAML manifest file at this object's {@link AppiumExtManifest._filepath filepath} to disk with the contents of this object's {@link AppiumExtManifest._data data}.
   *
   * @returns {Promise<boolean>} `true` if the file was written, `false` if it was not
   */
  async write () {
    let contents;
    try {
      contents = YAML.stringify(this._data);
    } catch (err) {
      logger.error(
        'Error serializing manifest at %s: %s',
        this._filepath,
        err.message,
      );
      return false;
    }
    /** @type {import('fs/promises').writeFile} */
    const writeFile = fs.writeFile;
    try {
      await writeFile(this._filepath, contents);
      logger.ok('Wrote extension manifest at %s', this._filepath);
      return true;
    } catch (err) {
      logger.error(
        'Error writing manifest file %s: %s',
        this._filepath,
        err.message,
      );
      return false;
    }
  }

  /**
   * Creates a new {@link AppiumExtManifest} within `cwd` from the manifest at
   * `filepath`.
   *
   * If you need a synchronous operation, use {@link AppiumExtManifest.from},
   * having obtained the manifest data already.
   * @param {string} cwd - The current working directory (`$APPIUM_HOME`)
   * @param {string} filepath - Path to manifest file (`extensions.yaml`)
   * @returns {Promise<AppiumExtManifest>}
   */
  static async fromManifestFile (cwd, filepath) {
    return new AppiumExtManifest(
      cwd,
      filepath,
      await AppiumExtManifest.readExtensionManifest(filepath),
    );
  }

  /**
   * Reads extensions manifest (`extensions.yaml`) at `filepath` and resolves w/ {@link AppiumExtManifest.compare}
   *
   * @param {string} filepath - Full filepath to `extensions.yaml`
   * @private
   * @returns {Promise<Manifest>}
   */
  static async readExtensionManifest (filepath) {
    /** @type {import('fs/promises').readFile} */
    const readFile = fs.readFile;
    const contents = await readFile(filepath, 'utf8');
    return YAML.parse(contents);
  }

  /**
   * Creates a new {@link AppiumExtManifest} within `cwd`.
   *
   * @param {string} cwd - The current working directory (`$APPIUM_HOME`)
   * @param {string} [filepath] - _Relative_ filepath to manifest. If omitted,
   * `extensions.yaml` will be created in `cwd` when
   * {@link AppiumExtManifest.write} is called.
   * @param {Manifest} [data] - Manifest data. If omitted, a new file be written
   * to `filepath`, potentially overwriting anything there..
   * @returns {AppiumExtManifest}
   */
  static from (cwd, filepath, data) {
    return new AppiumExtManifest(cwd, filepath, data);
  }

  toString () {
    return YAML.stringify(this._data);
  }
}

/**
 * @typedef {Object} Manifest
 * @property {Record<string,ManifestData<ExternalDriverData>>} drivers
 * @property {Record<string,ManifestData<ExternalPluginData>>} plugins
 */

/**
 * @template {ExternalDriverData|ExternalPluginData} ExternalData
 * @typedef {Omit<ExternalData,ExternalData extends ExternalDriverData ? 'driverName' : 'pluginName'> & InternalData} ManifestData
 */

/**
 * Manifest extension data which is _not_ provided by either
 * {@link ExternalDriverData} or {@link ExternalPluginData}.  It may be derived
 * (e.g., `installPath`) or copied from elsewhere in a `package.json` (e.g.,
 * `version`).
 * @typedef {Object} InternalData
 * @property {string} pkgName - Name of package (e.g., `appium-xcuitest-driver`)
 * @property {string} version - Version of package
 * @property {string} installPath - Install path _relative to `$APPIUM_HOME`_
 * @property {string} [installType] - Install type (e.g., `npm` or `local`). Unused by this tool; only used by `appium` executable
 * @property {string} [installSpec] - Whatever the user typed as the extension to install.  Unused by this tool; only used by `appium` executable
 */

/**
 * Data points shared by all Appium extensions
 * @typedef {Object} CommonData
 * @property {string} mainClass - Name of main class in the extension
 * @property {Record<string,string>} [scripts] - Collection of scripts which an extension may run
 * @property {import('ajv').SchemaObject & {[key: number]: never}} [schema] - Argument schema object
 */

/**
 * Driver-specific manifest data.
 * @typedef {Object} DriverData
 * @property {string} automationName - Automation engine to use
 * @property {string[]} platformNames - Platforms to run on
 * @property {string} driverName - Name of driver (_not_ the same as the package name, probably)
 */

/**
 * Plugin-specific manifest data.
 * @typedef {Object} PluginData
 * @property {string} pluginName - Name of plugin (_not_ the same as the package name, probably)
 */

/**
 * Driver-specific and common manifest data.
 * @typedef {CommonData & DriverData} ExternalDriverData
 */

/**
 * Plugin-specific and common manifest data.
 * @typedef {CommonData & PluginData} ExternalPluginData
 */

/**
 * A `package.json` containing extension data (one of {@link ExternalDriverData} or {@link ExternalPluginData}).
 * @template {ExternalDriverData|ExternalPluginData} ExternalData
 * @typedef {NormalizedPackageJson & {appium: ExternalData}} ExtensionPackageJson
 */

/**
 * A `package.json` containing {@link ExternalDriverData}.
 * @typedef {ExtensionPackageJson<ExternalDriverData>} DriverPackageJson
 */

/**
 * A `package.json` containing {@link ExternalPluginData}.
 * @typedef {ExtensionPackageJson<ExternalPluginData>} PluginPackageJson
 */

/**
 * @typedef {import('read-pkg').NormalizedPackageJson} NormalizedPackageJson
 */

/**
 * An object summarizing the differences between expected extensions (in `extensions.yaml`) and installed ones (e.g., in a `node_modules` directory).
 * @typedef {Object} Summary
 * @property {InternalData['pkgName']} pkgName - Extension {@link InternalData['pkgName'] package name}
 * @property {InternalData['version']} version - The expected {@link InternalData['version'] version}
 * @property {keyof Manifest['drivers'] | keyof Manifest['plugins']} name - Either a {@link DriverData['driverName'] driver name} or a {@link PluginData['pluginName'] plugin name}
 * @property {'driver'|'plugin'} type - Extension type
 * @property {Status} status - See {@link Status}
 * @property {string} [note] - Optional contextual information; could be used to e.g., show which version is _actually_ installed
 */

/**
 * A string representing the status of an installed (or expected-to-be-installed) extension.
 *
 * The status is one of:
 * - `installed`: The extension is installed and up-to-date
 * - `outdated`: The extension is installed, but is out-of-date
 * - `missing`: The extension is not installed
 * - `newer`: The extension is installed, but is newer than the expected version
 * - `extraneous`: The extension is installed, but is not expected
 * @typedef {'installed'|'missing'|'outdated'|'newer'|'extraneous'} Status
 */
