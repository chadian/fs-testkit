/**
 * @typedef {import('./file.js').File} File
 * @typedef {import('./dir.js').Dir} Dir
 * @typedef {import('./git.js').Git} Git
 * @typedef {import('./sandbox.js').Sandbox} Sandbox
 * @typedef {import('node:fs/promises')} Fs
 */

/**
 * @internal
 */
export class SandboxFileOperations {
  #fs;

  /**
   * @param {object} options
   * @param {Sandbox['options']['fs']} options.fs
   */
  constructor({ fs }) {
    this.#fs = fs;
  }

  /**
   * @param {File} file
   * @param {Parameters<Fs['readFile']>["1"]} [options]
   * @returns {ReturnType<Fs['readFile']>}
   */
  async read(file, options) {
    return this.#fs.readFile(file.absolutePath, options);
  }

  /**
   * @param {File} file
   * @param {Parameters<Fs['writeFile']>["1"]} contents
   * @param {Parameters<Fs['writeFile']>["2"]} [options]
   * @returns {ReturnType<Fs['writeFile']>}
   */
  async write(file, contents, options) {
    return this.#fs.writeFile(file.absolutePath, contents, options);
  }

  /**
   * @param {File} file
   * @param {string} newFilename
   * @returns {ReturnType<Fs['rename']>}
   */
  async rename(file, newFilename) {
    const newFilenameAbsolutePath = file.parent.file(newFilename).absolutePath;
    return this.#fs.rename(file.absolutePath, newFilenameAbsolutePath);
  }

  /**
   * @param {File} file
   * @param {Dir} newParentDir
   * @returns {ReturnType<Fs['rename']>}
   */
  async move(file, newParentDir) {
    const newFilenameAbsolutePath = newParentDir.file(file.name).absolutePath;
    return this.#fs.rename(file.absolutePath, newFilenameAbsolutePath);
  }

  /**
   * @param {File} file
   * @param {Parameters<Fs['access']>["1"]} mode
   * @returns {ReturnType<Fs['access']>}
   */
  async access(file, mode) {
    return this.#fs.access(file.absolutePath, mode);
  }

  /**
   * @param {File} file
   * @returns {Promise<boolean>}
   */
  async exists(file) {
    return this.access(file, this.#fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);
  }

  /**
   * @param {File} file
   * @param {Parameters<Fs['rm']>["1"]} [options]
   * @returns {ReturnType<Fs['rm']>}
   */
  async rm(file, options) {
    return this.#fs.rm(file.absolutePath, options);
  }

  /**
   * @param {File} file
   * @param {Parameters<Fs['stat']>[1]} [options]
   * @returns {ReturnType<Fs['stat']>}
   */
  async stat(file, options) {
    return this.#fs.stat(file.absolutePath, options);
  }
}
