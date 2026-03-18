import { File } from "./file.js";
import { buildPath } from "./utils/build-path.js";
import { isAbsolute, parse, resolve, sep, join, basename } from "node:path";
import { isScaffoldDir, scaffold } from "./utils/scaffold.js";
import { tree, treeString } from "./utils/tree.js";
import { contains } from "./utils/path.js";
import assert from "node:assert";
import { constants } from "node:fs/promises";

/**
 * @typedef {import('./git.js').Git} Git
 * @typedef {import('./sandbox.js').Sandbox} Sandbox
 * @typedef {import('./sandbox-file-operations.js').SandboxFileOperations} SandboxFileOperations
 * @typedef {import('./sandbox-dir-operations.js').SandboxDirOperations} SandboxDirOperations
 */

export class Dir {
  #name;
  #sandbox;
  #parent;

  /**
   * @param {object} options
   * @param {string} options.name
   * @param {import("./sandbox.js").Sandbox} options.sandbox
   * @param {Dir | null} options.parent
   */
  constructor({ name, sandbox, parent }) {
    this.#name = name;
    this.#sandbox = sandbox;
    this.#parent = parent;
  }

  /**
   * The directory's name
   * @returns {string}
   */
  get name() {
    return this.#name;
  }

  /**
   * The directory's parent
   * @returns {Dir | null}
   */
  get parent() {
    return this.#parent;
  }

  /**
   * The directory's relative path. Returns an empty string ("") if path is the sandbox root.
   * @returns {string}
   */
  get path() {
    return buildPath(this);
  }

