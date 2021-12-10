/**
 * This module contains stuff that patches an `extensions.yaml`.
 *
 * The patching does not operate on YAML data per se, but rather a JS object representation,
 * which is then serialized to YAML.
 *
 * Patching is handled via the [`rfc6902`](https://npm.im/rfc6902) library.
 */

import _ from 'lodash';
import jsonPatch from 'rfc6902';

/**
 * Only these operations are allowed.
 * @type {Readonly<Set<jsonPatch.Operation['op']>>}
 */
const ALLOWED_OPS = new Set(['add', 'replace']);

/**
 * Matches the`installType` property of an extension in an extension manifest within a {@link jsonPatch.Operation.path}.
 *
 * This property is only applicable when leveraging the `appium` executable to install extensions.
 */
const INSTALL_TYPE_REGEX = /^\/(drivers|plugins)\/.+?\/installType$/;

/**
 * Matches the`installType` property of an extension in an extension manifest within a {@link jsonPatch.Operation.path}.
 *
 * This property is only applicable when leveraging the `appium` executable to install extensions.
 */
const INSTALL_SPEC_REGEX = /^\/(drivers|plugins)\/.+?\/installSpec$/;

/**
 * These functions help inspect an array of patch objects (returned by {@link createPatch});
 * if any of them return `true`, it removes the patch from the array.
 * @type {Readonly<OperationRejector[]>}
 */
const rejectors = Object.freeze([
  /**
   * This may be present in some `extensions.yaml`
   */
  (op) => op.path === '/schemaRev',
  /**
   * `/<extType>/<extName>/installType` is present _only_ if the extension is installed by `appium`
   */
  (op) => INSTALL_TYPE_REGEX.test(op.path),
  /**
   * `/<extType>/<extName>/installSpec` is present _only_ if the extension is installed by `appium`
   */
  (op) => INSTALL_SPEC_REGEX.test(op.path),

  /**
   * This _may_ be present in some schemas. It shouldn't be, since the `$id` will be computed
   * at runtime.
   */
  (op) => op.path.endsWith('/$id'),

  /**
   * Only {@link ALLOWED_OPS} operations are necessary for our purposes; we just
   * want to add missing or fix existing fields.  Removing is dangerous,
   * copying/moving is not applicable (afaik)
   */
  ({op}) => !ALLOWED_OPS.has(op),
]);

/**
 * Function to apply all of the functions in {@link rejectors}.
 *
 * {@link _.unary} is used to ensure that the function is called with a single argument, because
 * each {@link OperationRejector} only accepts a single argument. This sort of thing can be the source of subtle bugs.
 * @type {OperationRejector}
 */
const rejectOperations = _.unary(_.overEvery(rejectors));

/**
 *
 * Computes differences between two {@link Manifest} objects and returns an array of
 * relevant JSON Patch operations.
 *
 * Note that "patch" is used in a _plural_ sense to refer to a collection of operations.
 *
 * See {@link OP_REJECTIONS} for definition of "relevant".
 * @param {Manifest} expectedManifest - Represents manifest as an `extensions.yaml` file
 * @param {Manifest} actualManifest - Represents manifest as reflected in installed modules
 * @returns {jsonPatch.Operation[]} Array of relevant JSON patch operations
 */
export function createPatch (expectedManifest, actualManifest) {
  return _.filter(
    jsonPatch.createPatch(expectedManifest, actualManifest),
    rejectOperations
  );
}

/**
 * Applies result of {@link createPatch} to a manifest.
 * @param {Manifest} data - Manifest data to patch; generally this is the  manifest as reflected in `extensions.yaml`.
 * @param {jsonPatch.Operation[]} patch
 * @returns {ReturnType<jsonPatch.applyPatch>}
 */
export function applyPatch (data, patch) {
  // it looks like `jsonPatch.applyPatch` can return an array of "errors" containing a `null` error,
  // which is weird, so let's pretend it doesn't happen by using `_.compact`.
  return _.compact(jsonPatch.applyPatch(data, patch));
}

/**
 * @typedef {import('./manifest.mjs').Manifest} Manifest
 */

/**
 * A rejection function for operations that we want to ignore; for use with e.g.,
 * {@link Array.prototype.filter}.
 *
 * A rejection function is the opposite of a filter function.
 * @callback OperationRejector
 * @param {jsonPatch.Operation} op - Operation to check
 * @returns {boolean} - `true` if it should be filtered out
 */
