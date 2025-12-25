# fs-testkit

`fs-testkit` provides testing utilities to write better tests that use the file
system

Features:

- A simple API to quickly scaffold the file system with files and directories,
  handle pathing, and run filesystem operations
- Use snapshots to capture the state of the filesytem and then restore to those
  existing state, or perform a diff between different states
- Extract information in readable formats from the filesystem that make it
  clearer to read and write tests
- Includes typescript types
- Testing library integrations with custom assertions (in development for
  vitest, jest, and chai)

## Installation

The package is published to npm as `fs-testkit`, it can be installed with:

```shell
# pnpm
pnpm add --save-dev fs-testkit

# yarn
yarn add --dev fs-testkit

# npm
npm install --save-dev fs-testkit
```

## Getting Started

Using `fs-testkit` starts with a [`Sandbox`](#sandbox) instance. A sandbox is
tied to an underlying root directory on the filesystem. All of the functionality
and features of this library are avaliable from this sandbox instance.

```js
import { createSandbox } from "fs-testkit";

const sandbox = await createSandbox();
```

Continue with the following [Example](#example) that walks through some of the
available features or [read more](#sandbox) about what can be done with this
`Sandbox` instance.

## Example

Creating a sandbox can be done with the async function
[`createSandbox`](#creating-a-sandbox). The following example enables the
prettier option so that supported files are automatically prettier'd, this can
help when reviewing output from strings that might have been formatted oddly in
an editor. This example also does not specify a root directory so one will be
automatically created in the operating system's default temp directory.

```js
import { createSandbox } from "fs-testkit";

const sandbox = await createSandbox({ prettier: true });
```

Scaffolding an entire nested file tree can be done quickly using
`Sandbox.scaffold`:

```js
await sandbox.scaffold({
  // this is invalid json but it will prettier'd into valid json
  // because the prettier option is enabled
  "package.json": `
    {
      name: "hello-world",
      dependencies: {},
      devDependencies: {}
    }
  `,

  "README.md": `
    # The hello-world package
    This represents a test package
  `,

  // this structure will create a `src/index.js` file
  src: {
    "index.js": `
      import { writeFile } from "fs/promises";

      export default function async helloWorld() {
        console.log("hello world!");
        await writeFile("hello-world.txt", "hello world!");
      }
    `,
  },
});
```

When looking at the root directory, or any directory, it can be useful to see
the layout quickly and clearly, or even use the string to assert against in a
test:

```js
console.log(await sandbox.root.treeString());
```

The `Dir.treeString` output from above would log:

```
.
├── src
│   └── index.js
├── README.md
└── package.json
```

Often tests involving the filesystem compare before and after, or even multiple
states. `fs-testkit` provides snaphshots for this:

```js
await sandbox.snapshot.create("before-change");

// some action that creates a difference on the filesystem,
// in tests this could be a codemod, a file generator, or some script
await sandbox.file("CHANGELOG.md").write(`
# v1.0.0
* Initial Release!
`);

await sandbox.snapshot.create("after-change");
const diffs = await sandbox.root.diff("before-change", "after-change");

console.log(diffs);
```

The `Dir.diff` output logged would be:

```js
[{ path: "CHANGELOG.md", type: "add" }];
```

## `Sandbox`

### Creating a `Sandbox`

The preferred method of creating a sandbox is using the
[`createSandbox`](/fs-testkit/-api/index.Function.createSandbox) function
exported from the package:

```js
import { createSandbox } from "fs-testkit";
await createSandbox({
  /* options */
});
```

While the async `createSandbox` is preferred, a `Sandbox` instance can be also
created synchronously, but the async `setup` still needs to be called before
using any async methods, see:
[Sync Instantiation / Async Setup](#sync-instantiation--async-setup).

The options for creating a sandbox include:

```
{
    prettier?: boolean,
    autoCleanUp?: boolean,
    root?: {
      path?: string,
      allowExisting?: boolean,
      allowDestroyRoot?: boolean
    }
}
```

- `prettier` (default: `false`) - sets up the default option for prettier when
  creating files for supported file types.

- `autoCleanUp` - This defaults to `true` when a `root.path` is **not**
  specified. If a `root.path` is specified then `autoCleanUp` must be explicitly
  set to `true` **and** `root.allowDestroyRoot` must be also set to `true` in
  order for the sandbox root to be automatically cleaned up. See
  [Cleaning Up a Sandbox](#cleaning-up-a-sandbox) for more information.

- `root.path` - specifies the directory to be used for the root directory of the
  sandbox. If this is not passed in then a directory is automatically created in
  the operating system's temp directory. This value can be retrieved later from
  `sandbox.rootPath`.

- `root.allowExisting` - If the root directory specified by the `root.path`
  option already exists and should be used this must be set to `true` in order
  to use it as the sandbox root.

- `root.allowDestroyRoot` - This defaults to `true` if `root.path` is
  unspecified. If `root.path` is specified then the `root.allowDestroyRoot`
  option must be set to `true` in order for auto cleanup or to use `destroy`
  method. See [Cleaning Up a Sandbox](#cleaning-up-a-sandbox) for more
  information.

### The `root` Directory

The sandbox root directory is represented by a [`Dir` instance](#dir) at
`Sandbox.root`. This is often the starting point for pathing and filesystem
operations.

```js
await sandbox.root.at("src/index.js").create(`
  export default function helloWorld() {
    console.log("Hello World!");
  }
`);
```

### Pathing

While the `Sandbox.root` has all available [`Dir`](#dir) methods, there are a
few methods that are available on the `Sandbox` instance directly as shortcuts:

```js
// using the root directory's `at` method for relative paths (same as `Sandbox.root.at`)
const relative = sandbox.at("relative/path/to/src");

// reference a child directory of the root directory (same as `Sandbox.root.dir`)
const dir = sandbox.dir("src");

// reference a file of the root directory  (same as `Sandbox.root.file`)
const file = sandbox.file("README.md");
```

For more pathing options available on `sandbox.root`, see the `Dir`
[pathing documentation](#pathing-1).

### Scaffolding

The `Sandbox.scaffold` method is a shortcut for the `Sandbox.root.scaffold`. The
[`scaffold`](/fs-testkit/-api/sandbox.Class.Sandbox#scaffold) method makes it
quick to set up the sandbox's filesystem without the hassle of using multiple
filesystem APIs. See the [scaffolding documentation for `Dir`](#scaffolding-1)
for more information.

### Sync Instantiation / Async Setup

A `Sandbox` instance can be created synchronously, and then set up
asynchronously. Calling the
[`setup`](/fs-testkit/-api/sandbox.Class.Sandbox#setup) method is required
before anything any filesytem operations can be ran.

```js
import { Sandbox } from "fs-testkit/sandbox";

// accepts same options as `createSandbox`
const sandbox = new Sandbox({
  /* options */
});
await sandbox.setup();
```

### Cleaning Up a `Sandbox`

Manual cleanup of a sandbox root directory can be done by calling
[`destroy`](/fs-testkit/-api/sandbox.Class.Sandbox#destroy):

```js
await sandbox.destroy();
```

Automatic cleanup is the default when the `Sandbox` is created without a
specified root path, in which a temp directory is automatically created.
However, the `autoCleanUp` option can be specified to allow cleaning up a
directory when a root path is specified:

```js
const sandbox = await createSandbox({ autoCleanUp: true });
```

In the case the root path already exists you have to also provide permission to
acknowledge that it will be cleaned up by passing in the option
`root.allowDestroyRoot`:

```js
const sandbox = await createSandbox({
  autoCleanUp: true,
  root: {
    path: "/some/path",
    allowDestroyRoot: true,
  },
});
```

Under the hood automatic cleanup works by performing two passes:

1. By using a
   [`FinalizationRegistry`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry),
   when the `Sandbox` instance is garbage collected on supporting runtimes the
   root directory is also deleted from the filesystem. This aims to keep the
   sandbox root directory lifespan in sync with the corresponding `Sandbox`
   instance.
2. If the `Sandbox` instance is held on to for some reason and is never garabge
   collected then the clean up happens when the
   [`beforeExit`](https://nodejs.org/fs-testkit/-api/process.html#event-beforeexit)
   event is fired.

## `Dir`

The `Dir` instance represents a reference to a location within the sandbox root.
Creating an instance does not mean that it exists on the fileystem, it's only a
reference, although `Dir` does have
[methods for managing filesystem operations](#dir-filesystem-operations).

See the [API documentation](/fs-testkit/-api/dir.Class.Dir) for the full
capabilities of `Dir`.

### Pathing

A `Dir` instance has some immutable properties that reflect its position in the
filesystem:

```js
// The directory's name
const dirName = dir.name;

// The directory's path relative to the sandbox root
const relativePath = dir.path;

// The directory's absolute path
const absolutePath = dir.absolutePath;
```

The directory's parent can be referenced by its `parent` property which is also
a `Dir`, this property is `null` if the directory is the sandbox root:

```js
const parent = dir.parent;
```

One of the advantages of a `Dir` is that it makes it easy to traverse a file
tree in a chainable fashion where the pathing can return a `Dir` or `File`:

```js
// pathing chains through multiple instances of `Dir`
const file = dir.dir("packages").dir("core").file("package.json");

// similar to the example above but uses `at`
const relativePathing = dir.at("packages/core/package.json");
```

Note: the `Dir.at` method assumes that something is a `Dir` or ` File` based on
the ending having an extension or not, this can be controlled by specifying if
it should be a `"File"` or `"Dir"`:

```js
const directoryWithPeriod = dir.at("packages/core/testing.files", "Dir");
const fileWithNoExtension = dir.at("packages/core/Makefile", "File");
```

At any point saving a reference to a `Dir` instance preserves its immutable
reference within the filesystem structure. The `Dir` and `File` instances can be
flexibly chained:

```js
const packages = dir.dir("packages");
const packageA = packages.dir("package-A");
const packageB = packages.dir("package-B");

const distDirFromA = packageA.at("dist");
const indexRouteFromB = packageB.at("src/routes/index.js");
```

Traversing up can be done with `Dir.parent` or `".."` used within `Dir.at`:

```js
const packagesDir = dir.dir("packages");
const rootPackageJson = dirPackages.parent.file("package.json");
const altRootPackageJson = dirPackages.at("../package.json");
```

### Scaffolding

One tedious task when dealing with the filesystem is reading and creating the
structure of the filesystem. This is clearer when representing directories as
objects with the keys represent the names of its files or directories, with
files having values of either strings or buffers, for example:

```js
{
  ['file.js']: `console.log("hello world");`,
  subdir: {
    ['data']: Buffer.from("data data data")
  }
}
```

This object structure can be returned from
[`Dir.tree`](/fs-testkit/-api/dir.Class.Dir#tree) or passed to
[`Dir.scaffold`](/fs-testkit/-api/dir.Class.Dir#scaffold) to create its contents
on the filesystem.

The `Dir.scaffold` method can create nested directories and files:

```js
await dir.scaffold({
  // create a README.md file in the sandbox root directory
  ["README.md"]: `# README`,

  // directories are objects whose keys are the names of other dirs or files,
  // this directory would be a directory named `src`
  src: {
    ["sub directory"]: {},
    ["hello.js"]: `console.log('hello world');`,
  },
});
```

It also supports creating files from buffers:

```js
await dir.scaffold({
  // files can be represented by buffer data
  ["file buffer"]: Buffer.from("data data data"),
});
```

When using `scaffold` to specify the same options provided by
[`File.create`](/fs-testkit/-api/file.Class.File#create) specify the file in an
array tuple form:

```js
await dir.scaffold({
  ["CHANGELOG.md"]: [
    // first argument represents the file contents, string or buffer
    `v1.0.0 Big Release!`,
    // second argument represents the options passed into `File.create`
    { prettier: true, overwrite: true },
  ],
});
```

### Filesystem Structure

An object representing the directory structure can also be returned from
[`Dir.tree`](/fs-testkit/-api/dir.Class.Dir#tree):

```js
console.log(await dir.tree());
```

Would log:

```js
{
  src: { 'hello.js': 'hello.js' },
  'README.md': 'README.md',
  data: 'data',
  'package.json': 'package.json'
}
```

But also different masks can be passed in for the files that are text-based or
blobs:

```js
console.log(
  await sandbox.root.tree({
    textFileMask: "file-contents",
    blobFileMask: "hash",
  }),
);
```

Which would now log:

```js
{
  src: { 'hello.js': "console.log('hello!');" },
  'README.md': '# Hello!',
  'package.json': '{ name: "hello", dependencies: {} }',
  data: 'e1e849238bcf2b794f63e13c0ed1604aac455455'
}
```

Instead of an object, the filesystem can also be visualized as a tree string
with [`Dir.treeString`](/fs-testkit/-api/dir.Class.Dir#treestring).
`console.log(await dir.treeString())` would log:

```
.
├── src
│   └── hello.js
├── README.md
├── package.json
└── data
```

### `Dir` Properties

`Dir` instances have the following properties:

- [`absolutePath`](/fs-testkit/-api/dir.Class.Dir#absolutepath)
- [`name`](/fs-testkit/-api/dir.Class.Dir#name)
- [`parent`](/fs-testkit/-api/dir.Class.Dir#parent)
- [`path`](/fs-testkit/-api/dir.Class.Dir#path)

See the [`Dir` API documentation](api/dir.Class.Dir) for more.

### `Dir` Filesystem Operations

`Dir` instances support the following filesystem operations:

[`read`](/fs-testkit/-api/dir.Class.Dir#read))

- [`contents`](/fs-testkit/-api/dir.Class.Dir#contents) (alias
- [`create`](/fs-testkit/-api/dir.Class.Dir#create)
- [`delete`](/fs-testkit/-api/dir.Class.Dir#delete)
- [`exists`](/fs-testkit/-api/dir.Class.Dir#create)
- [`hash`](/fs-testkit/-api/dir.Class.Dir#hash)
- [`move`](/fs-testkit/-api/dir.Class.Dir#move)
- [`rename`](/fs-testkit/-api/dir.Class.Dir#rename)
- [`scaffold`](/fs-testkit/-api/dir.Class.Dir#scaffold)

See the [`Dir` API documentation](api/dir.Class.Dir) for the full set of methods
available.

### Diffing

`Dir` can be diffed using snapshots. See:
[Diffing Dir with Snapshots](#diffing-dir-with-snapshots)

## `File`

The `File` instance represents a reference to location of a file within the
sandbox directory. The existence of the instance does not mean the file actually
exists, but that can be determined by using its
[filesystem operations](#file-filesystem-operations).

See the [API documentation](/fs-testkit/-api/file.Class.File) for the full
capabilities of `File`.

### Creating (or updating) a file on the filesystem

One of the most common filesystem operation with a `Files` instance is to create
a file. This can be done with the `write` method (or its alias `create`). If the
file is being updated/replaced then the `{ overwrite: true }` option must be
passed. The global prettier option can be overridden on a case-by-case basis by
passing in the `{ prettier }` option.

```js
await dir.file("hello-world.md").write(
  `
  # Hello World
  ## Hello
  ## World
  `,
  { prettier: true, overwrite: true },
);
```

With supporting file types the prettier option can be useful to preserve
indentation in the editor but have the final output look pretty on the
filesystem.

See the [other fileystem operations](#file-filesystem-operations) available on
`File`.

### Diffing

A `File` instance can be diffed across different snapshots. This can be handy to
get individual differences within a text file or check if a blob is the same,
new, removed or modified, see:
[Diffing File with Snapshots](#diffing-file-with-snapshots).

### `File` Properties

The following properties exist on instances of `File`:

- [`absolutePath`](/fs-testkit/-api/file.Class.File#absolutePath)
- [`extension`](/fs-testkit/-api/file.Class.File#extension)
- [`name`](/fs-testkit/-api/file.Class.File#name)
- [`parent`](/fs-testkit/-api/file.Class.File#parent)
- [`path`](/fs-testkit/-api/file.Class.File#path)

See the [API documentation](/fs-testkit/-api/file.Class.File) for more details.

### `File` Filesystem Operations

- [`access`](/fs-testkit/-api/file.Class.File#access)
- [`contents`](/fs-testkit/-api/file.Class.File#contents) /
  [`read`](/fs-testkit/-api/file.Class.File#read)
- [`create`](/fs-testkit/-api/file.Class.File#create) /
  [`write`](/fs-testkit/-api/file.Class.File#write)
- [`delete`](/fs-testkit/-api/file.Class.File#delete)
- [`exists`](/fs-testkit/-api/file.Class.File#exists)
- [`hash`](/fs-testkit/-api/file.Class.File#hash)
- [`move`](/fs-testkit/-api/file.Class.File#move)
- [`rename`](/fs-testkit/-api/file.Class.File#rename)
- [`size`](/fs-testkit/-api/file.Class.File#size)

See the [API documentation](/fs-testkit/-api/file.Class.File) for more details.

## Snapshots

Snapshots take caoture current state of the filesystem when they are created.
They make it easier to perform a diff between two states or even to return the
filesystem to a previous state. Snapshot methods are accessed via
`Sandbox.snapshot`, see the full
[API documentation](/fs-testkit/-api/snapshot.Class.Snapshot) for more details.

### Creating Snapshots

Creating a snapshot captures the current state of the filesystem. If a string is
is specified it will be used to name the snapshot, otherwise a random uuid
string will be used and returned.

```js
await sandbox.snapshot.create("any unique string");
const snapshotName = await sandbox.snapshot.create();
const givenSnapshotName = await sandbox.snapshot.create("given name");
```

If a snapshot name is already in use an error will be thrown.

### Deleting Snapshots

Snapshots can be deleted by name:

```js
await sandbox.snapshot.delete("name of snapshot");
```

### Restoring Snapshots

Snapshots can be restored by name. This will restore the filesystem to the state
it had at the time of the snapshot. This is a destructive operation and will
modify files to how they existed at the snapshot, including removing files and
directories that did not exist.

```js
await sandbox.snapshot.restore("name of snapshot");
```

### Diffing `Dir` with Snapshots

[`Dir.diff`](/fs-testkit/-api/dir.Class.Dir#diff) can be used to get the
differences of a directory between two snapshots. This example uses
`Sandbox.root` but any `Dir` can be used and the diff will be scoped to that
directory.

```js
const diffs = await sandbox.root.diff("snapshot-a", "snapshot-b");
const diffs = await sandbox.root.diff("snapshot-a", "snapshot-b", {
  includeDirs: false,
});

console.log(diff);
```

The logged output would be an array of diff objects like:

```json
[
  {
    "path": "src",
    "type": "modify"
  },
  {
    "path": "src/CHANGELOG.md",
    "type": "add"
  },
  {
    "path": "src/routes",
    "type": "equal"
  },
  {
    "path": "README.md",
    "type": "equal"
  },
  {
    "path": "dist",
    "type": "remove"
  }
]
```

### Diffing `File` with Snapshots

Diffs of text-based files can be produced with
[`File.diffText`](/fs-testkit/-api/file.Class.File#difftext) and of blob/binary
files with [`File.diffBlob`](/fs-testkit/-api/file.Class.File#diffblob) (a
text-based file can also be treated as a blob).

The [`File.diffText`](/fs-testkit/-api/file.Class.File#difftext) can produce two
different output formats depending on what is most practical.

For the following example with an initial `snapshot-a` of `src/data.json`:

```json
{
  "hello": "world",
  "hola": "mundo",
  "hallo": "welt"
}
```

And being modified in `snapshot-b` with the addition the
`"bonjour": "le monde",`:

```json
{
  "hello": "world",
  "hola": "mundo",
  "bonjour": "le monde",
  "hallo": "welt"
}
```

Using the `"diff-object"` format:

```js
const diffs = await sandbox.root
  .at("src/data.json")
  .diffText("snapshot-a", "snapshot-b", "diff-object");

console.log(diffs);
```

The output of `diffs` would be an array of text diff objects:

```json
[
  {
    "type": "equal",
    "value": "{\n  \"hello\": \"world\",\n  \"hola\": \"mundo\",\n"
  },
  {
    "type": "add",
    "value": "  \"bonjour\": \"le monde\",\n"
  },
  {
    "type": "equal",
    "value": "  \"hallo\": \"welt\"\n}\n"
  }
]
```

Using the same example but with alternative format of `"patch-string"`:

```js
const diff = await sandbox.root
  .at("src/data.json")
  .diffText("snapshot-a", "snapshot-b", "patch-string");

console.log(diff);
```

Now the `diff` would output the string:

```diff
Index: src/data.json
===================================================================
--- src/data.json
+++ src/data.json
@@ -1,5 +1,6 @@
 {
   "hello": "world",
   "hola": "mundo",
+  "bonjour": "le monde",
   "hallo": "welt"
 }
```

Files treated as blobs can be diffed with
[`File.diffblob`](/fs-testkit/-api/file.Class.File#diffblob):

```js
const diff = await sandbox.root.at("src/data.json").diffBlob("first", "second");
console.log(diff);
```

The log from `diffBlob` would output:

```json
{
  "path": "src/data.json",
  "type": "modify"
}
```

## Additional Notes

### Design

`fs-testkit` is designed to make traversing the filesystem structure as easy as
possible which is why the pathing APIs are chainable and synchronous. These
pathing APIs represent locations within the sandbox root directory, but it's
only when using the async methods on a `File` or `Dir` instance that the
filesystem is used. In summary, `sandbox.at("random/path")` might not actually
exist, but it can be created with `await sandbox.at("random/path").create()` or
checked to see if it exists with `await sandbox.at("random/path").exists()`.

The `Sandbox` has guaranteed to have a root on the filesystem after
`Sandbox.setup` is called (which is also called as part of `createSandbox`). The
sandbox root directory separates the the files being tested from the tests and
source directories which ensures that the operations are contained.

Snapshots use a git implementation. Using a git implementation allows for
capturing different states of the filesystem and robustly diffing between these
states.

The `Sandbox` instance accepts an `fs` argument that is compatible with
`fs/promises`. This argument could be expanded in the future to allow passing
other fs-compatible modules or possibly different "fs adapters" that conform to
an interface. This would provide additional flexibility and also allow for
in-memory options.

To make tests more ergonomic and easier to read there are assertions being
developed to be compatible with vitest, jest and chai. This would enable a test
to have an assertion like:

```js
await expect(file).not.toExistOnFileSystem();
```

### Motivation

Often test scenarios that use the filesystem are tricky because:

- different APIs have to be used together to handle pathing, file system
  operations and assertions
- it's cumbersome to get a clear picture of the structure of files and
  directories created in a human readable way
- it's difficult to compare various states of the file system between various
  changes in tests

The library tries to address these issues by including:

- A simple api to get quickly set up, handle pathing for files and directories
  and run filesystem operations
- An easy way of creating and compare diffs between different filesystem states
  using snapshots
- Methods to extract human readable from the state of the filesystem
- Compatible assertions to use in your favourite test framework (work in
  progress for vitest, jest, and chai)
