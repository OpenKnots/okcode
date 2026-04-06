import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promises as fsPromises } from "node:fs";

import type {
  PrReviewConfig,
  PrReviewConfigIssue,
  PrReviewRepoConfigUpdatedPayload,
  PrReviewRuleDefinition,
  PrReviewRules,
  PrSkillSetDefinition,
  PrWorkflowDefinition,
  PrWorkflowStep,
} from "@okcode/contracts";
import { Effect, Layer } from "effect";
import YAML from "yaml";
import { runProcess } from "../../processRunner";
import {
  encodePrReviewLocalCommandAction,
  parseGitHubRepositoryNameWithOwnerFromRemoteUrl,
} from "../localProfiles.ts";
import { RepoReviewConfig, type RepoReviewConfigShape } from "../Services/RepoReviewConfig.ts";
import { PrReviewConfigError } from "../Errors.ts";

const REVIEW_RULES_RELATIVE_PATH = ".okcode/review-rules.md";
const WORKFLOWS_RELATIVE_DIR = ".okcode/workflows";
const SKILL_SETS_RELATIVE_DIR = ".okcode/skill-sets";
const LOCAL_PROFILE_RELATIVE_DIR = "pr-review-profiles";

type LocalProfileDefinition = {
  id: string;
  title: string;
  body: string;
  repositories: string[];
  adapter: "openclawMaintainer";
  maintainersRepo: string;
  relativePath: string;
  absolutePath: string;
};

const DEFAULT_BLOCKING_RULES: PrReviewRuleDefinition[] = [
  {
    id: "clean-merge",
    title: "Require a clean merge",
    description: "Do not submit or merge while GitHub reports merge conflicts.",
  },
];

const DEFAULT_ADVISORY_RULES: PrReviewRuleDefinition[] = [
  {
    id: "scope-clear",
    title: "Scope and intent are clear",
    description: "The pull request should explain what changed and why.",
  },
  {
    id: "tests-reviewed",
    title: "Tests or validation reviewed",
    description: "Review should confirm the change has meaningful validation.",
  },
];

const DEFAULT_RULES: PrReviewRules = {
  version: "1",
  title: "Default Review Rules",
  mergePolicy: "require-clean-merge",
  conflictPolicy: "preview-before-apply",
  requiredChecks: [],
  requiredApprovals: 0,
  blockingRules: DEFAULT_BLOCKING_RULES,
  advisoryRules: DEFAULT_ADVISORY_RULES,
  defaultWorkflow: "pr-review",
  mentionGroups: [],
  body: "Default OK Code PR review policy.",
  relativePath: REVIEW_RULES_RELATIVE_PATH,
};

const DEFAULT_WORKFLOW_STEPS: PrWorkflowStep[] = [
  {
    id: "review-context",
    title: "Review context",
    kind: "checklist",
    blocking: false,
    action: null,
    skillSet: null,
    requiresConfirmation: false,
    successMessage: "Context reviewed.",
    failureMessage: null,
    description: "Review the PR description, changed files, and discussion before commenting.",
  },
  {
    id: "remote-checks",
    title: "Required checks",
    kind: "remoteCheck",
    blocking: true,
    action: "check-required-status",
    skillSet: null,
    requiresConfirmation: false,
    successMessage: "Required checks passed.",
    failureMessage: "Required checks are still pending or failing.",
    description: "Required remote checks must pass before final approval.",
  },
  {
    id: "merge-conflicts",
    title: "Merge conflict analysis",
    kind: "conflictAnalysis",
    blocking: true,
    action: "analyze-conflicts",
    skillSet: null,
    requiresConfirmation: false,
    successMessage: "Merge conflict policy satisfied.",
    failureMessage: "Merge conflicts require review before approval.",
    description: "Check mergeability and, if needed, review safe conflict resolutions.",
  },
  {
    id: "submit-review",
    title: "Submit review",
    kind: "reviewAction",
    blocking: false,
    action: "submit-review",
    skillSet: null,
    requiresConfirmation: true,
    successMessage: "Review submitted.",
    failureMessage: "Submit a review action to finish the workflow.",
    description: "Comment, approve, or request changes once review is complete.",
  },
];

