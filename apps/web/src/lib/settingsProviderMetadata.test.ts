import { describe, expect, it } from "vitest";

import { PROVIDER_AUTH_GUIDES } from "./settingsProviderMetadata";

describe("PROVIDER_AUTH_GUIDES", () => {
  it("describes Codex auth", () => {
    const guide = PROVIDER_AUTH_GUIDES.codex;

    expect(guide.authCmd).toBe("codex login");
    expect(guide.installCmd).toContain("codex");
  });
});
