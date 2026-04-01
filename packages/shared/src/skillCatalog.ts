import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { BundledSkillId, SkillCatalogEntry } from "@okcode/contracts";

export interface BundledSkillAsset {
  readonly entry: SkillCatalogEntry;
  readonly skillName: string;
  readonly sourcePath: string;
}

const SKILL_CATALOG_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "skills-catalog");

export const BUNDLED_SKILLS: readonly BundledSkillAsset[] = [
  {
    entry: {
      id: "pdf",
      name: "PDF",
      description: "Create, edit, and review PDFs.",
      category: "recommended",
      tags: ["docs", "pdf", "review"],
      icon: "file-text",
      installScopeDefault: "global",
      system: false,
      recommended: true,
      immutable: false,
      sourceType: "bundled",
      sourceRef: "bundled:pdf",
    },
    skillName: "pdf",
    sourcePath: "recommended/pdf/SKILL.md",
  },
  {
    entry: {
      id: "spreadsheet",
      name: "Spreadsheet",
      description: "Create, edit, and analyze spreadsheets.",
      category: "recommended",
      tags: ["spreadsheet", "analysis", "csv"],
      icon: "sheet",
      installScopeDefault: "global",
      system: false,
      recommended: true,
      immutable: false,
      sourceType: "bundled",
      sourceRef: "bundled:spreadsheet",
    },
    skillName: "spreadsheet",
    sourcePath: "recommended/spreadsheet/SKILL.md",
  },
  {
    entry: {
      id: "doc",
      name: "Doc",
      description: "Edit and review docx-style documents.",
      category: "recommended",
      tags: ["docs", "docx", "writing"],
      icon: "doc",
      installScopeDefault: "global",
      system: false,
      recommended: true,
      immutable: false,
      sourceType: "bundled",
      sourceRef: "bundled:doc",
    },
    skillName: "doc",
    sourcePath: "recommended/doc/SKILL.md",
  },
  {
    entry: {
      id: "playwright",
      name: "Playwright",
      description: "Automate real browsers from the terminal.",
      category: "recommended",
      tags: ["browser", "testing", "automation"],
      icon: "play",
      installScopeDefault: "global",
      system: false,
      recommended: true,
      immutable: false,
      sourceType: "bundled",
      sourceRef: "bundled:playwright",
    },
    skillName: "playwright",
    sourcePath: "recommended/playwright/SKILL.md",
  },
  {
    entry: {
      id: "github",
      name: "GitHub",
      description: "Inspect repositories, PRs, issues, and CI workflows.",
      category: "recommended",
      tags: ["github", "pr", "issues"],
      icon: "github",
      installScopeDefault: "global",
      system: false,
      recommended: true,
      immutable: false,
      sourceType: "bundled",
      sourceRef: "bundled:github",
    },
    skillName: "github",
    sourcePath: "recommended/github/SKILL.md",
  },
  {
    entry: {
      id: "skill-creator",
      name: "Skill Creator",
      description: "Create or update a skill.",
      category: "system",
      tags: ["skills", "authoring"],
      icon: "pencil",
      installScopeDefault: "global",
      system: true,
      recommended: false,
      immutable: true,
      sourceType: "bundled",
      sourceRef: "bundled:skill-creator",
    },
    skillName: "skill-creator",
    sourcePath: "system/skill-creator/SKILL.md",
  },
  {
    entry: {
      id: "image-gen",
      name: "Image Gen",
      description: "Generate or edit images for product and content work.",
      category: "system",
      tags: ["images", "design"],
      icon: "image",
      installScopeDefault: "global",
      system: true,
      recommended: false,
      immutable: true,
      sourceType: "bundled",
      sourceRef: "bundled:image-gen",
    },
    skillName: "image-gen",
    sourcePath: "system/image-gen/SKILL.md",
  },
  {
    entry: {
      id: "plugin-creator",
      name: "Plugin Creator",
      description: "Scaffold plugins and marketplace entries.",
      category: "system",
      tags: ["plugins", "scaffold"],
      icon: "plug",
      installScopeDefault: "global",
      system: true,
      recommended: false,
      immutable: true,
      sourceType: "bundled",
      sourceRef: "bundled:plugin-creator",
    },
    skillName: "plugin-creator",
    sourcePath: "system/plugin-creator/SKILL.md",
  },
  {
    entry: {
      id: "skill-installer",
      name: "Skill Installer",
      description: "Install curated skills into the local environment.",
      category: "system",
      tags: ["skills", "install"],
      icon: "download",
      installScopeDefault: "global",
      system: true,
      recommended: false,
      immutable: true,
      sourceType: "bundled",
      sourceRef: "bundled:skill-installer",
    },
    skillName: "skill-installer",
    sourcePath: "system/skill-installer/SKILL.md",
  },
  {
    entry: {
      id: "openclaw-docs",
      name: "OpenClaw Docs",
      description: "Reference first-party OpenClaw and OK Code documentation.",
      category: "docs",
      tags: ["docs", "openclaw", "okcode"],
      icon: "book-open",
      installScopeDefault: "global",
      system: true,
      recommended: false,
      immutable: true,
      sourceType: "bundled",
      sourceRef: "bundled:openclaw-docs",
    },
    skillName: "openclaw-docs",
    sourcePath: "docs/openclaw-docs/SKILL.md",
  },
  {
    entry: {
      id: "openai-docs",
      name: "OpenAI Docs",
      description: "Reference official OpenAI docs and API guidance.",
      category: "docs",
      tags: ["docs", "openai", "api"],
      icon: "book-open",
      installScopeDefault: "global",
      system: true,
      recommended: false,
      immutable: true,
      sourceType: "bundled",
      sourceRef: "bundled:openai-docs",
    },
    skillName: "openai-docs",
    sourcePath: "docs/openai-docs/SKILL.md",
  },
  {
    entry: {
      id: "anthropic-docs",
      name: "Anthropic Docs",
      description: "Reference official Anthropic docs and Claude guidance.",
      category: "docs",
      tags: ["docs", "anthropic", "claude"],
      icon: "book-open",
      installScopeDefault: "global",
      system: true,
      recommended: false,
      immutable: true,
      sourceType: "bundled",
      sourceRef: "bundled:anthropic-docs",
    },
    skillName: "anthropic-docs",
    sourcePath: "docs/anthropic-docs/SKILL.md",
  },
] as const;

