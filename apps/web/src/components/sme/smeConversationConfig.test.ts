import { describe, expect, it } from "vitest";

import { getDefaultSmeAuthMethod, getSmeAuthMethodOptions } from "./smeConversationConfig";

describe("smeConversationConfig", () => {
  it("keeps OpenClaw auth copy aligned with shared-secret terminology", () => {
    const options = getSmeAuthMethodOptions("openclaw");

    expect(getDefaultSmeAuthMethod("openclaw")).toBe("password");
    expect(options).toEqual([
      { value: "password", label: "Gateway Shared Secret" },
      { value: "none", label: "Device Token Only" },
      { value: "auto", label: "Auto (prefer shared secret)" },
    ]);
  });
});
