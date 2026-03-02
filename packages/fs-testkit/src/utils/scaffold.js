import { basename, join } from "path";

/** @typedef {import('../dir.js').Dir} Dir  */
/** @typedef {import('../file.js').File} File  */
/** @typedef {import("../types.js").ScaffoldDir} ScaffoldDir  */
/** @typedef {import("../types.js").ScaffoldFile} ScaffoldFile  */
/** @typedef {import("../types.js").ScaffoldOptions} ScaffoldOptions  */

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
 * @template {ScaffoldDir} T
 * @template {ScaffoldOptions} [Opts={}]
 * @param {Dir} rootDir
 * @param {T} scaffolding
 * @param {Required<Opts>} options
 * @returns {Promise<import("../types.js").ScaffoldResult<T, Opts>>}
 */
export async function scaffold(rootDir, scaffolding, options) {
  const scaffoldResult =
    /** @type {import("../types.js").ScaffoldResult<T, Opts>} */ (
      options.includeDirInstances ? { __dir: rootDir } : {}
    );

  /** @type {Promise<unknown>[]} */
  const promises = [];

  /**
   * @type {{
   *   path: string;
   *   parentScaffoldResult: import("../types.js").ScaffoldResult<T, Opts>;
   *   value: ScaffoldFile | ScaffoldDir;
   * }[]}
   */
  const entries = Object.entries(scaffolding).map(([name, value]) => ({
    value,
    path: name,
    parentScaffoldResult: scaffoldResult,
  }));

  for (const {
    path,
    value,
    parentScaffoldResult: parentScaffoldDirResult,
  } of entries) {
    const name = basename(path);
    if (isScaffoldDir(value)) {
      const dir = /** @type {Dir} */ (rootDir.at(path, "Dir"));

      const scaffoldDirResult = options.includeDirInstances
        ? { __dir: dir }
        : {};

      // @ts-ignore
      parentScaffoldDirResult[name] = scaffoldDirResult;

      // only empty directories need to be created,
      // files are always leaf nodes and will create their parent directories as needed
      if (isEmptyScaffoldDir(value)) {
        promises.push(dir.create({ recursive: true }));
      } else {
        // directory is not empty
        Object.entries(value).forEach(([childName, childValue]) =>
          entries.push({
            value: childValue,
            path: join(path, childName),
            parentScaffoldResult:
              /** @type {import("../types.js").ScaffoldResult<T, Opts>} */ (
                scaffoldDirResult
              ),
          }),
        );
      }
    } else if (isScaffoldFile(value)) {
      const file = /** @type {File} */ (
        /** @type {unknown} */ (rootDir.at(path, "File"))
      );
      // eslint-disable-next-line jsdoc/reject-any-type
      /** @type {Record<string, any>} */ (parentScaffoldDirResult)[name] = file;

      const { overwrite, prettier } = options;
      const fileOptions = { overwrite, prettier };

      // @ts-ignore
      const [fileContents, individualFileOptions] = isScaffoldContents(value)
        ? [value, {}]
        : value;

      promises.push(
        file.create(fileContents, { ...fileOptions, ...individualFileOptions }),
      );
    } else {
      // ensure the return type is narrowed, realistically this should never be hit since
      // it the input should be checked and handled in the layer above
      throw new Error(
        `Invalid scaffolding type, was not a recognized as a scaffoldable structure: ${JSON.stringify(value)}`,
      );
    }
  }

  await Promise.all(promises);
  return scaffoldResult;
}
