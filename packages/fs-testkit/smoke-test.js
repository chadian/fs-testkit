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
await testDir.scaffold({
  ["test.js"]: readFileSync(resolve("./src/integration.test.js"))
    .toString()
    .replace("./index.js", "fs-testkit")
    // after the index.js has been replaced, next can be relative to the package
    .replaceAll("./", "fs-testkit/"),
});
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
