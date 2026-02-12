/**
 * @typedef {import('./dir.js').Dir} Dir
 * @typedef {import('./file.js').File} File
 * @typedef {import('./git.js').Git} Git
 * @typedef {import('./sandbox.js').Sandbox} Sandbox
 * @typedef {import('node:fs/promises')} Fs
 */

import assert from "node:assert";

/**
 * @internal
 */
export class SandboxDirOperations {
  #fs;

  /**
   * @param {object} options
   * @param {Sandbox['options']['fs']} options.fs
   */
  constructor({ fs }) {
    this.#fs = fs;
  }

  /**
   * Uses { recursive: true } by default, pass in { recursive: false } to disable
   * @param {Dir} dir
   * @param {Parameters<Fs['mkdir']>[1]} options
   * @returns {ReturnType<Fs['mkdir']>}
   */
  async mkdir(dir, options) {
    return this.#fs.mkdir(dir.absolutePath, options);
  }

  /**
   * @param {Dir} dir
   * @param {string} newDirname
   * @returns {ReturnType<Fs['rename']>}
   */
  async rename(dir, newDirname) {
    const newDirnameAbsolutePath = dir.parent?.dir(newDirname).absolutePath;
    assert(newDirnameAbsolutePath);
    return this.#fs.rename(dir.absolutePath, newDirnameAbsolutePath);
  }

  /**
   * @param {Dir} dir
   * @param {Dir} newParentDir
   * @returns {ReturnType<Fs['rename']>}
   */
  async move(dir, newParentDir) {
    const newDirnameAbsolutePath = newParentDir.dir(dir.name).absolutePath;
    return this.#fs.rename(dir.absolutePath, newDirnameAbsolutePath);
  }

  /**
   * @param {Dir} dir
   * @param {Parameters<Fs['access']>["1"]} mode
   * @returns {ReturnType<Fs['access']>}
   */
  async access(dir, mode) {
    return this.#fs.access(dir.absolutePath, mode);
  }

  /**
   * @param {Dir} dir
   * @returns {Promise<boolean>}
   */
  async exists(dir) {
    return this.access(dir, this.#fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);
  }

  /**
   * @param {Dir} dir
   * @param {Parameters<Fs['rm']>["1"]} [options]
   * @returns {Promise<void>}
   */
  async rm(dir, options) {
    return this.#fs.rm(dir.absolutePath, options);
  }

  /**
   * @param {Dir} dir
   * @param {import('node:fs').ObjectEncodingOptions & { recursive: true }} [options] Defaults to `encoding: "utf-8"`
   * @returns {Promise<import("node:fs").Dirent[]>}
   */
  async readdir(dir, options) {
    return this.#fs.readdir(dir.absolutePath, {
      encoding: "utf-8",
      ...options,
      withFileTypes: true,
    });
  }

  /**
   * @param {Dir} dir the destination directory being copied to
   * @param {File | Dir} fileOrDir
   * @param {import("node:fs").CopyOptions} [options]
   * @returns {Promise<void>}
   */
  async cp(dir, fileOrDir, options) {
    const src = fileOrDir.absolutePath;
    // For `fileOrDir`, the resulting path of using either `Dir.file` or `Dir.dir`
    // is the same for the purpose of the final `absolutePath` used for the
    // destination path
    const dest = dir.file(fileOrDir.name).absolutePath;
    return this.#fs.cp(src, dest, options);
  }
}
