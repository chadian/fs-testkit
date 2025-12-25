import { createHash } from "node:crypto";

// construct expected hash based on underlying git spec
/**
 *
 * @param {import("../file.js").File} file
 * @returns {Promise<string>}
 */
export async function fileOidHash(file) {
  const size = await file.size();
  const header = `blob ${size}\0`;
  const contents = (await file.read()).toString();
  const sha = createHash("sha1");
  sha.update(`${header}${contents}`);
  const hash = sha.digest("hex");
  return hash;
}
