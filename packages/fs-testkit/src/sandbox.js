import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { Dir } from "./dir.js";
import { SandboxDirOperations } from "./sandbox-dir-operations.js";
import { SandboxFileOperations } from "./sandbox-file-operations.js";
import { Git } from "./git.js";
import { cleanup, CleanUpRegistry } from "./utils/cleanup.js";
import { removeUndefinedValues } from "./utils/object.js";
import { Snapshot } from "./snapshot.js";
import assert from "node:assert";

// The following START/END posts are so the fs import can be replaced
// with memfs when running smoke tests
// START IMPORT FOR FS
import * as fs from "node:fs/promises";
// END IMPORT FOR FS

/**
 * @typedef {import('./file.js').File} File
 * @typedef {{
 *   fs?: typeof fs,
 *   prettier?: boolean,
 *   autoCleanUp?: boolean,
 *   root?: { path?: string, allowExisting?: boolean, allowDestroyRoot?: boolean }
 * }} InputSandboxOptions
 *
 * After defaults have been applied and `setup` has been called
 * @typedef {{
 *   fs: typeof fs,
 *   prettier: boolean,
 *   autoCleanUp?: boolean,
 *   root: { path: string, allowExisting?: boolean, allowDestroyRoot?: boolean }
 * }} SettledSandboxOptions
 */

export class Sandbox {
  /**
   * @internal
   * @type {SandboxFileOperations}
   */
  fileOps;

  /**
   * @internal
   * @type {SandboxDirOperations}
   */
  dirOps;

  /**
   * @type {SettledSandboxOptions}
   */
  #options;

  /**
   * @type {Dir}
   */
  #root;

  /** @type {string | undefined} */
  #rootPath;

  /**
   * @private
   * @type {Git | undefined}
   */
  _git;

  /**
   * @internal
   * @type {Git}
   */
  get git() {
    assert(this._git, `Ensure async #setup is called`);
    return this._git;
  }

  /**
   * @private
   * @type {Snapshot | undefined}
   */
  _snapshot;

  /** @type {Snapshot} */
  get snapshot() {
    assert(this._snapshot, `Ensure async #setup is called`);
    return this._snapshot;
  }

  /**
   * @param {Partial<InputSandboxOptions>} [options]
   */
  constructor(options = {}) {
    const defaults = {
      fs,
      prettier: false,
      root: {
        // set after calling `setup`
        path: "",
        allowExisting: false,
      },
    };

    this.#options = {
      ...defaults,
      ...removeUndefinedValues(options),

      root: {
        ...defaults.root,
        ...removeUndefinedValues(options.root ?? {}),
      },
    };

