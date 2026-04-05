# Plan: Templates — Community Project Sharing, Discovery, and Customization

## Problem

OK Code has no mechanism for community members to share, discover, or remix web projects. Users who build interesting projects (landing pages, dashboards, tools, animations) have no way to publish them within the platform, and new users have no starting point beyond blank files.

This plan covers a full templates pipeline: submission → storage → discovery → preview → customization, with a split-pane code+preview UI for browsing community-contributed projects.

---

## Current state

- **Skills system** exists for sharing markdown-based automation definitions, but not full project source code.
- **No community content layer** — all persistence is local-first with no shared content.
- **CodeMirrorViewer** exists as a read-only code viewer with line numbers and language detection.
- **PreviewPanel** exists but is tightly coupled to Electron's BrowserView bridge — not suitable for sandboxed template previews.

---

## Design goals

1. **Community-driven**: Users can submit their projects as templates for others to discover and remix.
2. **Split-pane experience**: Template detail view shows source code alongside a live preview, matching the reference UI (code on left, iframe preview on right).
3. **Social features**: Likes, author attribution, and discovery through categories/search/sorting.
4. **One-click customization**: "Customize" button forks a template into the user's local project directory.
5. **Local-first storage**: Templates stored in local SQLite, with bundled seed templates. Community sync/remote registry is a future phase.
6. **Cross-platform preview**: Use sandboxed `<iframe srcdoc>` for live preview (works in both web and desktop, no Electron dependency).

---

## Reference UI

When a template is opened, the user sees:

```
+--------------------------------------------------------+
| <- By AuthorName                           heart 37 ... |  <- Header
+---------------------------+----------------------------+
|                           |  [Code] [Preview]    [] X  |
|  file-tabs (if multi)     |                            |
|                           |                            |
|  CodeMirrorViewer         |  <iframe> live preview     |
|  (read-only, line #s)     |  (srcdoc rendered)         |
|                           |                            |
|                           |                            |
|                           |                            |
|  +----------------------+ |                            |
|  |     Customize        | |                            |
|  +----------------------+ |                            |
+---------------------------+----------------------------+
```

- **Header**: Back arrow, author name, like count with heart, kebab menu
- **Left panel**: File tabs + CodeMirrorViewer (read-only) + "Customize" button pinned to bottom
- **Right panel**: Code/Preview toggle, close button, fullscreen button, sandboxed iframe

---

## Phase 1: Data model and contracts

### 1.1 Template schema

Define typed schemas in `packages/contracts/src/template.ts`:

```ts
export const TemplateId = makeEntityId("TemplateId");

export const TemplateCategory = Schema.Literal(
  "landing-page", "dashboard", "portfolio", "component",
  "animation", "game", "utility"
);

export const TemplateFileEntry = Schema.Struct({
  path: TrimmedNonEmptyString,
  content: Schema.String,
  language: Schema.optional(Schema.String),
});

export const TemplateAuthor = Schema.Struct({
  id: TrimmedNonEmptyString,
  displayName: TrimmedNonEmptyString,
  avatarUrl: Schema.optional(Schema.String),
});

export const TemplateSummary = Schema.Struct({
  id: TemplateId,
  title: TrimmedNonEmptyString,
  description: Schema.String,
  author: TemplateAuthor,
  category: TemplateCategory,
  tags: Schema.Array(Schema.String),
  likeCount: NonNegativeInt,
  thumbnailUrl: Schema.optional(Schema.String),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

export const TemplateDetail = Schema.Struct({
  ...TemplateSummary.fields,
  files: Schema.Array(TemplateFileEntry),
  previewUrl: Schema.optional(Schema.String),
});
```

### 1.2 WebSocket API schemas

Following the pattern from `packages/contracts/src/skill.ts`:

