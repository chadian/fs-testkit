import { Git } from "../git.js";
import { Sandbox } from "../sandbox.js";
import { CleanUpRegistry } from "../utils/cleanup.js";

/**
 * @typedef {import("sinon").SinonStub} SinonStub
 */

// eslint-disable-next-line jsdoc/require-returns
/**
 * @param {import("sinon").SinonSandbox} sinonSandbox
 * @param {Sandbox} sandbox
 */
function mockSandboxFsOps(sinonSandbox, sandbox) {
  const dirOpsStubs = {
    exists: sinonSandbox.stub(sandbox.dirOps, "exists"),
    mkdir: sinonSandbox.stub(sandbox.dirOps, "mkdir"),
    rm: sinonSandbox.stub(sandbox.dirOps, "rm"),
    readdir: sinonSandbox.stub(sandbox.dirOps, "readdir"),
    access: sinonSandbox.stub(sandbox.dirOps, "access"),
    rename: sinonSandbox.stub(sandbox.dirOps, "rename"),
    move: sinonSandbox.stub(sandbox.dirOps, "move"),
    cp: sinonSandbox.stub(sandbox.dirOps, "cp"),
  };

  const fileOpsStubs = {
    exists: sinonSandbox.stub(sandbox.fileOps, "exists"),
    rm: sinonSandbox.stub(sandbox.fileOps, "rm"),
    write: sinonSandbox.stub(sandbox.fileOps, "write"),
    stat: sinonSandbox.stub(sandbox.fileOps, "stat"),
    read: sinonSandbox.stub(sandbox.fileOps, "read"),
    access: sinonSandbox.stub(sandbox.fileOps, "access"),
    rename: sinonSandbox.stub(sandbox.fileOps, "rename"),
    move: sinonSandbox.stub(sandbox.fileOps, "move"),
    cp: sinonSandbox.stub(sandbox.fileOps, "cp"),
  };

  return { dirOpsStubs, fileOpsStubs };
}

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
 *  dirOpsStubs: ReturnType<typeof mockSandboxFsOps>['dirOpsStubs']
 *  fileOpsStubs: ReturnType<typeof mockSandboxFsOps>['fileOpsStubs']
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
    ...mockSandboxFsOps(sinonSandbox, sandbox),
  };
}
