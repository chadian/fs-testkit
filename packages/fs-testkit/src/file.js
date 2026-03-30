import { Dir } from "./dir.js";
import { buildPath } from "./utils/build-path.js";
import { extname, resolve } from "node:path";
import { isText } from "istextorbinary";
import { createPatch, diffLines } from "diff";
import { fileOidHash } from "./utils/git-oid.js";

/**
 * @typedef {import('./git.js').Git} Git
 * @typedef {import('./sandbox.js').Sandbox} Sandbox
 * @typedef {import('./sandbox-file-operations.js').SandboxFileOperations} SandboxFileOperations
 * @typedef {import('./sandbox-dir-operations.js').SandboxDirOperations} SandboxDirOperations
 */

export class File {
  #name;
  #parent;
  #sandbox;

  /**
   * The name of the file
   * @returns { string }
   */
  get name() {
    return this.#name;
  }

  /**
   * The parent `Dir` of the file
   * @returns { Dir }
   */
  get parent() {
    return this.#parent;
  }

  /**
   * The path of the file relative to the sandbox root
   * @returns { string }
   */
  get path() {
    return buildPath(this);
  }

  /**
   * The absolute path of the file
   * @returns { string }
   */
  get absolutePath() {
    return resolve(this.#sandbox.rootPath, this.path);
  }

  /**
   * The extension of the file
   * @returns { string }
   */
  get extension() {
    return extname(this.#name);
  }

  /**
   * @returns { Git }
   */
  get #git() {
    const { git } = /** @type {{ git: Git }} */ (
      /** @type {unknown} */ (this.#sandbox)
    );

    return git;
  }

  /**
   * @param {object} options
   * @param {string} options.name
   * @param {Sandbox} options.sandbox
   * @param {Dir} options.parent
   */
  constructor({ name, parent, sandbox }) {
    this.#name = name;
    this.#parent = parent;
    this.#sandbox = sandbox;
  }

  /**
   * Reads the contents of the file
   * @param {Parameters<SandboxFileOperations['read']>[1]} [options]
   * @returns {Promise<Buffer | string>}
   */
  read(options) {
    const file = this;
    return this.#sandbox.fileOps.read(file, options);
  }

  /**
   * @alias File.read
   * @param {Parameters<SandboxFileOperations['read']>[1]} [options]
   * @returns {Promise<Buffer | string>}
   */
  contents(options) {
    return this.read(options);
  }

  /**
   * Rename the name of the file
   * @param {string} newFilename
   * @returns {Promise<File>} Returns a `File` representing the renamed file
   */
  async rename(newFilename) {
    const file = this;
    const renamed = file.parent.file(newFilename);

    if (await renamed.exists()) {
      throw new Error(
        `The file "${file.name}" cannot be renamed to "${renamed.name}" because a file or directory already exists as "${renamed.name}"`,
      );
    }

    await this.#sandbox.fileOps.rename(file, newFilename);
    return renamed;
  }

  /**
   * Move the file to a new parent directory on the filesystem
   * @param {Dir} newParent
   * @returns {Promise<File>} Returns a `File` representing the moved file at its new path
   */
  async move(newParent) {
    const file = this;

    if (!(await file.exists())) {
      throw new Error(
        `The file "${file.name}" does not exist, so it cannot be moved`,
      );
    }

    if (!(await newParent.exists())) {
      throw new Error(
        `The file "${file.name}" cannot be moved under the directory "${newParent.name}" because "${newParent.name}" does not exist`,
      );
    }

    const moved = newParent.file(file.name);
    if (await moved.exists()) {
      throw new Error(
        `The file "${file.name}" cannot be moved under the directory "${newParent.name}" because there already exists a file or directory named "${file.name}" under "${newParent.name}"`,
      );
    }

    await this.#sandbox.fileOps.move(file, newParent);
    return moved;
  }

  /**
   * @param {Dir} destDir
   * @param {object} [options]
   * @param {boolean} [options.overwrite]
   * @param {string} [options.as]
   * @returns {Promise<File>} Returns a `File` representing the copied destination path
   */
  async copyTo(destDir, options) {
    options = {
      overwrite: false,
      ...options,
    };

    const srcFile = this;

    if (!(destDir instanceof Dir)) {
      throw new Error(
        `Expected first argument of File.copyTo to be a \`Dir\` instance`,
      );
    }

    if (!(await destDir.exists())) {
      throw new Error(
        `Directory "${destDir.name}" must exist before directory or files can be copied into it`,
      );
    }

    if (!(await srcFile.exists())) {
      throw new Error(
        `File "${srcFile.name}" must exist before it can be copied`,
      );
    }

    const destFile = await destDir.file(options?.as ?? srcFile.name);
    const alreadyExists = !options.overwrite && (await destFile.exists());

    if (alreadyExists) {
      throw new Error(
        `A file or directory already exists as "${srcFile.name}" at "${destDir.path || "{sandbox root}"}"`,
      );
    }

    await this.#sandbox.fileOps.cp(srcFile, destDir, {
      force: options.overwrite,
      as: options.as,
    });

    return destFile;
  }

