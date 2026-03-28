# Plan: Skills System — Creation, Storage, Discovery, and Invocation

## Problem

Skills (slash commands backed by markdown definitions) currently exist as an external convention: markdown files placed in `~/.claude/skills/<name>/SKILL.md` that Claude discovers and surfaces as `/slash-commands`. There is no first-class support in OK Code for:

1. Creating new skills (scaffolding, validation, editing)
2. Storing skills at workspace vs global scope
3. Browsing / searching / importing skills from registries or other projects
4. Managing skill lifecycle (enable, disable, update, delete)
5. Rendering skill metadata in the UI (descriptions, trigger conditions, provenance)

This plan covers a full skills pipeline: authoring → storage → discovery → registration → invocation → UI.

---

## Current state

### Skill file format

```
<skill-dir>/SKILL.md
```

Each skill is a directory containing a `SKILL.md` file (plus optional supplementary files). The markdown file uses YAML frontmatter:

```yaml
---
name: acpx
description: Use acpx as a headless ACP CLI for agent-to-agent communication...
---
```

Body follows a loose convention:
1. `# <Skill Name>` heading
2. `## When to use this skill` section (trigger conditions)
3. Implementation details, examples, best practices

### Storage locations

| Scope | Path | Purpose |
|-------|------|---------|
| User/global | `~/.claude/skills/<name>/SKILL.md` | Available in all projects |
| Shared agent | `~/.agents/skills/<name>/SKILL.md` | Shared across agent tools |
| (missing) | `<project>/.claude/skills/<name>/SKILL.md` | Project-scoped skills |

Global skills can symlink to shared agent skills for deduplication.

### Current discovery

Claude Code discovers skills at startup by scanning `~/.claude/skills/` and presents them in the system prompt as available slash commands. There is no project-level discovery, no registry, no search.

### Current invocation

Skills are invoked via the `Skill` tool, which takes `skill: "<name>"` and optional `args`. Claude loads the skill markdown into context and follows its instructions.

---

## Design goals

1. **Two-tier scoping**: skills live at global (`~/.claude/skills/`) or project (`.claude/skills/`) scope, with clear precedence rules.
2. **Scaffold-first authoring**: `okcode skill create` (or UI equivalent) generates valid skill structure with frontmatter, required sections, and optional supplementary files.
3. **Discoverability**: skills can be browsed, searched, and imported from a registry (local directory, git repo, or future remote registry).
4. **Zero-config invocation**: existing `/skill-name` slash command convention continues to work; new skills are immediately available after creation.
5. **UI integration**: skill browser in the web app for viewing, enabling/disabling, and managing skills.

---

## Phase 1: Skill schema and validation

### 1.1 Formal skill manifest schema

Define a typed schema in `packages/contracts/src/skill.ts`:

```ts
export const SkillManifest = Schema.Struct({
  name: Schema.String.pipe(Schema.pattern(/^[a-z0-9-]+$/)),
  description: Schema.String,
  version: Schema.optional(Schema.String),
  scope: Schema.optional(Schema.Literal("global", "project")),
  triggers: Schema.optional(Schema.Array(Schema.String)),
  tags: Schema.optional(Schema.Array(Schema.String)),
  tools: Schema.optional(Schema.Array(Schema.String)),
  author: Schema.optional(Schema.String),
});
```

This extends the current `name`/`description` frontmatter with optional structured metadata while remaining backwards-compatible (existing skills with only `name`+`description` still validate).

### 1.2 Frontmatter parser

Add `packages/shared/src/skill.ts`:

1. Parse YAML frontmatter from `SKILL.md` files.
2. Validate against `SkillManifest` schema.
3. Return typed manifest + raw markdown body.
4. Graceful fallback: skills without frontmatter get `name` inferred from directory name and empty description.

### 1.3 Skill validation utility

Validate a skill directory:

1. `SKILL.md` exists and is non-empty.
2. Frontmatter parses and validates.
3. Required sections present (`# heading`, `## When to use`).
4. Warn on missing but recommended fields (`description`, `triggers`).
5. Report supplementary files found.

---

## Phase 2: Skill storage and scoping

### 2.1 Dual-scope resolution

Skills are resolved with project scope taking precedence over global scope:

```
Resolution order:
  1. <project-root>/.claude/skills/<name>/SKILL.md   (project scope)
  2. ~/.claude/skills/<name>/SKILL.md                 (global scope)
```

If the same skill name exists in both scopes, the project-scoped version wins. This allows projects to override or customize global skills.

### 2.2 Skill index

Build an in-memory skill index at session start:

