import { join } from "path";

export const KEEP_FILE = `.fs-testkit.gitkeep`;

/**
 * @param {import("fs/promises")} fs
 * @param {string} rootPath
 * @returns {Promise<string[]>}
 */
export async function addInternalGitKeepFiles(fs, rootPath) {
  const keepFiles = (
    await Promise.all(
      (await fs.readdir(rootPath, { recursive: true })).map(
        async (childPath) => {
          const absoluteChildPath = join(rootPath, childPath);
          const stats = await fs.stat(absoluteChildPath);

          // only add keep files to directories
          if (!stats.isDirectory()) {
            return;
          }

          // only add keep files to directories that are empty (don't have contents)
          if ((await fs.readdir(absoluteChildPath)).length > 0) {
            return;
          }

          const keepFile = join(absoluteChildPath, KEEP_FILE);
          await fs.writeFile(keepFile, "");
          return keepFile;
        }
      )
    )
  ).filter(Boolean);

  return /** @type {string[]} */ (keepFiles);
}

/**
 * @param {import("fs/promises")} fs
 * @param {string} path
 * @returns {Promise<string[]>}
 */
export async function removeInternalGitKeepFiles(fs, path) {
  const removedKeepFiles = (
    await Promise.all(
      (await fs.readdir(path, { recursive: true })).map(async (childPath) => {
        const absoluteChildPath = join(path, childPath);
        const stats = await fs.stat(absoluteChildPath);
        if (stats.isFile() && absoluteChildPath.endsWith(KEEP_FILE)) {
          await fs.rm(absoluteChildPath);
          return absoluteChildPath;
        }
      })
    )
  ).filter(Boolean);

  return /** @type {string[]} */ (removedKeepFiles);
}

/**
 * @param {import("fs/promises")} fs
 * @param {string} path
 * @returns {Promise<string[]>}
 */
export async function removeEmptyDirectoriesWithoutKeeps(fs, path) {
  const removedKeepFiles = (
    await Promise.all(
      (await fs.readdir(path, { recursive: true })).map(async (childPath) => {
        const absoluteChildPath = join(path, childPath);
        const stats = await fs.stat(absoluteChildPath);
        if (stats.isDirectory()) {
          const isEmpty = (await fs.readdir(absoluteChildPath)).length === 0;
          if (isEmpty) {
            await fs.rmdir(absoluteChildPath);
            return absoluteChildPath;
          }
        }
      })
    )
  ).filter(Boolean);

  return /** @type {string[]} */ (removedKeepFiles);
}
