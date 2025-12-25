/**
 * @param {import("../../file.js").File} file
 * @param {Buffer | string} expectedContents
 * @returns {Promise<import("../../types.js").AssertionResult>}
 */
export async function assertFileToHaveExactContents(file, expectedContents) {
  const contents = await file.read();
  let pass;

  if (typeof expectedContents === "string") {
    pass = contents.toString() === expectedContents;
  } else {
    pass = contents === expectedContents;
  }

  return pass
    ? {
        pass,
        subject: file,
        arguments: [expectedContents],
      }
    : {
        pass,
        subject: file,
        arguments: [expectedContents],
        message: `Expected ${file.name} to have contents "${expectedContents.toString().substring(0, 25)}"...`,
      };
}

/**
 * @param {import("../../file.js").File} file
 * @param {string} expectedContents
 * @returns {Promise<import("../../types.js").AssertionResult>}
 */
export async function assertFileToIncludeContents(file, expectedContents) {
  const contents = await file.read();
  let pass;

  pass = contents.toString() === expectedContents.toString();

  return pass
    ? {
        pass,
        subject: file,
        arguments: [expectedContents],
      }
    : {
        pass,
        subject: file,
        arguments: [expectedContents],
        message: `Expected ${file.name} to include "${expectedContents.toString().substring(0, 25)}"...`,
      };
}

/**
 * @param {import("../../file.js").File} file
 * @returns {Promise<import("../../types.js").AssertionResult>}
 */
export async function assertFileToExist(file) {
  const exists = await file.exists();
  return exists
    ? { pass: true, subject: file, arguments: [] }
    : {
        pass: false,
        subject: file,
        arguments: [],
        message: `Expected ${file.name} to exist`,
      };
}

/**
 * @param {import("../../file.js").File} file
 * @param {string} expectedHash
 * @returns {Promise<boolean>}
 */
export async function assertFileToHashAs(file, expectedHash) {
  const hash = await file.hash();
  return hash === expectedHash;
}
