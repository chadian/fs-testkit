import { expect, test, chai, beforeEach, describe } from "vitest";
import { createSandbox } from "../index.js";
import * as jestMatchers from "./jest-matchers.js";
import { chaiPlugin } from "./chai-plugin.js";

/** @type {import("../sandbox.js").Sandbox} */
let sandbox;

describe("Dir contains", () => {
  beforeEach(async () => {
    sandbox = await createSandbox();
    // @ts-ignore
    expect.extend(jestMatchers);
    chai.use(chaiPlugin);
  });

  test("Dir #toContainFileOrDir with jest assertion", async () => {
    const dir = sandbox.dir("hello-world");
    const dirWithinDir = dir.dir("subdir");
    const file = sandbox.dir("hello-world").file("hello-file.md");
    const dirWithoutFile = sandbox.dir("other-dir");
    const fileNotInDir = sandbox.file("not-in-hello-world.md");

    // @ts-ignore
    expect(dir).toContainFileOrDir(file);
    // @ts-ignore
    expect(dirWithoutFile).not.toContainFileOrDir(file);
    // @ts-ignore
    expect(dir).toContainFileOrDir(dirWithinDir);
    // @ts-ignore
    expect(dirWithoutFile).not.toContainFileOrDir(dirWithinDir);

    // @ts-ignore
    expect(() => expect(dir).toContainFileOrDir(fileNotInDir)).toThrow(
      `Expected directory "hello-world" to contain file "not-in-hello-world.md"`
    );

    expect(() =>
      expect(dirWithoutFile)
        // @ts-ignore
        .toContainFileOrDir(file)
    ).toThrow(`Expected directory "other-dir" to contain file "hello-file.md"`);

    // @ts-ignore
    expect(() => expect(dir).toContainFileOrDir(dirWithoutFile)).toThrow(
      `Expected directory "hello-world" to contain directory "other-dir"`
    );

    // @ts-ignore
    expect(() => expect(dir).not.toContainFileOrDir(file)).toThrow(
      `Expected directory "hello-world" not to contain file "hello-file.md"`
    );

    // @ts-ignore
    expect(() => expect(dir).not.toContainFileOrDir(dirWithinDir)).toThrow(
      `Expected directory "hello-world" not to contain directory "subdir"`
    );
  });

  test("Dir #to.contain with chai assertion", async () => {
    const dir = sandbox.dir("hello-world");
    const dirWithinDir = dir.dir("subdir");
    const file = sandbox.dir("hello-world").file("hello-file.md");
    const dirWithoutFile = sandbox.dir("other-dir");
    const fileNotInDir = sandbox.file("not-in-hello-world.md");

    expect(dir).to.contain(file);
    expect(dirWithoutFile).not.to.contain(file);
    expect(dir).to.contain(dirWithinDir);
    expect(dirWithoutFile).not.to.contain(dirWithinDir);

    // @ts-ignore
    expect(() => expect(dir).to.contain(fileNotInDir)).toThrow(
      `expected directory "hello-world" to contain file "not-in-hello-world.md"`
    );

    expect(() => expect(dir).not.to.contain(dirWithinDir)).toThrow(
      `expected directory "hello-world" not to contain directory "subdir"`
    );

    expect(() =>
      expect(dirWithoutFile)
        // @ts-ignore
        .to.contain(file)
    ).toThrow(`expected directory "other-dir" to contain file "hello-file.md"`);

    expect(() => expect(dir).not.to.contain(file)).toThrow(
      `expected directory "hello-world" not to contain file "hello-file.md"`
    );
  });
});

describe("Dir or File exists", () => {
  test(`Dir or File #toExist with jest assertion`, async () => {
    const createdDir = sandbox.dir("dir-on-fs");
    await createdDir.create();
    const createdFile = createdDir.file("created-file.md");
    await createdFile.create(``);
    const notCreatedDir = await sandbox.dir("dir-that-does-not-exist");
    const notCreatedFile = await notCreatedDir.file(
      "file-that-does-not-exist.md"
    );

    // @ts-ignore
    await expect(createdDir).toExistOnFileSystem();
    // @ts-ignore
    await expect(createdFile).toExistOnFileSystem();
    // @ts-ignore
    await expect(notCreatedDir).not.toExistOnFileSystem();
    // @ts-ignore
    await expect(notCreatedFile).not.toExistOnFileSystem();

    await expect(() =>
      // @ts-ignore
      expect(createdDir).not.toExistOnFileSystem()
    ).rejects.toThrow(
      /Expected directory "dir-on-fs" not to exist on filesystem/
    );

    await expect(() =>
      // @ts-ignore
      expect(createdFile).not.toExistOnFileSystem()
    ).rejects.toThrow(
      /Expected file "created-file.md" not to exist on filesystem/
    );

    await expect(() =>
      // @ts-ignore
      expect(notCreatedDir).toExistOnFileSystem()
    ).rejects.toThrow(
      /Expected directory "dir-that-does-not-exist" to exist on filesystem/
    );

    await expect(() =>
      // @ts-ignore
      expect(notCreatedFile).toExistOnFileSystem()
    ).rejects.toThrow(
      /Expected file "file-that-does-not-exist.md" to exist on filesystem/
    );
  });

  test(`Dir or File #to.existOnFileSystem with chai assertion`, async () => {
    const createdDir = sandbox.dir("dir-on-fs");
    await createdDir.create();
    const createdFile = createdDir.file("created-file.md");
    await createdFile.create(``);
    const notCreatedDir = await sandbox.dir("dir-that-does-not-exist");
    const notCreatedFile = await notCreatedDir.file(
      "file-that-does-not-exist.md"
    );

    // @ts-ignore
    await expect(createdDir).to.existOnFileSystem;
    // @ts-ignore
    await expect(createdFile).to.existOnFileSystem;
    // @ts-ignore
    await expect(notCreatedDir).to.not.existOnFileSystem;
    // @ts-ignore
    await expect(notCreatedFile).not.to.existOnFileSystem;

    await expect(
      () =>
        // @ts-ignore
        expect(createdDir).not.to.existOnFileSystem
    ).rejects.toThrow(
      /expected directory "dir-on-fs" not to exist on filesystem/
    );

    await expect(
      () =>
        // @ts-ignore
        expect(createdFile).not.to.existOnFileSystem
    ).rejects.toThrow(
      /expected file "created-file.md" not to exist on filesystem/
    );

    await expect(
      () =>
        // @ts-ignore
        expect(notCreatedDir).to.existOnFileSystem
    ).rejects.toThrow(
      /expected directory "dir-that-does-not-exist" to exist on filesystem/
    );

    await expect(
      () =>
        // @ts-ignore
        expect(notCreatedFile).to.existOnFileSystem
    ).rejects.toThrow(
      /expected file "file-that-does-not-exist.md" to exist on filesystem/
    );
  });
});