const DEFAULT_WORKFLOW: PrWorkflowDefinition = {
  id: "pr-review",
  title: "PR Review",
  description: "Default repo workflow for GitHub pull request review.",
  appliesTo: ["pull-request"],
  blocking: true,
  steps: DEFAULT_WORKFLOW_STEPS,
  body: "Default OK Code PR review workflow.",
  relativePath: `${WORKFLOWS_RELATIVE_DIR}/pr-review.md`,
};

interface ParsedFrontmatter<T> {
  exists: boolean;
  relativePath: string;
  absolutePath: string;
  raw: string | null;
  fallback: T;
}

function toIssue(
  severity: PrReviewConfigIssue["severity"],
  relativePath: string,
  message: string,
): PrReviewConfigIssue {
  return { severity, path: relativePath, message };
}

function splitFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body: string } {
  const normalized = raw.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) {
    return { frontmatter: {}, body: normalized.trim() };
  }
  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return { frontmatter: {}, body: normalized.trim() };
  }
  const yamlBlock = normalized.slice(4, closingIndex);
  const body = normalized.slice(closingIndex + 5).trim();
  const parsed = YAML.parse(yamlBlock);
  return {
    frontmatter: typeof parsed === "object" && parsed !== null ? parsed : {},
    body,
  };
}

function normalizeRuleDefinitions(value: unknown): PrReviewRuleDefinition[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        if (trimmed.length === 0) return null;
        return { id: trimmed, title: trimmed, description: null };
      }
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const id = String(record.id ?? record.title ?? `rule-${index + 1}`).trim();
      const title = String(record.title ?? record.id ?? id).trim();
      const description =
        typeof record.description === "string" && record.description.trim().length > 0
          ? record.description.trim()
          : null;
      if (id.length === 0 || title.length === 0) return null;
      return { id, title, description };
    })
    .filter((entry): entry is PrReviewRuleDefinition => entry !== null);
}

function normalizeMentionGroups(value: unknown): PrReviewRules["mentionGroups"] {
  if (!Array.isArray(value)) return [];

  const groups: Array<PrReviewRules["mentionGroups"][number]> = [];
  for (const [index, entry] of value.entries()) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = String(record.id ?? record.title ?? `group-${index + 1}`).trim();
    const title = String(record.title ?? record.id ?? id).trim();
    if (id.length === 0 || title.length === 0) continue;
    const users = Array.isArray(record.users)
      ? record.users
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item) => item.length > 0)
      : [];
    groups.push({ id, title, users });
  }
  return groups;
}

function normalizeWorkflowSteps(value: unknown): PrWorkflowStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const id = String(record.id ?? record.title ?? `step-${index + 1}`).trim();
      const title = String(record.title ?? record.id ?? id).trim();
      const kind = String(record.kind ?? "checklist").trim();
      if (id.length === 0 || title.length === 0) return null;
      if (
        ![
          "checklist",
          "remoteCheck",
          "reviewAction",
          "skillSet",
          "conflictAnalysis",
          "manualApproval",
          "openExternal",
        ].includes(kind)
      ) {
        return null;
      }
      return {
        id,
        title,
        kind: kind as PrWorkflowStep["kind"],
        blocking: Boolean(record.blocking),
        action:
          typeof record.action === "string" && record.action.trim().length > 0
            ? record.action.trim()
            : null,
        skillSet:
          typeof record.skillSet === "string" && record.skillSet.trim().length > 0
            ? record.skillSet.trim()
            : null,
        requiresConfirmation: Boolean(record.requiresConfirmation),
        successMessage:
          typeof record.successMessage === "string" && record.successMessage.trim().length > 0
            ? record.successMessage.trim()
            : null,
        failureMessage:
          typeof record.failureMessage === "string" && record.failureMessage.trim().length > 0
            ? record.failureMessage.trim()
            : null,
        description:
          typeof record.description === "string" && record.description.trim().length > 0
            ? record.description.trim()
            : null,
      };
    })
    .filter((entry): entry is PrWorkflowStep => entry !== null);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function normalizeRepositoryMatcher(value: string): string {
  return value.trim().toLowerCase();
}

function resolveOkcodeHome(): string {
  const raw = process.env.OKCODE_HOME?.trim();
  if (!raw) {
    return path.join(os.homedir(), ".okcode");
  }
  if (raw === "~") {
    return os.homedir();
  }
  if (raw.startsWith("~/") || raw.startsWith("~\\")) {
    return path.join(os.homedir(), raw.slice(2));
  }
  return path.resolve(raw);
}

