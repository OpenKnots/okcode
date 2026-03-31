import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

// ── Types ────────────────────────────────────────────────────────────

export interface SkillManifest {
  name: string;
  description: string;
  version?: string;
  scope?: "global" | "project";
  triggers?: string[];
  tags?: string[];
  tools?: string[];
  author?: string;
}

export interface SkillEntry {
  name: string;
  scope: "global" | "project";
  description: string;
  tags: string[];
  path: string;
  dir: string;
  supplementaryFiles: string[];
}

export interface SkillContent {
  manifest: SkillManifest;
  body: string;
  raw: string;
}

export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Frontmatter parsing ──────────────────────────────────────────────

/**
 * Parse YAML frontmatter from a SKILL.md string.
 * Returns the frontmatter as key-value pairs and the markdown body.
 * Uses a simple parser to avoid external YAML dependency.
 */
export function parseSkillFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---")) {
    return { frontmatter: {}, body: raw };
  }

  const endIndex = trimmed.indexOf("---", 3);
  if (endIndex === -1) {
    return { frontmatter: {}, body: raw };
  }

  const frontmatterBlock = trimmed.slice(3, endIndex).trim();
  const body = trimmed.slice(endIndex + 3).trimStart();
  const frontmatter: Record<string, unknown> = {};
  const lines = frontmatterBlock.split("\n");

  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  for (const line of lines) {
    // Check for block-list item (  - value)
    const listItemMatch = /^\s+-\s+(.*)$/.exec(line);
    if (listItemMatch && currentKey !== null && currentList !== null) {
      const itemValue = listItemMatch[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
      if (itemValue.length > 0) {
        currentList.push(itemValue);
      }
      continue;
    }

    // If we were building a list, commit it
    if (currentKey !== null && currentList !== null) {
      frontmatter[currentKey] = currentList;
      currentKey = null;
      currentList = null;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const rawValue = line.slice(colonIndex + 1).trim();

    if (key.length === 0) continue;

    // Empty value after colon means potential block-list follows
    if (rawValue.length === 0) {
      currentKey = key;
      currentList = [];
      continue;
    }

    // Handle inline array syntax: [item1, item2]
    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      frontmatter[key] = rawValue
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, ""))
        .filter((item) => item.length > 0);
      continue;
    }

    // Handle quoted strings
    if (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) {
      frontmatter[key] = rawValue.slice(1, -1);
      continue;
    }

    frontmatter[key] = rawValue;
  }

  // Commit any trailing list
  if (currentKey !== null && currentList !== null) {
    frontmatter[currentKey] = currentList;
  }

  return { frontmatter, body };
}

/**
 * Parse a SKILL.md file into a typed SkillContent.
 */
export function parseSkillContent(raw: string, fallbackName: string): SkillContent {
  const { frontmatter, body } = parseSkillFrontmatter(raw);

  const manifest: SkillManifest = {
    name: typeof frontmatter.name === "string" ? frontmatter.name : fallbackName,
    description: typeof frontmatter.description === "string" ? frontmatter.description : "",
    ...(typeof frontmatter.version === "string" ? { version: frontmatter.version } : {}),
    ...(frontmatter.scope === "global" || frontmatter.scope === "project"
      ? { scope: frontmatter.scope }
      : {}),
    ...(Array.isArray(frontmatter.triggers) ? { triggers: frontmatter.triggers.map(String) } : {}),
    ...(Array.isArray(frontmatter.tags) ? { tags: frontmatter.tags.map(String) } : {}),
    ...(Array.isArray(frontmatter.tools) ? { tools: frontmatter.tools.map(String) } : {}),
    ...(typeof frontmatter.author === "string" ? { author: frontmatter.author } : {}),
  };

  return { manifest, body, raw };
}

// ── Validation ───────────────────────────────────────────────────────

const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export function validateSkillName(name: string): { valid: boolean; reason?: string } {
  if (name.length === 0) return { valid: false, reason: "Skill name cannot be empty" };
  if (name.length > 64)
    return { valid: false, reason: "Skill name must be 64 characters or fewer" };
  if (!SKILL_NAME_PATTERN.test(name)) {
    return {
      valid: false,
      reason: "Skill name must be lowercase alphanumeric with hyphens (e.g., 'my-skill')",
    };
  }
  return { valid: true };
}