| Method | Input | Result |
|--------|-------|--------|
| `template.list` | `{ category?, search?, sortBy: "popular"\|"recent"\|"trending", page?, pageSize? }` | `{ templates: TemplateSummary[], totalCount, hasMore }` |
| `template.get` | `{ id: TemplateId }` | `TemplateDetail` |
| `template.like` | `{ id: TemplateId }` | `{ likeCount, liked }` |
| `template.submit` | `{ title, description, category, tags, files: TemplateFileEntry[] }` | `{ id: TemplateId }` |
| `template.customize` | `{ id: TemplateId, cwd: string }` | `{ projectPath: string }` |

### 1.3 Contract integration

- **`packages/contracts/src/ws.ts`** — Add `template.*` method names to `WS_METHODS` and request body union entries using `tagRequestBody` pattern.
- **`packages/contracts/src/ipc.ts`** — Add `templates` namespace to `NativeApi` interface (following the `skills` pattern).
- **`packages/contracts/src/index.ts`** — Re-export all template types.

---

## Phase 2: Database and persistence

### 2.1 Migration

New file: `apps/server/src/persistence/Migrations/018_Templates.ts`

```sql
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_display_name TEXT NOT NULL,
  author_avatar_url TEXT,
  category TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  like_count INTEGER NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  preview_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS template_files (
  template_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT,
  PRIMARY KEY (template_id, file_path),
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS template_likes (
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (template_id, user_id),
  FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_like_count ON templates(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON templates(created_at DESC);
```

Register migration in `apps/server/src/persistence/Migrations.ts`.

### 2.2 Persistence layer

New file: `apps/server/src/persistence/Layers/Templates.ts`

SQL query functions:
- `listTemplates(input)` — paginated, filterable by category, sortable by popularity/recency/trending
- `getTemplate(id)` — full detail with joined files
- `toggleLike(templateId, userId)` — insert/delete like row + update `like_count`
- `insertTemplate(input)` — create template + batch insert files
- `searchTemplates(query)` — full-text search on title, description, tags

---

## Phase 3: Server service

### 3.1 TemplateService

New file: `apps/server/src/templates/TemplateService.ts`

Following the `SkillService` pattern (Effect service with `ServiceMap.Service`, `Layer.succeed`, `TaggedErrorClass`):

```ts
export class TemplateServiceError extends Schema.TaggedErrorClass<TemplateServiceError>()(
  "TemplateServiceError",
  { message: Schema.String }
) {}

interface TemplateServiceShape {
  list(input: TemplateListInput): Effect.Effect<TemplateListResult, TemplateServiceError>;
  get(input: TemplateGetInput): Effect.Effect<TemplateDetail, TemplateServiceError>;
  like(input: TemplateLikeInput): Effect.Effect<TemplateLikeResult, TemplateServiceError>;
  submit(input: TemplateSubmitInput): Effect.Effect<TemplateSubmitResult, TemplateServiceError>;
  customize(input: TemplateCustomizeInput): Effect.Effect<TemplateCustomizeResult, TemplateServiceError>;
}
```

The `customize` method:
1. Read template files from DB.
2. Create a new subdirectory in the user's `cwd` named after the template slug.
3. Write all template files into the directory, preserving relative paths.
4. Return the created project path.

### 3.2 Server integration

- **`apps/server/src/wsServer.ts`** — Add case handlers for each `template.*` WS method in the request routing switch.
- **`apps/server/src/serverLayers.ts`** — Add `TemplateServiceLive` to the server layer composition.

### 3.3 Seed data

New file: `apps/server/src/templates/seedTemplates.ts`

Bundle 5-10 starter templates so the page is not empty on first launch:
- Landing page (marketing site)
- Portfolio (personal site)
- Dashboard (admin panel)
- CSS animation demo
- Interactive game
- UI component showcase

Seed templates are inserted on first migration or when the templates table is empty.

---

## Phase 4: Frontend data layer

### 4.1 React Query integration

New file: `apps/web/src/lib/templateReactQuery.ts`