```ts
interface SkillEntry {
  name: string;
  scope: "global" | "project";
  manifest: SkillManifest;
  path: string;            // absolute path to SKILL.md
  dir: string;             // absolute path to skill directory
  supplementaryFiles: string[];
}
```

Index is rebuilt when:
- Session starts
- User creates/deletes a skill
- Workspace root changes

### 2.3 Skill storage operations

Implement in `packages/shared/src/skill.ts`:

1. `listSkills(projectRoot?: string): SkillEntry[]` — scan both scopes, merge, deduplicate.
2. `readSkill(name: string, projectRoot?: string): SkillContent` — resolve and read full skill content.
3. `writeSkill(name: string, scope: "global" | "project", content: SkillContent, projectRoot?: string)` — write skill to correct location.
4. `deleteSkill(name: string, scope: "global" | "project", projectRoot?: string)` — remove skill directory.
5. `skillExists(name: string, projectRoot?: string): { exists: boolean; scope?: string }` — check existence.

---

## Phase 3: Skill creation and scaffolding

### 3.1 Scaffold template

Default `SKILL.md` template:

```markdown
---
name: {{name}}
description: {{description}}
---

# {{Name}} — Claude Code Skill

## When to use this skill

- TODO: Describe when Claude should invoke this skill

## What this skill does

TODO: Describe the skill's behavior and capabilities.

## Implementation

TODO: Add step-by-step instructions, commands, code examples.

## Best practices

- TODO: Add dos and don'ts
```

### 3.2 CLI scaffold command (server-side)

Add a server-side handler for skill creation, invocable via orchestration command:

1. Accept: `name`, `description`, `scope` (global or project).
2. Validate name (kebab-case, no conflicts with existing skills).
3. Create directory + `SKILL.md` from template.
4. Return path to created skill for immediate editing.

### 3.3 Interactive creation flow

When creating a skill via the chat interface:

1. User says "create a skill" or `/skill create`.
2. Claude asks for name, description, and scope (or infers from context).
3. Scaffold is written.
4. Claude opens the file for the user to edit or offers to help write the skill body.

---

## Phase 4: Skill discovery and importing

### 4.1 Local import

Import a skill from a local path or another project:

```
/skill import <path-to-skill-dir> [--scope global|project]
```

1. Validate source skill directory.
2. Copy (not symlink) skill directory to target scope.
3. Re-index skills.

### 4.2 Git import

Import a skill from a git repository:

```
/skill import <git-url> [--path skills/my-skill] [--scope global|project]
```

1. Sparse-checkout or download the skill directory.
2. Validate and copy to target scope.
3. Store provenance metadata in frontmatter (`source`, `source_ref`).

### 4.3 Skill search (local)

Search installed skills by name, description, or tags:

```
/skill search <query>
```

Returns matching skills with name, description, scope, and path.

### 4.4 Future: Remote registry

Design for (but do not implement yet) a remote skill registry:

1. `GET /skills?q=<query>` — search published skills.
2. `GET /skills/<name>` — skill manifest + download URL.
3. `POST /skills` — publish a skill.

Schema should include: `name`, `description`, `version`, `author`, `downloads`, `tags`, `source_repo`.

Leave hooks in the import system for registry-backed import, but do not build the registry service in this phase.

---

## Phase 5: Skill registration and invocation

### 5.1 Skill-to-slash-command registration

At session start (and on skill index rebuild):

1. Read all skills from index.
2. Generate system prompt fragment listing available skills with names, descriptions, and trigger conditions.
3. Each skill becomes invocable as `/skill-name` in the chat.

Format for system prompt injection:

```
The following skills are available for use with the Skill tool:

- acpx: Use acpx as a headless ACP CLI for agent-to-agent communication...
  TRIGGER when: user needs agent-to-agent communication, ACP sessions, or scripted agent output

- tmux-ide: Set up multi-pane terminal IDE using tmux...
  TRIGGER when: user wants IDE layout, tmux setup, or multi-pane development environment
```

### 5.2 Skill invocation lifecycle

When Claude invokes a skill:

1. Resolve skill by name from index.
2. Load `SKILL.md` content (full markdown body).
3. Load any supplementary files referenced by the skill.
4. Inject skill content into Claude's context as instructions.
5. Claude follows the skill's instructions to complete the task.
6. Skill invocation is logged as a provider runtime event for traceability.

### 5.3 Skill context management

Skills can be large. Context management strategy:

1. Only load skill content when invoked (not at session start — only the index/descriptions are loaded).
2. Supplementary files are loaded on-demand when the skill references them.
3. If a skill exceeds a size threshold (e.g., 15KB), warn and consider truncation or summary.

