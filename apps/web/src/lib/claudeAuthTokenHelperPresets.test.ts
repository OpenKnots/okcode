import { describe, expect, it } from "vitest";

import { CLAUDE_AUTH_TOKEN_HELPER_PRESETS } from "./claudeAuthTokenHelperPresets";

describe("CLAUDE_AUTH_TOKEN_HELPER_PRESETS", () => {
  it("includes presets for common secret managers", () => {
    expect(CLAUDE_AUTH_TOKEN_HELPER_PRESETS).toEqual([
      {
        label: "1Password",
        description: "Prefill an `op read` command for a 1Password secret.",
        command: 'op read "op://Private/Anthropic/Claude Code/token" --no-newline',
      },
      {
        label: "pass",
        description: "Prefill a `pass show` command for the `pass` password store.",
        command: "pass show anthropic/claude-code",
      },
      {
        label: "Doppler",
        description: "Prefill a `doppler secrets get` command for a linked project.",
        command: "doppler secrets get ANTHROPIC_AUTH_TOKEN --plain",
      },
    ]);
  });
});
