/**
 * @internal
 * @typedef {import('./git.js').Git} Git
 */

import { randomUUID } from "crypto";

export class Snapshot {
  #git;

  /**
   * @internal
   * @param {object} options
   * @param {Git} options.git
   */
  constructor({ git }) {
    this.#git = git;
  }

  /**
   * Create a snapshot of the file system with the given name
   * @param {string} [name]
   * @returns {Promise<string>}
   */
  async create(name) {
    if (!name) {
      name = randomUUID();
    }

    await this.#git.createSnapshot(name);
    return name;
  }

  /**
   * Restore the filesystem at a given snapshot
   * @param {string} name
   * @returns {ReturnType<Git['restoreSnapshot']>}
   */
  async restore(name) {
    return this.#git.restoreSnapshot(name);
  }

  /**
   * Delete an existing snapshot
   * @param {string} name
   * @returns {Promise<void>}
   */
  async delete(name) {
    return this.#git.deleteSnapshot(name);
  }

  /**
   * Get an array of differences between two snapshots
   * @param {string} from
   * @param {string} to
   * @returns {ReturnType<Git['diffSnapshot']>}
   */
  async diff(from, to) {
    return this.#git.diffSnapshot(from, to);
  }
}
