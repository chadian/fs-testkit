import { parse } from "path";
import { isText } from "istextorbinary";
import { hashBlob } from "isomorphic-git";

/**
 * @param {import("fs/promises")} fs
 * @param {import("../dir.js").Dir} dir
 * @param {"filename" | "file-contents" | "hash"} textFileMask
 * @param {"filename" | "hash"} blobFileMask
 * @param {import("../types.js").ObjectTree<string>} treeObject
 * @returns {Promise<import("../types.js").ObjectTree<string>>}
 */
export async function tree(
  fs,
  dir,
  textFileMask,
  blobFileMask,
  treeObject = {},
) {
  const childPaths = await fs.readdir(dir.absolutePath);

  await Promise.all(
    childPaths.map(async (childPath) => {
      const absoluteChildPath = dir.at(childPath).absolutePath;
      const { name, base: filename } = parse(childPath);
      const stats = await fs.stat(absoluteChildPath);

      if (stats.isDirectory()) {
        const subTreeObject = {};
        const subDir = dir.dir(name);
        treeObject[name] = subTreeObject;
        await tree(fs, subDir, textFileMask, blobFileMask, subTreeObject);
        return treeObject;
      }

      const format = isText(
        absoluteChildPath,
        await fs.readFile(absoluteChildPath),
      )
        ? textFileMask
        : blobFileMask;

      treeObject[filename] = await formatForFile(fs, absoluteChildPath, format);
      return treeObject;
    }),
  );

  return treeObject;
}

/**
 * @param {import("fs/promises")} fs
 * @param {string} filepath
 * @param {"filename" | "file-contents" | "hash"} format
 * @returns {Promise<string>}
 */
async function formatForFile(fs, filepath, format) {
  if (format === "filename") {
    return parse(filepath).base;
  }

  if (format === "file-contents") {
    const buffer = await fs.readFile(filepath);
    return buffer.toString();
  }

  if (format === "hash") {
    const buffer = await fs.readFile(filepath);
    return (await hashBlob({ object: buffer })).oid;
  }

  throw new Error(`Unacceptable format passed to #formatForFile: ${format}`);
}

/**
 * @param {import("../types.js").ObjectTree<string>} tree
 * @param {object} options
 * @param {boolean} options.labels
 * @param {object} context
 * @param {string} context.string
 * @param {number} context.level
 * @param {number[]} context.extensions
 * @returns {string}
 */
export function treeString(
  tree,
  options = { labels: false },
  context = Object.freeze({
    string: ".", // start with cap `.` on top
    level: 0,
    extensions: [],
  }),
) {
  let { string, level, extensions } = context;

  // prettier-ignore
  const treeSymbols = {
    space:     "    ",
    sibling:   "├── ",
    extension: "│   ",
    end:       "└── ",
  };

  const indents = new Array(level)
    .fill(undefined)
    .map((_, i) => {
      if (extensions.includes(i)) {
        return treeSymbols.extension;
      }

      return treeSymbols.space;
    })
    .join("");

  const treeEntries = Object.entries(tree);

  treeEntries.forEach(([name, dirOrFile], i) => {
    const isLastInCurrentLevel = i === treeEntries.length - 1;
    const isFolder = typeof dirOrFile === "object";

    const treeSymbol = isLastInCurrentLevel
      ? treeSymbols.end
      : treeSymbols.sibling;

    const label = options.labels
      ? " " + (isFolder ? "(Dir)" : "(File)")
      : undefined;
    string = [string, `\n`, `${indents}${treeSymbol}`, name, label]
      .filter(Boolean)
      .join("");

    if (isFolder) {
      if (isLastInCurrentLevel) {
        extensions = extensions.filter((extension) => extension !== level);
      } else {
        extensions = [...extensions, level];
      }

      const subTreeString = treeString(
        dirOrFile,
        options,
        Object.freeze({
          string: "", // reset with empty string for subtree
          level: level + 1,
          extensions,
        }),
      );

      string = [string, subTreeString].filter(Boolean).join("");
    }
  });

  return string;
}
