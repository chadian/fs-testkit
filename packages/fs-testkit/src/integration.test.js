import { createSandbox } from "./index.js";
import { describe, test } from "node:test";
import assert from "node:assert";
import { tmpdir } from "node:os";
import { Dir } from "./dir.js";
import { File } from "./file.js";
import { resolve } from "node:path";
import * as prettier from "prettier";
import { Buffer } from "node:buffer";

const sampleJsonString = {
  ugly: `{ invalid_json:
    'key has no quotes, this is using single quotes, and is awkwardly split between lines... but all this will be fixed by prettier'}`,
  pretty: `
{
"invalid_json": "key has no quotes, this is using single quotes, and is awkwardly split between lines... but all this will be fixed by prettier"
}
`.trim(),
};

describe("Initialization", () => {
  test("a Sandbox instance can be created", () => {
    assert.doesNotReject(() => createSandbox());
  });

  test("#createSandbox creates the its own sandbox directory at #rootPath", async () => {
    const sandbox = await createSandbox();
    await assert.doesNotReject(() =>
      sandbox.options.fs.access(resolve(sandbox.rootPath)),
    );
  });
});

describe("Path handling", () => {
  test("#rootPath and #root.absolutePath are the same thing", async () => {
    const sandbox = await createSandbox();
    assert.strictEqual(sandbox.rootPath, sandbox.root.absolutePath);
  });

  test("#root.path is an empty string (relative to the root)", async () => {
    const sandbox = await createSandbox();
    assert.strictEqual(sandbox.root.path, "");
  });

  test("the Sandbox instance contains has a tmp directory path in its root", async () => {
    const sandbox = await createSandbox();
    assert.strictEqual(sandbox.rootPath.includes(tmpdir()), true);
    assert.strictEqual(sandbox.root.absolutePath.includes(tmpdir()), true);
  });

  test("it can create a root directory", async () => {
    const directory = (await createSandbox()).dir("dir");
    assert.strictEqual(directory instanceof Dir, true);
    assert.strictEqual(directory.name, "dir");
    assert.strictEqual(directory.path, "dir");
  });

  test("it can create a root file", async () => {
    const file = (await createSandbox()).file("hello-world.md");
    assert.strictEqual(file instanceof File, true);
    assert.strictEqual(file.name, "hello-world.md");
    assert.strictEqual(file.path, "hello-world.md");
  });

  test("it can create a chain of directories", async () => {
    const sandbox = await createSandbox();
    const directory = sandbox.dir("dir");
    const subDirectory = directory.dir("subDir");

    assert.strictEqual(subDirectory instanceof Dir, true);
    assert.strictEqual(subDirectory.name, "subDir");
    assert.strictEqual(subDirectory.path, "dir/subDir");
    assert.strictEqual(subDirectory.path, "dir/subDir");
    assert.strictEqual(subDirectory.parent, directory);

    assert.strictEqual(directory instanceof Dir, true);
    assert.strictEqual(directory.name, "dir");
    assert.strictEqual(directory.path, "dir");

    assert.strictEqual(directory.parent, sandbox.root);
  });

  test("it can create files within non-root directories", async () => {
    const sandbox = await createSandbox();
    const file = sandbox.dir("my-folder").file("meow.md");
    assert.strictEqual(file.name, "meow.md");
    assert.strictEqual(file.path, "my-folder/meow.md");
    assert.strictEqual(file.parent.name, "my-folder");
  });

  describe("#at", () => {
    test("#at file nested from root", async () => {
      const sandbox = await createSandbox();
      const file = sandbox.at("hello-world/meow.md");
      assert.strictEqual(file instanceof File, true);
      assert.strictEqual(file.path, "hello-world/meow.md");
    });

    test("#at file directly from root", async () => {
      const sandbox = await createSandbox();
      const file = sandbox.at("hello-world.md");
      assert.strictEqual(file instanceof File, true);
      assert.strictEqual(file.path, "hello-world.md");
    });

    test("#at dir nested from root", async () => {
      const sandbox = await createSandbox();
      const dir = sandbox.at("hello-world/meow");
      assert.strictEqual(dir instanceof Dir, true);
      assert.strictEqual(dir.path, "hello-world/meow");
    });

    test("#at dir directly from root", async () => {
      const sandbox = await createSandbox();
      const dir = sandbox.at("hello-world");
      assert.strictEqual(dir instanceof Dir, true);
      assert.strictEqual(dir.path, "hello-world");
    });

    test("#at forcing directory by second argument ", async () => {
      const sandbox = await createSandbox();
      const dir = sandbox.at("meow/hello-world.md", "Dir");
      assert.strictEqual(dir instanceof Dir, true);
      assert.strictEqual(dir.path, "meow/hello-world.md");
    });

    test("#at forcing file by second argument ", async () => {
      const sandbox = await createSandbox();
      const file = sandbox.at("meow/hello-world", "File");
      assert.strictEqual(file instanceof File, true);
      assert.strictEqual(file.path, "meow/hello-world");
    });
  });
});

