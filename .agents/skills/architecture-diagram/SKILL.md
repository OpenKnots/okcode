---
name: architecture-diagram
description: Generate architecture diagrams for documentation using matplotlib.
version: 1.0.0
author: OK Code
tags:
  - diagrams
  - documentation
  - architecture
  - visualization
tools:
  - terminal
  - filesystem
triggers:
  - use when the user asks for an architecture diagram
  - use when the user wants to visualize system components or data flow
  - use when a README needs a visual architecture overview
  - use when the user says "generate diagram" or "architecture diagram"
---

# Architecture Diagram Generator

## When to use this skill

- When the user asks for an architecture diagram, system diagram, or component visualization.
- When updating READMEs that would benefit from visual architecture documentation.
- When comparing architectural alternatives visually (like the telemetry-architecture-comparison pattern).
- When the user wants to visualize data flow, package dependencies, or tech stack layers.

## What this skill does

Generates publication-quality PNG architecture diagrams using Python + matplotlib. Diagrams use a consistent visual language: colored rounded boxes for components, styled arrows for data flow, dashed boundaries for service groups, and score badges for comparisons.

## Implementation

### Step 1: Identify the diagram type

Determine which diagram pattern fits the request:

| Pattern                     | When to use                              | Example                         |
| --------------------------- | ---------------------------------------- | ------------------------------- |
| **High-level architecture** | Full system overview with all components | `high-level-architecture.png`   |
| **Request/event flow**      | Show how data moves through a pipeline   | `server-request-flow.png`       |
| **Package dependencies**    | Show import/dependency relationships     | `package-dependencies.png`      |
| **Event flow**              | Show event sourcing or pub/sub patterns  | `orchestration-event-flow.png`  |
| **Tech stack**              | Layered technology overview              | `tech-stack.png`                |
| **Architecture comparison** | Compare N alternatives with scores       | telemetry-style comparison grid |

### Step 2: Use or extend the generator script

The diagram generator lives at `scripts/generate-architecture-diagrams.py`. It provides reusable primitives:

```python
from generate_architecture_diagrams import (
    draw_box,      # Rounded colored rectangle with label + sublabel
    draw_arrow,    # Styled arrow with optional label and curve
    draw_boundary, # Dashed service/group boundary
    draw_badge,    # Colored score circle
    new_fig,       # Create a new figure with standard theme
    save,          # Save to assets/diagrams/
    THEME,         # Consistent color palette
    Box, Arrow,    # Dataclasses for components
)
```

**To add a new diagram**, add a new `generate_*()` function to the script following the existing patterns, then call it from `main()`.

**To create a standalone diagram**, write a new Python script that imports the primitives or copies the pattern.

### Step 3: Generate the PNG

```bash
# Ensure matplotlib is available (use a venv if system Python is externally-managed)
python3 -m venv /tmp/diag-venv 2>/dev/null
/tmp/diag-venv/bin/pip install matplotlib 2>/dev/null
/tmp/diag-venv/bin/python scripts/generate-architecture-diagrams.py
```

Output lands in `assets/diagrams/`. Reference from markdown as:

```markdown
![Alt text](assets/diagrams/diagram-name.png)
```

### Step 4: Embed in README

Add diagram references to the relevant README.md using relative paths. Place diagrams immediately after the section heading they illustrate.

## Visual language reference

### Color palette (THEME dict)

| Role      | Color      | Hex       | Use for                          |
| --------- | ---------- | --------- | -------------------------------- |
| Client    | Blue       | `#4A90D9` | UI, browser, external clients    |
| Server    | Green      | `#2ECC71` | Server components, orchestration |
| Provider  | Orange     | `#E67E22` | External provider processes      |
| Contracts | Purple     | `#9B59B6` | Shared type/schema packages      |
| Shared    | Light blue | `#3498DB` | Shared runtime utilities         |
| Storage   | Amber      | `#F39C12` | Persistence, checkpoints         |
| External  | Gray       | `#95A5A6` | External/third-party processes   |
| Desktop   | Dark gray  | `#34495E` | Desktop/Electron shell           |

### Arrow styles

| Style        | Color         | Meaning                       |
| ------------ | ------------- | ----------------------------- |
| Solid green  | `arrow_ws`    | WebSocket connection          |
| Solid orange | `arrow_stdio` | JSON-RPC stdio pipe           |
| Solid purple | `arrow_event` | Event stream / push           |
| Dashed       | any           | Import / dependency reference |

### Component primitives

- **Box**: `Box(x, y, w, h, label, color, sublabel=...)` — rounded rectangle with centered text
- **Arrow**: `Arrow(x1, y1, x2, y2, label, color, curve=0.0)` — directed arrow, optional arc
- **Boundary**: `draw_boundary(ax, x, y, w, h, label, color)` — dashed group rectangle
- **Badge**: `draw_badge(ax, x, y, text, color)` — small colored circle with score

## Best practices

- Keep diagrams focused: one concept per diagram, not everything in one image.
- Use the THEME palette consistently across all diagrams for visual coherence.
- Place labels on arrows only when the connection type is ambiguous.
- Use sublabels for technology annotations (e.g., "React/Vite", "effect/Schema").
- For comparison diagrams, use green badges for recommended (score >= 30), amber for acceptable (>= 22), red for discouraged (< 22).
- Always run the generator and verify the PNG visually before embedding in docs.
- Output to `assets/diagrams/` — never inline base64 images in markdown.
- Diagrams should be self-explanatory without reading surrounding text.
