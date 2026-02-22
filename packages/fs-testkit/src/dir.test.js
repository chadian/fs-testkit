import * as fs from "fs/promises";
import { Dir } from "./dir.js";
import { File } from "./file.js";
import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert";
import * as sinon from "sinon";
import { Git } from "./git.js";
import { basename, join, resolve } from "node:path";
import { mockSandboxFsOps } from "./test-utils/fs-ops.js";
import { createMockedSandbox } from "./test-utils/sandbox.js";

describe("Dir", () => {
  /** @type { import("sinon").SinonSandbox } */
  let sinonSandbox;

  /** @type {import('./sandbox.js').Sandbox} */
  let sandbox;

  const mockTempRootPath = "/mock-tmp/random-uuid";

  beforeEach(async () => {
    sinonSandbox = sinon.createSandbox();
    sandbox = createMockedSandbox(sinonSandbox).sandbox;
    await sandbox.setup();
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  test("#name", () => {
    const name = "hello-world";
    const dir = new Dir({
      name,
      sandbox,
      parent: sandbox.root,
    });

    assert.strictEqual(dir.name, name);
  });

  test("#parent", () => {
    const dir = new Dir({
      name: "hello-world",
      sandbox,
      parent: sandbox.root,
    });

    assert.strictEqual(dir.parent, sandbox.root);
  });

  test("#path", () => {
    const dir = new Dir({
      name: "hello-world",
      sandbox,
      parent: sandbox.root,
    });

    const subDir = new Dir({
      name: "sub-dir",
      sandbox,
      parent: dir,
    });

    assert.strictEqual(subDir.path, join("hello-world", "sub-dir"));
  });

  test("#absolutePath", () => {
    const dir = new Dir({
      name: "hello-world",
      sandbox,
      parent: sandbox.root,
    });

    assert.strictEqual(
      dir.absolutePath,
      resolve(mockTempRootPath, "hello-world"),
    );
  });

  test("#file", () => {
    const dir = new Dir({
      name: "hello-world",
      sandbox,
      parent: sandbox.root,
    });

    const file = dir.file("some-file.md");
    assert.strictEqual(file instanceof File, true);
    assert.strictEqual(file.parent, dir);
    assert.strictEqual(file.path, join(dir.path, file.name));
    assert.strictEqual(file.absolutePath, join(dir.absolutePath, file.name));
  });

  test("#dir", () => {
    const dir = new Dir({
      name: "hello-world",
      sandbox,
      parent: sandbox.root,
    });

    const subDir = dir.dir("some-file");
    assert.strictEqual(subDir instanceof Dir, true);
    assert.strictEqual(subDir.parent, dir);
    assert.strictEqual(subDir.path, join(dir.path, subDir.name));
    assert.strictEqual(
      subDir.absolutePath,
      join(dir.absolutePath, subDir.name),
    );
  });

  describe("#at", () => {
    test("#at with inferred directory without extension", () => {
      const dir = new Dir({
        name: "hello-world",
        sandbox,
        parent: sandbox.root,
      });

      const subDir = dir.at("hello-world");
      assert.strictEqual(subDir instanceof Dir, true);
      assert.strictEqual(subDir.parent, dir);
    });

    test("#at with inferred file by extension", () => {
      const dir = new Dir({
        name: "hello-world",
        sandbox,
        parent: sandbox.root,
      });

      const file = dir.at("hello-world.md");
      assert.strictEqual(file instanceof File, true);
      assert.strictEqual(file.parent, dir);
    });

    test("#at with specified Dir", () => {
      const dir = new Dir({
        name: "hello-world",
        sandbox,
        parent: sandbox.root,
      });

      // directory with an extension
      const subDir = dir.at("hello-world.md", "Dir");
      assert.strictEqual(subDir instanceof Dir, true);
      assert.strictEqual(subDir.parent, dir);
    });

    test("#at with specified File", () => {
      const dir = new Dir({
        name: "hello-world",
        sandbox,
        parent: sandbox.root,
      });

      // directory with an extension
      const file = dir.at("hello-world", "File");
      assert.strictEqual(file instanceof File, true);
      assert.strictEqual(file.parent, dir);
    });
  });

  describe("#contains", () => {
    test("it works", () => {
      const dir = new Dir({
        name: "hello-world",
        sandbox,
        parent: sandbox.root,
      });
      const anotherDir = new Dir({
        name: "hallo-welt",
        sandbox,
        parent: sandbox.root,
      });
      const file = anotherDir.file("hallo-welt-file");

      assert.strictEqual(dir.contains(file), false);
      assert.strictEqual(anotherDir.contains(file), true);
    });
  });

  describe("#create", () => {
    /**
     * @type {ReturnType<typeof mockSandboxFsOps>['dirOpsStubs']}
     */
    let dirOpsStubs;

    beforeEach(() => {
      const mockFsOps = mockSandboxFsOps(sandbox);
      dirOpsStubs = mockFsOps.dirOpsStubs;
      dirOpsStubs.mkdir.callsFake(async (dir) => dir.absolutePath);
    });

    test("it works", async () => {
      const dir = new Dir({
        name: "hello-world",
        sandbox,
        parent: sandbox.root,
      });

      await dir.create();
      assert.strictEqual(dirOpsStubs.mkdir.calledOnce, true);
      assert.strictEqual(dirOpsStubs.mkdir.firstCall.args[0], dir);
      assert.deepEqual(
        dirOpsStubs.mkdir.firstCall.args[1],
        {
          recursive: true,
        },
        "by default with no arguments, directories are created rescursively",
      );
    });

    test("it passes through the object options argument", async () => {
      const dir = new Dir({
        name: "hello-world",
        sandbox,
        parent: sandbox.root,
      });

      const options = { recursive: false, mode: 755 };
      await dir.create(options);
      assert.strictEqual(dirOpsStubs.mkdir.calledOnce, true);
      assert.strictEqual(dirOpsStubs.mkdir.firstCall.args[0], dir);
      assert.deepEqual(
        dirOpsStubs.mkdir.firstCall.args[1],
        options,
        "options are passed through",
      );
    });

    test("it passes through a mode options argument", async () => {
      const dir = new Dir({
        name: "hello-world",
        sandbox,
        parent: sandbox.root,
      });

      const options = 755;
      await dir.create(options);
      assert.strictEqual(dirOpsStubs.mkdir.calledOnce, true);
      assert.strictEqual(dirOpsStubs.mkdir.firstCall.args[0], dir);
      assert.deepEqual(
        dirOpsStubs.mkdir.firstCall.args[1],
        { recursive: true, mode: options },
        "recursive is by default true, and the mode is passed in as it was from the options argument",
      );
    });
  });

  test("#contents", async () => {
    const mockFsOps = mockSandboxFsOps(sandbox);

    const mockDirEnts = [
      { name: "file-hello-world" },
      { name: "folder-hello-world" },
    ];

    mockFsOps.dirOpsStubs.readdir.returns(
      /** @type {Promise<import('node:fs').Dirent[]>} */ (
        Promise.resolve(mockDirEnts)
      ),
    );

    mockFsOps.dirOpsStubs.exists
      .withArgs(sinon.match({ name: "file-hello-world" }))
      .returns(Promise.resolve(false));

    mockFsOps.dirOpsStubs.exists
      .withArgs(sinon.match({ name: "folder-hello-world" }))
      .returns(Promise.resolve(true));

    const dir = new Dir({
      name: "some-dir",
      sandbox,
      parent: sandbox.root,
    });

    const [subFile, subDir] = await dir.contents();
    assert.strictEqual(subFile instanceof File, true);
    assert.strictEqual(subFile.path, "some-dir/file-hello-world");
    assert.strictEqual(subDir instanceof Dir, true);
    assert.strictEqual(subDir.path, "some-dir/folder-hello-world");
  });

  describe("#rename", () => {
    /** @type {Dir} */
    let dir;

    beforeEach(() => {
      dir = new Dir({
        name: "dir",
        sandbox,
        parent: sandbox.root,
      });
    });

    test("it renames a directory", async () => {
      const { dirOpsStubs } = mockSandboxFsOps(sandbox);
      dirOpsStubs.rename.resolves();

      const renamedDir = await dir.rename("renamed-dir");

      assert.strictEqual(dirOpsStubs.rename.calledOnce, true);
      assert.deepEqual(dirOpsStubs.rename.args[0], [dir, "renamed-dir"]);
      assert.strictEqual(dir.name, "dir");
      assert.strictEqual(renamedDir.name, "renamed-dir");
      assert.deepEqual(dir.parent, renamedDir.parent);
    });

    test("it throws when the name the directory is being renamed to is taken by another file or directory", async () => {
      const { dirOpsStubs } = mockSandboxFsOps(sandbox);
      dirOpsStubs.exists
        .withArgs(sinon.match.has("path", dir.parent?.dir("renamed-dir").path))
        .resolves(true);

      await assert.rejects(() => dir.rename("renamed-dir"), {
        message:
          'The directory "dir" cannot be renamed to "renamed-dir" because a file or directory already exists as "renamed-dir"',
      });
    });
  });

  describe("#move", () => {
    /** @type {Dir} */
    let dirToMove;

    /** @type {Dir} */
    let newDirParent;

    beforeEach(() => {
      dirToMove = new Dir({
        name: "dir-to-move",
        sandbox,
        parent: sandbox.root,
      });

      newDirParent = new Dir({
        name: "new-dir-parent",
        sandbox,
        parent: sandbox.root,
      });
    });

    test("it moves directory under another directory", async () => {
      const { dirOpsStubs } = mockSandboxFsOps(sandbox);

      // using all sinon matchers for `withArgs` to workaround this issue:
      // https://github.com/sinonjs/sinon/issues/1572
      dirOpsStubs.exists
        .withArgs(sinon.match.has("path", "new-dir-parent/dir-to-move"))
        .resolves(false);
      dirOpsStubs.exists.withArgs(sinon.match.in([dirToMove])).resolves(true);
      dirOpsStubs.exists
        .withArgs(sinon.match.in([newDirParent]))
        .resolves(true);

      assert.deepEqual(dirToMove.parent, newDirParent.parent);
      const movedDir = await dirToMove.move(newDirParent);

      assert.strictEqual(dirOpsStubs.move.calledOnce, true);
      assert.deepEqual(dirOpsStubs.move.args[0], [dirToMove, newDirParent]);
      assert.strictEqual(dirToMove.name, "dir-to-move");
      assert.strictEqual(movedDir.name, "dir-to-move");
      assert.deepEqual(movedDir.parent, newDirParent);
    });

    test("it throws when a directory does not exist", async () => {
      const { dirOpsStubs } = mockSandboxFsOps(sandbox);
      dirOpsStubs.exists.withArgs(sinon.match.in([dirToMove])).resolves(false);

      await assert.rejects(() => dirToMove.move(newDirParent), {
        message:
          'The directory "dir-to-move" does not exist, so it cannot be moved',
      });
    });

    test("it throws when a directory is attempted to be moved under a directory that does not exist", async () => {
      const { dirOpsStubs } = mockSandboxFsOps(sandbox);

      dirOpsStubs.exists.withArgs(sinon.match.in([dirToMove])).resolves(true);
      dirOpsStubs.exists
        .withArgs(sinon.match.in([newDirParent]))
        .resolves(false);

      await assert.rejects(() => dirToMove.move(newDirParent), {
        message:
          'The directory "dir-to-move" cannot be moved under the directory "new-dir-parent" because "new-dir-parent" does not exist',
      });
    });

    test("it throws when a directory has the same name as a file or directory under the directory it is attempted to be moved under", async () => {
      const { dirOpsStubs } = mockSandboxFsOps(sandbox);

      // using all sinon matchers for `withArgs` to workaround this issue:
      // https://github.com/sinonjs/sinon/issues/1572
      dirOpsStubs.exists
        .withArgs(sinon.match.has("path", "new-dir-parent/dir-to-move")) // this check handles whether the name is already taken under `new-parent-dir`
        .resolves(true);

      dirOpsStubs.exists.withArgs(sinon.match.in([dirToMove])).resolves(true);
      dirOpsStubs.exists
        .withArgs(sinon.match.in([newDirParent]))
        .resolves(true);

      await assert.rejects(() => dirToMove.move(newDirParent), {
        message: `The directory "dir-to-move" cannot be moved under the directory "new-dir-parent" because there already exists a file or directory named "dir-to-move" under "new-dir-parent"`,
      });
    });

    test("it throws when a directory is attempted to be moved under a directory it contains", async () => {
      const { dirOpsStubs } = mockSandboxFsOps(sandbox);
      dirOpsStubs.rename.resolves();

      const dir = new Dir({
        name: "some-dir",
        sandbox,
        parent: sandbox.root,
      });

      const anotherDir = new Dir({
        name: "another-dir",
        sandbox,
        parent: dir,
      });

      await assert.rejects(() => dir.move(anotherDir), {
        message: `Cannot move directory "some-dir" under "another-dir" because "some-dir" contains "another-dir"`,
      });
    });
  });

  test("#access", async () => {
    const dir = new Dir({
      name: "some-dir",
      sandbox,
      parent: sandbox.root,
    });

    const mockFsOps = mockSandboxFsOps(sandbox);
    const existsStub = mockFsOps.dirOpsStubs.access
      .withArgs(sinon.match({ path: "some-dir" }))
      .resolves();

    const result = await dir.access();
    assert.strictEqual(result, undefined);
    assert.strictEqual(existsStub.calledOnce, true);
  });

  test("#exists", async () => {
    const dir = new Dir({
      name: "hello-world",
      sandbox,
      parent: sandbox.root,
    });

    const mockFsOps = mockSandboxFsOps(sandbox);
    mockFsOps.dirOpsStubs.exists.resolves(true);
    await dir.exists();

    assert.strictEqual(mockFsOps.dirOpsStubs.exists.calledOnce, true);
    assert.strictEqual(mockFsOps.dirOpsStubs.exists.firstCall.args[0], dir);
  });

  describe("#delete", () => {
    /**
     * @type {ReturnType<typeof mockSandboxFsOps>['dirOpsStubs']}
     */
    let dirOpsStubs;

    beforeEach(() => {
      const mockFsOps = mockSandboxFsOps(sandbox);
      dirOpsStubs = mockFsOps.dirOpsStubs;
      dirOpsStubs.rm.callsFake(async () => {});
    });

    test("it works", async () => {
      const dir = new Dir({
        name: "hello-world",
        sandbox,
        parent: sandbox.root,
      });

      await dir.delete();

      assert.strictEqual(dirOpsStubs.rm.calledOnce, true);
      assert.strictEqual(dirOpsStubs.rm.firstCall.args[0], dir);
      assert.deepEqual(
        dirOpsStubs.rm.firstCall.args[1],
        {
          recursive: true,
          force: true,
        },
        "by default recursive and force are both true",
      );
    });

    test("it passes the options argument", async () => {
      const dir = new Dir({
        name: "hello-world",
        sandbox,
        parent: sandbox.root,
      });

      const options = { recursive: false, force: false };
      await dir.delete(options);

      assert.strictEqual(dirOpsStubs.rm.calledOnce, true);
      assert.strictEqual(dirOpsStubs.rm.firstCall.args[0], dir);
      assert.deepEqual(
        dirOpsStubs.rm.firstCall.args[1],
        options,
        "options argument is passed through",
      );
    });
  });

  describe("#scaffold", () => {
    /**
     * @type {ReturnType<typeof mockSandboxFsOps>}
     */
    let mockFsOps;

    beforeEach(() => {
      mockFsOps = mockSandboxFsOps(sandbox);
      mockFsOps.dirOpsStubs.rm.callsFake(async () => {});
      mockFsOps.dirOpsStubs.mkdir.callsFake(async (dir) => dir.absolutePath);
    });

    test("it can scaffold out a structure of files and directories", async () => {
      const dir = new Dir({
        name: "hello-world",
        sandbox,
        parent: sandbox.root,
      });

      await dir.scaffold({
        rootFile: `This file is in the root`,

        ["rootFileWithPrettierOff.json"]: [
          `{ invalidJson: 2024 }`,
          { prettier: false },
        ],

        ["rootFileWithPrettierOn.json"]: [
          `{ invalidJson: 2024 }`,
          { prettier: true },
        ],

        emptyDirectory: {},

        directory: {
          file: `
            Look a file without an extension!
          `.trim(),
          ["fileWithExtension.md"]: `
            Another file with an extension
          `.trim(),

          subDirectory: {
            subDirectoryFile: `File within a subdirectory`,
          },

          emptySubDirectory: {},
        },
      });

      const numberOfRootFiles = 3;
      const numberOfNonRootFiles = 3;
      const numberOfEmptyDirectories = 2;

      assert.strictEqual(
        mockFsOps.dirOpsStubs.mkdir.callCount,
        numberOfRootFiles + numberOfNonRootFiles + numberOfEmptyDirectories,
        "each file and empty directory is considered a leaf and has a recursive mkdir called for it",
      );

      assert.strictEqual(
        mockFsOps.fileOpsStubs.write.callCount,
        numberOfRootFiles + numberOfNonRootFiles,
        "each file is called with create",
      );

      const mkdirStub = mockFsOps.dirOpsStubs.mkdir;
      const writeCallStub = mockFsOps.fileOpsStubs.write;

      const checkFsOpForPath = (
        /** @type {import("./test-utils/sandbox.js").SinonStub} */ fsOpStub,
        /** @type {string[]} */ directories,
      ) =>
        Boolean(
          fsOpStub
            .getCalls()
            .find(
              (call) =>
                call.args[0].absolutePath ===
                join(mockTempRootPath, ...directories),
            ),
        );

      assert(checkFsOpForPath(mkdirStub, ["hello-world", "emptyDirectory"]));
      assert(checkFsOpForPath(mkdirStub, ["hello-world", "directory"]));
      assert(
        checkFsOpForPath(mkdirStub, [
          "hello-world",
          "directory",
          "subDirectory",
        ]),
      );
      assert(
        checkFsOpForPath(mkdirStub, [
          "hello-world",
          "directory",
          "emptySubDirectory",
        ]),
      );

      assert(checkFsOpForPath(writeCallStub, ["hello-world", "rootFile"]));
      assert(
        checkFsOpForPath(writeCallStub, [
          "hello-world",
          "rootFileWithPrettierOff.json",
        ]),
      );
      assert(
        checkFsOpForPath(writeCallStub, [
          "hello-world",
          "rootFileWithPrettierOn.json",
        ]),
      );
      assert(
        checkFsOpForPath(writeCallStub, ["hello-world", "directory", "file"]),
      );
      assert(
        checkFsOpForPath(writeCallStub, [
          "hello-world",
          "directory",
          "fileWithExtension.md",
        ]),
      );
      assert(
        checkFsOpForPath(writeCallStub, [
          "hello-world",
          "directory",
          "subDirectory",
          "subDirectoryFile",
        ]),
      );
    });

    test('it throws an error when the "scaffold dir" argument is an incorrect shape', async () => {
      const dir = new Dir({
        name: "hello-world",
        sandbox,
        parent: sandbox.root,
      });

      await assert.rejects(
        async () =>
          await dir.scaffold(
            // eslint-disable-next-line jsdoc/reject-any-type
            /** @type {any} */ ("not a valid scaffold dir shape"),
          ),
      );
    });
  });

  describe("#tree, #treeString", () => {
    /** @type {{ readdir: import("sinon").SinonStub, stat: import("sinon").SinonStub, readFile: import("sinon").SinonStub }} */
    let mockFs;

    /** @type {Dir} */
    let dir;

    beforeEach(async () => {
      mockFs = {
        readdir: sinon.stub(),
        stat: sinon.stub(),
        readFile: sinon.stub(),
      };

      sandbox = createMockedSandbox(
        sinonSandbox,
        // eslint-disable-next-line jsdoc/reject-any-type
        /** @type {any} */ ({ fs: mockFs }),
      ).sandbox;

      await sandbox.setup();

      dir = new Dir({
        name: "hello-world",
        sandbox,
        parent: sandbox.root,
      });

      const files = {
        resume: {
          absolute: resolve(dir.absolutePath, "resume.doc"),
        },
        appsFolder: {
          absolute: resolve(dir.absolutePath, "apps"),
        },
        mail: {
          absolute: resolve(dir.absolutePath, "apps", "mail.app"),
        },
      };

      mockFs.readdir
        .withArgs(dir.absolutePath)
        .returns([files.resume.absolute, files.appsFolder.absolute]);

      mockFs.readdir
        .withArgs(files.appsFolder.absolute)
        .returns([files.mail.absolute]);

      const directoryStats = {
        isDirectory() {
          return true;
        },
      };
      const fileStats = {
        isDirectory() {
          return false;
        },
      };

      mockFs.stat.withArgs(files.resume.absolute).resolves(fileStats);
      mockFs.stat.withArgs(files.mail.absolute).resolves(fileStats);
      mockFs.stat.withArgs(files.appsFolder.absolute).resolves(directoryStats);

      mockFs.readFile
        .withArgs(files.resume.absolute)
        .resolves(Buffer.from("resume.doc file contents"));

      mockFs.readFile
        .withArgs(files.mail.absolute)
        .resolves(Buffer.from("mail.app file contents"));
    });

    describe("#tree", () => {
      test("it can output a tree object", async () => {
        const tree = await dir.tree();
        assert.deepEqual(tree, {
          "resume.doc": "resume.doc",
          apps: {
            "mail.app": "mail.app",
          },
        });
      });

      test("it can output a tree with hash file masks", async () => {
        const tree = await dir.tree({
          blobFileMask: "hash",
          textFileMask: "hash",
        });

        assert.deepEqual(tree, {
          "resume.doc": "5737bbadea68d5a8e71409769f6197990e93605b",
          apps: {
            "mail.app": "5b53ba0a6df1865a32ee1f2648e492f7c97a0624",
          },
        });
      });

      test("it can output a tree with file-contents file mask for text files", async () => {
        const tree = await dir.tree({
          blobFileMask: "hash",
          textFileMask: "file-contents",
        });

        assert.deepEqual(tree, {
          "resume.doc": "resume.doc file contents",
          apps: {
            "mail.app": "mail.app file contents",
          },
        });
      });
    });

    describe("#treeString", () => {
      test("it can output a tree string", async () => {
        const tree = await dir.treeString();
        assert.deepEqual(
          tree.trim(),
          `
.
├── apps
│   └── mail.app
└── resume.doc
        `.trim(),
        );
      });
    });
  });

  describe("#hash", () => {
    /** @type {import("sinon").SinonStub} */
    let gitOidStub;

    /** @type {Dir} */
    let dir;

    beforeEach(() => {
      gitOidStub = sinonSandbox
        .stub(Git.prototype, "oid")
        .callsFake(async () => "mocked git#oid return");

      dir = new Dir({
        name: "hello-world",
        sandbox,
        parent: sandbox.root,
      });
    });

    test("it calls Git#oid with arguments", async () => {
      dir = new Dir({
        name: "hello-world",
        sandbox,
        parent: sandbox.root,
      });

      const result = await dir.hash("hello-world-snapshot");
      assert.strictEqual(result, "mocked git#oid return");
      assert.strictEqual(gitOidStub.called, true);
      assert.deepEqual(gitOidStub.firstCall.args, [
        "hello-world-snapshot",
        dir.absolutePath,
      ]);
    });

    test(`it creates a snapshot when an snapshot name argument isn't passed in`, async () => {
      const snapshotCreateSpy = sinon
        .stub(sandbox.snapshot, "create")
        .resolves("generated-snapshot");
      const result = await dir.hash();

      assert.strictEqual(snapshotCreateSpy.calledOnce, true);
      assert.strictEqual(result, "mocked git#oid return");
      assert.strictEqual(gitOidStub.calledOnce, true);
      assert.deepEqual(gitOidStub.firstCall.args, [
        "generated-snapshot",
        dir.absolutePath,
      ]);
    });
  });

  test(`#diff`, async () => {
    const gitDiffSnapshotStub = sinon
      .stub(Git.prototype, "diffSnapshot")
      .resolves([]);

    const dir = new Dir({
      name: "hello-world",
      sandbox,
      parent: sandbox.root,
    });

    await dir.diff(`snapshot-a`, `snapshot-b`);
    assert.strictEqual(gitDiffSnapshotStub.called, true);
    assert.deepEqual(gitDiffSnapshotStub.firstCall.args, [
      `snapshot-a`,
      `snapshot-b`,
      { path: dir.path, includeDirs: true },
    ]);
  });

  describe("#copyTo", () => {
    /** @type {Dir} */
    let srcDir;

    /** @type { Dir } */
    let destDir;

    /** @type {ReturnType<mockSandboxFsOps>['dirOpsStubs']} */
    let dirOpsStubs;

    const defaultDirOpsCpOptions = Object.freeze({
      errorOnExist: true,
      force: false,
      recursive: true,
      contentsOnly: true,
      as: undefined,
    });

    /**
     * using all sinon matchers for `withArgs` to workaround this issue:
       https://github.com/sinonjs/sinon/issues/1572
     * @param {Dir} dir 
     * @param {boolean} exists 
     */
    const mockDirExists = (dir, exists) => {
      dirOpsStubs.exists
        .withArgs(sinon.match.has("path", dir.path))
        .resolves(exists);
    };

    beforeEach(() => {
      srcDir = sandbox.dir("src-dir");
      destDir = sandbox.dir("dest-dir");

      const mockFsOps = mockSandboxFsOps(sandbox);
      dirOpsStubs = mockFsOps.dirOpsStubs;

      dirOpsStubs.cp.resolves();
      mockDirExists(srcDir, true);
      mockDirExists(destDir, true);
    });

    test("it can copy a directory", async () => {
      await srcDir.copyTo(destDir);
      assert.strictEqual(dirOpsStubs.cp.calledOnce, true);
      assert.deepEqual(dirOpsStubs.cp.firstCall.args, [
        srcDir,
        destDir,
        defaultDirOpsCpOptions,
      ]);
    });

    test("specified options are passed through", async () => {
      const specifiedOptions = {
        overwrite: true,
        recursive: false,
        contentsOnly: false,
        as: "renamed-dir",
      };

      await srcDir.copyTo(destDir, specifiedOptions);
      assert.strictEqual(dirOpsStubs.cp.calledOnce, true);
      assert.deepEqual(dirOpsStubs.cp.firstCall.args, [
        srcDir,
        destDir,
        {
          force: specifiedOptions.overwrite,
          recursive: specifiedOptions.recursive,
          contentsOnly: specifiedOptions.contentsOnly,
          errorOnExist: defaultDirOpsCpOptions.errorOnExist,
          as: "renamed-dir",
        },
      ]);
    });

    test("it throws when the first argument passed in is not a `Dir` instance", async () => {
      await assert.rejects(
        () =>
          srcDir.copyTo(
            // eslint-disable-next-line jsdoc/reject-any-type
            /** @type {any} */ ("not a file or directory instance"),
          ),
        {
          message:
            "Expected first argument of Dir.copyTo to be a `Dir` instance",
        },
      );
    });

    test("it throws when the source directory does not exist", async () => {
      mockDirExists(srcDir, false);

      await assert.rejects(async () => srcDir.copyTo(destDir), {
        message: `Directory "src-dir" must exist before it can be copied`,
      });
    });

    describe("option: overwite", async () => {
      test("it defaults to false", async () => {
        await srcDir.copyTo(destDir);
        assert.strictEqual(dirOpsStubs.cp.calledOnce, true);
        assert.strictEqual(dirOpsStubs.cp.firstCall.args[2]?.force, false);
        assert.strictEqual(
          dirOpsStubs.cp.firstCall.args[2]?.errorOnExist,
          true,
        );
      });

      test("it accepts a passed in true value", async () => {
        await srcDir.copyTo(destDir, { overwrite: true });
        assert.strictEqual(dirOpsStubs.cp.calledOnce, true);
        assert.strictEqual(dirOpsStubs.cp.firstCall.args[2]?.force, true);
        assert.strictEqual(
          dirOpsStubs.cp.firstCall.args[2]?.errorOnExist,
          true,
        );
      });

      test("it throws when overwrite: false and contentsOnly: false, and the file or directory already exists at the location being copied to", async () => {
        mockDirExists(destDir.dir(srcDir.name), true);

        await assert.rejects(
          async () =>
            await srcDir.copyTo(destDir, {
              contentsOnly: false,
              overwrite: false,
            }),
          {
            message: `A file or directory already exists as "src-dir" at "dest-dir"`,
          },
        );
      });
    });
  });

  describe("#copyFromExternal", () => {
    const srcAbsolutePath = "/some/external/absolute/path/";

    // eslint-disable-next-line jsdoc/reject-any-type
    /** @type { Record<keyof import('fs/promises'), any>} */
    let fsModuleMocks;

    /** @type { Dir } */
    let destDir;

    /** @type {ReturnType<mockSandboxFsOps>['dirOpsStubs']} */
    let dirOpsStubs;

    const defaultFsModuleCpOptions = Object.freeze({
      errorOnExist: true,
      force: false,
      recursive: true,
    });

    /**
     * using all sinon matchers for `withArgs` to workaround this issue:
       https://github.com/sinonjs/sinon/issues/1572
     * @param {Dir} dir 
     * @param {boolean} exists 
     */
    const mockDirExists = (dir, exists) => {
      dirOpsStubs.exists
        .withArgs(sinon.match.has("path", dir.path))
        .resolves(exists);
    };

    beforeEach(async () => {
      fsModuleMocks = {
        ...fs,

        // `Dir.copyFromExternal` only uses stat for the `isDirectory` check
        stat: sinonSandbox.stub().resolves({ isDirectory: () => true }),
        access: sinonSandbox.stub(),
        cp: sinonSandbox.stub().resolves(),
      };

      const { sandbox: sb, mockTempRootPath } = createMockedSandbox(
        sinonSandbox,
        {
          fs: fsModuleMocks,
        },
      );

      sandbox = sb;

      // existing root directory should not already exist
      fsModuleMocks.access.withArgs(sinon.match(mockTempRootPath)).rejects();
      // source absolute path being copied should exist
      fsModuleMocks.access.withArgs(sinon.match(srcAbsolutePath)).resolves();

      destDir = sandbox.root;
      const mockFsOps = mockSandboxFsOps(sandbox);
      dirOpsStubs = mockFsOps.dirOpsStubs;
      mockDirExists(destDir, true);
      await sandbox.setup();
    });

    test("it can copy a directory", async () => {
      await sandbox.root.copyFromExternal(srcAbsolutePath);

      assert.strictEqual(fsModuleMocks.cp.calledOnce, true);
      assert.deepEqual(fsModuleMocks.cp.firstCall.args, [
        srcAbsolutePath,
        destDir.absolutePath,
        defaultFsModuleCpOptions,
      ]);
    });

    test("specified options are passed through", async () => {
      const specifiedOptions = {
        overwrite: true,
        recursive: false,
        contentsOnly: false,
        as: "renamed-dir",
      };

      await sandbox.root.copyFromExternal(srcAbsolutePath, specifiedOptions);
      assert.strictEqual(fsModuleMocks.cp.calledOnce, true);
      assert.deepEqual(fsModuleMocks.cp.firstCall.args, [
        srcAbsolutePath,
        join(destDir.absolutePath, specifiedOptions.as),
        {
          errorOnExist: defaultFsModuleCpOptions.errorOnExist,
          force: specifiedOptions.overwrite,
          recursive: specifiedOptions.recursive,
        },
      ]);
    });

    test("it throws when the first argument passed in is not a string", async () => {
      await assert.rejects(
        () =>
          sandbox.root.copyFromExternal(
            // eslint-disable-next-line jsdoc/reject-any-type
            /** @type {any} */ ({}),
          ),
        {
          message: `Expected the first argument of Dir.copyFromExternal to be a string, got "object"`,
        },
      );
    });

    test("it throws when the source directory does not exist", async () => {
      fsModuleMocks.access.withArgs(sinon.match(srcAbsolutePath)).rejects();

      await assert.rejects(
        async () => sandbox.root.copyFromExternal(srcAbsolutePath),
        {
          message: `Unable to access absolute path to copy: "/some/external/absolute/path/"`,
        },
      );
    });

    describe("option: overwite", async () => {
      test("it defaults to false", async () => {
        await sandbox.root.copyFromExternal(srcAbsolutePath);
        assert.strictEqual(fsModuleMocks.cp.calledOnce, true);
        assert.strictEqual(fsModuleMocks.cp.firstCall.args[2]?.force, false);
        assert.strictEqual(
          fsModuleMocks.cp.firstCall.args[2]?.errorOnExist,
          true,
        );
      });

      test("it accepts a passed in true value", async () => {
        await sandbox.root.copyFromExternal(srcAbsolutePath, {
          overwrite: true,
        });
        assert.strictEqual(fsModuleMocks.cp.calledOnce, true);
        assert.strictEqual(fsModuleMocks.cp.firstCall.args[2]?.force, true);
        assert.strictEqual(
          fsModuleMocks.cp.firstCall.args[2]?.errorOnExist,
          true,
        );
      });

      test("it throws when overwrite: false and contentsOnly: false, and the file or directory already exists at the location being copied to", async () => {
        sinonSandbox
          .stub(destDir, "dir")
          .withArgs(basename(srcAbsolutePath))
          .returns(
            // eslint-disable-next-line jsdoc/reject-any-type
            /** @type { any } */ ({ exists: () => Promise.resolve(true) }),
          );

        await assert.rejects(
          async () =>
            await sandbox.root.copyFromExternal(srcAbsolutePath, {
              contentsOnly: false,
              overwrite: false,
            }),
          {
            message: `A file or directory already exists as "path" at "{sandbox root}"`,
          },
        );
      });
    });
  });
});
