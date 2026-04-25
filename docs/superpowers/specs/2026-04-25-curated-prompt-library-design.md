# Curated Prompt Library Design

Date: 2026-04-25
Status: Proposed
Scope: `apps/web` curated built-in prompts only

## Summary

Add a curated prompt library to OK Code with two user entry points:

1. A `/prompt` slash-command flow in the chat composer
2. A dedicated prompt library UI in the web app

This should follow the same philosophy used in `openknots/code-editor` without adding prompt persistence or custom prompt authoring in the first pass. Prompts remain transparent user input: selecting a prompt inserts editable text into the composer and does not create hidden provider-side behavior.

## Goals

- Provide a small, high-signal set of optimized built-in prompts for common coding workflows
- Make prompts discoverable both inline during composition and through a browse-first library view
- Keep prompt definitions centralized in a single catalog shared by all UI surfaces
- Support prompts with lightweight variable substitution
- Preserve current composer behavior and avoid hidden execution semantics

## Non-Goals

- User-created or editable saved prompts
- Server-side prompt storage or synchronization
- Provider-specific prompt injection behavior
- Automatic send after prompt selection
- Large prompt taxonomy or exhaustive template coverage

## Product Behavior

### `/prompt` Slash Command

Typing `/prompt` in the composer opens a searchable prompt picker.

Typing `/prompt <query>` filters curated prompts by:

- title
- description
- category
- tags

Selecting a prompt replaces the active slash-command token range with prompt text in the composer.

If the selected prompt requires variables, the UI opens a small resolver dialog first. After the user fills the required fields, the resolved prompt text is inserted into the composer.

The inserted text stays fully editable before send.

### Prompt Library UI

Add a dedicated prompt library view in the web app navigation.

The library supports:

- free-text search
- category filtering
- speed filtering (`instant` vs `step-by-step`)
- prompt cards with metadata and a primary action

Each prompt card shows:

- title
- description
- category
- tags
- speed
- whether variables are required

Using a prompt from the library inserts it into the active thread composer using the same insertion path as `/prompt`.

If variables are required, the library uses the same resolver dialog as the slash-command flow.

The library is read-only in this pass.

## Prompt Philosophy

The curated prompts should reflect the `openknots/code-editor` approach while being trimmed for OK Code:

- prompts are optimized for developer workflows, not generic assistant usage
- prompts should be explicit about structure and expected output
- prompts should account for the primary happy path
- prompts should consider before/after behavior when the change is user-visible
- prompts should call out likely edge cases that would otherwise make the result feel incomplete

Each prompt should be practical enough to drop into a real coding session with minimal editing.

## Initial Catalog Scope

Keep the first pass intentionally small. Recommended categories and prompt coverage:

- Codebase analysis
  - Explain codebase
  - Explain component/module architecture
- Build features
  - Build a feature from scratch
- Debugging
  - Systematic debugging workflow
- Testing and quality
  - Generate missing tests
  - TDD workflow
- Documentation
  - Create project documentation
  - Document API endpoints
- Git workflow
  - Prepare PR for review
  - Finish development branch

This subset is enough to validate:

- search and browsing
- prompt insertion
- variable substitution
- category and speed metadata

## Data Model

Create a shared prompt catalog module in `apps/web` with typed prompt metadata.

Recommended shape:

```ts
type PromptCategory =
  | "codebase-analysis"
  | "documentation"
  | "testing-quality"
  | "build-features"
  | "debugging"
  | "git-workflow";

type PromptSpeed = "instant" | "step-by-step";

interface PromptVariable {
  name: string;
  label: string;
  placeholder: string;
}

interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: PromptCategory;
  speed: PromptSpeed;
  tags: string[];
  variables?: PromptVariable[];
}
```

Also expose helpers for:

- get by id
- search by query
- filter by category
- filter by speed
- resolve variable placeholders

The catalog should be client-side only for this pass.

## Architecture