export function validateSkillDirectory(skillDir: string): SkillValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const skillMdPath = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillMdPath)) {
    errors.push("Missing SKILL.md file");
    return { valid: false, errors, warnings };
  }

  const raw = fs.readFileSync(skillMdPath, "utf-8");
  if (raw.trim().length === 0) {
    errors.push("SKILL.md is empty");
    return { valid: false, errors, warnings };
  }

  const { manifest } = parseSkillContent(raw, path.basename(skillDir));

  if (!manifest.description || manifest.description.length === 0) {
    warnings.push("Missing description in frontmatter");
  }

  if (!manifest.tags || manifest.tags.length === 0) {
    warnings.push("No tags specified");
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Storage paths ────────────────────────────────────────────────────

export function globalSkillsDir(): string {
  return path.join(os.homedir(), ".claude", "skills");
}

export function projectSkillsDir(projectRoot: string): string {
  return path.join(projectRoot, ".claude", "skills");
}

export function skillMdPath(skillDir: string): string {
  return path.join(skillDir, "SKILL.md");
}

// ── Listing ──────────────────────────────────────────────────────────

function scanSkillsDirectory(baseDir: string, scope: "global" | "project"): SkillEntry[] {
  if (!fs.existsSync(baseDir)) return [];

  const entries: SkillEntry[] = [];

  try {
    const items = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const item of items) {
      if (!item.isDirectory()) continue;

      const skillDir = path.join(baseDir, item.name);
      const mdPath = skillMdPath(skillDir);

      if (!fs.existsSync(mdPath)) continue;

      try {
        const raw = fs.readFileSync(mdPath, "utf-8");
        const { manifest } = parseSkillContent(raw, item.name);

        // Find supplementary files
        const supplementaryFiles: string[] = [];
        try {
          const dirContents = fs.readdirSync(skillDir);
          for (const file of dirContents) {
            if (file !== "SKILL.md" && !file.startsWith(".")) {
              supplementaryFiles.push(file);
            }
          }
        } catch {
          // Ignore errors reading supplementary files
        }

        entries.push({
          name: manifest.name,
          scope,
          description: manifest.description,
          tags: manifest.tags ?? [],
          path: mdPath,
          dir: skillDir,
          supplementaryFiles,
        });
      } catch {
        // Skip skills that can't be parsed
      }
    }
  } catch {
    // Directory doesn't exist or is unreadable
  }

  return entries;
}

/**
 * List all installed skills, with project scope taking precedence over global.
 */
