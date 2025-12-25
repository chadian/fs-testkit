import { Git } from "../git.js";
import { Sandbox } from "../sandbox.js";
import { CleanUpRegistry } from "../utils/cleanup.js";

/**
 * @typedef {import("sinon").SinonStub} SinonStub
 */

/**
 * Create a `Sandbox` instance with mocked parts of the setup so that after `setup`
 * nothing is actually created on the file system.
 *
 * Includes mocking:
 *    - Git.setup
 *    - Sandbox.root.create
 *    - Sandbox.getTempRootPath
 *    - Automatic attempts to clean up
 * @param {import("sinon").SinonSandbox} sinonSandbox
 * @param {Partial<import("../sandbox.js").InputSandboxOptions>} [sandboxOptions]
 * @returns {{
 *  sandbox: Sandbox,
 *  mockTempRootPath: string,
 *  sandboxRootCreateStub: SinonStub,
 *  gitSetupStub: SinonStub,
 *  cleanUpRegistryRegisterStub: SinonStub
 * }}
 */
export function createMockedSandbox(sinonSandbox, sandboxOptions) {
  const mockTempRootPath = "/mock-tmp/random-uuid";
  const sandbox = new Sandbox(sandboxOptions ?? {});

  sinonSandbox
    // eslint-disable-next-line jsdoc/reject-any-type
    .stub(/** @type {any} */ (sandbox), "getTempRootPath")
    .returns(mockTempRootPath);

  const sandboxRootCreateStub = sinonSandbox
    .stub(sandbox.root, "create")
    .resolves();

  // eslint-disable-next-line jsdoc/reject-any-type
  const gitSetupStub = /** @type { any } */ (
    "called" in Git.prototype.setup
      ? Git.prototype.setup
      : sinonSandbox.stub(Git.prototype, "setup")
  );

  // restore the stub so that it can be allowed to be re-stubbed,
  // this can happen because it's a global module reference and
  // `createMockedSandbox` can be called multiple times in different
  // `beforeEach` or individual test blocks, which attempt to
  // restub it. The last call should be the closest in scope for the
  // test being ran, so it should "win"
  if ("returns" in CleanUpRegistry.register) {
    /** @type { SinonStub } */ (CleanUpRegistry.register).restore();
  }

  const cleanUpRegistryRegisterStub = sinonSandbox.stub(
    CleanUpRegistry,
    "register",
  );

  return {
    sandbox,
    mockTempRootPath,
    sandboxRootCreateStub,
    gitSetupStub,
    cleanUpRegistryRegisterStub,
  };
}
