import { describe, it, expect } from "vitest";
import { extractPlanChecklistItems } from "./planChecklist";

describe("extractPlanChecklistItems", () => {
  it("returns empty array for markdown without list items", () => {
    const md = `# My Plan\n\nSome description paragraph.`;
    expect(extractPlanChecklistItems(md)).toEqual([]);
  });

  describe("GFM task list items", () => {
    it("extracts unchecked task list items", () => {
      const md = `# Plan\n\n- [ ] First task\n- [ ] Second task\n- [ ] Third task`;
      const items = extractPlanChecklistItems(md);
      expect(items).toHaveLength(3);
      expect(items[0]!.text).toBe("First task");
      expect(items[0]!.completed).toBe(false);
      expect(items[2]!.text).toBe("Third task");
    });

    it("extracts checked task list items", () => {
      const md = `- [x] Done item\n- [X] Also done\n- [ ] Not done`;
      const items = extractPlanChecklistItems(md);
      expect(items).toHaveLength(3);
      expect(items[0]!.completed).toBe(true);
      expect(items[1]!.completed).toBe(true);
      expect(items[2]!.completed).toBe(false);
    });

    it("strips inline markdown from task list text", () => {
      const md = `- [ ] **Bold** task with \`code\` and [link](url)`;
      const items = extractPlanChecklistItems(md);
      expect(items).toHaveLength(1);
      expect(items[0]!.text).toBe("Bold task with code and link");
    });

    it("handles asterisk bullet markers", () => {
      const md = `* [ ] First task\n* [x] Second task`;
      const items = extractPlanChecklistItems(md);
      expect(items).toHaveLength(2);
      expect(items[0]!.completed).toBe(false);
      expect(items[1]!.completed).toBe(true);
    });
  });

  describe("numbered list items under step-like headings", () => {
    it("extracts items under a '## Steps' heading", () => {
      const md = `# Plan Title\n\nSome intro text.\n\n## Steps\n\n1. Set up the project\n2. Implement the feature\n3. Write tests\n\n## Notes\n\nSome notes.`;
      const items = extractPlanChecklistItems(md);
      expect(items).toHaveLength(3);
      expect(items[0]!.text).toBe("Set up the project");
      expect(items[1]!.text).toBe("Implement the feature");
      expect(items[2]!.text).toBe("Write tests");
      expect(items.every((i) => !i.completed)).toBe(true);
    });

    it("extracts items under 'Implementation' heading (case-insensitive)", () => {
      const md = `# Title\n\n## implementation plan\n\n1. First step\n2. Second step`;
      const items = extractPlanChecklistItems(md);
      expect(items).toHaveLength(2);
    });

    it("extracts items under 'Suggested order of execution' heading", () => {
      const md = `# Title\n\n## Suggested order of execution\n\n1. Step one\n2. Step two\n3. Step three`;
      const items = extractPlanChecklistItems(md);
      expect(items).toHaveLength(3);
      expect(items[0]!.text).toBe("Step one");
    });

    it("strips bold from numbered items", () => {
      const md = `## Steps\n\n1. **Setup**: Initialize the repo\n2. **Build**: Compile the code`;
      const items = extractPlanChecklistItems(md);
      expect(items[0]!.text).toBe("Setup: Initialize the repo");
      expect(items[1]!.text).toBe("Build: Compile the code");
    });
  });

  describe("fallback: top-level numbered items", () => {
    it("extracts numbered items when no step heading exists", () => {
      const md = `# My Plan\n\nHere is the plan:\n\n1. Do thing A\n2. Do thing B\n3. Do thing C`;
      const items = extractPlanChecklistItems(md);
      expect(items).toHaveLength(3);
      expect(items[0]!.text).toBe("Do thing A");
    });

    it("handles parenthesis-style numbering", () => {
      const md = `1) First\n2) Second\n3) Third`;
      const items = extractPlanChecklistItems(md);
      expect(items).toHaveLength(3);
      expect(items[0]!.text).toBe("First");
    });
  });

  describe("priority: task list > step heading > numbered", () => {
    it("prefers task list items over numbered items", () => {
      const md = `# Plan\n\n- [ ] Task A\n- [x] Task B\n\n1. Numbered one\n2. Numbered two`;
      const items = extractPlanChecklistItems(md);
      expect(items).toHaveLength(2);
      expect(items[0]!.text).toBe("Task A");
      expect(items[1]!.text).toBe("Task B");
      expect(items[1]!.completed).toBe(true);
    });
  });

  describe("stable IDs", () => {
    it("generates unique stable IDs for each item", () => {
      const md = `- [ ] First\n- [ ] Second\n- [ ] Third`;
      const items = extractPlanChecklistItems(md);
      const ids = items.map((i) => i.id);
      expect(new Set(ids).size).toBe(3);
      expect(ids.every((id) => id.startsWith("plan-item-"))).toBe(true);
    });
  });
});