function resolveMaybeHomePath(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "~") {
    return os.homedir();
  }
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return path.resolve(trimmed);
}

function readTitleAndDescription(input: {
  raw: string | null;
  fallbackTitle: string;
  fallbackDescription?: string | null;
}): { title: string; description: string | null; body: string } {
  if (!input.raw) {
    return {
      title: input.fallbackTitle,
      description: input.fallbackDescription ?? null,
      body: "",
    };
  }
  try {
    const { frontmatter, body } = splitFrontmatter(input.raw);
    const title =
      typeof frontmatter.title === "string" && frontmatter.title.trim().length > 0
        ? frontmatter.title.trim()
        : input.fallbackTitle;
    const description =
      typeof frontmatter.description === "string" && frontmatter.description.trim().length > 0
        ? frontmatter.description.trim()
        : (input.fallbackDescription ?? null);
    return { title, description, body };
  } catch {
    return {
      title: input.fallbackTitle,
      description: input.fallbackDescription ?? null,
      body: input.raw.trim(),
    };
  }
}

function parseRulesDocument(input: ParsedFrontmatter<PrReviewRules>): {
  rules: PrReviewRules;
  issues: PrReviewConfigIssue[];
} {
  if (!input.exists || !input.raw) {
    return { rules: input.fallback, issues: [] };
  }

  try {
    const { frontmatter, body } = splitFrontmatter(input.raw);
    const requiredChecks = Array.isArray(frontmatter.requiredChecks)
      ? frontmatter.requiredChecks
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter((value) => value.length > 0)
      : [];

    const nextRules: PrReviewRules = {
      version:
        typeof frontmatter.version === "string" && frontmatter.version.trim().length > 0
          ? frontmatter.version.trim()
          : input.fallback.version,
      title:
        typeof frontmatter.title === "string" && frontmatter.title.trim().length > 0
          ? frontmatter.title.trim()
          : input.fallback.title,
      mergePolicy:
        typeof frontmatter.mergePolicy === "string" && frontmatter.mergePolicy.trim().length > 0
          ? frontmatter.mergePolicy.trim()
          : input.fallback.mergePolicy,
      conflictPolicy:
        typeof frontmatter.conflictPolicy === "string" &&
        frontmatter.conflictPolicy.trim().length > 0
          ? frontmatter.conflictPolicy.trim()
          : input.fallback.conflictPolicy,
      requiredChecks,
      requiredApprovals:
        typeof frontmatter.requiredApprovals === "number" &&
        Number.isInteger(frontmatter.requiredApprovals) &&
        frontmatter.requiredApprovals >= 0
          ? frontmatter.requiredApprovals
          : input.fallback.requiredApprovals,
      blockingRules: normalizeRuleDefinitions(frontmatter.blockingRules),
      advisoryRules: normalizeRuleDefinitions(frontmatter.advisoryRules),
      defaultWorkflow:
        typeof frontmatter.defaultWorkflow === "string" &&
        frontmatter.defaultWorkflow.trim().length > 0
          ? frontmatter.defaultWorkflow.trim()
          : input.fallback.defaultWorkflow,
      mentionGroups: normalizeMentionGroups(frontmatter.mentionGroups),
      body: body.length > 0 ? body : input.fallback.body,
      relativePath: input.relativePath,
    };

    return { rules: nextRules, issues: [] };
  } catch (error) {
    return {
      rules: input.fallback,
      issues: [
        toIssue("error", input.relativePath, `Failed to parse frontmatter: ${String(error)}`),
      ],
    };
  }
}