```ts
export const templateQueryKeys = {
  all: ["templates"] as const,
  list: (category: string | null, search: string, sort: string, page: number) =>
    ["templates", "list", category, search, sort, page] as const,
  detail: (id: string) => ["templates", "detail", id] as const,
};
```

Define `templateListQueryOptions(input)` and `templateDetailQueryOptions(input)` using `queryOptions` from `@tanstack/react-query`, calling `ensureNativeApi().templates.*`.

### 4.2 Zustand store

New file: `apps/web/src/templateStore.ts`

UI state for template browsing:

```ts
interface TemplateStore {
  activeCategory: string | null;
  searchQuery: string;
  sortBy: "popular" | "recent" | "trending";
  activeFileIndex: number;      // which file shown in code viewer
  previewMode: "code" | "preview";  // Code/Preview toggle
}
```

---

## Phase 5: Routes

### 5.1 Templates listing route

New file: `apps/web/src/routes/_chat.templates.tsx`

```ts
export const Route = createFileRoute("/_chat/templates")({
  validateSearch: (search: Record<string, unknown>) => ({
    category: typeof search.category === "string" ? search.category : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: TemplatesRouteView,
});
```

Renders `TemplatesListPage` component.

### 5.2 Template detail route

New file: `apps/web/src/routes/_chat.templates.$templateId.tsx`

```ts
export const Route = createFileRoute("/_chat/templates/$templateId")({
  component: TemplateDetailRouteView,
});
```

Renders `TemplateDetailPage` component (the split-pane view).

---

## Phase 6: Frontend components

### New directory: `apps/web/src/components/templates/`

### 6.1 TemplatesListPage.tsx

The browse page, following `SkillsPage.tsx` patterns:

- Wrapped in `<SidebarInset>` with header bar containing `<SidebarTrigger>` and navigation
- Search input with `SearchIcon`
- Category filter using `<Select>` component
- Sort dropdown (Popular / Recent / Trending)
- Responsive grid of `TemplateCard` components (`grid gap-4 lg:grid-cols-2 xl:grid-cols-3`)
- Pagination at bottom
- Loading/error/empty states

### 6.2 TemplateCard.tsx

Grid card component:
- Thumbnail image (or generated gradient placeholder)
- Title and description (truncated)
- Author name + avatar
- Like count with heart icon
- Category badge (using existing `<Badge>`)
- Tag badges

Styling: `rounded-2xl border bg-card/80 p-4 transition-colors hover:border-border/90 hover:bg-card`

### 6.3 TemplateDetailPage.tsx

The split-pane detail view (primary UI from the reference screenshot):

**Header bar:**
- Back arrow button (`navigate({ to: "/templates" })`)
- Author display: avatar + "By {authorName}"
- Like button with heart icon + count (`useMutation` for like toggle)
- Kebab menu (using existing `<Menu>`, `<MenuTrigger>`, `<MenuPopup>`) with "Report" and "Share link" options

**Split-pane layout** (reuse `SidebarProvider` + `Sidebar` resizable pattern from `_chat.$threadId.tsx`):

**Left panel — Code viewer:**
- File tab strip at top (if template has multiple files), following `CodeViewerTabStrip` pattern
- `<CodeMirrorViewer>` component (existing, already read-only) with language detection by file extension
- "Customize" button fixed at the bottom of the panel

**Right panel — Live preview:**
- Toggle tabs: "Code" / "Preview"
- Close (X) button and fullscreen button in the header
- `<TemplatePreviewIframe>` component for live preview

### 6.4 TemplatePreviewIframe.tsx

Sandboxed iframe preview component:
- Takes template files (HTML, CSS, JS) and constructs a full HTML document
- Renders in `<iframe sandbox="allow-scripts" srcdoc={...}>` — no external network dependency
- Fullscreen toggle using `requestFullscreen` API
- Loading indicator while iframe loads

### 6.5 SubmitTemplateDialog.tsx

Template submission dialog (following `CreateSkillDialog.tsx` pattern):
- `<Dialog>` wrapper from existing UI components
- Form fields: title, description, category select, tags input
- File upload or paste area for template files
- Submit mutation using `useMutation`
- Validation feedback