describe("Dirs", () => {
  test("#create", async () => {
    const sandbox = await createSandbox();
    const directory = sandbox.dir("hello-world");
    await directory.create();

    await assert.doesNotReject(() =>
      sandbox.options.fs.access(resolve(sandbox.rootPath, "hello-world")),
    );
  });

  test("#create works recursively", async () => {
    const sandbox = await createSandbox();
    await sandbox.dir("parent").dir("child").create();

    await assert.doesNotReject(() =>
      sandbox.options.fs.access(resolve(sandbox.rootPath, "parent", "child")),
    );
  });

  test("#tree", async () => {
    const sandbox = await createSandbox();
    const childDir = sandbox.dir("parent").dir("child");
    await childDir.create();
    await childDir.file("hello-world").create(`Hello World!`);

    const tree = await sandbox.root.tree({
      blobFileMask: "hash",
      textFileMask: "hash",
    });

    assert.deepStrictEqual(tree, {
      parent: {
        child: { "hello-world": "c57eff55ebc0c54973903af5f72bac72762cf4f4" },
      },
    });
  });

  test("#rename", async () => {
    const sandbox = await createSandbox();
    const childDir = sandbox.dir("directory");
    await childDir.create();
    assert.strictEqual(await sandbox.root.treeString(), ".\n└── directory");
    await childDir.rename("renamed-directory");
    assert.strictEqual(
      await sandbox.root.treeString(),
      ".\n└── renamed-directory",
    );
  });

  test("#move", async () => {
    const sandbox = await createSandbox();
    await sandbox.scaffold({
      "parent-dir": {},
      "dir-to-move": {},
    });

    assert.strictEqual(
      await sandbox.root.treeString(),
      `
.
├── dir-to-move
└── parent-dir`.trim(),
    );

    await sandbox.root.dir("dir-to-move").move(sandbox.root.dir("parent-dir"));
    assert.strictEqual(
      await sandbox.root.treeString(),
      `
.
└── parent-dir
    └── dir-to-move`.trim(),
    );
  });

  test("#diff", async () => {
    const sandbox = await createSandbox();
    const snapshotA = await sandbox.snapshot.create("snapshot-a");

    await sandbox.scaffold({
      "some-dir": {
        "readme.md": `Hello world`,
        directory: {},
      },
    });

    const snapshotB = await sandbox.snapshot.create("snapshot-b");

    assert.deepEqual(await sandbox.root.diff(snapshotA, snapshotB), [
      {
        path: "some-dir",
        type: "add",
      },
      {
        path: "some-dir/directory",
        type: "add",
      },
      {
        path: "some-dir/readme.md",
        type: "add",
      },
    ]);

    await sandbox.dir("some-dir").file("changelog.md").create(`changelog!`);
    const snapshotC = await sandbox.snapshot.create("snapshot-c");

    assert.deepEqual(await sandbox.root.diff(snapshotB, snapshotC), [
      {
        path: "some-dir",
        type: "modify",
      },
      {
        path: "some-dir/changelog.md",
        type: "add",
      },
      {
        path: "some-dir/directory",
        type: "equal",
      },
      {
        path: "some-dir/readme.md",
        type: "equal",
      },
    ]);

    await sandbox.dir("some-dir").delete({ recursive: true });
    const snapshotD = await sandbox.snapshot.create("snapshot-d");

    assert.deepEqual(await sandbox.root.diff(snapshotC, snapshotD), [
      {
        path: "some-dir",
        type: "remove",
      },
      {
        path: "some-dir/changelog.md",
        type: "remove",
      },
      {
        path: "some-dir/directory",
        type: "remove",
      },
      {
        path: "some-dir/readme.md",
        type: "remove",
      },
    ]);
  });

  test("#copy (dir, contents only)", async () => {
    const sandbox = await createSandbox();

    const dirA = sandbox.root.dir("dirA");
    await dirA.create();
    await dirA.file("README.md").create(``);
    const dirB = sandbox.root.dir("dirB");
    await dirB.create();
    assert.strictEqual(
      await sandbox.root.treeString(),
      `
.
├── dirA
│   └── README.md
└── dirB
`.trim(),
    );

    await dirA.copyTo(dirB, { contentsOnly: true });
    assert.strictEqual(
      await sandbox.root.treeString(),
      `
.
├── dirA
│   └── README.md
└── dirB
    └── README.md
`.trim(),
    );
  });
});