### Shared Catalog

The prompt catalog is the single source of truth for:

- slash-command menu results
- prompt library rendering
- variable resolution

Avoid duplicating prompt metadata between composer logic and UI pages.

### Composer Integration

Extend the existing slash-command system to treat `/prompt` as a first-class command.

Changes needed:

- recognize `/prompt` in composer trigger detection
- add prompt items to the composer menu model
- support prompt search results in the composer dropdown
- add selection handling that inserts resolved prompt text into the composer

Selection rules:

- replace only the active slash-command range
- do not disturb surrounding prompt content
- do not auto-send
- preserve cursor/focus behavior after insertion

### Prompt Library View

Add a library page or panel consistent with the current app navigation model.

This surface should be browse-first and depend only on the shared prompt catalog plus a shared insertion helper.

### Shared Resolver Dialog

Prompts with variables should use a shared resolver component rather than separate implementations for:

- `/prompt`
- library card actions

The dialog should:

- render required text inputs
- preview the resolved prompt text
- block submission until required fields are filled
- return the resolved string to the caller

## UX Details

### Happy Path

1. User types `/prompt`
2. Picker opens with curated templates
3. User searches or browses
4. User selects a prompt
5. If needed, fills variables
6. Resolved prompt text is inserted into the composer
7. User edits or sends

### User-Visible Before/After Behavior

Before:

- Slash command menu supports `/model`, `/plan`, `/code`, and `/skill`
- There is no prompt library UI
- Users must write prompt structures manually

After:

- `/prompt` appears as a first-class slash command
- Users can browse curated prompts in a dedicated library
- Selecting a prompt inserts a structured, optimized prompt into the composer

### Edge Cases

- Empty query after `/prompt` should show the default curated list
- No-match query should show a prompt-specific empty state
- Selection should replace only the slash-command token range, not unrelated composer text
- Insertion should avoid double spaces when replacing `/prompt ...` followed by existing whitespace
- Multi-line composer content should only replace the line-local slash command range
- Prompt selection should not clear attachments, model choice, or other composer state
- Variable placeholders should not leak unresolved markers like `{{feature}}` into the composer after confirmation
- Cancelling variable entry should leave the composer text unchanged
- Library usage should target the active thread composer only

## Testing Strategy

### Catalog Tests

Add unit tests for:

- prompt lookup by id
- search behavior
- category/speed filters
- variable resolution

### Composer Tests

Add or update tests for:

- `/prompt` trigger detection
- prompt menu population
- filtered prompt search results
- insertion replacing only the intended range
- whitespace handling
- variable prompt resolution

### Library Tests

Add UI/component coverage for:

- library filtering
- prompt card rendering
- launching the shared variable resolver
- using a prompt from the library

## Rollout Notes

- Start with curated prompts only
- Keep the catalog small and easy to maintain
- Do not introduce API or storage dependencies unless required by existing navigation primitives
- If the prompt catalog grows later, consider extracting shared prompt types beyond `apps/web`, but do not do that preemptively in this pass

## Risks

### Catalog Drift

If prompt definitions are duplicated between composer and library code, search and insertion behavior will drift. Mitigation: one shared catalog and one shared resolver path.

### Overbuilt Scope

Adding persistence or prompt CRUD now would slow delivery and complicate the UX. Mitigation: explicit curated-only scope.

### Confusing Execution Model

If prompts behave like hidden runtime instructions instead of visible text, users may not trust the feature. Mitigation: prompts always insert editable composer text and never auto-send.

## Open Questions Resolved

- Entry points: implement both `/prompt` and a dedicated prompt library UI
- Scope: curated built-in prompts only
- Invocation model: insert into composer, do not auto-send
- Variable prompts: supported through a shared resolver dialog

## Implementation Follow-Up

After spec approval, create a concrete implementation plan covering:

- prompt catalog module
- composer trigger and menu integration
- shared resolver dialog
- prompt library UI
- tests
