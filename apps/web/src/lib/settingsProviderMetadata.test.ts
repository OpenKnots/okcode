import { describe, expect, it } from "vitest";

import { PROVIDER_AUTH_GUIDES } from "./settingsProviderMetadata";

describe("PROVIDER_AUTH_GUIDES", () => {
  it("describes OpenClaw auth as a shared-secret flow", () => {
    const guide = PROVIDER_AUTH_GUIDES.openclaw;

    expect(guide.authCmd).toBe("Use gateway shared secret");
    expect(guide.note).toContain("shared secret");
    expect(guide.note).toContain("password-style auth");
    expect(guide.note).toContain("remote gateways");
  });
});