---

## Phase 7: Navigation integration

### 7.1 Sidebar entry

Modify `apps/web/src/components/Sidebar.tsx`:

Add a `SidebarMenuItem` for Templates in the footer section (between Skills and Settings):

```tsx
<SidebarMenuItem>
  <SidebarMenuButton
    size="sm"
    className="gap-2 px-2 py-1.5 text-muted-foreground/70 hover:bg-accent hover:text-foreground"
    onClick={() => void navigate({ to: "/templates" })}
  >
    <LayoutTemplateIcon className="size-3.5" />
    <span className="text-xs">Templates</span>
  </SidebarMenuButton>
</SidebarMenuItem>
```

Add `/templates` to the `isOnSubPage` check so the "Back" button appears when viewing templates.

### 7.2 Route registration

No structural changes to `apps/web/src/routes/_chat.tsx` needed — TanStack Router's `<Outlet>` automatically renders the new template routes as children of the `_chat` layout.

---

## Phase 8: Customize flow

When the user clicks "Customize" on a template detail page:

1. **Dialog** appears asking where to fork:
   - Select an existing project directory
   - Or create a new directory
2. **API call**: `api.templates.customize({ id: templateId, cwd: selectedPath })`
3. **Server-side**: Creates a subdirectory named after the template slug, writes all template files preserving relative paths
4. **On success**: Navigate the user to the new project, or open the files in the code viewer
5. **Toast**: `"Template forked to {path}"`

This follows the same UX pattern as skill installation (`SkillsPage.tsx` where `installMutation` calls the API and opens the result).

---

## Phase 9: Testing strategy

### 9.1 Unit tests

1. Template schema validation: valid, invalid, edge cases.
2. File entry parsing: multi-file templates, language detection.
3. Like toggle: increment/decrement, idempotency.
4. Customize: directory creation, file writing, path sanitization.

### 9.2 Integration tests

1. Full template lifecycle: submit -> list -> get -> like -> customize.
2. Pagination and filtering.
3. Search across title, description, tags.
4. WebSocket API round-trips.

### 9.3 E2E tests

1. Browse templates page, verify grid rendering.
2. Open a template, verify split-pane layout with code and preview.
3. Click Customize, verify files written to local directory.
4. Submit a template, verify it appears in the listing.

Test files:
- `apps/server/src/templates/TemplateService.test.ts`
- `apps/web/src/lib/templateReactQuery.test.ts`
- `apps/web/src/components/templates/TemplateCard.test.tsx`

---

## Implementation order

| Step | Phase | Work | Dependencies |
|------|-------|------|--------------|
| 1 | Phase 1 | Contracts — `template.ts`, update `ws.ts`, `ipc.ts`, `index.ts` | None |
| 2 | Phase 2 | DB migration — `018_Templates.ts`, update `Migrations.ts` | Step 1 |
| 3 | Phase 2 | Persistence layer — `Layers/Templates.ts` | Step 2 |
| 4 | Phase 3 | Server service — `TemplateService.ts`, wire `wsServer.ts` + `serverLayers.ts` | Step 3 |
| 5 | Phase 3 | Seed data — bundled starter templates | Step 4 |
| 6 | Phase 4 | Frontend data layer — `templateReactQuery.ts`, `templateStore.ts` | Step 1 |
| 7 | Phase 5 | Routes — `_chat.templates.tsx`, `_chat.templates.$templateId.tsx` | Step 6 |
| 8 | Phase 6 | List page — `TemplatesListPage.tsx`, `TemplateCard.tsx` | Step 7 |
| 9 | Phase 6 | Detail page — `TemplateDetailPage.tsx`, `TemplatePreviewIframe.tsx` | Step 8 |
| 10 | Phase 7 | Sidebar nav — modify `Sidebar.tsx` | Step 7 |
| 11 | Phase 8 | Customize flow — dialog + server file writing | Step 9 |
| 12 | Phase 6 | Submit flow — `SubmitTemplateDialog.tsx` | Step 9 |
| 13 | Phase 9 | Tests | All |

