import { beforeEach, describe, test, afterEach } from "node:test";
import { File } from "./file.js";
import assert from "node:assert";
import * as sinon from "sinon";
import { resolve } from "node:path";
import { Git } from "./git.js";
import { createMockedSandbox } from "./test-utils/sandbox.js";

/**
 * @typedef {import('./dir.js').Dir} Dir
 */

describe("File", () => {
  /** @type { import("sinon").SinonSandbox } */
  let sinonSandbox;

  /** @type {import('./sandbox.js').Sandbox} */
  let sandbox;

  const mockTempRootPath = "/mock-tmp/random-uuid";
  /** @type {import("sinon").SinonStub} */

  /** @type {ReturnType<typeof createMockedSandbox>['fileOpsStubs']} */
  let fileOpsStubs;

  /** @type {ReturnType<typeof createMockedSandbox>['dirOpsStubs']} */
  let dirOpsStubs;

  beforeEach(async () => {
    sinonSandbox = sinon.createSandbox();
    const {
      sandbox: s,
      fileOpsStubs: fOpsStubs,
      dirOpsStubs: dOpsStubs,
    } = createMockedSandbox(sinonSandbox);

    sandbox = s;
    fileOpsStubs = fOpsStubs;
    dirOpsStubs = dOpsStubs;

    await sandbox.setup();
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  test("#name", () => {
    const file = new File({
      name: "hello-world.md",
      sandbox,
      parent: sandbox.root,
    });

    assert.strictEqual(file.name, "hello-world.md");
  });

  test("#parent", () => {
    const file = new File({
      name: "hello-world.md",
      sandbox,
      parent: sandbox.root,
    });

    assert.strictEqual(file.parent, sandbox.root);
  });

  describe("#path", () => {
    test("#path", () => {
      const file = new File({
        name: "hello-world.md",
        sandbox,
        parent: sandbox.root,
      });

      assert.strictEqual(file.path, "hello-world.md");
    });

    test("#path (nested)", () => {
      const subDir = sandbox.dir("sub-dir");

      const file = new File({
        name: "hello-world.md",
        sandbox,
        parent: subDir,
      });

      assert.strictEqual(file.path, "sub-dir/hello-world.md");
    });
  });

  describe("#absolutePath", () => {
    test("#absolutePath", () => {
      const file = new File({
        sandbox,
        name: "hello-world.md",
        parent: sandbox.root,
      });

      assert.strictEqual(
        file.absolutePath,
        resolve(mockTempRootPath, "hello-world.md"),
      );
    });

    test("#absolutePath (nested)", () => {
      const subDir = sandbox.dir("sub-dir");

      const file = new File({
        sandbox,
        name: "hello-world.md",
        parent: subDir,
      });

      assert.strictEqual(
        file.absolutePath,
        resolve(mockTempRootPath, "sub-dir", "hello-world.md"),
      );
    });
  });

  describe("#extension", () => {
    test("#extension", () => {
      const file = new File({
        sandbox,
        name: "hello-world.md",
        parent: sandbox.root,
      });

      assert.strictEqual(file.extension, ".md");
    });

    test("#extension (empty)", () => {
      const file = new File({
        sandbox,
        name: "hello-world",
        parent: sandbox.root,
      });

      assert.strictEqual(file.extension, "");
    });
  });

  test("#read", async () => {
    fileOpsStubs.read.resolves("mock resolved from #read");

    const file = new File({
      sandbox,
      name: "hello-world",
      parent: sandbox.root,
    });

    const readOptions = {};
    const result = await file.read(readOptions);
    assert.strictEqual(result, "mock resolved from #read");
    assert.strictEqual(fileOpsStubs.read.called, true);
    assert.deepEqual(fileOpsStubs.read.firstCall.args, [file, readOptions]);
  });

  describe("#create", () => {
    /** @type { File } */
    let file;

    beforeEach(() => {
      dirOpsStubs.mkdir.callsFake(async (dir) => dir.absolutePath);

      file = new File({
        sandbox,
        name: "hello-world.json",
        parent: sandbox.root.dir("parent-dir"),
      });
    });

    test("it works", async () => {
      const contents = `Hello World!`;
      const options = { overwrite: false, prettier: true };
      await file.create(contents, options);
      assert.strictEqual(fileOpsStubs.write.calledOnce, true);
      assert.strictEqual(fileOpsStubs.write.firstCall.args[0], file);
      assert.strictEqual(
        fileOpsStubs.write.firstCall.args[1],
        contents,
        "contents passed through to underlying fileOps",
      );
      assert.deepEqual(
        fileOpsStubs.write.firstCall.args[2],
        options,
        "options passed through to underlying fileOps",
      );
    });

    describe("when the file to be created already exists", () => {
      beforeEach(() => {
        fileOpsStubs.exists.callsFake(async () => true);
      });

      test("by default it will overwrite a file", async () => {
        await file.create(``);
        assert.strictEqual(
          fileOpsStubs.exists.calledOnce,
          false,
          "file is not checked to exist first if overwrite is on by default",
        );
        assert.strictEqual(fileOpsStubs.write.calledOnce, true);
      });

      test("it will overwrite a file when { overwrite: true }", async () => {
        await file.create(``, { overwrite: true });
        assert.strictEqual(
          fileOpsStubs.exists.calledOnce,
          false,
          "file is not checked to exist first if overwrite option is true",
        );
        assert.strictEqual(fileOpsStubs.write.calledOnce, true);
      });

      test("it will throw an error when { overwrite: false }", async () => {
        await assert.rejects(
          () => file.create(``, { overwrite: false }),
          (error) => {
            assert.strictEqual(
              // @ts-expect-error
              error.message,
              `#write has { overwrite: false } but ${file.path} already exists`,
            );
            return true;
          },
        );

        assert.strictEqual(
          fileOpsStubs.exists.calledOnce,
          true,
          "file is checked when if overwrite option is false",
        );

        assert.strictEqual(
          fileOpsStubs.exists.firstCall.firstArg,
          file,
          "file being created is checked to exist",
        );

        assert.strictEqual(
          fileOpsStubs.write.calledOnce,
          false,
          "file is never created",
        );
      });
    });

    describe("when the file's parent directory exists", () => {
      beforeEach(() => {
        dirOpsStubs.exists.callsFake(async () => true);
        dirOpsStubs.mkdir.callsFake(async (dir) => dir.absolutePath);
      });

      test("it skips creating the directory before creating the file ", async () => {
        await file.create(``);

        assert.strictEqual(dirOpsStubs.exists.callCount, 1);
        assert.strictEqual(
          dirOpsStubs.exists.firstCall.firstArg.path,
          file.parent.path,
          "parent `Dir` of file is checked to exist",
        );

        assert.strictEqual(fileOpsStubs.write.calledOnce, true);
      });
    });

    describe("when the file's parent directory doesn't exist", () => {
      beforeEach(() => {
        dirOpsStubs.exists.callsFake(async () => false);
        dirOpsStubs.mkdir.callsFake(async () => Promise.resolve(""));
      });

      test("it creates the file's parent directory before creating the file", async () => {
        await file.create(``);

        assert.strictEqual(dirOpsStubs.exists.callCount, 1);
        assert.strictEqual(
          dirOpsStubs.exists.firstCall.firstArg,
          file.parent,
          "parent `Dir` of file is checked to exist",
        );

        assert.strictEqual(dirOpsStubs.mkdir.callCount, 1);
        assert.strictEqual(
          dirOpsStubs.mkdir.firstCall.args[0],
          file.parent,
          "parent `Dir` of file is created",
        );
        assert.deepEqual(
          dirOpsStubs.mkdir.firstCall.args[1],
          { recursive: true },
          "parent dir is created recursively if necessary",
        );

        assert.strictEqual(fileOpsStubs.write.calledOnce, true);
      });
    });

    describe("prettier formatting", () => {
      const uglyJson = `{ invalid_json:
        'key has no quotes, this is using single quotes, and is awkwardly split between lines... but all this will be fixed by prettier'}`.trim();
      const prettyJson = `
{
  "invalid_json": "key has no quotes, this is using single quotes, and is awkwardly split between lines... but all this will be fixed by prettier"
}`.trim();

      test("prettier formatting is disabled by default", async () => {
        await file.create(uglyJson);
        const writtenString = fileOpsStubs.write.firstCall.args[1];
        assert.strictEqual(
          /** @type {string} */ (writtenString).trim(),
          uglyJson,
        );
      });

      test("prettier formatting is enabled by option { prettier: true }", async () => {
        await file.create(uglyJson, { prettier: true });
        const writtenString = fileOpsStubs.write.firstCall.args[1];
        assert.strictEqual(
          /** @type {string} */ (writtenString).trim(),
          prettyJson,
        );
      });

      test("prettier formatting is disabled by option { prettier: false }", async () => {
        await file.create(uglyJson, { prettier: false });
        const writtenString = fileOpsStubs.write.firstCall.args[1];
        assert.strictEqual(
          /** @type {string} */ (writtenString).trim(),
          uglyJson,
        );
      });

      test("prettier formatting uses parent sandbox prettier option", async () => {
        const {
          sandbox: s,
          fileOpsStubs: fOpsStubs,
          dirOpsStubs: dOpsStubs,
        } = createMockedSandbox(sinonSandbox, { prettier: true });

        sandbox = s;
        dirOpsStubs = dOpsStubs;
        fileOpsStubs = fOpsStubs;
        await sandbox.setup();

        dirOpsStubs.mkdir.callsFake(async (dir) => dir.absolutePath);

        const file = new File({
          sandbox,
          name: "hello-world.json",
          parent: sandbox.root.dir("parent-dir"),
        });

        await file.create(uglyJson);
        const writtenString = fileOpsStubs.write.firstCall.args[1].toString();
        assert.strictEqual(writtenString.trim(), prettyJson);
      });

      test("prettier formatting is skipped when there is no extension", async () => {
        const file = new File({
          sandbox,
          name: "hello-world",
          parent: sandbox.root,
        });

        await file.create(uglyJson, { prettier: true });
        const writtenString = fileOpsStubs.write.firstCall.args[1];
        assert.strictEqual(
          /** @type {string} */ (writtenString).trim(),
          uglyJson,
        );
      });
    });
  });

  test("#rename", async () => {
    fileOpsStubs.rename.resolves();

    const file = new File({
      sandbox,
      name: "hello-world",
      parent: sandbox.root,
    });

    const renamedFile = await file.rename("renamed-file");

    assert.strictEqual(fileOpsStubs.rename.calledOnce, true);
    assert.deepEqual(fileOpsStubs.rename.args[0], [file, "renamed-file"]);
    assert.strictEqual(file.name, "hello-world");
    assert.strictEqual(renamedFile.name, "renamed-file");
    assert.deepEqual(file.parent, renamedFile.parent);
  });

  describe("#move", () => {
    /** @type {File} */
    let file;

    /** @type {Dir} */
    let subDir;

    beforeEach(() => {
      file = new File({
        sandbox,
        name: "hello-world",
        parent: sandbox.root,
      });

      subDir = sandbox.root.dir("sub-dir");
    });

    test("it moves a file under a directory", async () => {
      fileOpsStubs.move.resolves();

      // using all sinon matchers for `withArgs` to workaround this issue:
      // https://github.com/sinonjs/sinon/issues/1572
      fileOpsStubs.exists
        .withArgs(sinon.match.has("path", "sub-dir/hello-world"))
        .resolves(false);
      fileOpsStubs.exists.withArgs(sinon.match.in([file])).resolves(true);
      dirOpsStubs.exists.withArgs(sinon.match.in([subDir])).resolves(true);

      assert.deepEqual(file.parent, sandbox.root);
      assert.deepEqual(subDir.parent, sandbox.root);
      const movedFile = await file.move(subDir);

      assert.strictEqual(fileOpsStubs.move.calledOnce, true);
      assert.deepEqual(fileOpsStubs.move.args[0], [file, subDir]);
      assert.strictEqual(file.name, "hello-world");
      assert.strictEqual(movedFile.name, "hello-world");
      assert.deepEqual(movedFile.parent, subDir);
    });

    test("it throws when the file to be moved does not exist", async () => {
      const subDir = sandbox.root.dir("sub-dir");
      fileOpsStubs.exists.withArgs(sinon.match.in([file])).resolves(false);

      await assert.rejects(() => file.move(subDir), {
        message: `The file "hello-world" does not exist, so it cannot be moved`,
      });
    });

    test("it throws when the directory the file is to be moved to does not exist", async () => {
      fileOpsStubs.exists.withArgs(sinon.match.in([file])).resolves(true);
      dirOpsStubs.exists.withArgs(sinon.match.in([subDir])).resolves(false);

      await assert.rejects(() => file.move(subDir), {
        message: `The file "hello-world" cannot be moved under the directory "sub-dir" because "sub-dir" does not exist`,
      });
    });

    test("it throws when the directory the file is to be moved to already has a file or directory under the same name", async () => {
      // using all sinon matchers for `withArgs` to workaround this issue:
      // https://github.com/sinonjs/sinon/issues/1572
      fileOpsStubs.exists
        .withArgs(sinon.match.has("path", "sub-dir/hello-world"))
        .resolves(true);
      fileOpsStubs.exists.withArgs(sinon.match.in([file])).resolves(true);
      dirOpsStubs.exists.withArgs(sinon.match.in([subDir])).resolves(true);

      await assert.rejects(() => file.move(subDir), {
        message: `The file "hello-world" cannot be moved under the directory "sub-dir" because there already exists a file or directory named "hello-world" under "sub-dir"`,
      });
    });
  });

  test("#access", async () => {
    fileOpsStubs.access.resolves();

    const file = new File({
      sandbox,
      name: "hello-world",
      parent: sandbox.root,
    });

    await file.access(1234);

    assert.strictEqual(fileOpsStubs.access.calledOnce, true);
    assert.deepEqual(fileOpsStubs.access.firstCall.args, [file, 1234]);
  });

  test("#exists", async () => {
    const file = new File({
      sandbox,
      name: "hello-world",
      parent: sandbox.root,
    });

    fileOpsStubs.exists.callsFake(async () => true);
    const result = await file.exists();
    assert.strictEqual(result, true);
    assert.strictEqual(fileOpsStubs.exists.calledOnce, true);
    assert.strictEqual(fileOpsStubs.exists.firstCall.args[0], file);
  });

  test("#delete", async () => {
    const file = new File({
      sandbox,
      name: "hello-world",
      parent: sandbox.root,
    });

    fileOpsStubs.rm.callsFake(async () => {});
    const result = await file.delete();
    assert.strictEqual(result, undefined);
    assert.strictEqual(fileOpsStubs.rm.calledOnce, true);
    assert.strictEqual(fileOpsStubs.rm.firstCall.args[0], file);
  });

  describe("#hash", () => {
    /** @type {import("sinon").SinonStub} */
    let gitOidStub;

    beforeEach(() => {
      gitOidStub = sinonSandbox
        .stub(Git.prototype, "oid")
        .callsFake(async () => "mocked git#oid return");
    });

    test("#hash", async () => {
      const file = new File({
        sandbox,
        name: "hello-world",
        parent: sandbox.root,
      });

      const result = await file.hash("hello-world");
      assert.strictEqual(result, "mocked git#oid return");
      assert.strictEqual(gitOidStub.called, true);
      assert.deepEqual(gitOidStub.firstCall.args, [
        "hello-world",
        file.absolutePath,
      ]);
    });
  });

  test("#size", async () => {
    const mockStatSize = 123456;
    fileOpsStubs.stat.returns(
      // eslint-disable-next-line jsdoc/reject-any-type
      /** @type {any} */ (Promise.resolve({ size: mockStatSize })),
    );

    const file = new File({
      sandbox,
      name: "hello-world",
      parent: sandbox.root,
    });

    const size = await file.size();
    assert.strictEqual(size, mockStatSize);
  });

  describe("#diffText", async () => {
    const SNAPSHOT_ONE = "snapshot-one";
    const SNAPSHOT_TWO = "snapshot-two";
    const binaryFileContents = Buffer.from([0, 1, 2, 3]);

    /** @type {import("sinon").SinonStub} */
    let gitPrototypeFileStub;

    beforeEach(() => {
      gitPrototypeFileStub = sinonSandbox.stub(Git.prototype, "file");
    });

    /**
     * @param {string} testName
     * @param {string} snapshotOneStubContents
     * @param {string} snapshotTwoStubContents
     * @param {{ 'patch-string': string, 'diff-object': import("./types.js").FileDiff}} expected
     */
    function testDiffText(
      testName,
      snapshotOneStubContents,
      snapshotTwoStubContents,
      expected,
    ) {
      ["patch-string", "diff-object"].forEach((formatArg) => {
        test(`#diffText (with format arg: ${formatArg}): ${testName}`, async () => {
          const file = new File({
            sandbox,
            name: "hello-world",
            parent: sandbox.root,
          });

          gitPrototypeFileStub
            .withArgs(SNAPSHOT_ONE, file.path)
            .resolves(Buffer.from(snapshotOneStubContents));

          gitPrototypeFileStub
            .withArgs(SNAPSHOT_TWO, file.path)
            .resolves(Buffer.from(snapshotTwoStubContents));

          const diff = await file.diffText(
            SNAPSHOT_ONE,
            SNAPSHOT_TWO,
            // eslint-disable-next-line jsdoc/reject-any-type
            /** @type {any} */ (formatArg),
          );

          // eslint-disable-next-line jsdoc/reject-any-type
          assert.deepEqual(diff, /** @type {any} */ (expected)[formatArg]);
        });
      });
    }

    testDiffText(
      `with matching files`,
      `hello world, no changes`,
      `hello world, no changes`,
      {
        "patch-string": `Index: hello-world\n===================================================================\n--- hello-world\n+++ hello-world\n`,
        "diff-object": [
          {
            type: "equal",
            value: "hello world, no changes",
          },
        ],
      },
    );

    testDiffText(
      `with changed files`,
      `hello world, changes`,
      `hello world, some changes`,
      {
        "patch-string": `Index: hello-world\n===================================================================\n--- hello-world\n+++ hello-world\n@@ -1,1 +1,1 @@\n-hello world, changes\n\\ No newline at end of file\n+hello world, some changes\n\\ No newline at end of file\n`,
        "diff-object": [
          {
            type: "remove",
            value: "hello world, changes",
          },
          {
            type: "add",
            value: "hello world, some changes",
          },
        ],
      },
    );

    test("it throws if there is the file cannot be found in either snapshot", () => {
      const file = new File({
        sandbox,
        name: "hello-world",
        parent: sandbox.root,
      });

      gitPrototypeFileStub
        .withArgs(SNAPSHOT_ONE, file.path)
        .resolves(undefined);

      gitPrototypeFileStub
        .withArgs(SNAPSHOT_TWO, file.path)
        .resolves(undefined);

      assert.rejects(
        file.diffText(SNAPSHOT_ONE, SNAPSHOT_TWO, "diff-object"),
        /The file hello-world does not exist on either snapshot snapshot-one or snapshot-two/,
      );
    });

    test("it throws if the first snapshot file is not a text-based buffer", async () => {
      const file = new File({
        sandbox,
        name: "hello-world",
        parent: sandbox.root,
      });

      gitPrototypeFileStub
        .withArgs(SNAPSHOT_ONE, file.path)
        .resolves(binaryFileContents);

      gitPrototypeFileStub
        .withArgs(SNAPSHOT_TWO, file.path)
        .resolves(`some file contents`);

      await assert.rejects(
        () => file.diffText(SNAPSHOT_ONE, SNAPSHOT_TWO, "diff-object"),
        /Could not create diff of hello-world. File at snapshot-one is not a text file/,
      );
    });

    test("it throws if the second snapshot file is not a text-based buffer", async () => {
      const file = new File({
        sandbox,
        name: "hello-world",
        parent: sandbox.root,
      });

      gitPrototypeFileStub
        .withArgs(SNAPSHOT_ONE, file.path)
        .resolves(`some file contents`);

      gitPrototypeFileStub
        .withArgs(SNAPSHOT_TWO, file.path)
        .resolves(binaryFileContents);

      await assert.rejects(
        () => file.diffText(SNAPSHOT_ONE, SNAPSHOT_TWO, "diff-object"),
        /Could not create diff of hello-world. File at snapshot-two is not a text file/,
      );
    });

    test("it throws if an invalid diff format is passed in", async () => {
      const file = new File({
        sandbox,
        name: "hello-world",
        parent: sandbox.root,
      });

      gitPrototypeFileStub
        .withArgs(SNAPSHOT_ONE, file.path)
        .resolves(`some file contents`);

      gitPrototypeFileStub
        .withArgs(SNAPSHOT_TWO, file.path)
        .resolves(`some file contents`);

      await assert.rejects(
        () =>
          file.diffText(
            SNAPSHOT_ONE,
            SNAPSHOT_TWO,
            // eslint-disable-next-line jsdoc/reject-any-type
            /** @type {any} */ ("NOT A VALID DIFF FORMAT"),
          ),
        /Format NOT A VALID DIFF FORMAT not supported/,
      );
    });
  });

  describe("#diffBlob", () => {
    const SNAPSHOT_ONE = "snapshot-one";
    const SNAPSHOT_TWO = "snapshot-two";

    /** @type {import("sinon").SinonStub} */
    let gitPrototypeDiffSnapshotStub;

    beforeEach(() => {
      gitPrototypeDiffSnapshotStub = sinonSandbox.stub(
        Git.prototype,
        "diffSnapshot",
      );
    });

    test("#diffBlob", async () => {
      const file = new File({
        sandbox,
        name: "hello-world",
        parent: sandbox.root,
      });

      gitPrototypeDiffSnapshotStub.returns(() => []);
      await file.diffBlob(SNAPSHOT_ONE, SNAPSHOT_TWO);
      assert.strictEqual(gitPrototypeDiffSnapshotStub.called, true);
      assert.deepEqual(gitPrototypeDiffSnapshotStub.firstCall.args, [
        SNAPSHOT_ONE,
        SNAPSHOT_TWO,
        { path: file.path },
      ]);
    });
  });

  describe("#copyTo", () => {
    /** @type { File } */
    let srcFile;

    /** @type { Dir } */
    let destDir;

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

    /**
     * using all sinon matchers for `withArgs` to workaround this issue:
       https://github.com/sinonjs/sinon/issues/1572
     * @param {File} file 
     * @param {boolean} exists 
     */
    const mockFileExists = (file, exists) => {
      fileOpsStubs.exists
        .withArgs(sinon.match.has("path", file.path))
        .resolves(exists);
    };

    const defaultFileOpsCpOptions = Object.freeze({
      force: false,
      as: undefined,
    });

    beforeEach(() => {
      srcFile = sandbox.file("src-file.md");
      destDir = sandbox.dir("dest-dir");

      dirOpsStubs.cp.resolves();
      mockFileExists(srcFile, true);
      mockDirExists(destDir, true);
    });

    test("it can copy a file", async () => {
      await srcFile.copyTo(destDir);
      assert.strictEqual(fileOpsStubs.cp.calledOnce, true);
      assert.deepEqual(fileOpsStubs.cp.firstCall.args, [
        srcFile,
        destDir,
        defaultFileOpsCpOptions,
      ]);
    });

    test("specified options are passed through", async () => {
      const specifiedOptions = {
        overwrite: true,
        as: "renamed-file",
      };

      await srcFile.copyTo(destDir, specifiedOptions);
      assert.strictEqual(fileOpsStubs.cp.calledOnce, true);
      assert.deepEqual(fileOpsStubs.cp.firstCall.args, [
        srcFile,
        destDir,
        {
          force: specifiedOptions.overwrite,
          as: specifiedOptions.as,
        },
      ]);
    });

    test("it throws when the first argument passed in is not a `Dir` instance", async () => {
      await assert.rejects(
        () =>
          srcFile.copyTo(
            // eslint-disable-next-line jsdoc/reject-any-type
            /** @type {any} */ ("not a file or directory instance"),
          ),
        {
          message:
            "Expected first argument of File.copyTo to be a `Dir` instance",
        },
      );
    });

    test("it throws when the destination directory does not exist", async () => {
      mockDirExists(destDir, false);

      await assert.rejects(async () => srcFile.copyTo(destDir), {
        message: `Directory "dest-dir" must exist before directory or files can be copied into it`,
      });
    });

    test("it throws when the source file does not exist", async () => {
      mockFileExists(srcFile, false);

      await assert.rejects(async () => srcFile.copyTo(destDir), {
        message: `File "src-file.md" must exist before it can be copied`,
      });
    });

    test("it throws when a file already exists at the destination directory", async () => {
      mockFileExists(destDir.file(srcFile.name), true);

      await assert.rejects(
        async () => srcFile.copyTo(destDir, { overwrite: false }),
        {
          message: `A file or directory already exists as "src-file.md" at "dest-dir"`,
        },
      );
    });
  });
});
