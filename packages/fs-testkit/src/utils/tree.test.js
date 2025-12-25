import { describe, test } from "node:test";
import { treeString } from "./tree.js";
import assert from "node:assert";

describe("#treeString", () => {
  test("it can create a tree string of an empty root", () => {
    const result = treeString({});
    assert.strictEqual(result, ".");
  });

  test("it can create a tree string of a file", () => {
    const result = treeString({ hello: "" });
    assert.strictEqual(
      result,
      `
.
└── hello

      `.trim()
    );
  });

  test("it can create a tree string of a directory", () => {
    const result = treeString({ hello: {} });
    assert.strictEqual(
      result,
      `
.
└── hello

      `.trim()
    );
  });

  test("it can create a tree string of multiple files", () => {
    const result = treeString({ hello: "", meow: "", file: "" });
    assert.strictEqual(
      result,
      `
.
├── hello
├── meow
└── file

      `.trim()
    );
  });

  test("it can create a tree string of multiple dirs", () => {
    const result = treeString({ hello: {}, meow: {}, dir: {} });
    assert.strictEqual(
      result,
      `
.
├── hello
├── meow
└── dir

      `.trim()
    );
  });

  test("it can create a tree string of nested files and dirs", () => {
    const result = treeString({
      "empty dir": {},
      "dir with one file": { file: "" },
      "dir with many files": {
        "file one.md": "",
        "file two.txt": "",
        "file three.js": "",
      },
      "dir with dirs and files": {
        "workspace.json": "",
        "package.json": "",
        node_modules: {
          "left-pad": {},
          emberjs: {
            "package.json": "",
            app: {
              components: {
                "hello-world.js": "",
              },
            },
            config: {
              "enviroment.js": "",
            },
          },
        },
      },
      "last-file.js": "",
    });

    assert.strictEqual(
      result,
      `

.
├── empty dir
├── dir with one file
│   └── file
├── dir with many files
│   ├── file one.md
│   ├── file two.txt
│   └── file three.js
├── dir with dirs and files
│   ├── workspace.json
│   ├── package.json
│   └── node_modules
│       ├── left-pad
│       └── emberjs
│           ├── package.json
│           ├── app
│           │   └── components
│           │       └── hello-world.js
│           └── config
│               └── enviroment.js
└── last-file.js

            `.trim()
    );
  });

  test("it supports labels when the option is passed in", () => {
    const result = treeString(
      {
        folder: {
          fileOne: "",
          fileTwo: "",
          subFolder: {
            fileThree: "",
          },
        },
        fileA: "",
        fileB: "",
        anotherFolder: {
          fileOne: "",
        },
      },
      { labels: true }
    );

    assert.strictEqual(
      result,
      `
.
├── folder (Dir)
│   ├── fileOne (File)
│   ├── fileTwo (File)
│   └── subFolder (Dir)
│       └── fileThree (File)
├── fileA (File)
├── fileB (File)
└── anotherFolder (Dir)
    └── fileOne (File)

    `.trim()
    );
  });
});