describe("Files", async () => {
  test("#create with a nested file", async () => {
    const sandbox = await createSandbox();

    await sandbox
      .dir("parent")
      .dir("child")
      .file("hello-world")
      .create("This is the contents of the file!");

    const fileContents = (
      await sandbox.options.fs.readFile(
        resolve(sandbox.rootPath, "parent", "child", "hello-world"),
      )
    ).toString();

    assert.strictEqual(fileContents, "This is the contents of the file!");
  });

  describe("prettier", () => {
    test("#create with string uses prettier default", async () => {
      const sandbox = await createSandbox();
      await sandbox.file("some.json").create(sampleJsonString.ugly);

      const result = (
        await sandbox.options.fs.readFile(
          resolve(sandbox.rootPath, "some.json"),
        )
      ).toString();
      assert.notStrictEqual(result.trim(), sampleJsonString.pretty.trim());
      assert.strictEqual(result.trim(), sampleJsonString.ugly.trim());
    });

    test("#create with string does not use default when sandbox is created with { prettier: true }", async () => {
      const sandbox = await createSandbox({ prettier: true });
      await sandbox.file("some.json").create(sampleJsonString.ugly);
      const result = (
        await sandbox.options.fs.readFile(
          resolve(sandbox.rootPath, "some.json"),
        )
      ).toString();
      assert.strict(result.trim(), sampleJsonString.pretty.trim());
    });

    test("#create with string can override prettier default when { prettier: false } is passed as an argument", async () => {
      const sandbox = await createSandbox({ prettier: true });
      await sandbox
        .file("some.json")
        .create(sampleJsonString.ugly, { prettier: false });

      const result = (
        await sandbox.options.fs.readFile(
          resolve(sandbox.rootPath, "some.json"),
        )
      ).toString();

      assert.notStrictEqual(result, sampleJsonString.pretty);
      assert.strictEqual(result.trim(), sampleJsonString.ugly.trim());
    });
  });

  describe("#diffText", () => {
    test("it can generate a patch difference", async () => {
      const sandbox = await createSandbox({ prettier: true });

      const helloWorld = await sandbox
        .dir("parent")
        .dir("child")
        .file("hello-world.json");

      await helloWorld.create(
        JSON.stringify(
          {
            hello: "world",
            hola: "mundo",
            hallo: "welt",
          },
          null,
          2,
        ),
      );
      await sandbox.snapshot.create("first");

      await helloWorld.create(
        JSON.stringify(
          {
            hello: "world",
            hola: "mundo",
            bonjour: "le monde",
            hallo: "welt",
          },
          null,
          2,
        ),
      );
      await sandbox.snapshot.create("second");

      const patch = await helloWorld.diffText(
        "first",
        "second",
        "patch-string",
      );
      assert.strictEqual(
        patch?.trim(),
        `
Index: parent/child/hello-world.json
===================================================================
--- parent/child/hello-world.json
+++ parent/child/hello-world.json
@@ -1,5 +1,6 @@
 {
   "hello": "world",
   "hola": "mundo",
+  "bonjour": "le monde",
   "hallo": "welt"
 }
`.trim(),
      );
    });

    test("it can generate a diff-object difference", async () => {
      const sandbox = await createSandbox({ prettier: true });

      const helloWorld = await sandbox
        .dir("parent")
        .dir("child")
        .file("hello-world.json");

      await helloWorld.create(
        JSON.stringify(
          {
            hello: "world",
            hola: "mundo",
            hallo: "welt",
          },
          null,
          2,
        ),
      );
      await sandbox.snapshot.create("first");

      await helloWorld.create(
        JSON.stringify(
          {
            hello: "world",
            hola: "mundo",
            bonjour: "le monde",
            hallo: "welt",
          },
          null,
          2,
        ),
      );
      await sandbox.snapshot.create("second");

      const diff = await helloWorld.diffText("first", "second", "diff-object");
      assert.deepEqual(diff, [
        {
          type: "equal",
          value: '{\n  "hello": "world",\n  "hola": "mundo",\n',
        },
        {
          type: "add",
          value: '  "bonjour": "le monde",\n',
        },
        {
          type: "equal",
          value: '  "hallo": "welt"\n}\n',
        },
      ]);
    });
  });

  describe("#diffBlob", () => {
    test("it can generate a diff on files treated as blobs", async () => {
      const sandbox = await createSandbox({ prettier: true });

      const helloWorld = await sandbox
        .dir("parent")
        .dir("child")
        .file("hello-world.json");

      await helloWorld.create(
        JSON.stringify(
          {
            hello: "world",
            hola: "mundo",
            hallo: "welt",
          },
          null,
          2,
        ),
      );
      await sandbox.snapshot.create("first");

      await helloWorld.create(
        JSON.stringify(
          {
            hello: "world",
            hola: "mundo",
            bonjour: "le monde",
            hallo: "welt",
          },
          null,
          2,
        ),
      );
      await sandbox.snapshot.create("second");

      const diff = await helloWorld.diffBlob("first", "second");
      assert.deepEqual(diff, {
        path: "parent/child/hello-world.json",
        type: "modify",
      });
    });
  });
});

