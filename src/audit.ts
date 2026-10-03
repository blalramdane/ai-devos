import { readdir, stat, readFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import type { Project } from "./domain.js";

export interface ProjectAudit {
  project: Project;
  detectedStack: string[];
  entryPoints: string[];
  importantFiles: string[];
  risks: string[];
  generatedAt: string;
}

const ignored = new Set([".git", "node_modules", "dist", "build", ".aidevos", ".venv"]);

async function topLevel(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter((e) => !ignored.has(e.name)).map((e) => e.name);
}

async function exists(root: string, name: string): Promise<boolean> {
  try {
    await stat(join(root, name));
    return true;
  } catch {
    return false;
  }
}

export async function auditProject(project: Project): Promise<ProjectAudit> {
  const root = resolve(project.rootPath);
  const names = await topLevel(root);
  const stack: string[] = [];
  const important: string[] = [];
  const entryPoints: string[] = [];
  const risks: string[] = [];

  if (await exists(root, "package.json")) {
    stack.push("Node.js");
    important.push("package.json");
  }
  if (await exists(root, "composer.json")) {
    stack.push("PHP/Composer");
    important.push("composer.json");
  }
  if (await exists(root, "artisan")) {
    stack.push("Laravel");
    entryPoints.push("artisan");
  }
  if (await exists(root, "vite.config.ts") || await exists(root, "vite.config.js")) {
    stack.push("Vite");
    entryPoints.push("Vite config");
  }
  if (await exists(root, "next.config.js") || await exists(root, "next.config.ts")) {
    stack.push("Next.js");
    entryPoints.push("Next.js config");
  }
  if (await exists(root, "docker-compose.yml") || await exists(root, "compose.yml")) {
    stack.push("Docker Compose");
    important.push("compose file");
  }
  if (await exists(root, ".github")) important.push(".github");
  if (await exists(root, "README.md")) important.push("README.md");

  if (names.includes(".env")) risks.push("A .env file exists; verify it is ignored and never expose secrets.");
  if (!names.includes("tests") && !names.includes("test")) risks.push("No obvious top-level test directory detected.");
  if (!names.includes(".git")) risks.push("Project is not a Git working tree.");

  let packageScripts = "";
  try {
    packageScripts = await readFile(join(root, "package.json"), "utf8");
  } catch {}
  if (packageScripts && !/"test"\s*:/.test(packageScripts)) {
    risks.push("package.json does not expose an obvious test script.");
  }

  return {
    project,
    detectedStack: [...new Set(stack)],
    entryPoints,
    importantFiles: [...new Set(important)],
    risks,
    generatedAt: new Date().toISOString(),
  };
}
