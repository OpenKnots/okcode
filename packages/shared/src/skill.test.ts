import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureSystemSkillsInstalled,
  globalSkillsDir,
  installBundledSkill,
  legacyGlobalSkillsDir,
  listSkills,
  readSkill,
  skillExists,
} from "./skill";
import { listBundledSkillAssetPaths, readBundledSkillMarkdown } from "./skillCatalog";

function writeSkill(baseDir: string, name: string, description: string) {
  const skillDir = path.join(baseDir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    [
      "---",
      `name: ${name}`,
      `description: ${description}`,
      "tags:",
      "  - test",
      "---",
      "",
      `# ${name}`,
      "",
      "## When to use this skill",
      "",
      "- Use this in tests.",
      "",
      "## What this skill does",
      "",
      `- ${description}`,
      "",
      "## Implementation",
      "",
      "- Test helper implementation.",
      "",
      "## Best practices",
      "",
      "- Keep fixtures small.",
      "",
    ].join("\n"),
    "utf-8",
  );
}

describe("skill storage", () => {
  let tempRoot = "";
  let tempHome = "";
  let projectRoot = "";
  const originalHome = process.env.HOME;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "okcode-skill-"));
    tempHome = path.join(tempRoot, "home");
    projectRoot = path.join(tempRoot, "project");
    fs.mkdirSync(tempHome, { recursive: true });
    fs.mkdirSync(projectRoot, { recursive: true });
    process.env.HOME = tempHome;
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("uses ~/.okcode/skills as the canonical global directory", () => {
    expect(globalSkillsDir()).toBe(path.join(tempHome, ".okcode", "skills"));
    expect(legacyGlobalSkillsDir()).toBe(path.join(tempHome, ".claude", "skills"));
  });

  it("resolves precedence as project, then ~/.okcode, then ~/.claude", () => {
    writeSkill(path.join(legacyGlobalSkillsDir()), "legacy-only", "Legacy skill");
    writeSkill(path.join(legacyGlobalSkillsDir()), "shared", "Legacy shared skill");
    writeSkill(path.join(globalSkillsDir()), "canonical-only", "Canonical skill");
    writeSkill(path.join(globalSkillsDir()), "shared", "Canonical shared skill");
    writeSkill(path.join(projectRoot, ".claude", "skills"), "project-only", "Project skill");
    writeSkill(path.join(projectRoot, ".claude", "skills"), "shared", "Project shared skill");

    const skills = listSkills(projectRoot);
    expect(skills.map((skill) => skill.name)).toEqual([
      "canonical-only",
      "legacy-only",
      "project-only",
      "shared",
    ]);

    expect(skills.find((skill) => skill.name === "shared")).toMatchObject({
      scope: "project",
      description: "Project shared skill",
    });
    expect(skills.find((skill) => skill.name === "canonical-only")).toMatchObject({
      scope: "global",
      description: "Canonical skill",
    });
    expect(skills.find((skill) => skill.name === "legacy-only")).toMatchObject({
      scope: "global",
      description: "Legacy skill",
    });
  });

  it("prefers ~/.okcode over ~/.claude when reading a global skill", () => {
    writeSkill(path.join(legacyGlobalSkillsDir()), "shared", "Legacy shared skill");
    writeSkill(path.join(globalSkillsDir()), "shared", "Canonical shared skill");

    const skill = readSkill("shared");
    expect(skill).not.toBeNull();
    expect(skill?.description).toBe("Canonical shared skill");
    expect(skill?.path).toBe(path.join(globalSkillsDir(), "shared", "SKILL.md"));
  });

  it("does not silently fall back to ~/.claude when the canonical ~/.okcode directory exists", () => {
    fs.mkdirSync(path.join(globalSkillsDir(), "broken"), { recursive: true });
    writeSkill(path.join(legacyGlobalSkillsDir()), "broken", "Legacy fallback skill");

    expect(readSkill("broken")).toBeNull();
    expect(skillExists("broken")).toEqual({ exists: false });
    expect(listSkills().some((skill) => skill.name === "broken")).toBe(false);
  });

  it("installs bundled recommended skills into ~/.okcode/skills", () => {
    const installed = installBundledSkill("pdf", "global");

    expect(installed.path).toBe(path.join(globalSkillsDir(), "pdf", "SKILL.md"));
    expect(fs.existsSync(installed.path)).toBe(true);
    expect(fs.readFileSync(installed.path, "utf-8")).toContain("catalog_id: pdf");
    expect(fs.existsSync(path.join(legacyGlobalSkillsDir(), "pdf", "SKILL.md"))).toBe(false);
  });

  it("bootstraps system skills into ~/.okcode/skills only", () => {
    ensureSystemSkillsInstalled();

    expect(fs.existsSync(path.join(globalSkillsDir(), "skill-creator", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(legacyGlobalSkillsDir(), "skill-creator", "SKILL.md"))).toBe(
      false,
    );
  });
});

describe("bundled recommended skill assets", () => {
  const recommendedSkills = ["pdf", "spreadsheet", "doc", "playwright", "github"] as const;

  it("materializes each recommended skill as a file-backed asset", () => {
    for (const assetPath of listBundledSkillAssetPaths()) {
      expect(fs.existsSync(assetPath)).toBe(true);
    }
  });

  it("ships full markdown for each recommended skill", () => {
    for (const skillId of recommendedSkills) {
      const markdown = readBundledSkillMarkdown(skillId);
      expect(markdown).toContain(`catalog_id: ${skillId}`);
      expect(markdown).toContain("origin: bundled");
      expect(markdown).toContain("# ");
      expect(markdown).toContain("## When to use this skill");
      expect(markdown).toContain("## What this skill does");
      expect(markdown).toContain("## Implementation");
      expect(markdown).toContain("## Best practices");
      expect(markdown.trim().length).toBeGreaterThan(400);
    }
  });
});
