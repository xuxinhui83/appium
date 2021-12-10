export * as extinfo from './extinfo.mjs';
export * as fix from './fix.mjs';
export * as sysinfo from './sysinfo.mjs';

/**
 * Utility type to declare a command module.
 *
 * I'm probably not doing this right.
 * @template {Record<string,import('yargs').Options>} Builder
 * @typedef {import('yargs').CommandModule<Builder,import('yargs').InferredOptionTypes<Builder>>} CmdModule
 */