describe("Snapshots", async () => {
  test("Creating snapshots", async () => {
    const sandbox = await createSandbox();
    await sandbox.dir("hello-world").file("meow.md").create(``);
    await sandbox.dir("hello-world").file("delete-me.md").create(``);
    await sandbox.snapshot.create("initial");

    await sandbox.dir("hello-world").file("delete-me.md").delete();
    await sandbox.dir("hello-world").file("another.md").create(``);
    await sandbox.snapshot.create("with-another");

    await assert.doesNotReject(() =>
      sandbox.options.fs.access(
        resolve(sandbox.rootPath, "hello-world", "meow.md"),
      ),
    );

    await assert.doesNotReject(() =>
      sandbox.options.fs.access(
        resolve(sandbox.rootPath, "hello-world", "another.md"),
      ),
    );

    await sandbox.snapshot.restore("initial");

    await assert.doesNotReject(() =>
      sandbox.options.fs.access(
        resolve(sandbox.rootPath, "hello-world", "meow.md"),
      ),
    );

    // REJECTS! `another.md` does not exist on snapshot @ "initial"
    await assert.rejects(() =>
      sandbox.options.fs.access(
        resolve(sandbox.rootPath, "hello-world", "another.md"),
      ),
    );

    await sandbox.snapshot.restore("with-another");

    await assert.doesNotReject(() =>
      sandbox.options.fs.access(
        resolve(sandbox.rootPath, "hello-world", "meow.md"),
      ),
    );

    // Does not reject! `another.md` is restored from snapshot @ "with-another"
    await assert.doesNotReject(() =>
      sandbox.options.fs.access(
        resolve(sandbox.rootPath, "hello-world", "another.md"),
      ),
    );
  });

  test("Diffs changes to files and folders across snapshots", async () => {
    const sandbox = await createSandbox();
    await sandbox.dir("hello-world").file("meow.md").create(``);
    await sandbox.dir("hello-world").file("delete-me.md").create(``);
    await sandbox.snapshot.create("initial");

    await sandbox.dir("hello-world").file("delete-me.md").delete();
    await sandbox.dir("hello-world").file("another.md").create(``);
    await sandbox.snapshot.create("with-another");

    const diff = await sandbox.snapshot.diff("initial", "with-another");
    assert.deepEqual(diff, [
      { path: "hello-world/another.md", type: "add" },
      { path: "hello-world/delete-me.md", type: "remove" },
      { path: "hello-world/meow.md", type: "equal" },
    ]);
  });
});