  /**
   * Write contents to the file.
   * By default the existing contents will be overwritten, this can be changed by specifying `options.overwrite`.
   * The default `options.prettier` option will depend on the option passed to the sandbox, but can be changed by
   * specifying the `options.prettier` option when calling `write`. The contents are only passed to prettier when
   * it's a known extension prettier can manage.
   * @param {Parameters<SandboxFileOperations['write']>[1]} contents
   * @param {Parameters<SandboxFileOperations['write']>[2] & { prettier?: boolean; overwrite?: boolean }} [options]
   * @returns {Promise<this>}
   */
  async write(contents, options) {
    const defaults = {
      overwrite: true,
      prettier: this.#sandbox.options.prettier,
    };

    options =
      typeof options === "object" ? { ...defaults, ...options } : defaults;

    if (!options.overwrite && (await this.exists())) {
      throw new Error(
        `#write has { overwrite: false } but ${this.path} already exists`,
      );
    }

    const file = this;
    const parent = file.parent;
    if (!(await parent.exists())) {
      await parent.create();
    }

    if (options.prettier && typeof contents === "string" && this.extension) {
      /** @type {import("prettier")}  */
      let prettier;

      try {
        prettier = (await import("prettier")).default;
      } catch {
        const prettierOptionReason = this.#sandbox.options.prettier
          ? "the global prettier option was set"
          : "the File.create method was passed an option with prettier set to true";

        throw new Error(
          `Could not import prettier, is it installed? Attempted to use prettier because ${prettierOptionReason}.`,
        );
      }

      try {
        contents = await prettier.format(contents, { filepath: this.path });
      } catch (e) {
        if (
          e &&
          typeof e === "object" &&
          "cause" in e &&
          typeof e.cause === "object" &&
          e.cause &&
          "code" in e.cause &&
          e.cause.code == "BABEL_PARSER_SYNTAX_ERROR"
        ) {
          // swallow this case when the prettier attempt for a given extension fails
        } else {
          throw e;
        }
      }
    }

    await this.#sandbox.fileOps.write(file, contents, options);
    return this;
  }

  /**
   * @alias File.write
   * @param {Parameters<SandboxFileOperations['write']>[1]} contents
   * @param {Parameters<SandboxFileOperations['write']>[2] & { prettier?: boolean; overwrite?: boolean }} [options]
   * @returns {Promise<this>}
   */
  async create(contents, options) {
    await this.write(contents, options);
    return this;
  }

  /**
   * Check the access of the directory on the filesystem
   * @param {Parameters<SandboxFileOperations['access']>[1]} mode
   * @returns {Promise<this>}
   */
  async access(mode) {
    const file = this;
    await this.#sandbox.fileOps.access(file, mode);
    return this;
  }

  /**
   * Check the access of the directory on the filesystem
   * Not exactly the same as `exists` but should work in most cases
   * based on access(file, F_OK). See: https://github.com/nodejs/node/issues/39960
   * Implementation subject to change
   * @returns {Promise<boolean>}
   */
  async exists() {
    const file = this;
    return this.#sandbox.fileOps.exists(file);
  }

