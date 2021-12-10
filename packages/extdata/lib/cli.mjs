#!/usr/bin/env node
/**
 * CLI executable; see `index.mjs` for a programmatic API.
 */

/* eslint-disable promise/no-native */
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { extinfo, fix, sysinfo } from './commands/index.mjs';
import { logger } from './log.mjs';

// XXX: we should be able to use top-level await, but can't figure out how to make TS believe it
(async () => {
  /**
   * Commands:
   * - `extinfo`: Prints information about installed extensions
   * - `fix`: Modifies manifest to reflect installed extensions
   * - `sysinfo`: Prints information about the Appium installation
   *
   * @todo Figure out why "global" options are not supported by the type declarations. Or rather, if they ever are, update this to define common-across-all-commands options here.
   */
  const parser = yargs(hideBin(process.argv))
    .env('APPIUM')
    .strict()
    // XXX: the yargs docs mention that `command()` can accept an array of
    // `CommandModule`s, but the type declarations don't reflect this.
    .command(fix)
    .command(extinfo)
    .command(sysinfo)
    .demandCommand()
    .help();

  await parser.parseAsync();
  logger.ok('Done');
})();
