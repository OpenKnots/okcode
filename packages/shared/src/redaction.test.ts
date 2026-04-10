import { describe, expect, it } from "vitest";

import { redactSensitiveText, redactSensitiveValue } from "./redaction";

describe("redactSensitiveText", () => {
  it("redacts OpenAI-style secret keys", () => {
    expect(redactSensitiveText("OpenAI failed with sk-proj-abc123_secret-token")).toBe(
      "OpenAI failed with [REDACTED]",
    );
  });

  it("redacts environment variable assignments", () => {
    expect(
      redactSensitiveText(
        "Command failed with OPENAI_API_KEY=sk-proj-abc123 SECRET_TOKEN=hunter2 PATH=/tmp/bin",
      ),
    ).toBe("Command failed with OPENAI_API_KEY=[REDACTED] SECRET_TOKEN=[REDACTED] PATH=[REDACTED]");
  });

  it("redacts sensitive JSON-like fields and query params", () => {
    expect(
      redactSensitiveText(
        'Request failed: {"token":"abc123","password":"hunter2"} https://x.test?token=abc123&ok=1',
      ),
    ).toBe(
      'Request failed: {"token":"[REDACTED]","password":"[REDACTED]"} https://x.test?token=[REDACTED]&ok=1',
    );
  });
});

describe("redactSensitiveValue", () => {
  it("redacts nested structured payloads", () => {
    expect(
      redactSensitiveValue({
        summary: "Push failed for sk-proj-abc123",
        nextSteps: ["Unset OPENAI_API_KEY=sk-proj-abc123"],
        nested: {
          detail: "Authorization: Bearer topsecret",
        },
      }),
    ).toEqual({
      summary: "Push failed for [REDACTED]",
      nextSteps: ["Unset OPENAI_API_KEY=[REDACTED]"],
      nested: {
        detail: "Authorization: Bearer [REDACTED]",
      },
    });
  });
});