  /**
   * Delete the directory on the filesystem
   * @returns {Promise<this>}
   */
  async delete() {
    const file = this;
    await this.#sandbox.fileOps.rm(file);
    return this;
  }

  /**
   * Creates a unique hash for the current directory and its contents based on the filesystem.
   * Two files represented by the same hash have the same contents.
   * @param {string} [snapshot]
   * @returns {Promise<string | undefined>}
   */
  async hash(snapshot) {
    if (!snapshot) {
      return fileOidHash(this);
    }
    return this.#git.oid(snapshot, this.absolutePath);
  }

  /**
   * Return the size of the file on the filesystem, in bytes
   * @param {Parameters<SandboxFileOperations['stat']>[1]} [options]
   * @returns {Promise<number | bigint>}
   */
  async size(options) {
    const file = this;
    const stats = await this.#sandbox.fileOps.stat(file, options);
    return stats.size;
  }

  /**
   * @overload
   * @param {string} snapshotOne
   * @param {string} snapshotTwo
   * @param {'diff-object'} format
   * @returns {Promise<import("./types.js").FileDiff>}
   */
  /**
   * @overload
   * @param {string} snapshotOne
   * @param {string} snapshotTwo
   * @param {'patch-string'} format
   * @returns {Promise<string>}
   */
  /**
   * Return an array of text diffs for changes between two snapshots for the file on the filesystem.
   * The file must be text-based.
   * @param {string} snapshotOne
   * @param {string} snapshotTwo
   * @param {'patch-string' | 'diff-object'} format
   * @returns {Promise<string | import("./types.js").FileDiff>}
   */
  async diffText(snapshotOne, snapshotTwo, format) {
    const filepath = this.path;
    const fileOneBuffer = await this.#git.file(snapshotOne, filepath);
    const fileTwoBuffer = await this.#git.file(snapshotTwo, filepath);

    if (fileOneBuffer && !isText(filepath, fileOneBuffer)) {
      throw new Error(
        `Could not create diff of ${this.path}. File at ${snapshotOne} is not a text file`,
      );
    }

    if (fileTwoBuffer && !isText(filepath, fileTwoBuffer)) {
      throw new Error(
        `Could not create diff of ${this.path}. File at ${snapshotTwo} is not a text file`,
      );
    }

    if (!fileOneBuffer && !fileTwoBuffer) {
      throw new Error(
        `The file ${this.path} does not exist on either snapshot ${snapshotOne} or ${snapshotTwo}. At least one snapshot must contain the file to create a diff.`,
      );
    }

    const fileOneText = fileOneBuffer?.toString() ?? "";
    const fileTwoText = fileTwoBuffer?.toString() ?? "";

    if (format === "patch-string") {
      return createPatch(this.path, fileOneText, fileTwoText);
    }

    if (format === "diff-object") {
      const diffs = diffLines(fileOneText, fileTwoText);

      /**
       * @type {{value: string, type: 'add' | 'remove' | 'equal'}[]}
       */
      const mappedDiffs = diffs.map((diff) => {
        if (diff.added) {
          return {
            type: "add",
            value: diff.value,
          };
        }

        if (diff.removed) {
          return {
            type: "remove",
            value: diff.value,
          };
        }

        return {
          type: "equal",
          value: diff.value,
        };
      });

      return mappedDiffs;
    }

    throw new Error(`Format ${format} not supported`);
  }

  /**
   * Returns a diff for the file on the filesystem, treating the file as a blob
   * @param {string} snapshotOne
   * @param {string} snapshotTwo
   * @returns {Promise<import("./types.js").BlobDiff[] | null>}
   */
  async diffBlob(snapshotOne, snapshotTwo) {
    const { path } = this;
    const diffs = await this.#git.diffSnapshot(snapshotOne, snapshotTwo, {
      path,
    });
    const diff = diffs?.[0] ?? null;

    return /** @type {import("./types.js").BlobDiff[]} */ (diff);
  }
}
