/**
 * @param {import("../../dir.js").Dir} dir
 * @param {import("../../file.js").File} file
 * @returns {import("../../types.js").AssertionResult}
 */
export function assertDirToContainFile(dir, file) {
  const hasFile = dir.contains(file);
  const base = {
    subject: dir,
    arguments: [file],
  };

  return hasFile
    ? { pass: true, ...base }
    : {
        pass: false,
        message: `Expected ${dir.name} at ${dir.path} to contain ${file.path}`,
        ...base,
      };
}
