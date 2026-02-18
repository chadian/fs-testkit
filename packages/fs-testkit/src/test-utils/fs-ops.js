import sinon from "sinon";

/**
 * @typedef {import('../sandbox.js').Sandbox} Sandbox
 */

// eslint-disable-next-line jsdoc/require-returns
/**
 * @param {Sandbox} sandbox
 */
export function mockSandboxFsOps(sandbox) {
  const dirOpsStubs = {
    exists: sinon.stub(sandbox.dirOps, "exists"),
    mkdir: sinon.stub(sandbox.dirOps, "mkdir"),
    rm: sinon.stub(sandbox.dirOps, "rm"),
    readdir: sinon.stub(sandbox.dirOps, "readdir"),
    access: sinon.stub(sandbox.dirOps, "access"),
    rename: sinon.stub(sandbox.dirOps, "rename"),
    move: sinon.stub(sandbox.dirOps, "move"),
    cp: sinon.stub(sandbox.dirOps, "cp"),
  };

  const fileOpsStubs = {
    exists: sinon.stub(sandbox.fileOps, "exists"),
    rm: sinon.stub(sandbox.fileOps, "rm"),
    write: sinon.stub(sandbox.fileOps, "write"),
    stat: sinon.stub(sandbox.fileOps, "stat"),
    read: sinon.stub(sandbox.fileOps, "read"),
    access: sinon.stub(sandbox.fileOps, "access"),
    rename: sinon.stub(sandbox.fileOps, "rename"),
    move: sinon.stub(sandbox.fileOps, "move"),
    cp: sinon.stub(sandbox.fileOps, "cp"),
  };

  return { dirOpsStubs, fileOpsStubs };
}
