---
name: doc
description: Edit and review docx-style documents.
catalog_id: doc
origin: bundled
version: 1.0.0
author: OK Code
tags:
  - docs
  - docx
  - writing
tools:
  - filesystem
  - terminal
---

# Doc Skill

## When to use this skill

- Use when the task involves drafting, editing, reviewing, or converting rich-text documents such as DOCX files.
- Use when preserving writing quality and document structure matters more than raw plain-text extraction.
- Use when the user needs help balancing content edits against formatting preservation.
- Use when a document must be converted between editable and presentation-friendly formats.

## What this skill does

- Helps edit and review document content while being explicit about formatting-preservation limits.
- Separates writing changes from layout and formatting changes so the user can judge tradeoffs clearly.
- Prefers reversible workflows when converting between DOCX, Markdown, HTML, and plain text.
- Keeps tone, structure, and author intent central during review and rewrite tasks.

## Implementation

- Determine whether the user cares most about wording, formatting, comments, tracked changes, or export format.
- If the task is content-focused, use the most editable intermediate format available and summarize how fidelity may change.
- If the task is formatting-sensitive, warn early about limitations in round-tripping through simpler text formats.
- Preserve headings, lists, tables, and section boundaries where possible.
- When reviewing, summarize substantive content changes separately from formatting or layout issues.
- If a conversion path may drop tracked changes, comments, footnotes, or advanced formatting, state that explicitly.
- Keep rewrites concise and aligned to the intended audience unless the user requests a different tone.

## Best practices

- Do not silently flatten rich structure when the original formatting appears important.
- Prefer reversible edits and keep the original document available.
- Call out unsupported document features rather than approximating them as if they were preserved.
- Separate editorial guidance from file-format guidance.
- When rewriting text, keep the user's target audience and tone explicit.
