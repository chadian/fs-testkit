import path from "path";

export function markdownId(filename: string) {
  filename = filename === "api/index.md" ? "indexjs" : filename;
  return path.basename(filename, ".md");
}