  /**
   * The directory's absolute path
   * @returns {string}
   */
  get absolutePath() {
    return resolve(this.#sandbox.rootPath, this.path);
  }

  /**
   * @internal
   * @returns { Git }
   */
  get #git() {
    const { git } = /** @type {{ git: Git }} */ (
      /** @type {unknown} */ (this.#sandbox)
    );

    return git;
  }

  /**
   * Create a `File` pointing to the given name within the directory
   * @param {string} name
   * @returns {File}
   */
  file(name) {
    const parent = this;
    const sandbox = this.#sandbox;
    const file = new File({ name, sandbox, parent });
    return file;
  }

  /**
   * Create a `Dir` pointing to the given name within the directory
   * @param {string} name
   * @returns {Dir}
   */
  dir(name) {
    const parent = this;
    const sandbox = this.#sandbox;
    const dir = new Dir({ name, sandbox, parent });
    return dir;
  }

  /**
   * Create a `Dir` or `File` at a given path relative to the current directory.
   * The returned instance is inferred based on whether the relative path has an extension,
   * this can be forced by specifying the type argument.
   * @param {string} path
   * @param {'Dir' | 'File'} [type]
   * @returns {Dir | File}
   */
  at(path, type) {
    const { dir: dirString, base, ext } = parse(path);

    const dirs = dirString.split(sep);
    let dirSegment;
    /** @type {Dir | undefined} */
    let dir = this;

    while ((dirSegment = dirs.shift())) {
      dir = dir.dir(dirSegment);
    }

    if ((!type && ext) || type === "File") {
      return dir.file(base);
    }

    return dir.dir(base);
  }

  /**
   * Returns true if the `File` or `Dir` argument is contained by the directory, otherwise false.
   * This method does not check if anything exists on the filesystem. Use the `exists` method
   * on `File` or `Dir` instances to check if they exist on the filesystem.
   * @param {File | Dir} fileOrDir
   * @returns {boolean}
   */
  contains(fileOrDir) {
    return contains(this.absolutePath, fileOrDir.absolutePath);
  }

  /**
   * Creates the directory on the filesystem. By default, intermediate directories are
   * recursively created, this can be changed by providing a `options.recursive` argument
   * @param {Parameters<SandboxDirOperations['mkdir']>[1]} [options]
   * @returns {Promise<this>}
   */
  async create(options) {
    const dir = this;
    options = options ?? {};
    options = typeof options === "object" ? options : { mode: options };
    options = { recursive: true, ...options };
    await this.#sandbox.dirOps.mkdir(dir, options);

    return dir;
  }

  /**
   * Provides the contents of the directory as an array of `Dir` and `File` instances
   * Alias for {@link Dir.contents}
   * @param {Parameters<Dir["contents"]>[0]} options
   * @returns {Promise<(Dir | File)[]>}
   */
  async read(options) {
    return this.contents(options);
  }

  /**
   * Provides the contents of the directory as an array of `Dir` and `File` instances
   * @param {Parameters<SandboxDirOperations['readdir']>[1]} [options]
   * @returns {Promise<(Dir | File)[]>}
   */
  async contents(options) {
    const dir = this;
    const dirents = await this.#sandbox.dirOps.readdir(dir, options);

    return Promise.all(
      dirents.map(async (dirent) => {
        const existsAsDir = await this.at(dirent.name, "Dir").exists();
        if (existsAsDir) {
          return this.at(dirent.name, "Dir");
        }

        return this.at(dirent.name, "File");
      }),
    );
  }

  /**
   * Rename the name of the directory on the filesystem
   * @param {string} newDirname
   * @returns {Promise<Dir>}
   */
  async rename(newDirname) {
    const dir = this;
    const renamed = dir.parent?.dir(newDirname);
    assert(renamed);

    if (await renamed.exists()) {
      throw new Error(
        `The directory "${dir.name}" cannot be renamed to "${renamed.name}" because a file or directory already exists as "${renamed.name}"`,
      );
    }

    await this.#sandbox.dirOps.rename(dir, newDirname);
    return renamed;
  }

  /**
   * Move the directory to a new parent directory on the filesystem
   * @param {Dir} newParent
   * @returns {Promise<Dir>}
   */
  async move(newParent) {
    const dir = this;

    if (dir.contains(newParent)) {
      throw new Error(
        `Cannot move directory "${dir.name}" under "${newParent.name}" because "${dir.name}" contains "${newParent.name}"`,
      );
    }

    if (!(await dir.exists())) {
      throw new Error(
        `The directory "${dir.name}" does not exist, so it cannot be moved`,
      );
    }

    if (!(await newParent.exists())) {
      throw new Error(
        `The directory "${dir.name}" cannot be moved under the directory "${newParent.name}" because "${newParent.name}" does not exist`,
      );
    }

    const moved = newParent.dir(dir.name);
    if (await moved.exists()) {
      throw new Error(
        `The directory "${dir.name}" cannot be moved under the directory "${newParent.name}" because there already exists a file or directory named "${dir.name}" under "${newParent.name}"`,
      );
    }

    await this.#sandbox.dirOps.move(dir, newParent);
    return moved;
  }

  /**
   * Check the access of the directory on the filesystem, returned promise rejects if not accessible,
   * otherwise resolves
   * @param {Parameters<SandboxDirOperations['access']>[1]} [mode]
   * @returns {Promise<this>}
   */
  async access(mode) {
    const dir = this;
    await this.#sandbox.dirOps.access(dir, mode);
    return dir;
  }

  /**
   * Returns true if the directory exists on the filesystem, otherwise false,
   * based on fs.access(file, F_OK).
   * Implementation subject to change
   * @returns {Promise<boolean>}
   */
  async exists() {
    const dir = this;
    const result = await this.#sandbox.dirOps.exists(dir);
    return result;
  }

  /**
   * Delete the directory on the filesystem
   * @param {Parameters<SandboxDirOperations['rm']>[1]} [options]
   * @returns {Promise<this>}
   */
  async delete(options) {
    const dir = this;
    options = options ?? options;
    options = { recursive: true, force: true, ...options };
    await this.#sandbox.dirOps.rm(dir, options);
    return dir;
  }

  /**
   * Scaffold nested files and directories on the file system, within the current directory.
   * The file options can be specified for all files, for example:
   * dir.scaffold({ dir: { "readme.md": "# My Readme" }}, { overwrite: true, prettier: true })
   *
   * or file options can be specified per file, for example:
   * dir.scaffold({ dir: {
   *  "readme.md": ["# My Readme", { overwrite: true, prettier: true }]
   * }});
   *
   * By default `options.prettier` option will based on the option passed to the sandbox.
   * Only files with known extensions to prettier can be prettier.
   * @template {import("./types.js").ScaffoldDir} T
   * @template {import("./types.js").ScaffoldOptions} [Opts={}]
   * @param {T} scaffoldDir
   * @param {Opts} [options]
   * @returns {Promise<import("./types.js").ScaffoldResult<T, Opts>>}
   */
  async scaffold(scaffoldDir, options) {
    const dir = this;

    const resolvedOptions = /** @type {Required<Opts>} */ ({
      overwrite: false,
      includeDirInstances: false,
      prettier: this.#sandbox.options.prettier,
      ...options,
    });

    if (!isScaffoldDir(scaffoldDir)) {
      throw new Error("A type of `ScaffoldDir` must be passed in");
    }

    return scaffold(dir, scaffoldDir, resolvedOptions);
  }

  /**
   * Returns a tree string of the filesystem from the current directory
   * @param {object} [options]
   * @param {"filename" | "file-contents" | "hash"} [options.textFileMask]
   * @param {"filename" | "hash"} [options.blobFileMask]
   * @returns {Promise<string>}
   */
  async treeString(options) {
    const textFileMask = options?.textFileMask ?? "filename";
    const blobFileMask = options?.blobFileMask ?? "filename";

    const dir = this;
    const treeObject = await tree(
      this.#sandbox.options.fs,
      dir,
      textFileMask,
      blobFileMask,
    );

    return treeString(treeObject);
  }

  /**
   * Returns a object representing the nested tree structure of the directory from the filesystem
   * @param {object} [options]
   * @param {"filename" | "file-contents" | "hash"} [options.textFileMask]
   * @param {"filename" | "hash"} [options.blobFileMask]
   * @returns {Promise<import("./types.js").ObjectTree<string>>}
   */
  async tree(options) {
    const textFileMask = options?.textFileMask ?? "filename";
    const blobFileMask = options?.blobFileMask ?? "filename";

    const dir = this;
    const treeObject = await tree(
      this.#sandbox.options.fs,
      dir,
      textFileMask,
      blobFileMask,
    );

    return treeObject;
  }

  /**
   * Creates a unique hash for the current directory and its contents based on the filesystem.
   * Two directories represented by the same hash have the same contents.
   * @param {string} [snapshot]
   * @returns {Promise<string | undefined>}
   */
  async hash(snapshot) {
    if (!snapshot) {
      snapshot = await this.#sandbox.snapshot.create();
    }

    return this.#git.oid(snapshot, this.absolutePath);
  }

  /**
   * Creates an array of objects that describe the diff of the directory between two snapshots.
   * By default, the diff of directories are included, this can be changed by specifying `options.includeDirs`
   * @param {string} snapshotOne
   * @param {string} snapshotTwo
   * @param {object} [options]
   * @param {boolean} [options.includeDirs]
   * @returns {Promise<import("./types.js").DirDiff[]>}
   */
  async diff(snapshotOne, snapshotTwo, options) {
    const includeDirs = options?.includeDirs ?? true;
    const { path } = this;
    return this.#git.diffSnapshot(snapshotOne, snapshotTwo, {
      path,
      includeDirs,
    });
  }

  /**
   * Copies a file or directory into the current directory. See `contentsOnly` option for control over
   * copying the directory or its contents.
   * @param {Dir} destDir
   * @param {object} [options]
   * @param {string} [options.as] defaults to undefined - when copying the directory and not its contents
   * the directory copied can be renamed as specified by the `options.as`
   * @param {boolean} [options.overwrite] defaults to false
   * @param {boolean} [options.recursive] defaults to true
   * @param {boolean} [options.contentsOnly] defaults to true - Applies only when copying directories,
   * when true it copies the contents of the directory (equivalent to `cp src/ dist`),
   * when false it copies the directory and its contents (equivalent to `cp src dist`)
   * @returns {Promise<(Dir | File)[]>}
   */
  async copyTo(destDir, options) {
    options = {
      overwrite: false,
      recursive: true,
      contentsOnly: true,
      as: undefined,
      ...options,
    };

    const srcDir = this;

    if (!(destDir instanceof Dir)) {
      throw new Error(
        `Expected first argument of Dir.copyTo to be a \`Dir\` instance`,
      );
    }

    if (!(await destDir.exists())) {
      throw new Error(
        `Directory "${destDir.name}" must exist before directory or files can be copied into it`,
      );
    }

    if (!(await srcDir.exists())) {
      throw new Error(
        `Directory "${srcDir.name}" must exist before it can be copied`,
      );
    }

    if (options.contentsOnly && options.as) {
      throw new Error(
        `The \`options.contentsOnly\` cannot be true while also specifying the options.as\``,
      );
    }

    /** @type {(Dir | File)[]} */ let copiedContents;

    if (options.contentsOnly) {
      // Read source entries before copying so we track exactly what is copied.
      // It's possible that this list could be out of sync with the actual copied
      // contents if entries are changed between this read and the copy operation
      const dirents = await this.#sandbox.dirOps.readdir(srcDir);
      copiedContents = dirents.map((dirent) =>
        dirent.isDirectory()
          ? destDir.dir(dirent.name)
          : destDir.file(dirent.name),
      );
    } else {
      const destCpDir = destDir.dir(options?.as ?? srcDir.name);

      const alreadyExists = !options.overwrite && (await destCpDir.exists());
      if (alreadyExists) {
        throw new Error(
          `A file or directory already exists as "${options?.as ?? srcDir.name}" at "${destDir.path || "{sandbox root}"}"`,
        );
      }

      copiedContents = [destCpDir];
    }

    await this.#sandbox.dirOps.cp(srcDir, destDir, {
      errorOnExist: true,
      force: options.overwrite,
      recursive: options.recursive,
      contentsOnly: options.contentsOnly,
      as: options.as,
    });

    return copiedContents;
  }

  /**
   * Copies an file or directory at an absolute path from outside the sandbox into the current directory
   * @param {string} srcPath
   * @param {object} [options]
   * @param {string} [options.as] defaults to undefined - when copying the directory and not its contents
   * the directory copied can be renamed as specified by the `options.as`
   * @param {boolean} [options.overwrite] defaults to false
   * @param {boolean} [options.recursive] defaults to true
   * @param {boolean} [options.contentsOnly] defaults to true - Applies only when copying directories,
   * when true it copies the contents of the directory (equivalent to `cp src/ dist`),
   * when false it copies the directory and its contents (equivalent to `cp src dist`)
   * @returns {Promise<(Dir | File)[]>} Returns an array of `Dir` and/or `File` instances representing
   * the copied items. When copying a directory and its contents (`options.contentsOnly` is false)
   * the returned array contains a single `Dir` instance.
   */
  async copyFromExternal(srcPath, options) {
    options = {
      overwrite: false,
      recursive: true,
      contentsOnly: true,
      as: undefined,
      ...options,
    };

    const destDir = this;

    if (typeof srcPath !== "string") {
      throw new Error(
        `Expected the first argument of Dir.copyFromExternal to be a string, got "${typeof srcPath}"`,
      );
    }

    if (!isAbsolute(srcPath)) {
      srcPath = resolve(srcPath);
    }

    if (contains(this.#sandbox.root.absolutePath, srcPath)) {
      throw new Error(
        `The source path "${srcPath}" should be outside of the sandbox root directory ${this.#sandbox.root.absolutePath}. Use the \`Dir.copyTo\` method for copying files or directories within a sandbox`,
      );
    }

    if (!(await destDir.exists())) {
      throw new Error(
        `Directory "${destDir.name}" must exist before directory or files can be copied into it`,
      );
    }

    try {
      await this.#sandbox.options.fs.access(srcPath, constants.R_OK);
    } catch {
      throw new Error(
        `The source path must exist and be accessible: "${srcPath}"`,
      );
    }

    const srcIsDirectory = (
      await this.#sandbox.options.fs.stat(srcPath)
    ).isDirectory();

    if (!srcIsDirectory) {
      throw new Error(
        `The source directory to be copied "${srcPath}" must be a directory`,
      );
    }

    if (options.contentsOnly && options.as) {
      throw new Error(
        `The \`options.contentsOnly\` cannot be true while also specifying the options.as\``,
      );
    }

    /** @type {string} */ let srcCp;
    /** @type {Dir} */ let destCpDir;
    /** @type {(Dir | File)[]} */ let copiedContents;

    if (options?.contentsOnly) {
      srcCp = join(srcPath, sep);
      destCpDir = destDir;

      // Read source entries before copying so we track exactly what is copied.
      // It's possible that this list could be out of sync with the actual copied
      // contents are changed between this read and the copy operation
      const dirents = await this.#sandbox.options.fs.readdir(srcPath, {
        withFileTypes: true,
      });

      copiedContents = dirents.map((dirent) =>
        dirent.isDirectory()
          ? destCpDir.dir(dirent.name)
          : destCpDir.file(dirent.name),
      );
    } else {
      srcCp = srcPath;
      destCpDir = destDir.dir(options?.as ?? basename(srcPath));

      const alreadyExists = !options.overwrite && (await destCpDir.exists());
      if (alreadyExists) {
        throw new Error(
          `A file or directory already exists as "${options?.as ?? basename(srcPath)}" at "${destDir.path || "{sandbox root}"}"`,
        );
      }

      copiedContents = [destCpDir];
    }

    await this.#sandbox.options.fs.cp(srcCp, destCpDir.absolutePath, {
      errorOnExist: true,
      recursive: options.recursive,
      force: options.overwrite,
    });

    return copiedContents;
  }
}
