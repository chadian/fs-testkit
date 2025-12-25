/**
 * @param {unknown} thing
 * @returns {unknown is import("../types.js").ScaffoldDir}
 */
export function isScaffoldDir(thing) {
  if (typeof thing === "object" && thing !== null) {
    const dirContents = Object.values(thing);

    // empty directory
    if (dirContents.length === 0) {
      return true;
    }

    // every content is either a file or a directory
    return dirContents.every((dirContent) => {
      return isScaffoldFile(dirContent) || isScaffoldDir(dirContent);
    });
  }

  return false;
}

/**
 * @param {unknown} thing
 * @returns {unknown is import("../types.js").ScaffoldFile}
 */
export function isScaffoldFile(thing) {
  if (isScaffoldContents(thing)) {
    return true;
  }

  if (Array.isArray(thing)) {
    const [contents, options] = thing;
    if (
      isScaffoldContents(contents) &&
      typeof options === "object" &&
      options !== null
    ) {
      return true;
    }
  }

  return false;
}

/**
 * @param {unknown} thing
 * @returns {boolean}
 */
export function isEmptyScaffoldDir(thing) {
  if (
    typeof thing === "object" &&
    thing !== null &&
    Object.values(thing).length === 0
  ) {
    return true;
  }

  return false;
}

/**
 * @param {unknown} thing
 * @returns {unknown is import("../types.js").ScaffoldFileContents}
 */
export function isScaffoldContents(thing) {
  if (
    typeof thing === "string" ||
    (typeof thing === "object" && thing instanceof Buffer)
  ) {
    return true;
  }

  return false;
}
/**
 * @param {import("../types.js").ScaffoldDir} scaffoldDir
 * @param {string[]} path
 * @param {({path: string[]; type: 'File'; file: import("../types.js").ScaffoldFile } | {path: string[]; type: 'Dir';})[]} leafs
 * @returns {({ path: string[]; type: "File"; file: import("../types.js").ScaffoldFile; } | { path: string[]; type: "Dir"; })[]}
 */
export function leaves(scaffoldDir, path = [], leafs = []) {
  for (const [name, fileOrDir] of Object.entries(scaffoldDir)) {
    const currentPath = [...path, name];

    if (isEmptyScaffoldDir(fileOrDir)) {
      leafs.push({ path: currentPath, type: "Dir" });
      continue;
    }

    if (isScaffoldFile(fileOrDir)) {
      leafs.push({
        path: currentPath,
        type: "File",
        // @ts-ignore
        file: fileOrDir,
      });
      continue;
    }

    leaves(
      /** @type {import("../types.js").ScaffoldDir} */ (fileOrDir),
      currentPath,
      leafs
    );
  }

  return leafs;
}
