import test, { afterEach, beforeEach, describe } from "node:test";
import sinon from "sinon";
import assert from "node:assert";
import { Dir } from "./dir.js";
import { File } from "./file.js";
import * as fs from "node:fs/promises";
import { createMockedSandbox } from "./test-utils/sandbox.js";
import { Snapshot } from "./snapshot.js";

describe("Sandbox", () => {
  /** @type { import("sinon").SinonSandbox } */
  let sinonSandbox;

  /** @type {import('./sandbox.js').Sandbox}*/
  let sandbox;

  /** @type {import("sinon").SinonStub} */
  let gitSetupStub;

  /** @type {import("sinon").SinonStub} */
  let sandboxRootCreateStub;

  const mockTempRootPath = "/mock-tmp/random-uuid";

  beforeEach(async () => {
    sinonSandbox = sinon.createSandbox();

    const mockedSandboxArtifacts = createMockedSandbox(sinonSandbox);
    sandbox = mockedSandboxArtifacts.sandbox;
    gitSetupStub = mockedSandboxArtifacts.gitSetupStub;
    sandboxRootCreateStub = mockedSandboxArtifacts.sandboxRootCreateStub;

    await sandbox.setup();
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  test("#rootPath, #createRootPath", async () => {
    assert.strictEqual(sandbox.rootPath, mockTempRootPath);
  });

  describe("#setup", () => {
    test("#setup sets up Git, Snapshot, and creates root dir", async () => {
      assert.strictEqual(sandboxRootCreateStub.calledOnce, true);
      assert.strictEqual(gitSetupStub.calledOnce, true);
      assert.strictEqual(sandbox.snapshot instanceof Snapshot, true);
    });

    describe("creating root dir with #allowExisting option", () => {
      // eslint-disable-next-line jsdoc/reject-any-type
      /** @type {any} */
      let mockFs;

      beforeEach(() => {
        // eslint-disable-next-line jsdoc/reject-any-type
        mockFs = /** @type {any} */ ({
          ...fs,
          access: sinon.stub(),
        });
      });

      test("it throws an error when `allowExisting` is false and the directory already exists", async () => {
        const mocks = createMockedSandbox(sinonSandbox, {
          root: {
            allowExisting: false,
          },
          fs: mockFs,
        });
        sandbox = mocks.sandbox;

        // resolves with Promise<undefined> for `access` on `fs/promises` means the dir exists
        mockFs.access.withArgs(mocks.mockTempRootPath).resolves();
        await assert.rejects(
          sandbox.setup(),
          new RegExp(
            'Sandbox can\'t setup root "/mock-tmp/random-uuid" without the passing a value of `true` for option root.allowExisting',
          ),
        );

        assert.strictEqual(mockFs.access.called, true);
        assert.deepEqual(mockFs.access.firstCall.args, [
          mocks.mockTempRootPath,
        ]);
      });

      test("it creates the directory when `allowExisting` is true and the directory already exists", async () => {
        const mocks = createMockedSandbox(sinonSandbox, {
          root: {
            allowExisting: true,
          },
          fs: mockFs,
        });
        sandbox = mocks.sandbox;

        // resolves with Promise<undefined> for `access` on `fs/promises` means the dir exists
        mockFs.access.withArgs(mocks.mockTempRootPath).resolves();

        await sandbox.setup();

        assert.strictEqual(mockFs.access.called, true);
        assert.deepEqual(mockFs.access.firstCall.args, [
          mocks.mockTempRootPath,
        ]);

        // the sandbox root should not be created since it already exists
        assert.strictEqual(mocks.sandboxRootCreateStub.called, false);
      });
    });

    describe("auto cleanup", () => {
      // eslint-disable-next-line jsdoc/reject-any-type
      /** @type {any} */
      let mockFs;

      beforeEach(() => {
        // eslint-disable-next-line jsdoc/reject-any-type
        mockFs = /** @type {any} */ ({
          ...fs,
          access: sinon.stub(),
        });
      });

      test("it should auto cleanup when its a tmp dir that does not exist and no option is passed in for `autoCleanUp`", async () => {
        mockFs.access.rejects();
        const mocks = createMockedSandbox(sinonSandbox, {
          autoCleanUp: true,
          fs: mockFs,
        });
        sandbox = mocks.sandbox;
        await sandbox.setup();

        assert.strictEqual(mocks.cleanUpRegistryRegisterStub.called, true);
      });
      test("it should auto cleanup when its a user-defined root dir that does not exist and { autoCleanUp: true } option is passed in", async () => {
        mockFs.access.rejects();
        const mocks = createMockedSandbox(sinonSandbox, {
          root: {
            path: "/manully/specified/path",
          },
          autoCleanUp: true,
          fs: mockFs,
        });
        sandbox = mocks.sandbox;
        await sandbox.setup();

        assert.strictEqual(mocks.cleanUpRegistryRegisterStub.called, true);
      });

      test("it should not auto clean up when { autoCleanUp: false } is passed in", async () => {
        mockFs.access.rejects();
        const mocks = createMockedSandbox(sinonSandbox, {
          autoCleanUp: false,
          fs: mockFs,
        });
        sandbox = mocks.sandbox;
        await sandbox.setup();

        assert.strictEqual(mocks.cleanUpRegistryRegisterStub.called, false);
      });

      test("it should throw if { autoCleanUp: true } option is passed in and the directory already exists", async () => {
        mockFs.access.resolves();
        const mocks = createMockedSandbox(sinonSandbox, {
          autoCleanUp: true,
          fs: mockFs,
          root: {
            allowExisting: true,
          },
        });
        sandbox = mocks.sandbox;

        assert.rejects(
          () => sandbox.setup(),
          new Error(
            "Refusing to setup `options.autoCleanUp`, option was passed in as true, but root path already existed for path:/mock-tmp/random-uuid.\nEither set `options.root.allowDestroyRoot` to true to allow it to be cleaned up, set autoCleanUp to false, use a different root, or delete the root directory so it can be created.",
          ),
        );

        assert.strictEqual(mocks.cleanUpRegistryRegisterStub.called, false);
      });
    });
  });

  describe("#rootPath", () => {
    test("#rootPath, generated automatically in temp directory", async () => {
      assert.strictEqual(sandbox.rootPath, mockTempRootPath);
    });

    test("#rootPath, passed in as an option", async () => {
      const { sandbox } = createMockedSandbox(sinonSandbox, {
        root: {
          path: "/manully/specified/path",
          allowExisting: false,
          allowDestroyRoot: false,
        },
      });

      await sandbox.setup();
      assert.strictEqual(sandbox.root.absolutePath, "/manully/specified/path");
    });
  });

  test("#root", async () => {
    assert.strictEqual(sandbox.root instanceof Dir, true);
    assert.strictEqual(sandbox.root.absolutePath, mockTempRootPath);
    assert.strictEqual(sandbox.root.parent, null);
    assert.strictEqual(sandbox.root.name, "");
  });

  describe("#options", () => {
    test("it throws if options are checked before setup is called", async () => {
      const { sandbox } = createMockedSandbox(sinonSandbox);
      assert.throws(() => sandbox.options, {
        message:
          "Ensure `setup` has been called before checking options. Some options are only settled after `setup` has been called.",
      });
    });

    describe("with unspecified root", () => {
      test("#options (defaults with unspecified root)", async () => {
        const expected = {
          autoCleanUp: true,
          fs,
          prettier: false,
          root: {
            path: "",
            allowExisting: false,
            allowDestroyRoot: true,
          },
        };

        for (const optionsKey in sandbox.options) {
          assert.deepEqual(
            // eslint-disable-next-line jsdoc/reject-any-type
            /** @type {any} */ (sandbox.options)[optionsKey],
            // eslint-disable-next-line jsdoc/reject-any-type
            /** @type {any} */ (expected)[optionsKey],
            `Checking ${optionsKey} key matches in options`,
          );
        }
      });

      test("#options (passed through)", async () => {
        const expected = {
          autoCleanUp: false,
          fs,
          prettier: false,
          root: {
            path: "",
            allowDestroyRoot: true,
            allowExisting: false,
          },
        };

        const options = {
          fs,
          prettier: expected.prettier,
          autoCleanUp: expected.autoCleanUp,
        };

        const { sandbox } = createMockedSandbox(sinonSandbox, options);
        await sandbox.setup();

        for (const optionsKey in sandbox.options) {
          assert.deepEqual(
            // eslint-disable-next-line jsdoc/reject-any-type
            /** @type {any} */ (sandbox.options)[optionsKey],
            // eslint-disable-next-line jsdoc/reject-any-type
            /** @type {any} */ (expected)[optionsKey],
          );
        }
      });
    });

    describe("with specified root", () => {
      const customRootPath = "/custom/root/path";

      beforeEach(async () => {
        const mockedSandboxArtifacts = createMockedSandbox(sinonSandbox, {
          root: {
            path: customRootPath,
            allowExisting: false,
            allowDestroyRoot: false,
          },
        });

        sandbox = mockedSandboxArtifacts.sandbox;
        await sandbox.setup();
      });

      test("#options (defaults)", async () => {
        const expected = {
          autoCleanUp: false,
          fs,
          prettier: false,
          root: {
            path: customRootPath,
            allowExisting: false,
            allowDestroyRoot: false,
          },
        };

        for (const optionsKey in sandbox.options) {
          assert.deepEqual(
            // eslint-disable-next-line jsdoc/reject-any-type
            /** @type {any} */ (sandbox.options)[optionsKey],
            // eslint-disable-next-line jsdoc/reject-any-type
            /** @type {any} */ (expected)[optionsKey],
            `Checking ${optionsKey} key matches in options`,
          );
        }
      });
    });
  });

  test("#file", async () => {
    const file = sandbox.file("hello-world.md");
    assert.strictEqual(file instanceof File, true);
    assert.strictEqual(file.name, "hello-world.md");
    assert.strictEqual(file.parent, sandbox.root);
  });

  test("#dir", async () => {
    const dir = sandbox.dir("hello-world");
    assert.strictEqual(dir instanceof Dir, true);
    assert.strictEqual(dir.name, "hello-world");
    assert.strictEqual(dir.parent, sandbox.root);
  });

  describe("#destroy", async () => {
    // eslint-disable-next-line jsdoc/reject-any-type
    /** @type {any} */
    let mockFs;

    beforeEach(() => {
      const accessStub = sinon.stub();
      accessStub.onFirstCall().rejects().onSecondCall().resolves();

      // eslint-disable-next-line jsdoc/reject-any-type
      mockFs = /** @type {any} */ ({
        ...fs,
        access: accessStub,
        rm: sinon.stub(),
      });
    });

    test("it works with the default tmp directory root path", async () => {
      const { sandbox, mockTempRootPath } = createMockedSandbox(sinonSandbox, {
        fs: mockFs,
      });
      await sandbox.setup();
      await sandbox.destroy();

      assert.strictEqual(mockFs.access.callCount, 2);
      assert.strictEqual(mockFs.access.firstCall.args[0], mockTempRootPath);
      assert.strictEqual(mockFs.access.secondCall.args[0], mockTempRootPath);

      assert.strictEqual(mockFs.rm.callCount, 1);
      assert.deepEqual(mockFs.rm.firstCall.args, [
        "/mock-tmp/random-uuid",
        { recursive: true },
      ]);
    });

    test("it works with a specified root path and `allowDestroyRoot` is true", async () => {
      const specifiedRootPath = "/some/root/path";
      const { sandbox } = createMockedSandbox(sinonSandbox, {
        fs: mockFs,
        root: {
          path: specifiedRootPath,
          allowDestroyRoot: true,
          allowExisting: false,
        },
      });
      await sandbox.setup();
      await sandbox.destroy();

      assert.strictEqual(mockFs.access.callCount, 2);
      assert.strictEqual(mockFs.access.firstCall.args[0], specifiedRootPath);
      assert.strictEqual(mockFs.access.secondCall.args[0], specifiedRootPath);

      assert.strictEqual(mockFs.rm.callCount, 1);
      assert.deepEqual(mockFs.rm.firstCall.args, [
        specifiedRootPath,
        { recursive: true },
      ]);
    });

    test("it throws with a specified root path and `allowDestroyRoot` is unset (defaults to false)", async () => {
      const { sandbox } = createMockedSandbox(sinonSandbox, {
        fs: mockFs,
        root: {
          path: "/some/root/path",
          allowExisting: false,
          allowDestroyRoot: false,
        },
      });
      await sandbox.setup();
      await assert.rejects(() => sandbox.destroy(), {
        message:
          "Refusing to destroy since `options.root.allowDestroyRoot` is not true. Pass in a true value to the `Sandbox` options",
      });
    });

    test("it throws with a specified root path and `allowDestroyRoot` is false", async () => {
      const { sandbox } = createMockedSandbox(sinonSandbox, {
        fs: mockFs,
        root: {
          path: "/some/root/path",
          allowDestroyRoot: false,
          allowExisting: false,
        },
      });
      await sandbox.setup();
      await assert.rejects(() => sandbox.destroy(), {
        message:
          "Refusing to destroy since `options.root.allowDestroyRoot` is not true. Pass in a true value to the `Sandbox` options",
      });
    });
  });
});