---

## Files to create

| File | Description |
|------|-------------|
| `packages/contracts/src/template.ts` | Schema types, WS API input/result schemas |
| `apps/server/src/persistence/Migrations/018_Templates.ts` | Database migration |
| `apps/server/src/persistence/Layers/Templates.ts` | SQL persistence layer |
| `apps/server/src/templates/TemplateService.ts` | Effect service (list, get, like, submit, customize) |
| `apps/server/src/templates/seedTemplates.ts` | Bundled starter templates |
| `apps/web/src/lib/templateReactQuery.ts` | React Query keys + options |
| `apps/web/src/templateStore.ts` | Zustand UI state store |
| `apps/web/src/routes/_chat.templates.tsx` | Browse/listing route |
| `apps/web/src/routes/_chat.templates.$templateId.tsx` | Detail view route |
| `apps/web/src/components/templates/TemplatesListPage.tsx` | Browse page component |
| `apps/web/src/components/templates/TemplateCard.tsx` | Grid card component |
| `apps/web/src/components/templates/TemplateDetailPage.tsx` | Split-pane detail view |
| `apps/web/src/components/templates/TemplatePreviewIframe.tsx` | Sandboxed iframe preview |
| `apps/web/src/components/templates/SubmitTemplateDialog.tsx` | Submission dialog |

## Files to modify

| File | Change |
|------|--------|
| `packages/contracts/src/ws.ts` | Add `template.*` methods and request body entries |
| `packages/contracts/src/ipc.ts` | Add `templates` namespace to `NativeApi` |
| `packages/contracts/src/index.ts` | Re-export template types |
| `apps/server/src/persistence/Migrations.ts` | Register migration 018 |
| `apps/server/src/wsServer.ts` | Add `template.*` WS method handlers |
| `apps/server/src/serverLayers.ts` | Add `TemplateServiceLive` to layer composition |
| `apps/web/src/components/Sidebar.tsx` | Add Templates menu item in footer |

---

## Key architectural decisions

1. **Local SQLite over remote API**: Templates stored in local DB, consistent with the rest of OK Code's local-first architecture. A community sync service or central registry is deferred to a future phase.
2. **`srcdoc` iframes over BrowserView**: Sandboxed `<iframe srcdoc>` for preview rendering avoids Electron dependency and works in the web app. Templates are self-contained HTML/CSS/JS.
3. **File content in SQLite**: Template file contents stored in `template_files` table (not filesystem). Portable, backup-friendly, queryable.
4. **Reuse CodeMirrorViewer**: Existing component is already read-only with line numbers and language detection by file extension. No new editor needed.
5. **Reuse resizable sidebar pattern**: The split-pane layout reuses the `SidebarProvider` + `Sidebar resizable` pattern from the thread detail view, maintaining UI consistency.

---

## Non-goals

1. Building a remote template registry or marketplace (design for it, don't build it).
2. Template versioning or dependency management.
3. Collaborative editing of templates.
4. Template monetization or paid templates.
5. Server-side rendering of template previews.
6. Real-time collaborative template development.

---

## Open questions

1. **Author identity**: How do we identify template authors in a local-first app? Use a local user profile, or defer to a future auth system?
2. **Template size limits**: What is the maximum reasonable template size? Large templates (many files, large assets) may need chunking or compression.
3. **Asset handling**: Should templates support binary assets (images, fonts), or only text files (HTML/CSS/JS/SVG)?
4. **Preview security**: What level of iframe sandboxing is appropriate? `allow-scripts` is needed for JS, but should we allow `allow-same-origin` or network access?
5. **Template updates**: Can a template author update their submitted template, or is each submission immutable?
6. **Categorization**: Is the fixed category enum sufficient, or should categories be user-defined/extensible?
