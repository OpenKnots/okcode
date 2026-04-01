---
name: pdf
description: Create, edit, and review PDFs.
catalog_id: pdf
origin: bundled
version: 1.0.0
author: OK Code
tags:
  - docs
  - pdf
  - review
tools:
  - filesystem
  - terminal
---

# PDF Skill

## When to use this skill

- Use when the task involves creating, editing, reviewing, splitting, merging, or extracting content from PDF files.
- Use when the user needs to understand whether a PDF can be edited directly or must be converted first.
- Use when the task depends on preserving layout, images, pagination, or annotation fidelity.
- Use when OCR may be required because the PDF contains scanned pages rather than selectable text.

## What this skill does

- Chooses the safest PDF workflow based on the user's goal: review, extraction, transformation, or generation.
- Distinguishes between text-based PDFs and image-only scanned PDFs before proposing edits.
- Preserves fidelity when layout matters and explicitly calls out any tradeoff when converting to another format.
- Prefers repeatable tools and scripted operations over manual one-off desktop steps.

## Implementation

- Start by identifying the real goal: review content, extract data, annotate, merge, split, redact, or convert.
- Determine whether the PDF is text-based or scanned. If the content is image-only, state that OCR may be required.
- If the user needs edits that preserve layout, avoid lossy conversions unless they explicitly accept them.
- If extracting text, note whether the output should preserve reading order, tables, headings, or page boundaries.
- If generating a PDF from another source, preserve the source of truth in an editable format whenever possible.
- When tools are limited, explain the limitation clearly and offer the safest fallback rather than implying full fidelity.
- Summarize important tradeoffs before carrying out destructive or lossy transformations.

## Best practices

- Never imply that all PDFs are safely editable; many require conversion or specialized tooling.
- Call out OCR accuracy risk explicitly for scanned documents.
- Preserve the original file before transformations that may alter layout or metadata.
- Prefer deterministic, scriptable workflows for extraction and generation.
- Tell the user when tables, forms, annotations, or embedded fonts may not round-trip cleanly.