describe("Scaffolding", () => {
  test("#scaffold", async () => {
    const sandbox = await createSandbox();
    await sandbox.scaffold({
      rootEmptyFile: ``,
      emptyRootDir: {},
      bufferFile: Buffer.from(`hello buffer text`),

      ["markdown_file.md"]: `
# The headling
A paragraph of marakdown content, cool!
      `.trim(),
      rootDir: {
        ["uglyJson.json"]: [sampleJsonString.ugly, { prettier: false }],
        ["prettyJsonByDefault.json"]: sampleJsonString.ugly,
        ["prettyJsonByArgs.json"]: [sampleJsonString.ugly, { prettier: true }],
        emptyNestedFolder: {},
      },
    });

    const expectedDirs = {
      rootDir: "rootDir",
      emptyRootDir: "emptyRootDir",
      emptyNestedFolder: "rootDir/emptyNestedFolder",
    };

    const expectedFiles = {
      empty: "rootEmptyFile",
      buffer: "bufferFile",
      rootMarkdown: "markdown_file.md",
      nestedUglyJson: "rootDir/uglyJson.json",
      nestedPrettyJsonDefault: "rootDir/prettyJsonByDefault.json",
      nestedPrettyJsonArgs: "rootDir/prettyJsonByArgs.json",
    };

    // assert all expected files and folders exist
    for (const fileOrFolder of Object.values({
      ...expectedDirs,
      ...expectedFiles,
    })) {
      await assert.doesNotReject(() =>
        sandbox.options.fs.access(resolve(sandbox.rootPath, fileOrFolder)),
      );
    }

    // assert all expected files are actual files
    for (const file of Object.values(expectedFiles)) {
      assert.strictEqual(
        (
          await sandbox.options.fs.stat(resolve(sandbox.rootPath, file))
        ).isFile(),
        true,
      );
    }

    // assert all expected dirs are actual dirs
    for (const file of Object.values(expectedDirs)) {
      assert.strictEqual(
        (
          await sandbox.options.fs.stat(resolve(sandbox.rootPath, file))
        ).isDirectory(),
        true,
      );
    }

    // check buffer file
    const fileFromBuffer = (
      await sandbox.options.fs.readFile(
        resolve(sandbox.rootPath, expectedFiles.buffer),
      )
    ).toString();
    assert.strictEqual(fileFromBuffer, `hello buffer text`);

    // assert `File#create` args by checking `prettier` application
    const uglyJsonFileContents = (
      await sandbox.options.fs.readFile(
        resolve(sandbox.rootPath, expectedFiles.nestedUglyJson),
      )
    ).toString();
    assert.strictEqual(uglyJsonFileContents, sampleJsonString.ugly);

    const prettyJson = await prettier.format(sampleJsonString.ugly, {
      parser: "json",
    });
    assert.notStrictEqual(
      prettyJson,
      sampleJsonString.ugly,
      "pretty json and ugly json are not the same",
    );

    const prettyJsonByArgsContents = (
      await sandbox.options.fs.readFile(
        resolve(sandbox.rootPath, expectedFiles.nestedPrettyJsonArgs),
      )
    ).toString();
    assert.strictEqual(prettyJsonByArgsContents, prettyJson);

    const prettyJsonByDefaultContents = (
      await sandbox.options.fs.readFile(
        resolve(sandbox.rootPath, expectedFiles.nestedPrettyJsonDefault),
      )
    ).toString();
    assert.strictEqual(prettyJsonByDefaultContents, sampleJsonString.ugly);
  });
});