---

## Phase 6: Web UI integration

### 6.1 Skill browser panel

Add a skill browser to the web app (likely as a panel or modal):

1. List all installed skills grouped by scope (project / global).
2. Show: name, description, scope, path, tags.
3. Actions: view full content, edit (opens in editor), delete, change scope.

### 6.2 Skill creation UI

Inline skill creation from the web app:

1. Button or command to "Create Skill".
2. Form: name, description, scope.
3. Creates scaffold and opens `SKILL.md` for editing.

### 6.3 Slash command autocomplete

Enhance the composer input:

1. When user types `/`, show autocomplete dropdown with all available skills.
2. Show skill name + short description.
3. Filter as user types.
4. Existing built-in commands (`/plan`, `/chat`, `/code`, `/model`) appear first, then skills.

Touch points:
- `apps/web/src/composer-logic.ts` — extend slash command parsing
- `apps/web/src/components/ChatView.tsx` — autocomplete rendering
- New component for skill browser panel

### 6.4 Skill invocation indicator

When a skill is invoked during a conversation:

1. Show a collapsible "Skill: <name>" indicator in the message stream.
2. Include skill description and scope.
3. Allow expanding to see the full skill content that was loaded.

---

## Phase 7: Server-side skill service

### 7.1 Skill service layer

Add `apps/server/src/skills/SkillService.ts`:

1. Manages skill index lifecycle (build, rebuild, query).
2. Exposes skill CRUD operations.
3. Integrates with provider session for skill registration.
4. Watches skill directories for changes (optional, nice-to-have).

### 7.2 WebSocket API

Add skill-related methods to the WS API:

```
skill.list        → SkillEntry[]
skill.read        → SkillContent
skill.create      → { path: string }
skill.delete      → void
skill.import      → { path: string }
skill.search      → SkillEntry[]
```

Route through existing `wsServer.ts` NativeApi pattern.

### 7.3 Orchestration integration

Skills should integrate with the orchestration layer:

1. Skill invocation emits a domain event (`skill.invoked`) for traceability.
2. Skill creation/deletion emits domain events for UI reactivity.
3. Skill index is available to the provider adapter for system prompt construction.

---

## Phase 8: Testing strategy

### 8.1 Unit tests

1. Frontmatter parser: valid, invalid, missing frontmatter, edge cases.
2. Skill validation: complete skill, missing sections, malformed YAML.
3. Scope resolution: project overrides global, global-only, project-only.
4. Index building: multiple scopes, symlinks, empty directories.
5. Scaffold generation: template substitution, directory creation.

### 8.2 Integration tests

1. Full skill lifecycle: create → list → read → invoke → delete.
2. Import from local path.
3. Scope precedence under concurrent access.
4. Skill registration into system prompt.
5. WebSocket API round-trips.

### 8.3 E2E tests

1. Create a skill via chat, verify it appears in `/skill-name` autocomplete.
2. Invoke a skill, verify it executes correctly.
3. Import a skill, verify it's available.

---

## Implementation order

Recommended phasing:

1. **Skill schema + validation** (Phase 1) — foundation for everything else
2. **Storage and scoping** (Phase 2) — dual-scope resolution
3. **Scaffolding** (Phase 3) — create skills
4. **Registration and invocation** (Phase 5) — make skills usable
5. **Server-side service** (Phase 7) — proper service layer
6. **Web UI** (Phase 6) — browser, autocomplete, creation UI
7. **Discovery and import** (Phase 4) — import from external sources
8. **Testing** (Phase 8) — throughout, but comprehensive suite at end

---

## Non-goals

1. Building a remote skill registry service (design for it, don't build it).
2. Skill versioning or dependency resolution between skills.
3. Skill permissions or access control (all installed skills are available).
4. Skill marketplace or monetization.
5. Breaking backwards compatibility with existing `~/.claude/skills/` layout.
6. Auto-updating skills from remote sources.

---

## Open questions

1. **Skill namespacing**: Should imported skills retain their source namespace (e.g., `@author/skill-name`) or flatten to just `skill-name`?
2. **Skill composition**: Should skills be able to reference/invoke other skills, or keep them independent?
3. **Skill enablement**: Should there be an enable/disable toggle per skill, or is presence/absence in the directory sufficient?
4. **Supplementary file convention**: Should supplementary files be explicitly declared in frontmatter, or discovered by convention (any `.md` file in the skill directory)?
5. **Size limits**: What is the maximum reasonable skill size before we need chunking or summarization strategies?
