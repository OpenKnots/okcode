import { describe, expect, it } from "vitest";

import { PROVIDER_AUTH_GUIDES } from "./settingsProviderMetadata";

describe("PROVIDER_AUTH_GUIDES", () => {
  it("describes OpenClaw auth as a shared secret/token flow", () => {
    const guide = PROVIDER_AUTH_GUIDES.openclaw;

    expect(guide.authCmd).toBe("Use gateway shared secret/token");
    expect(guide.note).toContain("shared secret/token");
    expect(guide.note).toContain("remote gateways");
  });
});