function parseWorkflowDocument(input: ParsedFrontmatter<PrWorkflowDefinition>): {
  workflow: PrWorkflowDefinition;
  issues: PrReviewConfigIssue[];
} {
  if (!input.exists || !input.raw) {
    return { workflow: input.fallback, issues: [] };
  }

  try {
    const { frontmatter, body } = splitFrontmatter(input.raw);
    const steps = normalizeWorkflowSteps(frontmatter.steps);
    const workflow: PrWorkflowDefinition = {
      id:
        typeof frontmatter.id === "string" && frontmatter.id.trim().length > 0
          ? frontmatter.id.trim()
          : input.fallback.id,
      title:
        typeof frontmatter.title === "string" && frontmatter.title.trim().length > 0
          ? frontmatter.title.trim()
          : input.fallback.title,
      description:
        typeof frontmatter.description === "string" && frontmatter.description.trim().length > 0
          ? frontmatter.description.trim()
          : input.fallback.description,
      appliesTo: Array.isArray(frontmatter.appliesTo)
        ? frontmatter.appliesTo
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value) => value.length > 0)
        : input.fallback.appliesTo,
      blocking:
        typeof frontmatter.blocking === "boolean" ? frontmatter.blocking : input.fallback.blocking,
      steps: steps.length > 0 ? steps : input.fallback.steps,
      body: body.length > 0 ? body : input.fallback.body,
      relativePath: input.relativePath,
    };
    return { workflow, issues: [] };
  } catch (error) {
    return {
      workflow: input.fallback,
      issues: [
        toIssue("error", input.relativePath, `Failed to parse frontmatter: ${String(error)}`),
      ],
    };
  }
}

function parseSkillSetDocument(input: ParsedFrontmatter<PrSkillSetDefinition>): {
  skillSet: PrSkillSetDefinition;
  issues: PrReviewConfigIssue[];
} {
  if (!input.exists || !input.raw) {
    return { skillSet: input.fallback, issues: [] };
  }

  try {
    const { frontmatter, body } = splitFrontmatter(input.raw);
    const skillSet: PrSkillSetDefinition = {
      id:
        typeof frontmatter.id === "string" && frontmatter.id.trim().length > 0
          ? frontmatter.id.trim()
          : input.fallback.id,
      title:
        typeof frontmatter.title === "string" && frontmatter.title.trim().length > 0
          ? frontmatter.title.trim()
          : input.fallback.title,
      description:
        typeof frontmatter.description === "string" && frontmatter.description.trim().length > 0
          ? frontmatter.description.trim()
          : input.fallback.description,
      skills: Array.isArray(frontmatter.skills)
        ? frontmatter.skills
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value) => value.length > 0)
        : input.fallback.skills,
      allowedTools: Array.isArray(frontmatter.allowedTools)
        ? frontmatter.allowedTools
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value) => value.length > 0)
        : input.fallback.allowedTools,
      runPolicy:
        typeof frontmatter.runPolicy === "string" && frontmatter.runPolicy.trim().length > 0
          ? frontmatter.runPolicy.trim()
          : input.fallback.runPolicy,
      body: body.length > 0 ? body : input.fallback.body,
      relativePath: input.relativePath,
    };
    return { skillSet, issues: [] };
  } catch (error) {
    return {
      skillSet: input.fallback,
      issues: [
        toIssue("error", input.relativePath, `Failed to parse frontmatter: ${String(error)}`),
      ],
    };
  }
}

function parseLocalProfileDocument(input: { absolutePath: string; raw: string }): {
  profile: LocalProfileDefinition | null;
  issues: PrReviewConfigIssue[];
} {
  const relativePath = path.join(LOCAL_PROFILE_RELATIVE_DIR, path.basename(input.absolutePath));
  try {
    const { frontmatter, body } = splitFrontmatter(input.raw);
    const repositories = normalizeStringArray(frontmatter.repositories).map(
      normalizeRepositoryMatcher,
    );
    const adapterRaw = typeof frontmatter.adapter === "string" ? frontmatter.adapter.trim() : "";
    const maintainersRepoRaw =
      typeof frontmatter.maintainersRepo === "string" ? frontmatter.maintainersRepo.trim() : "";
    const id =
      typeof frontmatter.id === "string" && frontmatter.id.trim().length > 0
        ? frontmatter.id.trim()
        : path.basename(input.absolutePath, path.extname(input.absolutePath));
    const title =
      typeof frontmatter.title === "string" && frontmatter.title.trim().length > 0
        ? frontmatter.title.trim()
        : id;

    if (repositories.length === 0) {
      return {
        profile: null,
        issues: [toIssue("warning", relativePath, "Profile is missing repositories[] matchers.")],
      };
    }
    if (adapterRaw !== "openclawMaintainer") {
      return {
        profile: null,
        issues: [
          toIssue("warning", relativePath, `Unsupported adapter "${adapterRaw || "(missing)"}".`),
        ],
      };
    }
    if (maintainersRepoRaw.length === 0) {
      return {
        profile: null,
        issues: [toIssue("warning", relativePath, "Profile is missing maintainersRepo.")],
      };
    }

    return {
      profile: {
        id,
        title,
        body,
        repositories,
        adapter: "openclawMaintainer",
        maintainersRepo: resolveMaybeHomePath(maintainersRepoRaw),
        relativePath,
        absolutePath: input.absolutePath,
      },
      issues: [],
    };
  } catch (error) {
    return {
      profile: null,
      issues: [toIssue("error", relativePath, `Failed to parse frontmatter: ${String(error)}`)],
    };
  }
}

