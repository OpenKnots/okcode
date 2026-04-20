import { describe, expect, it } from "vitest";
import type { FileDiffMetadata } from "@pierre/diffs/react";

import { resolveFileDiffLanguage } from "./pr-review-utils";

describe("resolveFileDiffLanguage", () => {
  it("normalizes common VS Code language ids into diff highlighter languages", () => {
    expect(resolveFileDiffLanguage({ lang: "typescriptreact" } as FileDiffMetadata)).toBe("tsx");
    expect(resolveFileDiffLanguage({ lang: "javascriptreact" } as FileDiffMetadata)).toBe("jsx");
    expect(resolveFileDiffLanguage({ lang: "manifest-yaml" } as FileDiffMetadata)).toBe("yaml");
    expect(resolveFileDiffLanguage({ lang: "esphome" } as FileDiffMetadata)).toBe("yaml");
    expect(resolveFileDiffLanguage({ lang: "django-html" } as FileDiffMetadata)).toBe("html");
    expect(resolveFileDiffLanguage({ lang: "cfmhtml" } as FileDiffMetadata)).toBe("html");
    expect(resolveFileDiffLanguage({ lang: "restructuredtext" } as FileDiffMetadata)).toBe("rst");
    expect(resolveFileDiffLanguage({ lang: "json-tmlanguage" } as FileDiffMetadata)).toBe("json");
    expect(resolveFileDiffLanguage({ lang: "plaintext" } as FileDiffMetadata)).toBe("text");
    expect(resolveFileDiffLanguage({ lang: "go.mod" } as FileDiffMetadata)).toBe("go");
    expect(resolveFileDiffLanguage({ lang: "swagger" } as FileDiffMetadata)).toBe("yaml");
  });

  it("infers normalized languages from file paths", () => {
    expect(resolveFileDiffLanguage({ name: "checkbox.tsx" } as FileDiffMetadata)).toBe("tsx");
    expect(resolveFileDiffLanguage({ name: "entrypoint.sh" } as FileDiffMetadata)).toBe(
      "shellscript",
    );
    expect(resolveFileDiffLanguage({ name: "config.yml" } as FileDiffMetadata)).toBe("yaml");
  });
});
