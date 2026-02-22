/**
 * @typedef {import('../sandbox.js').Sandbox} Sandbox
 */

process.once("beforeExit", async () => {
  await Promise.allSettled(
    CleanUpRegistry.beforeExitCleanUp.map((options) => cleanup(options)),
  );
});

export const CleanUpRegistry = {
  /**
   * @type {{ fs: import('fs/promises'), throws: boolean, path: string, logs: false }[]}
   */
  beforeExitCleanUp: [],
  finalizationRegistry: new FinalizationRegistry(cleanup),

  /**
   * @param {object} target
   * @param {object} cleanupOptions
   * @param {import('fs/promises')} cleanupOptions.fs
   * @param {boolean} cleanupOptions.throws
   * @param {string} cleanupOptions.path
   */
  register(target, cleanupOptions) {
    this.finalizationRegistry.register(target, {
      ...cleanupOptions,
      logs: false,
    });

    this.beforeExitCleanUp.push({ ...cleanupOptions, logs: false });
  },
};

/**
 * @param {object} options
 * @param {import('fs/promises')} options.fs
 * @param {boolean} options.throws
 * @param {string} options.path
 * @param {boolean} [options.logs]
 */
export async function cleanup({ fs, throws, path, logs = true }) {
  try {
    await fs.access(path);
    await fs.rm(path, { recursive: true });
  } catch (e) {
    if (logs) console.error(e);
    if (throws) throw e;
  }
}
