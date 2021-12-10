/* eslint-disable no-console */
import {
  blueBright as blue,
  greenBright as green,
  redBright as red,
  yellowBright as yellow
} from 'colorette';
import _ from 'lodash';
import logSymbols from 'log-symbols';

/**
 * Singleton logger.
 * @type {AppiumExtDataConsole}
 */
export let logger;

/**
 * Decorates log messages with stuff (if they are strings)
 *
 * Mutates `data`. Should be called from Console methods
 *
 * @param {string} symbol - Text to prepend to message
 * @param {string} level - More text to prepend to message
 * @param {any[]} args - arguments from a Console method
 */
function decorate (symbol, level, args) {
  if (_.isString(_.first(args))) {
    args[0] = `${symbol} ${level}: ${_.first(args)}`;
  }
}

/**
 * A {@link Console} subclass which adds some prefixes to certain methods.
 */
class AppiumExtDataConsole extends console.Console {
  /**
   * Sets some defaults.
   * @private
   */
  constructor (opts = {}) {
    super({
      stdout: process.stdout,
      stderr: process.stderr,
      inspectOptions: {depth: null},
      groupIndentation: 4,
      ...opts,
    });
  }

  /**
   * Displays message in blue with `[INFO]` prefix & symbol.
   * @param {Parameters<Console['info']>} data
   */
  info (...data) {
    decorate(logSymbols.info, blue('[INFO]'), data);
    super.log(...data);
  }

  /**
   * Displays message in red with `[ERROR]` prefix & symbol.
   * @param {Parameters<Console['error']>} data
   */
  error (...data) {
    decorate(logSymbols.error, red('[ERROR]'), data);
    super.error(...data);
  }

  /**
   * Displays message in yellow with `[WARN]` prefix & symbol.
   * @param {Parameters<Console['warn']>} data
   */
  warn (...data) {
    decorate(logSymbols.warning, yellow('[WARN]'), data);
    super.warn(...data);
  }

  /**
   * Displays message in green with `[OK]` prefix & symbol.
   * @param {Parameters<Console['log']>} data
   */
  ok (...data) {
    decorate(logSymbols.success, green('[OK]'), data);
    super.log(...data);
  }

  /**
   * Creates a {@link AppiumExtDataConsole} singleton instance or returns the existing one.
   * @param {import('console').ConsoleConstructorOptions} [opts] - Options}
   * @returns {AppiumExtDataConsole}
   */
  static create (opts) {
    return logger ?? new AppiumExtDataConsole(opts);
  }
}

/**
 * Singleton logger.
 * @type {AppiumExtDataConsole}
 */
logger = AppiumExtDataConsole.create();