export function listSkills(projectRoot?: string): SkillEntry[] {
  const globalEntries = scanSkillsDirectory(globalSkillsDir(), "global");
  const projectEntries = projectRoot
    ? scanSkillsDirectory(projectSkillsDir(projectRoot), "project")
    : [];

  // Project-scoped skills override global skills with the same name
  const nameSet = new Set(projectEntries.map((e) => e.name));
  const merged = [...projectEntries, ...globalEntries.filter((e) => !nameSet.has(e.name))];

  return merged.toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * Read a skill by name, resolving from project scope first then global.
 */
export function readSkill(
  name: string,
  projectRoot?: string,
): (SkillEntry & { content: SkillContent }) | null {
  const nameValidation = validateSkillName(name);
  if (!nameValidation.valid) return null;

  // Direct path lookup instead of scanning all directories
  const candidates: Array<{ dir: string; mdPath: string; scope: "global" | "project" }> = [];

  if (projectRoot) {
    const dir = path.join(projectSkillsDir(projectRoot), name);
    candidates.push({ dir, mdPath: skillMdPath(dir), scope: "project" });
  }
  candidates.push({
    dir: path.join(globalSkillsDir(), name),
    mdPath: skillMdPath(path.join(globalSkillsDir(), name)),
    scope: "global",
  });

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate.mdPath)) continue;

    try {
      const raw = fs.readFileSync(candidate.mdPath, "utf-8");
      const content = parseSkillContent(raw, name);

      // Find supplementary files
      const supplementaryFiles: string[] = [];
      try {
        const dirContents = fs.readdirSync(candidate.dir);
        for (const file of dirContents) {
          if (file !== "SKILL.md" && !file.startsWith(".")) {
            supplementaryFiles.push(file);
          }
        }
      } catch {
        // Ignore
      }

      return {
        name: content.manifest.name,
        scope: candidate.scope,
        description: content.manifest.description,
        tags: content.manifest.tags ?? [],
        path: candidate.mdPath,
        dir: candidate.dir,
        supplementaryFiles,
        content,
      };
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Search skills by query (fuzzy match against name, description, and tags).
 */
export function searchSkills(query: string, projectRoot?: string): SkillEntry[] {
  const allSkills = listSkills(projectRoot);
  const lowerQuery = query.toLowerCase();

  return allSkills
    .map((skill) => {
      let score = 0;
      const lowerName = skill.name.toLowerCase();
      const lowerDesc = skill.description.toLowerCase();

      if (lowerName === lowerQuery) score += 100;
      else if (lowerName.startsWith(lowerQuery)) score += 80;
      else if (lowerName.includes(lowerQuery)) score += 60;

      if (lowerDesc.includes(lowerQuery)) score += 40;

      for (const tag of skill.tags) {
        if (tag.toLowerCase().includes(lowerQuery)) score += 30;
      }

      return { skill, score };
    })
    .filter(({ score }) => score > 0)
    .toSorted((a, b) => b.score - a.score)
    .map(({ skill }) => skill);
}

/**
 * Check if a skill exists.
 */
export function skillExists(
  name: string,
  projectRoot?: string,
): { exists: boolean; scope?: "global" | "project" } {
  if (projectRoot) {
    const projectDir = path.join(projectSkillsDir(projectRoot), name);
    if (fs.existsSync(skillMdPath(projectDir))) {
      return { exists: true, scope: "project" };
    }
  }

  const globalDir = path.join(globalSkillsDir(), name);
  if (fs.existsSync(skillMdPath(globalDir))) {
    return { exists: true, scope: "global" };
  }

  return { exists: false };
}

// ── Scaffold template ────────────────────────────────────────────────

export function generateSkillTemplate(name: string, description: string): string {
  const titleCase = name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return `---
name: ${name}
description: ${description}
tags: []
---

# ${titleCase} — Claude Code Skill

## When to use this skill

- TODO: Describe when Claude should invoke this skill

## What this skill does

${description}

## Implementation

TODO: Add step-by-step instructions, commands, code examples.

## Best practices

- TODO: Add dos and don'ts
`;
}

/**
 * Create a new skill with scaffold template.
 */
export function createSkill(
  name: string,
  description: string,
  scope: "global" | "project",
  projectRoot?: string,
): { path: string; name: string } {
  const nameValidation = validateSkillName(name);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.reason ?? "Invalid skill name");
  }

  const baseDir =
    scope === "project" && projectRoot ? projectSkillsDir(projectRoot) : globalSkillsDir();

  const skillDir = path.join(baseDir, name);
  const mdPath = skillMdPath(skillDir);

  if (fs.existsSync(mdPath)) {
    throw new Error(`Skill "${name}" already exists at ${scope} scope`);
  }

  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(mdPath, generateSkillTemplate(name, description), "utf-8");

  return { path: mdPath, name };
}

/**
 * Delete a skill.
 */
export function deleteSkill(name: string, scope: "global" | "project", projectRoot?: string): void {
  const nameValidation = validateSkillName(name);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.reason ?? "Invalid skill name");
  }

  const baseDir =
    scope === "project" && projectRoot ? projectSkillsDir(projectRoot) : globalSkillsDir();

  const skillDir = path.join(baseDir, name);

  if (!fs.existsSync(skillDir)) {
    throw new Error(`Skill "${name}" not found at ${scope} scope`);
  }

  fs.rmSync(skillDir, { recursive: true, force: true });
}

// ── Built-in skill management subcommands ────────────────────────────

export interface SkillSubcommandDef {
  name: string;
  description: string;
  usage: string;
}

export const SKILL_MANAGEMENT_SUBCOMMANDS: readonly SkillSubcommandDef[] = [
  {
    name: "create",
    description: "Create a new skill with scaffold template",
    usage: "/skill create <name> [--scope global|project]",
  },
  {
    name: "list",
    description: "List all installed skills",
    usage: "/skill list",
  },
  {
    name: "search",
    description: "Search installed skills by keyword",
    usage: "/skill search <query>",
  },
  {
    name: "read",
    description: "View the full content of a skill",
    usage: "/skill read <name>",
  },
  {
    name: "delete",
    description: "Remove an installed skill",
    usage: "/skill delete <name> [--scope global|project]",
  },
  {
    name: "import",
    description: "Import a skill from a local path",
    usage: "/skill import <path> [--scope global|project]",
  },
] as const;
