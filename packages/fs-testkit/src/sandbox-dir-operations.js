import { Dir } from "./dir.js";
import { File } from "./file.js";
import path from "path";

/**
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
   * @param {Dir} srcDir
   * @param {Dir} destDir
   * @param {import("node:fs").CopyOptions & { contentsOnly?: boolean; as?: string }} [options]
   * @returns {Promise<void>}
   */
  async cp(srcDir, destDir, options) {
    /** @type {string} */
    let src;

    /** @type {string} */
    let dest;

    if (options?.as && options?.contentsOnly) {
      throw new Error(
        "`options.as` and `options.contentOnly` cannot both be set. The `options.as` refers to naming the directory being copied where the `contentsOnly` refers to many files or directories of the directory being copied",
      );
    }

    if (options?.contentsOnly) {
      src = path.join(srcDir.absolutePath, path.sep);
      dest = destDir.absolutePath;
    } else {
      src = srcDir.absolutePath;
      dest = destDir.dir(options?.as ?? srcDir.name).absolutePath;
    }

    return this.#fs.cp(src, dest, options);
  }
}
