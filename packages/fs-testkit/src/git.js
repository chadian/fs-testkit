import git from "isomorphic-git";
import fs from "fs/promises";
import { tmpdir } from "os";
import { parse, relative, join, resolve } from "node:path";
import {
  KEEP_FILE,
  addInternalGitKeepFiles,
  removeEmptyDirectoriesWithoutKeeps,
  removeInternalGitKeepFiles,
} from "./utils/git-keep.js";
import { CleanUpRegistry } from "./utils/cleanup.js";

export const AUTHOR_AND_COMMITER = {
  email: "",
  name: "fs-testkit/git",
  timestamp: Date.now(),
  timezoneOffset: 0,
};

/**
 * @internal
 */
export class Git {
  #fs;
  #dir;

  gitDir = "";

  /**
   * snapshot/tag name => git sha
   * @type {Map<string, string>}
   */
  #snapshots = new Map();

  /**
   *
   * @param {object} options
   * @param {typeof fs} options.fs
   * @param {string} options.dir
   */
  constructor({ fs, dir }) {
    this.#fs = fs;
    this.#dir = dir;
  }

  get #gitOptions() {
    // the library requires the option to be `gitdir` ** all lowercase **
    return { fs: this.#fs, gitdir: this.gitDir, dir: this.#dir };
  }

