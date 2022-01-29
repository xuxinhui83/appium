import {isPackageChanged} from 'package-changed';
import path from 'path';

const HASHFILE_RELATIVE_PATH = path.join(
  'node_modules',
  '.cache',
  'appium',
  'package.hash',
);

/**
 * Determines if extensions have changed.  If they have, we need to sync them
 * with the `extensions.yaml` manifest.
 * @param {string} appiumHome
 * @returns {Promise<boolean>} `true` if `package.json` `appiumHome` changed
 */
export async function packageDidChange (appiumHome) {
  try {
    const {isChanged, writeHash} = await isPackageChanged({
      cwd: appiumHome,
      hashFilename: path.join(appiumHome, HASHFILE_RELATIVE_PATH),
    });

    if (isChanged) {
      writeHash();
    }
    return isChanged;
  } catch {
    return true;
  }
}
