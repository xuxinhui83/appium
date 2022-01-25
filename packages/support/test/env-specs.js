// @ts-check

import {rewiremock} from './helpers';
import sinon from 'sinon';
import path from 'path';

const {expect} = chai;

describe('env', function () {
  /** @type {typeof import('../lib/env')} */
  let env;

  /** @type {import('sinon').SinonSandbox} */
  let sandbox;

  /**
   * @type { {'read-pkg': SinonStub<any[],Promise<any>>, 'resolve-from': SinonStub<any[],string>} }
   */
  let mocks;

  /** @type {string|undefined} */
  let envAppiumHome;

  /**
   * @type {import('type-fest').PackageJson}
   */
  let pkg;

  beforeEach(function () {
    sandbox = sinon.createSandbox();

    // ensure an APPIUM_HOME in the environment does not befoul our tests
    envAppiumHome = process.env.APPIUM_HOME;
    delete process.env.APPIUM_HOME;

    pkg = {};
    mocks = {
      'read-pkg': sandbox.stub().resolves(pkg),
      'resolve-from': sandbox.stub().returns('/some/path/to/package.json')
    };
    env = rewiremock.proxy(() => require('../lib/env'), mocks);
  });


  describe('getManifestPath()', function () {
    describe('when appium is located relative to cwd', function () {
      it('should return a path relative to cwd', async function () {
        expect(await env.getManifestPath()).to.equal(path.join(process.cwd(), env.LOCAL_RELATIVE_MANIFEST_PATH));
      });
    });

    describe('when appium is not located relative to cwd', function () {
      beforeEach(function () {
        mocks['resolve-from'].throws();
      });

      it('should return a path relative to the default APPIUM_HOME', async function () {
        expect(await env.getManifestPath()).to.equal(path.join(process.cwd(), env.MANIFEST_BASENAME));
      });
    });
  });

  describe('resolveAppiumHome()', function () {
    describe('when param is not absolute', function () {
      it('should reject', async function () {
        await expect(env.resolveAppiumHome('foo')).to.be.rejectedWith(TypeError, /must be absolute/);
      });
    });

    describe('when APPIUM_HOME is set in env', function () {
      beforeEach(function () {
        process.env.APPIUM_HOME = '/some/path/to/appium';
      });

      it('should resolve APPIUM_HOME from env', async function () {
        await expect(env.resolveAppiumHome()).to.eventually.equal(process.env.APPIUM_HOME);
      });
    });

    describe('when APPIUM_HOME is not set in env', function () {
      describe('when Appium is installed locally', function () {
        beforeEach(function () {
          mocks['resolve-from'].returns('/some/path/to/appium/package.json');
        });
        it('should resolve with the identity', async function () {
          await expect(env.resolveAppiumHome('/somewhere')).to.eventually.equal('/somewhere');
        });

        describe('when no parameter provided', function () {
          it('should resolve with cwd', async function () {
            await expect(env.resolveAppiumHome()).to.eventually.equal(process.cwd());
          });
        });
      });

      describe('when Appium is not installed locally', function () {
        beforeEach(function () {
          mocks['resolve-from'].throws();
        });

        it('should resolve with DEFAULT_APPIUM_HOME', async function () {
          await expect(env.resolveAppiumHome('/somewhere')).to.eventually.equal(env.DEFAULT_APPIUM_HOME);
        });
      });

      describe('when package.json cannot be read (for whatever reason)', function () {
        beforeEach(function () {
          mocks['read-pkg'].rejects(new Error('on the fritz'));
        });

        it('should resolve with DEFAULT_APPIUM_HOME', async function () {
          await expect(env.resolveAppiumHome('/somewhere')).to.eventually.equal(env.DEFAULT_APPIUM_HOME);
        });
      });
    });
  });

  afterEach(function () {
    sandbox.restore();
    process.env.APPIUM_HOME = envAppiumHome;
  });
});

/**
 * @template P,R
 * @typedef {import('sinon').SinonStub<P,R>} SinonStub<P,R>
 */
