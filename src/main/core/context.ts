import { readFile, stat } from "fs/promises";
import { resolve, basename } from "path";
import { existsSync } from "fs";
import { readdir } from "fs/promises";

export interface ProjectContext {
  name: string;
  cwd: string;
  language?: string;
  framework?: string;
  packageManager?: string;
  description?: string;
  summary: string;
}

export async function gatherProjectContext(cwd?: string): Promise<ProjectContext> {
  cwd = cwd ?? process.cwd();
  const name = basename(cwd);
  const context: ProjectContext = {
    name,
    cwd,
    summary: "",
  };

  // Detect package.json (Node.js)
  const pkgPath = resolve(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
      context.language = "TypeScript/JavaScript";
      context.description = pkg.description;

      if (pkg.dependencies?.next || pkg.devDependencies?.next) {
        context.framework = "Next.js";
      } else if (pkg.dependencies?.react || pkg.devDependencies?.react) {
        context.framework = "React";
      } else if (pkg.dependencies?.vue || pkg.devDependencies?.vue) {
        context.framework = "Vue";
      } else if (pkg.dependencies?.express || pkg.devDependencies?.express) {
        context.framework = "Express";
      }

      // Detect package manager
      if (existsSync(resolve(cwd, "bun.lockb"))) {
        context.packageManager = "bun";
      } else if (existsSync(resolve(cwd, "pnpm-lock.yaml"))) {
        context.packageManager = "pnpm";
      } else if (existsSync(resolve(cwd, "yarn.lock"))) {
        context.packageManager = "yarn";
      } else {
        context.packageManager = "npm";
      }
    } catch {}
  }

  // Detect Python
  if (
    existsSync(resolve(cwd, "pyproject.toml")) ||
    existsSync(resolve(cwd, "setup.py")) ||
    existsSync(resolve(cwd, "requirements.txt"))
  ) {
    context.language = "Python";
    if (existsSync(resolve(cwd, "manage.py"))) {
      context.framework = "Django";
    }
  }

  // Detect Rust
  if (existsSync(resolve(cwd, "Cargo.toml"))) {
    context.language = "Rust";
  }

  // Detect Go
  if (existsSync(resolve(cwd, "go.mod"))) {
    context.language = "Go";
  }

  // Build summary
  const parts = [`Project: ${name}`];
  if (context.language) parts.push(`Language: ${context.language}`);
  if (context.framework) parts.push(`Framework: ${context.framework}`);
  if (context.packageManager) parts.push(`Package Manager: ${context.packageManager}`);
  if (context.description) parts.push(`Description: ${context.description}`);
  parts.push(`Working Directory: ${cwd}`);

  // Get top-level file listing
  try {
    const entries = await readdir(cwd, { withFileTypes: true });
    const topLevel = entries
      .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
      .slice(0, 20)
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
    parts.push(`Files: ${topLevel.join(", ")}`);
  } catch {}

  context.summary = parts.join("\n");
  return context;
}
