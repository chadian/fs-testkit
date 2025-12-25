import test, { beforeEach, describe } from "node:test";
import fs from "fs/promises";
import { AUTHOR_AND_COMMITER, Git } from "./git.js";
import { createSandbox } from "./index.js";
import assert from "node:assert";
import { KEEP_FILE } from "./utils/git-keep.js";
import isoGit, { resolveRef } from "isomorphic-git";
import { fileOidHash } from "./utils/git-oid.js";

/**
 * @typedef {import('./sandbox.js').Sandbox} Sandbox
 */

describe("Git", () => {
  /** @type { string } */
  let dir;

  /** @type { Sandbox } */
  let sandbox;

  beforeEach(async () => {
    // use a real sandbox to more easily setup test files and directories
    sandbox = await createSandbox();
    dir = sandbox.root.absolutePath;
  });

  describe("#oid", () => {
    test("#oid", async () => {
      const git = new Git({ fs, dir });
      await git.setup();
      const helloFile = sandbox.dir("hello").file("hello");
      await helloFile.create(`hello world`);
      const expectedHash = await fileOidHash(helloFile);
      await git.createSnapshot("hello-snapshot");
      const hash = await git.oid("hello-snapshot", helloFile.path);
      assert.strictEqual(hash, expectedHash);
    });

    test("it rejects if the snapshot argument does not exist", async () => {
      const git = new Git({ fs, dir });
      await git.setup();
      assert.rejects(git.oid("not-a-real-snapshot", "hello-world.md"));
    });

    test("it works on directories", async function () {
      const git = new Git({ fs, dir });
      await git.setup();
      await sandbox.dir("hello-world").create();
      await git.createSnapshot("snapshot");
      const oid = await git.oid("snapshot", "hello-world");
      assert.strictEqual(oid, "3a74c19dcb2147d8f879625498e9ac49e3dcd452");
    });

    test("it works on files", async function () {
      const git = new Git({ fs, dir });
      await git.setup();
      await sandbox.dir("hello-world").file("hello.txt").create(``);
      await git.createSnapshot("snapshot");
      const oid = await git.oid("snapshot", "hello-world/hello.txt");
      assert.strictEqual(oid, "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
    });

    test("it returns undefined for a git keep file", async () => {
      const git = new Git({ fs, dir });
      await git.setup();
      await sandbox.dir("hello-world").create();
      await git.createSnapshot("snapshot");
      const oid = await git.oid("snapshot", `hello-world/${KEEP_FILE}`);
      assert.strictEqual(oid, undefined);
    });
  });

  describe("#createSnapshot", () => {
    test("creates a snapshot", async () => {
      const git = new Git({ fs, dir });
      await git.setup();

      await sandbox.dir("hello-world-dir").create();
      await sandbox.file("hello-world-file.txt").create(``);

      await git.createSnapshot("hello-world-tag");

      const tags = await isoGit.listTags({ fs, dir, gitdir: git.gitDir });
      assert.deepEqual(tags, ["hello-world-tag"]);

      const ref = await resolveRef({
        fs,
        gitdir: git.gitDir,
        dir,
        ref: "hello-world-tag",
      });

      const commit = await isoGit.readCommit({
        fs,
        dir,
        gitdir: git.gitDir,
        oid: ref,
      });

      assert.deepEqual(commit.commit.author, AUTHOR_AND_COMMITER);
      assert.deepEqual(commit.commit.committer, AUTHOR_AND_COMMITER);

      const files = await isoGit.listFiles({
        fs,
        dir,
        gitdir: git.gitDir,
        ref,
      });

      assert.deepEqual(files, [
        "hello-world-dir/.fs-testkit.gitkeep",
        "hello-world-file.txt",
      ]);
    });

    test("rejects if the snapshot already exists", async () => {
      const git = new Git({ fs, dir });
      await git.setup();
      await git.createSnapshot("hello-world");
      assert.rejects(
        git.createSnapshot("hello-world"),
        /Snapshot with name "hello-world" has already been used. Use #deleteSnapshot first before re-using a snapshot/
      );
    });
  });

  describe("#diffSnapshot", () => {
    describe("for files", () => {
      test("it can diff on type 'add'", async () => {
        const git = new Git({ fs, dir });
        await git.setup();

        await git.createSnapshot("first-snapshot");

        const fileA = sandbox.file("fileA.txt");
        await fileA.create(`A change to file A`);
        await git.createSnapshot("second-snapshot");

        const diffs = await git.diffSnapshot(
          "first-snapshot",
          "second-snapshot"
        );

        assert.deepEqual(diffs, [{ path: "fileA.txt", type: "add" }]);
      });

      test("it can diff on type 'modify'", async () => {
        const git = new Git({ fs, dir });
        await git.setup();

        const fileA = sandbox.file("fileA.txt");
        await fileA.create(`fileA`);
        await git.createSnapshot("first-snapshot");

        await fileA.create(`A change to file A`);
        await git.createSnapshot("second-snapshot");

        const diffs = await git.diffSnapshot(
          "first-snapshot",
          "second-snapshot"
        );
        assert.deepEqual(diffs, [{ path: "fileA.txt", type: "modify" }]);
      });

      test("it can diff on type 'remove'", async () => {
        const git = new Git({ fs, dir });
        await git.setup();

        const fileA = sandbox.file("fileA.txt");
        await fileA.create(`fileA`);
        await git.createSnapshot("first-snapshot");

        await fileA.delete();
        await git.createSnapshot("second-snapshot");

        const diffs = await git.diffSnapshot(
          "first-snapshot",
          "second-snapshot"
        );
        assert.deepEqual(diffs, [{ path: "fileA.txt", type: "remove" }]);
      });

      test("it can diff on type 'equal'", async () => {
        const git = new Git({ fs, dir });
        await git.setup();

        const fileA = sandbox.file("fileA.txt");
        await fileA.create(`fileA`);
        await git.createSnapshot("first-snapshot");
        await git.createSnapshot("second-snapshot");

        const diffs = await git.diffSnapshot(
          "first-snapshot",
          "second-snapshot"
        );
        assert.deepEqual(diffs, [{ path: "fileA.txt", type: "equal" }]);
      });
    });

    describe("for directories", () => {
      test("it can diff on type 'add'", async () => {
        const git = new Git({ fs, dir });
        await git.setup();

        await git.createSnapshot("first-snapshot");

        await sandbox.dir("hello-world-dir").create();
        await git.createSnapshot("second-snapshot");

        const diffs = await git.diffSnapshot(
          "first-snapshot",
          "second-snapshot",
          { includeDirs: true }
        );

        assert.deepEqual(diffs, [
          {
            path: "hello-world-dir",
            type: "add",
          },
        ]);
      });

      test("it can diff on type 'modify' (when a file is added within an empty directory)", async () => {
        const git = new Git({ fs, dir });
        await git.setup();

        await sandbox.dir("hello-world-dir").create();
        await git.createSnapshot("first-snapshot");

        await sandbox
          .dir("hello-world-dir")
          .file("hello-world-file.md")
          .create(``);
        await git.createSnapshot("second-snapshot");

        const diffs = await git.diffSnapshot(
          "first-snapshot",
          "second-snapshot",
          { includeDirs: true }
        );

        assert.deepEqual(diffs, [
          {
            path: "hello-world-dir",
            type: "modify",
          },
          {
            path: "hello-world-dir/hello-world-file.md",
            type: "add",
          },
        ]);
      });

      test("it can diff on type 'modify' (when an existing file is changed within a directory)", async () => {
        const git = new Git({ fs, dir });
        await git.setup();

        await sandbox.dir("hello-world-dir").create();
        await sandbox
          .dir("hello-world-dir")
          .file("hello-world-file.md")
          .create(``);
        await git.createSnapshot("first-snapshot");
        await sandbox
          .dir("hello-world-dir")
          .file("hello-world-file.md")
          .create(`contents changed!`);
        await git.createSnapshot("second-snapshot");

        const diffs = await git.diffSnapshot(
          "first-snapshot",
          "second-snapshot",
          { includeDirs: true }
        );

        assert.deepEqual(diffs, [
          {
            path: "hello-world-dir",
            type: "modify",
          },
          {
            path: "hello-world-dir/hello-world-file.md",
            type: "modify",
          },
        ]);
      });

      test("it can diff on type 'equal'", async () => {
        const git = new Git({ fs, dir });
        await git.setup();

        await sandbox.dir("hello-world-dir").create();

        await git.createSnapshot("first-snapshot");
        await git.createSnapshot("second-snapshot");

        const diffs = await git.diffSnapshot(
          "first-snapshot",
          "second-snapshot",
          { includeDirs: true }
        );

        assert.deepEqual(diffs, [
          {
            path: "hello-world-dir",
            type: "equal",
          },
        ]);
      });

      test("it can diff on type 'remove'", async () => {
        const git = new Git({ fs, dir });
        await git.setup();

        await sandbox.dir("hello-world-dir").create();
        await git.createSnapshot("first-snapshot");

        await sandbox.dir("hello-world-dir").delete();
        await git.createSnapshot("second-snapshot");

        const diffs = await git.diffSnapshot(
          "first-snapshot",
          "second-snapshot",
          { includeDirs: true }
        );

        assert.deepEqual(diffs, [
          {
            path: "hello-world-dir",
            type: "remove",
          },
        ]);
      });
    });

    test("it supports diffs recursively", async () => {
      const git = new Git({ fs, dir });
      await git.setup();

      const fileInRoot = sandbox.file("file-in-root.txt");
      const fileInDirectory = sandbox
        .dir("directory")
        .file("file-in-directory.txt");

      await fileInRoot.create("hello world");
      await fileInDirectory.create("hello world");

      await git.createSnapshot("first-snapshot");

      await fileInRoot.create("changed file-in-root.txt");
      await git.createSnapshot("second-snapshot");

      const diffs = await git.diffSnapshot("first-snapshot", "second-snapshot");

      assert.deepEqual(diffs, [
        { path: "directory/file-in-directory.txt", type: "equal" },
        { path: "file-in-root.txt", type: "modify" },
      ]);
    });

    test("it supports diffs rooted by specified directories", async () => {
      const git = new Git({ fs, dir });
      await git.setup();

      const fileInRoot = sandbox.file("file-in-root.txt");
      const directory = sandbox.dir("directory");
      const fileInDirectory = directory.file("file-in-directory.txt");
      const subDirectory = directory.dir("sub-directory");
      const fileInSubDirectory = subDirectory.file("file-in-sub-directory.txt");

      await fileInRoot.create("hello world");
      await fileInDirectory.create("hello world");
      await fileInSubDirectory.create("hello world");

      await git.createSnapshot("first-snapshot");

      await fileInSubDirectory.create("changed file-in-sub-directory.txt");
      await git.createSnapshot("second-snapshot");

      const diffs = await git.diffSnapshot(
        "first-snapshot",
        "second-snapshot",
        { path: "directory" }
      );

      // diffs do not contain the file-in-root.txt, only those descendants of "directory"
      assert.deepEqual(diffs, [
        { path: "directory/file-in-directory.txt", type: "equal" },
        {
          path: "directory/sub-directory/file-in-sub-directory.txt",
          type: "modify",
        },
      ]);
    });
  });

  describe("#deleteSnapshot", () => {
    test("throws if the snapshot doesn't exist", async () => {
      const git = new Git({ fs, dir });
      await git.setup();
      await assert.rejects(git.deleteSnapshot("snapshot-does-not-exist"));
    });

    test("it deletes a snapshot", async () => {
      const git = new Git({ fs, dir });
      await git.setup();

      await git.createSnapshot("snapshot-to-delete");
      let tags = await isoGit.listTags({ fs, dir, gitdir: git.gitDir });
      assert.deepEqual(tags, ["snapshot-to-delete"]);

      await git.deleteSnapshot("snapshot-to-delete");
      tags = await isoGit.listTags({ fs, dir, gitdir: git.gitDir });
      assert.deepEqual(tags, []);
    });
  });

  describe("#restoreSnapshot", () => {
    test("it throws if the snapshot doesn't exist", async () => {
      const git = new Git({ fs, dir });
      await git.setup();
      await assert.rejects(git.restoreSnapshot("snapshot-does-not-exist"));
    });

    test("it restores the file system to the state of snapshot", async () => {
      const git = new Git({ fs, dir });
      await git.setup();

      await sandbox.dir("test-dir").create();
      await sandbox.file("test-file").create(``);
      await git.createSnapshot("hello-world");

      await sandbox.file("new-file").create(``);
      await sandbox.dir("new-dir").create();

      assert.deepEqual(await sandbox.root.tree(), {
        "new-file": "new-file",
        "test-dir": {},
        "new-dir": {},
        "test-file": "test-file",
      });

      await git.restoreSnapshot("hello-world");
      assert.deepEqual(await sandbox.root.tree(), {
        "test-dir": {},
        "test-file": "test-file",
      });
    });
  });

  describe("#file", () => {
    test("it returns the file buffer for a valid file at a snapshot", async () => {
      const git = new Git({ fs, dir });
      await git.setup();

      const file = sandbox.file("test-file");
      const fileContents = `a file with some text`;
      await file.create(fileContents);
      await git.createSnapshot("hello-world");
      const fileBuffer = await git.file("hello-world", "test-file");
      assert.strictEqual(fileBuffer?.toString(), fileContents);
    });

    test("it returns undefined when the file does not exist", async () => {
      const git = new Git({ fs, dir });
      await git.setup();
      await git.createSnapshot("hello-world");
      const fileBuffer = await git.file("hello-world", "test-file");
      assert.strictEqual(fileBuffer, undefined);
    });

    test("it throws when the snapshot does not exist", async () => {
      const git = new Git({ fs, dir });
      await git.setup();
      await assert.rejects(() => git.file("some-snapshot", "test-file"), {
        message: "Snapshot some-snapshot does not exist.",
      });
    });
  });

  describe("empty directories", () => {
    test("handle diffs when added", async () => {
      const git = new Git({ fs, dir });
      await git.setup();
      await git.createSnapshot("snapshot-a");
      await sandbox.dir("empty-dir").create();
      await git.createSnapshot("snapshot-b");
      const diff = await git.diffSnapshot("snapshot-a", "snapshot-b", {
        includeDirs: true,
      });

      assert.deepEqual(diff, [{ path: "empty-dir", type: "add" }]);
    });

    test("handle diffs when removed", async () => {
      const git = new Git({ fs, dir });
      await git.setup();
      await sandbox.dir("empty-dir").create();
      await git.createSnapshot("snapshot-a");
      await sandbox.dir("empty-dir").delete();
      await git.createSnapshot("snapshot-b");
      const diff = await git.diffSnapshot("snapshot-a", "snapshot-b", {
        includeDirs: true,
      });

      assert.deepEqual(diff, [
        {
          path: "empty-dir",
          type: "remove",
        },
      ]);
    });

    test("handle diffs when modfied", async () => {
      const git = new Git({ fs, dir });
      await git.setup();
      await sandbox.dir("empty-dir").create();
      await git.createSnapshot("snapshot-a");
      await sandbox.dir("empty-dir").dir("sub-empty-dir").create();
      await git.createSnapshot("snapshot-b");
      const diff = await git.diffSnapshot("snapshot-a", "snapshot-b", {
        includeDirs: true,
      });

      assert.deepEqual(diff, [
        {
          path: "empty-dir",
          type: "modify",
        },
        {
          path: "empty-dir/sub-empty-dir",
          type: "add",
        },
      ]);
    });
  });
});
