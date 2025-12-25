import { relative } from "node:path";

/**
 * @param {string} absoluteParentPath
 * @param {string} absoluteChildPath
 * @returns {boolean}
 */
export function contains(absoluteParentPath, absoluteChildPath) {
  const relativePath = relative(absoluteParentPath, absoluteChildPath);
  return !relativePath.startsWith("../");
}
