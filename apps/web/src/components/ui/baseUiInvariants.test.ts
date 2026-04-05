import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WEB_SRC_ROOT = path.resolve(import.meta.dirname, "../..");

const REQUIRED_ANCESTORS = {
  AutocompleteGroupLabel: "AutocompleteGroup",
  ComboboxGroupLabel: "ComboboxGroup",
  MenuGroupLabel: "MenuGroup",
  MenuRadioItem: "MenuRadioGroup",
  MenuSubPopup: "MenuSub",
  MenuSubTrigger: "MenuSub",
  SelectGroupLabel: "SelectGroup",
} as const;

const TARGET_COMPONENTS = new Set(Object.keys(REQUIRED_ANCESTORS));
const JSX_TAG_PATTERN = /<(?<closing>\/)?(?<name>[A-Z][A-Za-z0-9]*)\b[^>]*?(?<selfClosing>\/)?>/g;

const WRAPPER_SOURCE_ASSERTIONS = [
  {
    filePath: path.resolve(import.meta.dirname, "./select.tsx"),
    message: "Select item wrappers keep item indicator and text inside SelectPrimitive.Item",
    patterns: [
      /<SelectPrimitive\.Item\b[\s\S]*?<SelectPrimitive\.ItemIndicator\b[\s\S]*?<\/SelectPrimitive\.ItemIndicator>[\s\S]*?<SelectPrimitive\.ItemText\b[\s\S]*?<\/SelectPrimitive\.ItemText>[\s\S]*?<\/SelectPrimitive\.Item>/,
    ],
  },
  {
    filePath: path.resolve(import.meta.dirname, "./combobox.tsx"),
    message: "Combobox item wrappers keep item indicators inside ComboboxPrimitive.Item",
    patterns: [
      /<ComboboxPrimitive\.Item\b[\s\S]*?<ComboboxPrimitive\.ItemIndicator\b[\s\S]*?<\/ComboboxPrimitive\.ItemIndicator>[\s\S]*?<\/ComboboxPrimitive\.Item>/,
    ],
  },
  {
    filePath: path.resolve(import.meta.dirname, "./menu.tsx"),
    message: "Menu item wrappers keep radio and checkbox indicators inside their item parents",
    patterns: [
      /<MenuPrimitive\.RadioItem\b[\s\S]*?<MenuPrimitive\.RadioItemIndicator\b[\s\S]*?<\/MenuPrimitive\.RadioItemIndicator>[\s\S]*?<\/MenuPrimitive\.RadioItem>/,
      /<MenuPrimitive\.CheckboxItem\b[\s\S]*?<MenuPrimitive\.CheckboxItemIndicator\b[\s\S]*?<\/MenuPrimitive\.CheckboxItemIndicator>[\s\S]*?<\/MenuPrimitive\.CheckboxItem>/,
    ],
  },
  {
    filePath: path.resolve(import.meta.dirname, "./scroll-area.tsx"),
    message: "ScrollArea wrappers keep thumbs inside scrollbars",
    patterns: [
      /<ScrollAreaPrimitive\.Scrollbar\b[\s\S]*?<ScrollAreaPrimitive\.Thumb\b[\s\S]*?\/>[\s\S]*?<\/ScrollAreaPrimitive\.Scrollbar>/,
    ],
  },
] as const;

function collectTsxFiles(rootDir: string): string[] {
  const entries = readdirSync(rootDir);
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      files.push(...collectTsxFiles(absolutePath));
      continue;
    }

    if (
      absolutePath.endsWith(".tsx") &&
      !absolutePath.includes(`${path.sep}components${path.sep}ui${path.sep}`)
    ) {
      files.push(absolutePath);
    }
  }

  return files;
}

function findMissingAncestorViolations(source: string): string[] {
  const stack: string[] = [];
  const violations: string[] = [];

  for (const match of source.matchAll(JSX_TAG_PATTERN)) {
    const name = match.groups?.name;
    if (!name) continue;

    const isClosing = Boolean(match.groups?.closing);
    const isSelfClosing = Boolean(match.groups?.selfClosing);

    if (isClosing) {
      const lastIndex = stack.lastIndexOf(name);
      if (lastIndex >= 0) {
        stack.splice(lastIndex, 1);
      }
      continue;
    }

    if (TARGET_COMPONENTS.has(name)) {
      const requiredAncestor = REQUIRED_ANCESTORS[name as keyof typeof REQUIRED_ANCESTORS];
      if (!stack.includes(requiredAncestor)) {
        violations.push(`${name} must be rendered within ${requiredAncestor}`);
      }
    }

    if (!isSelfClosing) {
      stack.push(name);
    }
  }

  return violations;
}

describe("Base UI wrapper invariants", () => {
  it("keeps label and item wrapper parts inside their required parent components", () => {
    const failures = collectTsxFiles(WEB_SRC_ROOT).flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      const violations = findMissingAncestorViolations(source);

      return violations.map(
        (violation) => `${path.relative(WEB_SRC_ROOT, filePath)}: ${violation}`,
      );
    });

    expect(failures).toEqual([]);
  });

  it("keeps second-tier primitive relationships intact inside shared UI wrappers", () => {
    const failures = WRAPPER_SOURCE_ASSERTIONS.flatMap(({ filePath, message, patterns }) => {
      const source = readFileSync(filePath, "utf8");
      const missingPattern = patterns.some((pattern) => !pattern.test(source));

      if (!missingPattern) {
        return [];
      }

      return `${path.relative(WEB_SRC_ROOT, filePath)}: ${message}`;
    });

    expect(failures).toEqual([]);
  });
});