    this.fileOps = new SandboxFileOperations({ fs });
    this.dirOps = new SandboxDirOperations({ fs });
    this.#root = new Dir({ name: "", parent: null, sandbox: this });
  }

  /**
   * @private
   * @returns {string}
   */
  getTempRootPath() {
    const rootDirName = randomUUID();
    const tempRootPath = resolve(tmpdir(), rootDirName);
    return tempRootPath;
  }

  /**
   * It is generally preferred to use `createSandbox` which will create an instance and handle async setup.
   * Only call this function if creating an instance manually using the `Sandbox` constructor
   * @returns {Promise<void>}
   */
  async setup() {
    const options = this.#options;
    let rootPath;
    let isTmpDirRootPath = false;
    let rootDirAlreadyExisted;

    // determine the root path to use
    if (options.root.path) {
      rootPath = options.root.path;
    } else {
      rootPath = this.getTempRootPath();
      isTmpDirRootPath = true;
    }

    // check if the root path already exists
    try {
      await this.#options.fs.access(rootPath);
      rootDirAlreadyExisted = true;
    } catch {
      rootDirAlreadyExisted = false;
    }

    // prevent using a root path that exists without it specifically being opted into
    if (rootDirAlreadyExisted && !options?.root.allowExisting) {
      throw new Error(
        `Sandbox can't setup root "${rootPath}" without the passing a value of \`true\` for option root.allowExisting`,
      );
    }

    this.#rootPath = rootPath;
    if (!rootDirAlreadyExisted) {
      await this.#root.create();
    }

    // enable `options.autoCleanUp` for the special case:
    // * the option is not already set up
    // * the root directory did not already exist
    // * the directory is in the tmp dir
    if (
      options.autoCleanUp === undefined &&
      !rootDirAlreadyExisted &&
      isTmpDirRootPath
    ) {
      options.autoCleanUp = true;
    }

    // enable `options.allowDestroyRoot` for the special case:
    // * the option is not already set up
    // * the root directory did not already exist
    // * the directory is in the tmp dir
    if (
      options.root.allowDestroyRoot === undefined &&
      !rootDirAlreadyExisted &&
      isTmpDirRootPath
    ) {
      options.root.allowDestroyRoot = true;
    }

    if (
      options.autoCleanUp === true &&
      rootDirAlreadyExisted &&
      options.root.allowDestroyRoot !== false
    ) {
      throw new Error(
        `Refusing to setup \`options.autoCleanUp\`, option was passed in as true, but root path already existed for path:${rootPath}.\nEither set \`options.root.allowDestroyRoot\` to true to allow it to be cleaned up, set autoCleanUp to false, use a different root, or delete the root directory so it can be created.`,
      );
    }

    if (options.autoCleanUp) {
      CleanUpRegistry.register(this, {
        fs: options.fs,
        throws: false,
        path: this.rootPath,
      });
    }

    const git = new Git({ fs, dir: rootPath });
    this._git = git;
    await this.git.setup();
    this._snapshot = new Snapshot({ git });
  }

  /**
   * The path to the root directory of the sandbox
   * @returns { string }
   */
  get rootPath() {
    assert(this.#rootPath, `Ensure async #setup is called`);
    return this.#rootPath;
  }

  /**
   * The `Dir` representing the root directory of the sandbox
   * @returns { Dir }
   */
  get root() {
    return this.#root;
  }

  /**
   * Read-only options used by the `Sandbox` instance. Can only be checked after `setup` has been called and all options have settled
   * @returns {SettledSandboxOptions}
   */
  get options() {
    const setupCalled = Boolean(this._snapshot);
    if (!setupCalled) {
      throw new Error(
        `Ensure \`setup\` has been called before checking options. Some options are only settled after \`setup\` has been called.`,
      );
    }

    const options = { ...this.#options };
    // @ts-ignore
    delete options.fs;
    return Object.freeze({ ...structuredClone(options), fs: this.#options.fs });
  }

  /**
   * Create a `File` instance with the sandbox root as the parent
   * @param {string} name
   * @returns {File}
   */
  file(name) {
    return this.#root.file(name);
  }

  /**
   * Create a `Dir` instance with the sandbox root as the parent
   * @param {string} name
   * @returns {Dir}
   */
  dir(name) {
    return this.#root.dir(name);
  }

  /**
   * @override
   * @param {string} path
   * @param {'Dir'} type
   * @returns {Dir}
   */
  /**
   * @override
   * @param {string} path
   * @param {'File'} type
   * @returns {File}
   */
  /**
   * Create a `Dir` or `File` at a given path relative to sandbox root.
   * The returned instance is inferred based on whether the relative path has an extension,
   * this can be forced by specifying the type argument.
   * @param {string} path
   * @param {'Dir' | 'File'} [type]
   * @returns {Dir | File}
   */
  at(path, type) {
    return this.#root.at(path, type);
  }

  /**
   * Scaffold nested files and directories on the file system, from the sandbox root
   * @param {import("./types.js").ScaffoldDir} scaffoldDir
   * @returns {ReturnType<Dir['scaffold']>}
   */
  async scaffold(scaffoldDir) {
    return this.#root.scaffold(scaffoldDir);
  }

  /**
   * @param {Parameters<Dir['copyFromExternal']>[0]} srcAbsolutePath
   * @param {Parameters<Dir['copyFromExternal']>[1]} options
   * @returns {ReturnType<Dir['copyFromExternal']>}
   */
  async copyFromExternal(srcAbsolutePath, options) {
    return this.#root.copyFromExternal(srcAbsolutePath, options);
  }

  /**
   * Delete the sandbox root and its contents
   * @returns {Promise<void>}
   */
  async destroy() {
    if (this.options.root.allowDestroyRoot !== true) {
      throw new Error(
        `Refusing to destroy since \`options.root.allowDestroyRoot\` is not true. Pass in a true value to the \`Sandbox\` options`,
      );
    }

    return cleanup({ fs: this.options.fs, throws: true, path: this.rootPath });
  }
}
