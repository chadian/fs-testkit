import { sep as pathSeparator } from "node:path";

/**
 * @typedef {import('../file.js').File} File
 * @typedef {import('../dir.js').Dir} Dir
 */

/**
 * @param {Dir | File} initiator
 * @returns {string}
 */
export function buildPath(initiator) {
  const segments = [initiator.name];
  let parent = initiator.parent;

  while (parent !== null && parent?.parent !== null) {
    segments.push(parent.name);
    parent = parent.parent;
  }

  return segments.reverse().join(pathSeparator);
}
