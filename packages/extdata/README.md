# @appium/extdata

> Utility for managing installation of Appium extensions

## About

The main goal of this utility is to establish a compatibility layer between installation of extensions in `APPIUM_HOME` and those installed in a local JavaScript project.

### Background

Appium v2 provides a CLI for managing extensions, which sidesteps the typical package management workflow of JavaScript projects. It does not require the user to know about `npm` or any other package manager besides the few commands `appium` provides. While this is helpful for many users of Appium--including those who are automating non-Node.js projects or otherwise do not care about the implementation--it becomes unnecessary complexity when applied to a local Node.js/JavaScript project.

In other words, if you typically use `npm` (or `yarn` or `pnpm` or whathaveyou) to manage your project's dependencies, then you will want to use the same system (or _not have to learn a bespoke system_) to install Appium extensions.

### Strategy

Appium v2, by default, will install extensions in `APPIUM_HOME`, which is typically `~/.appium`. Within this directory is a custom manifest (`extensions.yaml`). This is _essentially_ a cache of information from each extension's `package.json`, combined with some metadata about how it was installed. _Only when a user runs `appium` will the manifest be updated._

However, the target audience of this utility will already _have_ a manifest: `package.json`. Dependencies listed in this manifest will be installed into `node_modules` via `npm install`.

> Note: The above is true when using `npm`. Support for "plug-n-play" package managers is outside of the scope of this project.

It would be helpful to have the information from extensions' `package.json` stored in a cache (to avoid I/O overhead on every `appium` execution), but a project's `package.json` will: a) only contain a list of dependencies and versions thereof, and b) not differentiate between Appium extensions and other dependencies.

To that end, this utility will _detect_ the presence of Appium extensions in a `node_modules` folder and establish a cache of information equivalent to `extensions.yaml`. The cache will be created on the first execution of `appium`, and continually updated based on changes to the project's manifest or lockfile (`package-lock.json`). It will be stored in `./node_modules/.cache/appium/extensions.yaml` and should generally not be under version control.

> Note: In the other use-case, because we _know_ that the user wants to add or remove an extension via `appium driver install <driver>`, the cache should be updated at that time. When using another program like `npm` to manage extensions, we won't know whether or not an Appium extension was installed or removed. It is not feasible to ask users to update the cache via a `postinstall` script or manually, and there is no such script we could add to `appium`'s lifecycle scripts to run _after all packages have been installed_--which would be necessary for determining which of those packages are Appium extensions. Thus, the cache must be built and updated at runtime.

This utility is intended to be consumed _mainly_ as an API by `appium` itself, but a CLI is also provided for convenience and debugging purposes.
