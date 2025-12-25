/**
 * @param {import("../../dir.js").Dir | import("../../file.js").File} dirOrFile
 * @returns {Promise<import("../../types.js").AssertionResult>}
 */
export async function assertDirOrFileToExist(dirOrFile) {
  const exists = await dirOrFile.exists();
  const base = {
    subject: dirOrFile,
    arguments: [],
  };

  return exists
    ? { pass: true, ...base }
    : { pass: false, message: `Expected ${dirOrFile.name} to exist`, ...base };
}
