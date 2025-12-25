/**
 * @param {import("../../file.js").File} file
 * @param {string} snapshotA
 * @param {string} snapshotB
 * @returns {Promise<import("../../types.js").AssertionResult>}
 */
export async function expectFileToHaveBeenModifiedBetween(
  file,
  snapshotA,
  snapshotB
) {
  const hashA = await file.hash(snapshotA);
  const hashB = await file.hash(snapshotB);
  const pass = hashA === hashB;

  /** @type {import("../../types.js").AssertionSuccessResult} */

  if (pass) {
    return {
      pass,
      subject: file,
      arguments: [snapshotA, snapshotB],
    };
  } else {
    return {
      pass,
      subject: file,
      arguments: [snapshotA, snapshotB],
      message: `Expected ${file.name} to be different between ${snapshotA} and ${snapshotB}`,
    };
  }
}