  async setup() {
    this.gitDir = await fs.mkdtemp(join(tmpdir(), `fs-testkit-git-`));
    CleanUpRegistry.register(this, {
      fs: this.#fs,
      throws: false,
      path: this.gitDir,
    });
    await git.init({ ...this.#gitOptions });
  }

  /**
   * @param {string} name
   */
  async createSnapshot(name) {
    const snapshots = this.#snapshots;
    if (snapshots.has(name)) {
      throw new Error(
        `Snapshot with name "${name}" has already been used. Use #deleteSnapshot first before re-using a snapshot`,
      );
    }

    await this.#addKeeps();
    await git.add({ ...this.#gitOptions, force: true, filepath: "." });

    const files = await git.listFiles({ ...this.#gitOptions });

    // Use `git.remove` by checking all files for removed status
    await Promise.all(
      files.map(async (file) => {
        const status = await git.status({
          ...this.#gitOptions,
          filepath: file,
        });

        if (status === "deleted" || status === "*deleted") {
          await git.remove({ ...this.#gitOptions, filepath: file });
          return file;
        }

        return null;
      }),
    );

    const sha = await git.commit({
      ...this.#gitOptions,
      message: name,
      author: AUTHOR_AND_COMMITER,
      committer: AUTHOR_AND_COMMITER,
    });

    await git.tag({ ...this.#gitOptions, object: sha, ref: name });
    this.#snapshots.set(name, sha);
    await this.#removeKeeps();
  }

  /**
   * @param {string} name
   */
  async deleteSnapshot(name) {
    const snapshots = this.#snapshots;
    if (!snapshots.has(name)) {
      throw new Error(`Snapshot with name "${name}" does not exist`);
    }

    await git.deleteTag({ ...this.#gitOptions, ref: name });
    snapshots.delete(name);
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  hasSnapshot(name) {
    return this.#snapshots.has(name);
  }

  /**
   * @param {string} name
   */
  async restoreSnapshot(name) {
    const snapshots = this.#snapshots;
    if (!snapshots.has(name)) {
      throw new Error(`Snapshot with name "${name}" does not exist`);
    }

    const sha = snapshots.get(name);
    /* node:coverage disable */
    if (!sha) {
      throw new Error(`Could not find snapshot named "${name}"`);
    }
    /* node:coverage enable */

    await this.#reset(sha);
  }

  /**
   * @param {string} start
   * @param {string} end
   * @param {object} [options]
   * @param {string} [options.path]
   * @param {boolean} [options.includeDirs]
   * @returns {Promise<import("./types.js").DirDiff[]>}
   */
  async diffSnapshot(start, end, options) {
    const path = options?.path ?? ".";
    const includeDirs = options?.includeDirs ?? false;

    const startSha = this.#snapshots.get(start);
    if (!startSha) {
      throw new Error(`Could not find start snapshot named with ${start}`);
    }

    const endSha = this.#snapshots.get(end);
    if (!endSha) {
      throw new Error(`Could not find end snapshot named with ${end}`);
    }

    return this.#walkDiff(startSha, endSha, { rootPath: path, includeDirs });
  }

  /**
   * @param {string} snapshot
   * @param {string} filepath
   * @returns {Promise<Buffer | undefined>}
   */
  async file(snapshot, filepath) {
    if (filepath.endsWith(KEEP_FILE)) {
      return;
    }

    if (!this.hasSnapshot(snapshot)) {
      throw new Error(`Snapshot ${snapshot} does not exist.`);
    }

    const commitOid = await git.resolveRef({
      ...this.#gitOptions,
      ref: snapshot,
    });

    try {
      const { blob: blobArray } = await git.readBlob({
        ...this.#gitOptions,
        oid: commitOid,
        filepath,
      });

      return Buffer.from(blobArray);
    } catch {
      return;
    }
  }

  /**
   *
   * @param {string} snapshot
   * @param {string} path
   * @returns {Promise<string | undefined>}
   */
  async oid(snapshot, path) {
    if (!this.hasSnapshot(snapshot)) {
      throw new Error(`Snapshot ${snapshot} does not exist.`);
    }

    if (path.endsWith(KEEP_FILE)) {
      return;
    }

    const { dir: parentPath, base } = parse(path);

    const commitOid = await git.resolveRef({
      ...this.#gitOptions,
      ref: snapshot,
    });

    const { commit } = await git.readCommit({
      ...this.#gitOptions,
      oid: commitOid,
    });

    const parentTree = await git.readTree({
      ...this.#gitOptions,
      oid: commit.tree,
      filepath: parentPath,
    });

    const treeOrBlobAtPath = parentTree.tree.find(
      (treeOrBlob) => treeOrBlob.path === base,
    );

    return treeOrBlobAtPath?.oid;
  }

  /**
   * @param {string} a
   * @param {string} b
   * @param {object} options
   * @param {string} options.rootPath
   * @param {boolean} options.includeDirs
   * @returns {Promise<import("./types.js").DirDiff[]>}
   */
  async #walkDiff(a, b, { includeDirs, rootPath }) {
    return git.walk({
      ...this.#gitOptions,
      trees: [git.TREE({ ref: a }), git.TREE({ ref: b })],
      map: async function (path, [A, B]) {
        const isOutsideOfRoot = relative(rootPath, path).startsWith("..");
        if (isOutsideOfRoot) {
          return;
        }

        // ignore root directory
        if (path === ".") {
          return;
        }

        // ignore keep files
        if (path.endsWith(KEEP_FILE)) {
          return;
        }

        if (!includeDirs) {
          if ((await A?.type()) === "tree" || (await B?.type()) === "tree") {
            return;
          }
        }

        if (A === null && B !== null) {
          return {
            path,
            type: "add",
          };
        }

        if (A !== null && B === null) {
          return {
            path,
            type: "remove",
          };
        }

        if (A === null) {
          throw new Error("Unexpected diff condition");
        }

        if (B === null) {
          throw new Error("Unexpected diff condition");
        }

        // generate ids
        const Aoid = await A.oid();
        const Boid = await B.oid();

        // determine modification type
        let type = "equal";
        if (Aoid !== Boid) {
          type = "modify";
        }
        if (Aoid === undefined) {
          type = "add";
        }
        if (Boid === undefined) {
          type = "remove";
        }
        if (Aoid === undefined && Boid === undefined) {
          throw new Error("Unexpected diff condition");
        }

        return {
          path,
          type: type,
        };
      },
    });
  }

  // #reset implementation pulled from:
  // https://github.com/isomorphic-git/isomorphic-git/issues/129#issuecomment-973756911
  /**
   * @param {string} sha
   */
  async #reset(sha) {
    await this.#removeEmptyDirectoriesWithoutKeeps();

    // return HEAD to snapshot at `sha`
    await git.checkout({
      ...this.#gitOptions,
      ref: sha,
      force: true,
    });
    await this.#removeKeeps();

    // Status Matrix Row Indexes
    const FILEPATH = 0;
    const HEAD = 1;
    const WORKDIR = 2;
    const STAGE = 3;

    // Status Matrix State
    const ABSCENT_IN_HEAD = 0;
    const IDENTICAL_TO_HEAD = 1;

    const allFiles = await git.statusMatrix({ ...this.#gitOptions });

    // Get all files which have been modified or staged - does not include new untracked files or deleted files
    const modifiedFiles = allFiles
      .filter((row) => {
        const absentFromHead = row[HEAD] === ABSCENT_IN_HEAD;
        const differentFromHead =
          row[WORKDIR] > IDENTICAL_TO_HEAD || row[STAGE] > IDENTICAL_TO_HEAD;
        return absentFromHead || differentFromHead;
      })
      .map((row) => row[FILEPATH]);

    // Delete modified/staged files
    await Promise.all(
      modifiedFiles.map((path) => {
        return this.#fs.rm(resolve(this.#dir, path));
      }),
    );
  }

  async #addKeeps() {
    await addInternalGitKeepFiles(this.#fs, this.#dir);
  }

  async #removeKeeps() {
    await removeInternalGitKeepFiles(this.#fs, this.#dir);
  }

  async #removeEmptyDirectoriesWithoutKeeps() {
    await removeEmptyDirectoriesWithoutKeeps(this.#fs, this.#dir);
  }
}
