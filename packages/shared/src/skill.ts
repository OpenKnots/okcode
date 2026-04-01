import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import type { BundledSkillId } from "@okcode/contracts";
import { getBundledSkillById, listBundledSkills, readBundledSkillFiles } from "./skillCatalog";

export type SkillOrigin = "bundled" | "custom" | "imported";
export type SkillTemplateKind = "blank" | "docs-helper" | "automation-helper" | "review-helper";

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
  origin?: SkillOrigin;
  catalog_id?: string;
}

export interface SkillEntry {
  name: string;
  scope: "global" | "project";
  description: string;
  tags: string[];
  path: string;
  dir: string;
  supplementaryFiles: string[];
  origin: SkillOrigin;
  catalogId: string | null;
  system: boolean;
  mutable: boolean;
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

function toSkillOrigin(value: unknown): SkillOrigin | undefined {
  return value === "bundled" || value === "custom" || value === "imported" ? value : undefined;
}

function serializeFrontmatter(manifest: SkillManifest): string {
  const lines: string[] = ["---", `name: ${manifest.name}`, `description: ${manifest.description}`];
  if (manifest.catalog_id) lines.push(`catalog_id: ${manifest.catalog_id}`);
  if (manifest.origin) lines.push(`origin: ${manifest.origin}`);
  if (manifest.version) lines.push(`version: ${manifest.version}`);
  if (manifest.author) lines.push(`author: ${manifest.author}`);
  if (manifest.scope) lines.push(`scope: ${manifest.scope}`);
  if (manifest.tags && manifest.tags.length > 0) {
    lines.push("tags:");
    for (const tag of manifest.tags) lines.push(`  - ${tag}`);
  } else {
    lines.push("tags: []");
  }
  if (manifest.triggers && manifest.triggers.length > 0) {
    lines.push("triggers:");
    for (const trigger of manifest.triggers) lines.push(`  - ${trigger}`);
  }
  if (manifest.tools && manifest.tools.length > 0) {
    lines.push("tools:");
    for (const tool of manifest.tools) lines.push(`  - ${tool}`);
  }
  lines.push("---");
  return `${lines.join("\n")}\n`;
}

function resolveOrigin(manifest: SkillManifest): SkillOrigin {
  if (manifest.origin) return manifest.origin;
  if (manifest.catalog_id) return "bundled";
  return "custom";
}

function resolveScopeBaseDir(scope: "global" | "project", projectRoot?: string): string {
  return scope === "project" && projectRoot ? projectSkillsDir(projectRoot) : globalSkillsDir();
}

function getSupplementaryFiles(skillDir: string): string[] {
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
  return supplementaryFiles;
}

function buildSkillEntry(input: {
  manifest: SkillManifest;
  scope: "global" | "project";
  mdPath: string;
  dir: string;
}): SkillEntry {
  const bundled = input.manifest.catalog_id
    ? getBundledSkillById(input.manifest.catalog_id as BundledSkillId)
    : undefined;
  return {
    name: input.manifest.name,
    scope: input.scope,
    description: input.manifest.description,
    tags: input.manifest.tags ?? [],
    path: input.mdPath,
    dir: input.dir,
    supplementaryFiles: getSupplementaryFiles(input.dir),
    origin: resolveOrigin(input.manifest),
    catalogId: input.manifest.catalog_id ?? null,
    system: bundled?.entry.system ?? false,
    mutable: !(bundled?.entry.immutable ?? false),
  };
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
  const origin = toSkillOrigin(frontmatter.origin);

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
    ...(origin ? { origin } : {}),
    ...(typeof frontmatter.catalog_id === "string" ? { catalog_id: frontmatter.catalog_id } : {}),
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
  return path.join(os.homedir(), ".okcode", "skills");
}

export function legacyGlobalSkillsDir(): string {
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
        entries.push(buildSkillEntry({ manifest, scope, mdPath, dir: skillDir }));
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
  const legacyGlobalEntries = scanSkillsDirectory(legacyGlobalSkillsDir(), "global");
  const projectEntries = projectRoot
    ? scanSkillsDirectory(projectSkillsDir(projectRoot), "project")
    : [];

  const canonicalGlobalNames = new Set<string>();
  try {
    for (const entry of fs.readdirSync(globalSkillsDir(), { withFileTypes: true })) {
      if (entry.isDirectory()) canonicalGlobalNames.add(entry.name);
    }
  } catch {
    // Ignore unreadable canonical global directory.
  }

  // Project-scoped skills override canonical global, which overrides legacy global.
  const nameSet = new Set(projectEntries.map((e) => e.name));
  const merged = [
    ...projectEntries,
    ...globalEntries.filter((e) => !nameSet.has(e.name)),
    ...legacyGlobalEntries.filter((e) => !nameSet.has(e.name) && !canonicalGlobalNames.has(e.name)),
  ];

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

  const tryReadCandidate = (candidate: {
    dir: string;
    mdPath: string;
    scope: "global" | "project";
  }): (SkillEntry & { content: SkillContent }) | null => {
    try {
      if (!fs.existsSync(candidate.mdPath)) return null;
      const raw = fs.readFileSync(candidate.mdPath, "utf-8");
      const content = parseSkillContent(raw, name);
      return {
        ...buildSkillEntry({
          manifest: content.manifest,
          scope: candidate.scope,
          mdPath: candidate.mdPath,
          dir: candidate.dir,
        }),
        content,
      };
    } catch {
      return null;
    }
  };

  if (projectRoot) {
    const projectDir = path.join(projectSkillsDir(projectRoot), name);
    if (fs.existsSync(projectDir)) {
      return tryReadCandidate({
        dir: projectDir,
        mdPath: skillMdPath(projectDir),
        scope: "project",
      });
    }
  }

  const canonicalGlobalDir = path.join(globalSkillsDir(), name);
  if (fs.existsSync(canonicalGlobalDir)) {
    return tryReadCandidate({
      dir: canonicalGlobalDir,
      mdPath: skillMdPath(canonicalGlobalDir),
      scope: "global",
    });
  }

  const legacyGlobalDir = path.join(legacyGlobalSkillsDir(), name);
  if (fs.existsSync(legacyGlobalDir)) {
    return tryReadCandidate({
      dir: legacyGlobalDir,
      mdPath: skillMdPath(legacyGlobalDir),
      scope: "global",
    });
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
    if (fs.existsSync(projectDir)) {
      return fs.existsSync(skillMdPath(projectDir))
        ? { exists: true, scope: "project" }
        : { exists: false };
    }
  }

  const globalDir = path.join(globalSkillsDir(), name);
  if (fs.existsSync(globalDir)) {
    return fs.existsSync(skillMdPath(globalDir))
      ? { exists: true, scope: "global" }
      : { exists: false };
  }

  const legacyGlobalDir = path.join(legacyGlobalSkillsDir(), name);
  if (fs.existsSync(skillMdPath(legacyGlobalDir))) {
    return { exists: true, scope: "global" };
  }

  return { exists: false };
}

// ── Scaffold template ────────────────────────────────────────────────

function titleCaseName(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function generateSkillTemplateContent(
  name: string,
  description: string,
  options?: {
    tags?: readonly string[];
    template?: SkillTemplateKind;
    origin?: SkillOrigin;
    catalogId?: string;
  },
): string {
  const template = options?.template ?? "blank";
  const titleCase = titleCaseName(name);
  const manifest: SkillManifest = {
    name,
    description,
    tags: [...(options?.tags ?? [])],
    origin: options?.origin ?? "custom",
    ...(options?.catalogId ? { catalog_id: options.catalogId } : {}),
  };
  const whatItDoes =
    template === "docs-helper"
      ? [
          "Summarize the relevant documentation accurately.",
          "Link advice to source material when possible.",
        ]
      : template === "automation-helper"
        ? [
            "Automate repetitive workflows with clear prerequisites.",
            "Favor deterministic commands over manual steps.",
          ]
        : template === "review-helper"
          ? [
              "Review changes with emphasis on bugs, regressions, and missing validation.",
              "Present findings before summary.",
            ]
          : [description];
  const implementation =
    template === "docs-helper"
      ? ["Inspect the relevant docs first.", "Differentiate documented facts from inference."]
      : template === "automation-helper"
        ? ["Check available tools.", "Prefer repeatable scripts and safe defaults."]
        : template === "review-helper"
          ? ["Inspect the affected code paths.", "Call out severity and missing tests."]
          : ["TODO: Add step-by-step instructions, commands, code examples."];
  const bestPractices =
    template === "review-helper"
      ? ["Keep findings specific and actionable.", "Avoid speculative issues without evidence."]
      : ["TODO: Add dos and don'ts"];

  return `${serializeFrontmatter(manifest)}

# ${titleCase}

## When to use this skill

- TODO: Describe when Claude should invoke this skill

## What this skill does

${whatItDoes.map((item) => `- ${item}`).join("\n")}

## Implementation

${implementation.map((item) => `- ${item}`).join("\n")}

## Best practices

${bestPractices.map((item) => `- ${item}`).join("\n")}
`;
}

function copyDirectory(sourceDir: string, targetDir: string) {
  fs.mkdirSync(targetDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function writeSkillDirectory(input: {
  skillDir: string;
  content: string;
  supplementaryFiles?: Readonly<Record<string, string>> | undefined;
}) {
  fs.mkdirSync(input.skillDir, { recursive: true });
  fs.writeFileSync(skillMdPath(input.skillDir), input.content, "utf-8");
  for (const [fileName, fileContent] of Object.entries(input.supplementaryFiles ?? {})) {
    fs.writeFileSync(path.join(input.skillDir, fileName), fileContent, "utf-8");
  }
}

export function installBundledSkill(
  id: BundledSkillId,
  scope: "global" | "project",
  projectRoot?: string,
): { path: string; name: string } {
  const bundledSkill = getBundledSkillById(id);
  if (!bundledSkill) {
    throw new Error(`Bundled skill "${id}" not found`);
  }
  const baseDir = resolveScopeBaseDir(scope, projectRoot);
  const skillDir = path.join(baseDir, bundledSkill.skillName);
  const mdPath = skillMdPath(skillDir);
  if (fs.existsSync(mdPath)) {
    const existing = readSkill(bundledSkill.skillName, projectRoot);
    if (existing?.system) {
      return { path: mdPath, name: bundledSkill.skillName };
    }
    throw new Error(`Skill "${bundledSkill.skillName}" already exists at ${scope} scope`);
  }
  const bundledFiles = readBundledSkillFiles(id);
  writeSkillDirectory({
    skillDir,
    content: bundledFiles.skillMd,
    supplementaryFiles: bundledFiles.supplementaryFiles,
  });
  return { path: mdPath, name: bundledSkill.skillName };
}

export function ensureSystemSkillsInstalled(): void {
  for (const bundledSkill of listBundledSkills()) {
    if (!bundledSkill.entry.system) continue;
    const targetDir = path.join(globalSkillsDir(), bundledSkill.skillName);
    const targetMdPath = skillMdPath(targetDir);
    if (!fs.existsSync(targetMdPath)) {
      const bundledFiles = readBundledSkillFiles(bundledSkill.entry.id);
      writeSkillDirectory({
        skillDir: targetDir,
        content: bundledFiles.skillMd,
        supplementaryFiles: bundledFiles.supplementaryFiles,
      });
      continue;
    }
    try {
      const currentRaw = fs.readFileSync(targetMdPath, "utf-8");
      const current = parseSkillContent(currentRaw, bundledSkill.skillName);
      if (
        current.manifest.catalog_id === bundledSkill.entry.id &&
        resolveOrigin(current.manifest) === "bundled"
      ) {
        continue;
      }
    } catch {
      // Fall through to preserve existing file.
    }
  }
}

export function importSkill(
  sourcePath: string,
  scope: "global" | "project",
  projectRoot?: string,
): { path: string; name: string } {
  const sourceDir = path.resolve(sourcePath);
  const validation = validateSkillDirectory(sourceDir);
  if (!validation.valid) {
    throw new Error(validation.errors.join(", "));
  }
  const raw = fs.readFileSync(skillMdPath(sourceDir), "utf-8");
  const parsed = parseSkillContent(raw, path.basename(sourceDir));
  const nameValidation = validateSkillName(parsed.manifest.name);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.reason ?? "Invalid skill name");
  }
  const baseDir = resolveScopeBaseDir(scope, projectRoot);
  const targetDir = path.join(baseDir, parsed.manifest.name);
  const targetMdPath = skillMdPath(targetDir);
  if (fs.existsSync(targetMdPath)) {
    throw new Error(`Skill "${parsed.manifest.name}" already exists at ${scope} scope`);
  }
  copyDirectory(sourceDir, targetDir);
  const importedManifest: SkillManifest = {
    ...parsed.manifest,
    origin: "imported",
  };
  const updatedContent = `${serializeFrontmatter(importedManifest)}\n${parsed.body}`;
  fs.writeFileSync(targetMdPath, updatedContent, "utf-8");
  return { path: targetMdPath, name: parsed.manifest.name };
}

export function generateSkillTemplate(name: string, description: string): string {
  return generateSkillTemplateContent(name, description, { template: "blank" });
}

/**
 * Create a new skill with scaffold template.
 */
export function createSkill(
  name: string,
  description: string,
  scope: "global" | "project",
  options?: {
    tags?: readonly string[];
    template?: SkillTemplateKind;
  },
  projectRoot?: string,
): { path: string; name: string } {
  const nameValidation = validateSkillName(name);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.reason ?? "Invalid skill name");
  }

  const baseDir = resolveScopeBaseDir(scope, projectRoot);
  const skillDir = path.join(baseDir, name);
  const mdPath = skillMdPath(skillDir);

  if (fs.existsSync(mdPath)) {
    throw new Error(`Skill "${name}" already exists at ${scope} scope`);
  }

  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    mdPath,
    generateSkillTemplateContent(name, description, {
      origin: "custom",
      ...(options?.tags ? { tags: options.tags } : {}),
      ...(options?.template ? { template: options.template } : {}),
    }),
    "utf-8",
  );

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

  const existing = readSkill(name, projectRoot);
  if (existing && !existing.mutable) {
    throw new Error(`Skill "${name}" is immutable and cannot be removed`);
  }
  const baseDir = resolveScopeBaseDir(scope, projectRoot);
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
    name: "browse",
    description: "Open the skills library",
    usage: "/skill browse",
  },
  {
    name: "create",
    description: "Create a new skill with a guided scaffold",
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
    name: "install",
    description: "Install a recommended bundled skill",
    usage: "/skill install <name> [--scope global|project]",
  },
  {
    name: "uninstall",
    description: "Remove an installed mutable skill",
    usage: "/skill uninstall <name> [--scope global|project]",
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
