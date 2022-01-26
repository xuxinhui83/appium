// @ts-check

/**
 * Module containing {@link Manifest} which handles reading & writing of extension config files.
 */

import { env, fs, mkdirp } from '@appium/support';
import _ from 'lodash';
import path from 'path';
import YAML from 'yaml';
import log from '../logger';
import { DRIVER_TYPE, PLUGIN_TYPE } from '../constants';

const { DEFAULT_APPIUM_HOME } = env;

/**
 * Current configuration schema revision!
 */
const CONFIG_SCHEMA_REV = 2;

/**
 * @type {`${typeof DRIVER_TYPE}s`}
 */
const CONFIG_DATA_DRIVER_KEY = `${DRIVER_TYPE}s`;

/**
 * @type {`${typeof PLUGIN_TYPE}s`}
 */
const CONFIG_DATA_PLUGIN_KEY = `${PLUGIN_TYPE}s`;

/**
 * Handles reading & writing of extension config files.
 *
 * Only one instance of this class exists per value of `APPIUM_HOME`.
 */
export class Manifest {
  /**
   * "Dirty" flag. If true, the data has changed since the last write.
   * @type {boolean}
   * @private
   */
  _dirty;

  /**
   * The entire contents of a parsed YAML extension config file.
   *
   * Contains proxies for automatic persistence on disk
   * @type {ManifestWithSchemaRev}
   * @private
   */
  _data;

  /**
   * Path to `APPIUM_HOME`.
   * @private
   * @type {Readonly<string>}
   */
  _appiumHome;

  /**
   * Path to `extensions.yaml`
   * @type {string}
   * Not set until {@link Manifest.read} is called.
   */
  _manifestPath;

  /**
   * Helps avoid writing multiple times.
   *
   * If this is `null`, calling {@link Manifest.write} will cause it to be
   * set to a `Promise`. When the call to `write()` is complete, the `Promise`
   * will resolve and then this value will be set to `null`.  Concurrent calls
   * made while this value is a `Promise` will return the `Promise` itself.
   * @private
   * @type {Promise<boolean>?}
   */
  _writing = null;

  /**
   * Helps avoid reading multiple times.
   *
   * If this is `null`, calling {@link Manifest.read} will cause it to be
   * set to a `Promise`. When the call to `read()` is complete, the `Promise`
   * will resolve and then this value will be set to `null`.  Concurrent calls
   * made while this value is a `Promise` will return the `Promise` itself.
   * @private
   * @type {Promise<void>?}
   */
  _reading = null;

  /**
   * @param {string} appiumHome
   */
  constructor (appiumHome) {
    this._appiumHome = appiumHome;
  }

  /**
   * Creaes a `Proxy` which watches for changes to the extension-type-specific
   * config data.
   *
   * When changes are detected, it sets a `_dirty` flag.  The next call to
   * {@link Manifest.write} will check if this flag is `true` before
   * proceeding.
   * @template {ExtensionType} ExtType
   * @param {ExtType} extTypeKey
   * @param {ManifestData} manifest - Extension config data, keyed by Name
   * @private
   */
  _createProxy (extTypeKey, manifest) {
    return (
      new Proxy(manifest[`${extTypeKey}s`], {
        set: (target, prop, value) => {
          // `prop` can be a symbol, but the keys of `target` are always strings.
          prop = String(prop);
          if (value !== target[prop]) {
            this._dirty = true;
          }
          target[prop] = value;
          return Reflect.set(target, prop, value);
        },
        deleteProperty: (target, prop) => {
          if (prop in target) {
            this._dirty = true;
          }
          return Reflect.deleteProperty(target, prop);
        },
      })
    );
  }

  /**
   * Returns the APPIUM_HOME path
   */
  get appiumHome () {
    return this._appiumHome;
  }

  /**
   * Returns the path to the manifest file
   */
  get manifestPath () {
    return this._manifestPath;
  }

  get drivers () {
    return this._data[CONFIG_DATA_DRIVER_KEY];
  }

  get plugins () {
    return this._data[CONFIG_DATA_PLUGIN_KEY];
  }

  /**
   * Gets data for an extension type.  Reads the config file if necessary.
   *
   * Force-reading is _not_ supported, as it's likely to be a source of
   * bugs--it's easy to mutate the data and then overwrite memory with the file
   * contents
   *
   * Ideally this will only ever read the file _once_.
   * want
   * @param {boolean} [force] - If `true`, re-read the manifest even if we've changed it in memory.
   * @returns {Promise<ManifestData>} The data
   */
  async read (force = false) {
    if (this._data && !force) {
      return this._data;
    }
    if (this._reading) {
      await this._reading;
      return this._data;
    }

    this._reading = (async () => {
      /** @type {ManifestWithSchemaRev} */
      let data;
      let isNewFile = false;
      this._manifestPath = this._manifestPath ?? (await env.getManifestPath(this._appiumHome));
      try {
        log.debug(`Reading ${this._manifestPath}...`);
        const yaml = await fs.readFile(this._manifestPath, 'utf8');
        data = YAML.parse(yaml);
      } catch (err) {
        if (err.code === 'ENOENT') {
          data = {
            [CONFIG_DATA_DRIVER_KEY]: {},
            [CONFIG_DATA_PLUGIN_KEY]: {},
          };
          isNewFile = true;
        } else {
          if (this._manifestPath) {
            throw new Error(
              `Appium had trouble loading the extension installation ` +
                `cache file (${this._manifestPath}). Ensure it exists and is ` +
                `readable. Specific error: ${err.message}`,
            );
          } else {
            throw new Error(
              `Appium encountered an unknown problem. Specific error: ${err.message}`,
            );
          }
        }
      }

      this._data = {
        [CONFIG_DATA_DRIVER_KEY]: this._createProxy(
          DRIVER_TYPE,
          data,
        ),
        [CONFIG_DATA_PLUGIN_KEY]: this._createProxy(
          PLUGIN_TYPE,
          data,
        ),
        schemaRev: data.schemaRev ?? CONFIG_SCHEMA_REV
      };

      if (isNewFile) {
        log.debug('Creating manifest');
        await this.write(true);
      }
    })();
    try {
      await this._reading;
      return this._data;
    } finally {
      this._reading = null;
    }
  }