async function readMarkdownFile(
  cwd: string,
  relativePath: string,
): Promise<{ exists: boolean; raw: string | null; absolutePath: string }> {
  const absolutePath = path.join(cwd, relativePath);
  try {
    const raw = await fsPromises.readFile(absolutePath, "utf8");
    return { exists: true, raw, absolutePath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { exists: false, raw: null, absolutePath };
    }
    throw error;
  }
}

async function readMarkdownFileAbsolute(
  absolutePath: string,
): Promise<{ exists: boolean; raw: string | null; absolutePath: string }> {
  try {
    const raw = await fsPromises.readFile(absolutePath, "utf8");
    return { exists: true, raw, absolutePath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { exists: false, raw: null, absolutePath };
    }
    throw error;
  }
}

async function listMarkdownFiles(cwd: string, relativeDir: string): Promise<string[]> {
  const absoluteDir = path.join(cwd, relativeDir);
  try {
    const entries = await fsPromises.readdir(absoluteDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => path.posix.join(relativeDir.replaceAll("\\", "/"), entry.name))
      .toSorted((a, b) => a.localeCompare(b));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function listMarkdownFilesAbsolute(absoluteDir: string): Promise<string[]> {
  try {
    const entries = await fsPromises.readdir(absoluteDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => path.join(absoluteDir, entry.name))
      .toSorted((a, b) => a.localeCompare(b));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function determineGitHubRepositoryNameWithOwner(cwd: string): Promise<string | null> {
  const remote = await runProcess("git", ["remote", "get-url", "origin"], {
    cwd,
    timeoutMs: 5_000,
    allowNonZeroExit: true,
  });
  const remoteUrl = remote.stdout.trim() || remote.stderr.trim();
  return parseGitHubRepositoryNameWithOwnerFromRemoteUrl(remoteUrl);
}

async function buildOpenClawMaintainerConfig(input: {
  profile: LocalProfileDefinition;
  issues: PrReviewConfigIssue[];
}): Promise<PrReviewConfig> {
  const workflowPath = path.join(input.profile.maintainersRepo, ".agents/skills/PR_WORKFLOW.md");
  const reviewSkillPath = path.join(
    input.profile.maintainersRepo,
    ".agents/skills/review-pr/SKILL.md",
  );
  const prepareSkillPath = path.join(
    input.profile.maintainersRepo,
    ".agents/skills/prepare-pr/SKILL.md",
  );
  const mergeSkillPath = path.join(
    input.profile.maintainersRepo,
    ".agents/skills/merge-pr/SKILL.md",
  );

  const workflowFile = await readMarkdownFileAbsolute(workflowPath);
  const reviewSkillFile = await readMarkdownFileAbsolute(reviewSkillPath);
  const prepareSkillFile = await readMarkdownFileAbsolute(prepareSkillPath);
  const mergeSkillFile = await readMarkdownFileAbsolute(mergeSkillPath);

  if (!workflowFile.exists) {
    input.issues.push(
      toIssue(
        "warning",
        input.profile.relativePath,
        `Maintainer workflow file not found at ${workflowPath}. Falling back to a minimal local profile.`,
      ),
    );
  }
  for (const missing of [
    { label: "review-pr skill", file: reviewSkillFile },
    { label: "prepare-pr skill", file: prepareSkillFile },
    { label: "merge-pr skill", file: mergeSkillFile },
  ]) {
    if (!missing.file.exists) {
      input.issues.push(
        toIssue(
          "warning",
          input.profile.relativePath,
          `${missing.label} not found at ${missing.file.absolutePath}.`,
        ),
      );
    }
  }

  const workflowDoc = readTitleAndDescription({
    raw: workflowFile.raw,
    fallbackTitle: "OpenClaw Maintainer PR Workflow",
    fallbackDescription: "Private maintainer workflow loaded from a local OK Code profile.",
  });
  const reviewSkillDoc = readTitleAndDescription({
    raw: reviewSkillFile.raw,
    fallbackTitle: "review-pr",
    fallbackDescription: "Run the read-only maintainer review workflow.",
  });
  const prepareSkillDoc = readTitleAndDescription({
    raw: prepareSkillFile.raw,
    fallbackTitle: "prepare-pr",
    fallbackDescription: "Resolve findings, re-run gates, and push safely.",
  });
  const mergeSkillDoc = readTitleAndDescription({
    raw: mergeSkillFile.raw,
    fallbackTitle: "merge-pr",
    fallbackDescription: "Verify readiness and perform the deterministic squash merge.",
  });

  const workflowId = `${input.profile.id}-workflow`;
  const skillSets: PrSkillSetDefinition[] = [
    {
      id: "review-pr",
      title: reviewSkillDoc.title,
      description: reviewSkillDoc.description,
      skills: ["review-pr"],
      allowedTools: ["local-command"],
      runPolicy: "script-first",
      body: reviewSkillDoc.body,
      relativePath: reviewSkillPath,
    },
    {
      id: "prepare-pr",
      title: prepareSkillDoc.title,
      description: prepareSkillDoc.description,
      skills: ["prepare-pr"],
      allowedTools: ["local-command"],
      runPolicy: "script-first",
      body: prepareSkillDoc.body,
      relativePath: prepareSkillPath,
    },
    {
      id: "merge-pr",
      title: mergeSkillDoc.title,
      description: mergeSkillDoc.description,
      skills: ["merge-pr"],
      allowedTools: ["local-command"],
      runPolicy: "script-first",
      body: mergeSkillDoc.body,
      relativePath: mergeSkillPath,
    },
  ];

  const workflow: PrWorkflowDefinition = {
    id: workflowId,
    title: workflowDoc.title,
    description: workflowDoc.description,
    appliesTo: ["pull-request"],
    blocking: true,
    body:
      input.profile.body.length > 0
        ? input.profile.body
        : workflowDoc.body || "Local private maintainer workflow.",
    relativePath: workflowPath,
    steps: [
      {
        id: "review-pr",
        title: reviewSkillDoc.title,
        kind: "skillSet",
        blocking: true,
        action: encodePrReviewLocalCommandAction({
          kind: "localCommand",
          cwd: input.profile.maintainersRepo,
          args: ["scripts/pr-review", "{{prNumber}}"],
          label: "review-pr",
        }),
        skillSet: "review-pr",
        requiresConfirmation: true,
        successMessage: "Review artifacts refreshed.",
        failureMessage: "The review workflow did not complete successfully.",
        description: reviewSkillDoc.description,
      },
      {
        id: "prepare-pr",
        title: prepareSkillDoc.title,
        kind: "skillSet",
        blocking: true,
        action: encodePrReviewLocalCommandAction({
          kind: "localCommand",
          cwd: input.profile.maintainersRepo,
          args: ["scripts/pr-prepare", "run", "{{prNumber}}"],
          label: "prepare-pr",
        }),
        skillSet: "prepare-pr",
        requiresConfirmation: true,
        successMessage: "Preparation completed and push safety checks passed.",
        failureMessage: "Preparation failed or left the PR not ready to merge.",
        description: prepareSkillDoc.description,
      },
      {
        id: "merge-pr",
        title: mergeSkillDoc.title,
        kind: "skillSet",
        blocking: true,
        action: encodePrReviewLocalCommandAction({
          kind: "localCommand",
          cwd: input.profile.maintainersRepo,
          args: ["scripts/pr-merge", "run", "{{prNumber}}"],
          label: "merge-pr",
        }),
        skillSet: "merge-pr",
        requiresConfirmation: true,
        successMessage: "Merge workflow completed.",
        failureMessage: "Merge verification failed or GitHub rejected the merge.",
        description: mergeSkillDoc.description,
      },
    ],
  };

  return {
    source: "localProfile",
    rules: {
      version: "1",
      title: input.profile.title,
      mergePolicy: "maintainer-script-first",
      conflictPolicy: "workflow-verification-before-merge",
      requiredChecks: [],
      requiredApprovals: 0,
      blockingRules: [
        {
          id: "phase-order",
          title: "Run review, prepare, and merge in order",
          description: "The local maintainer flow expects review-pr, prepare-pr, then merge-pr.",
        },
        {
          id: "artifact-handoff",
          title: "Artifacts are mandatory",
          description:
            "review-pr and prepare-pr must generate the structured handoff artifacts before merge.",
        },
      ],
      advisoryRules: [
        {
          id: "human-judgment",
          title: "Maintainers provide judgment",
          description:
            "Use the local workflow to gather truth, but pause at each phase boundary for judgment.",
        },
      ],
      mentionGroups: [],
      body:
        workflowDoc.body.length > 0
          ? workflowDoc.body
          : "Private maintainer workflow loaded from a local OK Code profile.",
      relativePath: workflowPath,
      defaultWorkflow: workflowId,
    },
    workflows: [workflow],
    skillSets,
    defaultWorkflowId: workflowId,
    issues: input.issues,
  } satisfies PrReviewConfig;
}

async function loadLocalProfileConfig(cwd: string): Promise<{
  config: PrReviewConfig | null;
  issues: PrReviewConfigIssue[];
}> {
  const repositoryNameWithOwner = await determineGitHubRepositoryNameWithOwner(cwd);
  if (!repositoryNameWithOwner) {
    return { config: null, issues: [] };
  }

  const normalizedRepository = normalizeRepositoryMatcher(repositoryNameWithOwner);
  const profileDir = path.join(resolveOkcodeHome(), LOCAL_PROFILE_RELATIVE_DIR);
  const profilePaths = await listMarkdownFilesAbsolute(profileDir);
  if (profilePaths.length === 0) {
    return { config: null, issues: [] };
  }

  const issues: PrReviewConfigIssue[] = [];
  for (const profilePath of profilePaths) {
    const profileFile = await readMarkdownFileAbsolute(profilePath);
    if (!profileFile.exists || !profileFile.raw) {
      continue;
    }
    const parsed = parseLocalProfileDocument({
      absolutePath: profilePath,
      raw: profileFile.raw,
    });
    issues.push(...parsed.issues);
    if (!parsed.profile) {
      continue;
    }
    if (!parsed.profile.repositories.includes(normalizedRepository)) {
      continue;
    }
    if (parsed.profile.adapter === "openclawMaintainer") {
      return {
        config: await buildOpenClawMaintainerConfig({
          profile: parsed.profile,
          issues: [...issues],
        }),
        issues,
      };
    }
  }

  return { config: null, issues };
}

type CacheEntry = {
  config: PrReviewConfig;
  stale: boolean;
};

const makeRepoReviewConfig = Effect.sync(() => {
  const cache = new Map<string, CacheEntry>();
  const listenersByCwd = new Map<
    string,
    Set<(payload: PrReviewRepoConfigUpdatedPayload) => void>
  >();
  const watcherByCwd = new Map<string, fs.FSWatcher[]>();

  const emitChange = (cwd: string, relativePaths: string[]) => {
    const cached = cache.get(cwd);
    if (cached) {
      cached.stale = true;
    }
    const payload: PrReviewRepoConfigUpdatedPayload = {
      cwd,
      relativePaths,
    };
    for (const listener of listenersByCwd.get(cwd) ?? []) {
      listener(payload);
    }
  };

  const loadConfig = async (cwd: string): Promise<PrReviewConfig> => {
    const issues: PrReviewConfigIssue[] = [];
    const rulesSource = await readMarkdownFile(cwd, REVIEW_RULES_RELATIVE_PATH);
    const parsedRules = parseRulesDocument({
      ...rulesSource,
      relativePath: REVIEW_RULES_RELATIVE_PATH,
      fallback: DEFAULT_RULES,
    });
    issues.push(...parsedRules.issues);

    const workflowPaths = await listMarkdownFiles(cwd, WORKFLOWS_RELATIVE_DIR);
    const workflows: PrWorkflowDefinition[] = [];
    if (workflowPaths.length === 0) {
      workflows.push(DEFAULT_WORKFLOW);
    } else {
      for (const relativePath of workflowPaths) {
        const file = await readMarkdownFile(cwd, relativePath);
        const fallback = {
          ...DEFAULT_WORKFLOW,
          id: path.basename(relativePath, path.extname(relativePath)),
          title: path.basename(relativePath, path.extname(relativePath)),
          relativePath,
        };
        const parsed = parseWorkflowDocument({
          ...file,
          relativePath,
          fallback,
        });
        workflows.push(parsed.workflow);
        issues.push(...parsed.issues);
      }
    }

    const skillSetPaths = await listMarkdownFiles(cwd, SKILL_SETS_RELATIVE_DIR);
    const skillSets: PrSkillSetDefinition[] = [];
    for (const relativePath of skillSetPaths) {
      const file = await readMarkdownFile(cwd, relativePath);
      const fallback: PrSkillSetDefinition = {
        id: path.basename(relativePath, path.extname(relativePath)),
        title: path.basename(relativePath, path.extname(relativePath)),
        description: null,
        skills: [],
        allowedTools: [],
        runPolicy: null,
        body: "",
        relativePath,
      };
      const parsed = parseSkillSetDocument({
        ...file,
        relativePath,
        fallback,
      });
      skillSets.push(parsed.skillSet);
      issues.push(...parsed.issues);
    }

    if (rulesSource.exists || workflowPaths.length > 0 || skillSetPaths.length > 0) {
      const defaultWorkflowId = workflows.some(
        (workflow) => workflow.id === parsedRules.rules.defaultWorkflow,
      )
        ? parsedRules.rules.defaultWorkflow
        : (workflows[0]?.id ?? DEFAULT_WORKFLOW.id);

      return {
        source: "repo",
        rules: parsedRules.rules,
        workflows,
        skillSets,
        defaultWorkflowId,
        issues,
      };
    }

    const localProfileResult = await loadLocalProfileConfig(cwd);
    if (localProfileResult.config) {
      return localProfileResult.config;
    }
    issues.push(...localProfileResult.issues);

    return {
      source: "default",
      rules: parsedRules.rules,
      workflows,
      skillSets,
      defaultWorkflowId: workflows[0]?.id ?? DEFAULT_WORKFLOW.id,
      issues,
    };
  };

  const service: RepoReviewConfigShape = {
    getConfig: ({ cwd }) =>
      Effect.tryPromise({
        try: async () => {
          const cached = cache.get(cwd);
          if (cached && !cached.stale) {
            return cached.config;
          }
          const config = await loadConfig(cwd);
          cache.set(cwd, { config, stale: false });
          return config;
        },
        catch: (cause) =>
          new PrReviewConfigError({
            operation: "getConfig",
            detail: `Failed to load repo review config from ${cwd}`,
            cause,
          }),
      }),
    watchRepo: ({ cwd, onChange }) =>
      Effect.try({
        try: () => {
          let listeners = listenersByCwd.get(cwd);
          if (!listeners) {
            listeners = new Set();
            listenersByCwd.set(cwd, listeners);
          }
          listeners.add(onChange);

          if (!watcherByCwd.has(cwd)) {
            const watchers: fs.FSWatcher[] = [];
            watchers.push(
              fs.watch(cwd, { recursive: true }, (_eventType, filename) => {
                const normalized = String(filename ?? "").replaceAll("\\", "/");
                if (normalized.length === 0 || !normalized.startsWith(".okcode")) {
                  return;
                }
                emitChange(cwd, [normalized]);
              }),
            );

            const okcodeHome = resolveOkcodeHome();
            if (fs.existsSync(okcodeHome)) {
              watchers.push(
                fs.watch(okcodeHome, { recursive: true }, (_eventType, filename) => {
                  const normalized = String(filename ?? "").replaceAll("\\", "/");
                  if (
                    normalized.length === 0 ||
                    (!normalized.startsWith(`${LOCAL_PROFILE_RELATIVE_DIR}/`) &&
                      normalized !== LOCAL_PROFILE_RELATIVE_DIR)
                  ) {
                    return;
                  }
                  emitChange(cwd, [normalized]);
                }),
              );
            }

            watcherByCwd.set(cwd, watchers);
          }
        },
        catch: (cause) =>
          new PrReviewConfigError({
            operation: "watchRepo",
            detail: `Failed to watch repo review config in ${cwd}`,
            cause,
          }),
      }),
  };

  return service;
});

export const RepoReviewConfigLive = Layer.effect(RepoReviewConfig, makeRepoReviewConfig);
