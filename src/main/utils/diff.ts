import chalk from "chalk";
import { createPatch } from "diff";

export function generateDiff(
  filename: string,
  oldContent: string,
  newContent: string
): string {
  const patch = createPatch(filename, oldContent, newContent, "", "", {
    context: 3,
  });
  return colorDiff(patch);
}

function colorDiff(patch: string): string {
  return patch
    .split("\n")
    .map((line) => {
      if (line.startsWith("+++") || line.startsWith("---")) {
        return chalk.bold(line);
      }
      if (line.startsWith("+")) {
        return chalk.green(line);
      }
      if (line.startsWith("-")) {
        return chalk.red(line);
      }
      if (line.startsWith("@@")) {
        return chalk.cyan(line);
      }
      return chalk.dim(line);
    })
    .join("\n");
}

export function applyStringEdit(
  content: string,
  target: string,
  replacement: string
): { success: boolean; result: string; matchCount: number } {
  const matchCount = content.split(target).length - 1;

  if (matchCount === 0) {
    return { success: false, result: content, matchCount: 0 };
  }

  if (matchCount > 1) {
    // Replace only the first occurrence to be safe
    const index = content.indexOf(target);
    const result =
      content.substring(0, index) +
      replacement +
      content.substring(index + target.length);
    return { success: true, result, matchCount };
  }

  return {
    success: true,
    result: content.replace(target, replacement),
    matchCount: 1,
  };
}
