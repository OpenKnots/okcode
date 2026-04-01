---
name: spreadsheet
description: Create, edit, and analyze spreadsheets.
catalog_id: spreadsheet
origin: bundled
version: 1.0.0
author: OK Code
tags:
  - spreadsheet
  - analysis
  - csv
tools:
  - filesystem
  - terminal
---

# Spreadsheet Skill

## When to use this skill

- Use when the task involves spreadsheets, CSV/TSV files, tabular data cleanup, or workbook analysis.
- Use when the user needs formulas, summaries, transformations, or structured exports from spreadsheet data.
- Use when the task depends on preserving headers, column types, sheet boundaries, or formulas.
- Use when bulk edits must remain auditable and reversible.

## What this skill does

- Normalizes spreadsheet-like tasks into safe, repeatable tabular workflows.
- Treats headers, row counts, formulas, and delimiters as explicit assumptions rather than guessing silently.
- Prefers scripted transformations that can be reviewed and rerun.
- Helps separate data cleaning, calculation, and presentation concerns.

## Implementation

- First identify the source format: CSV, TSV, XLSX, multiple sheets, exported report, or ad hoc table.
- Confirm the shape of the data before editing: headers, unique keys, empty rows, encoding, delimiters, and date formats.
- If formulas are involved, clarify whether they should be preserved, recalculated, or replaced with values.
- For bulk updates, favor scriptable transforms that produce a clear before/after story.
- Preserve source data before rewrites, especially when changing delimiters, formulas, or workbook structure.
- If workbook layout matters, call out any gap between plain-text data processing and full spreadsheet fidelity.
- Summarize row-level and column-level impacts after non-trivial edits.

## Best practices

- Never assume the first row is a header without checking.
- Treat date, currency, and numeric coercion as high-risk transformations.
- Preserve formulas unless the user explicitly wants static values.
- Prefer small, auditable transformations over opaque bulk rewrites.
- State when workbook-only features such as formatting, filters, merged cells, or charts may not be preserved.