function resolveBundledSkillPath(relativePath: string): string {
  return path.join(SKILL_CATALOG_DIR, relativePath);
}

function readBundledSkillSupplementaryFiles(sourcePath: string): Readonly<Record<string, string>> {
  const sourceDir = path.dirname(sourcePath);
  const supplementaryFiles: Record<string, string> = {};
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name === "SKILL.md" || entry.name.startsWith(".")) continue;
    supplementaryFiles[entry.name] = fs.readFileSync(path.join(sourceDir, entry.name), "utf-8");
  }
  return supplementaryFiles;
}

export function listBundledSkills(): readonly BundledSkillAsset[] {
  return BUNDLED_SKILLS;
}

export function listBundledSkillAssetPaths(): readonly string[] {
  return BUNDLED_SKILLS.map((skill) => resolveBundledSkillPath(skill.sourcePath));
}

export function getBundledSkillById(id: BundledSkillId): BundledSkillAsset | undefined {
  return BUNDLED_SKILLS.find((skill) => skill.entry.id === id);
}

export function getBundledSkillByName(name: string): BundledSkillAsset | undefined {
  const lowerName = name.trim().toLowerCase();
  return BUNDLED_SKILLS.find(
    (skill) => skill.skillName === lowerName || skill.entry.name.toLowerCase() === lowerName,
  );
}

export function readBundledSkillMarkdown(id: BundledSkillId): string {
  const skill = getBundledSkillById(id);
  if (!skill) {
    throw new Error(`Bundled skill "${id}" not found`);
  }
  const absolutePath = resolveBundledSkillPath(skill.sourcePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Bundled skill source file not found: ${absolutePath}`);
  }
  return fs.readFileSync(absolutePath, "utf-8");
}

export function readBundledSkillFiles(id: BundledSkillId): {
  readonly skillMd: string;
  readonly supplementaryFiles: Readonly<Record<string, string>>;
} {
  const skill = getBundledSkillById(id);
  if (!skill) {
    throw new Error(`Bundled skill "${id}" not found`);
  }
  const absolutePath = resolveBundledSkillPath(skill.sourcePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Bundled skill source file not found: ${absolutePath}`);
  }
  return {
    skillMd: fs.readFileSync(absolutePath, "utf-8"),
    supplementaryFiles: readBundledSkillSupplementaryFiles(absolutePath),
  };
}
