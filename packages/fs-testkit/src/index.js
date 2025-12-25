import { Sandbox } from "./sandbox.js";

/**
 * Create a new `Sanbdox` instance and run any required async setup
 * @param {import("./sandbox.js").InputSandboxOptions} [options]
 * @returns {Promise<Sandbox>}
 */
export async function createSandbox(options) {
  const sandbox = new Sandbox(options);
  await sandbox.setup();
  return sandbox;
}