  /**
   * Writes the data if it needs writing.
   *
   * If the `schemaRev` prop needs updating, the file will be written.
   * @param {boolean} [force=false] - Whether to force a write even if the data is clean
   * @returns {Promise<boolean>} Whether the data was written
   */
  async write (force = false) {
    if (this._writing) {
      return this._writing;
    }
    this._writing = (async () => {
      try {
        if (!this._dirty && !force) {
          return false;
        }

        if (!this._data) {
          throw new ReferenceError('No data to write. Call `read()` first');
        }

        this._manifestPath =
          this._manifestPath ?? (await env.getManifestPath(this._appiumHome));

        try {

          await mkdirp(path.dirname(this._manifestPath));
          await fs.writeFile(
            this._manifestPath,
            YAML.stringify(this._data),
            'utf8',
          );
          this._dirty = false;
          return true;
        } catch (err) {
          log.error(err);
          throw new Error(
            `Appium could not write to manifest at ${this._manifestPath} using APPIUM_HOME ${this._appiumHome}. ` +
              `Please ensure it is writable. Original error: ${err.message}`,
          );
        }
      } finally {
        this._writing = null;
      }
    })();
    return await this._writing;
  }
}

/**
 * Factory function for {@link Manifest}.
 *
 * Maintains one instance per value of `appiumHome`.
 */
export const getManifestInstance = _.memoize(
  /**
   * @param {string} [appiumHome] - Path to `APPIUM_HOME`
   * @returns {Manifest}
   */
  (appiumHome = DEFAULT_APPIUM_HOME) => new Manifest(appiumHome),
);

/**
 * @typedef {typeof DRIVER_TYPE | typeof PLUGIN_TYPE} ExtensionType
 */

/**
 * Represents an entire YAML manifest (`extensions.yaml`)
 * @typedef {Object} ManifestData
 * @property {Record<string,ManifestDriverData>} drivers - Record of drivers, keyed by name
 * @property {Record<string,ManifestPluginData>} plugins - Record of plugins, keyed by name
 */

/**
 * @typedef {ManifestData & { schemaRev?: number }} ManifestWithSchemaRev
 */

/**
 * Converts external extension data (as in `package.json`) into manifest data
 * @template {ExtensionType} ExtType
 * @typedef {Omit<ExternalData<ExtType>,ExtType extends DriverType ? 'driverName' : 'pluginName'> & InternalData} ExtensionManifest
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
 * Convert external (`package.json`) extension data into manifest data
 * @typedef {ExtensionManifest<DriverType>} ManifestDriverData
 */

/**
 * Convert external (`package.json`) extension data into manifest data
 * @typedef {ExtensionManifest<PluginType>} ManifestPluginData
 */

/**
 * Data points shared by all Appium extensions
 * @typedef {Object} CommonData
 * @property {string} mainClass - Name of main class in the extension
 * @property {Record<string,string>} [scripts] - Collection of scripts which an extension may run
 * @property {string | (import('ajv').SchemaObject & {[key: number]: never})} [schema] - Argument schema object
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
 * @template {ExtensionType} ExtType
 * @typedef {CommonData & ExtType extends DriverType ? DriverData : PluginData} ExternalData
 */

/**
 * Driver-specific and common manifest data as provided by an extension's `package.json`.
 * @typedef {CommonData & DriverData} ExternalDriverData
 */

/**
 * Plugin-specific and common manifest data as provided by an extension's `package.json`.
 * @typedef {CommonData & PluginData} ExternalPluginData
 */

/**
 * Main class/constructor of third-party plugin
 *
 * Referenced by {@link CommonData.mainClass}
 * @typedef { {pluginName: string} & (new (...args: any[]) => PluginClass)} PluginClass
 */

/**
 * Main class/constructor of third-party driver
 *
 * Referenced by {@link CommonData.mainClass}
 * @typedef { {driverName: string} & (new (...args: any[]) => DriverClass)} DriverClass
 */

/**
 * @template {ExtensionType} ExtType
 * @typedef {ManifestData[`${ExtType}s`]} ExtRecord
 */

/**
 * @template {ExtensionType} ExtType
 * @typedef {ExtType extends DriverType ? ManifestDriverData : ManifestPluginData} ExtData
 */

/**
 * @template {ExtensionType} ExtType
 * @typedef {(ExtType extends DriverType ? ManifestDriverData : ManifestPluginData) & {schema: import('ajv').SchemaObject|string} } ExtDataWithSchema
 */

/**
 * @template {ExtensionType} ExtType
 * @typedef {ExtType extends DriverType ? DriverClass : PluginClass} ExtClass
 */

/**
 * @template {ExtensionType} ExtType
 * @typedef {keyof ExtRecord<ExtType> & string} ExtName
 */

/**
 * Type of the string referring to a driver (typically as a key or type string)
 * @typedef {typeof import('../constants').DRIVER_TYPE} DriverType
 */

/**
 * Type of the string referring to a plugin] (typically as a key or type string)
 * @typedef {typeof import('../constants').PLUGIN_TYPE} PluginType
 */
