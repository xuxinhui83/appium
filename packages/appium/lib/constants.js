/**
 * The name of the extension type for drivers
 */
export const DRIVER_TYPE = 'driver';

/**
 * The name of the extension type for plugins
 */
export const PLUGIN_TYPE = 'plugin';

/**
 * The `server` command of the `appium` CLI
 */
export const SERVER_SUBCOMMAND = 'server';

/**
 * The value of `--use-plugins` if _all_ plugins should be loaded
 */
export const USE_ALL_PLUGINS = 'all';

// This is a map of plugin names to npm packages representing those plugins.
// The plugins in this list will be available to the CLI so users can just
// type 'appium plugin install 'name'', rather than having to specify the full
// npm package. I.e., these are the officially recognized plugins.
export const KNOWN_PLUGINS = Object.freeze(/** @type {const} */({
  images: '@appium/images-plugin',
  'execute-driver': '@appium/execute-driver-plugin',
  'relaxed-caps': '@appium/relaxed-caps-plugin',
}));

// This is a map of driver names to npm packages representing those drivers.
// The drivers in this list will be available to the CLI so users can just
// type 'appium driver install 'name'', rather than having to specify the full
// npm package. I.e., these are the officially recognized drivers.
export const KNOWN_DRIVERS = Object.freeze(/** @type {const} */({
  uiautomator2: 'appium-uiautomator2-driver',
  xcuitest: 'appium-xcuitest-driver',
  youiengine: 'appium-youiengine-driver',
  windows: 'appium-windows-driver',
  mac: 'appium-mac-driver',
  mac2: 'appium-mac2-driver',
  espresso: 'appium-espresso-driver',
  tizen: 'appium-tizen-driver',
  flutter: 'appium-flutter-driver',
  safari: 'appium-safari-driver',
  gecko: 'appium-geckodriver',
}));
