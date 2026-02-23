import { execSync as $ } from "node:child_process";
import { createSandbox } from "./src/index.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { exit } from "node:process";

const sandbox = await createSandbox();

console.log(`sandbox root: ${sandbox.rootPath}`);
const outTar = sandbox.root.file("fs-testkit.tar");
$(`pnpm pack --out ${outTar.absolutePath}`);
$(`tar -xvzf ${outTar.absolutePath}`, { cwd: sandbox.rootPath });

const testDir = sandbox.root.dir("test");
await testDir.create();
await $(`pnpm init`, { cwd: testDir.absolutePath });
await $(`pnpm add --save file:${sandbox.root.dir("package").absolutePath}`, {
  cwd: testDir.absolutePath,
});
await $(`pnpm add --save prettier`, { cwd: testDir.absolutePath });

// Manually patch parts of the integration test so that it can be ran externally
const patchedIntegrationTest = readFileSync(
  resolve("./src/integration.test.js"),
)
  .toString()
  .replace("./index.js", "fs-testkit")
  // after the index.js has been replaced, next can be relative to the package
  .replaceAll("./", "fs-testkit/");

await testDir.scaffold({
  ["test.js"]: patchedIntegrationTest,
});

if (process.env.TEST_MEMFS) {
  console.log("Testing with memfs");
  await $(`pnpm add --save memfs`, { cwd: testDir.absolutePath });
  const sandboxJsFile = sandbox.root.at("package/src/sandbox.js");
  const patchedSandboxJs = (await sandboxJsFile.contents()).toString().replace(
    /\/\/ START IMPORT FOR FS\n.*\n\/\/ END IMPORT FOR FS/gm,
    `
import { fs as memfs } from "memfs";
const fs = memfs.promises;
    `.trim(),
  );

  if (!patchedSandboxJs.includes(`import { fs as memfs } from "memfs"`)) {
    throw new Error(`Expected memfs import to exist`);
  }
  await sandboxJsFile.write(patchedSandboxJs);
}

$(`pnpm install`, { cwd: testDir.absolutePath });
const result = $(`node --test test.js`, {
  cwd: testDir.absolutePath,
}).toString();
console.log(result);
if (!result.includes("fail 0")) {
  console.log("Failures found in tests.");
  exit(-1);
}
console.log("Done.");
