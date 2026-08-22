import fs from "node:fs";
import path from "node:path";

/** Parse file paths pasted by a terminal drag-and-drop operation. */
export function parseDraggedFilePaths(input: string): string[] {
  const paths: string[] = [];
  const tokenPattern = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|((?:\\.|[^\s])+)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(input)) !== null) {
    const token = (match[1] ?? match[2] ?? match[3] ?? "")
      .replace(/\\([\\\s"'])/g, "$1")
      .trim();
    if (!token) continue;

    const expanded = token.startsWith("~")
      ? path.join(process.env.HOME || "~", token.slice(1))
      : token;
    const absolutePath = path.resolve(expanded);
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      paths.push(absolutePath);
    }
  }

  return [...new Set(paths)];
}
