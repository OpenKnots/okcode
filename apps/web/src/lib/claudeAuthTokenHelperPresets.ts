export type ClaudeAuthTokenHelperPreset = {
  readonly label: string;
  readonly description: string;
  readonly command: string;
};

export const CLAUDE_AUTH_TOKEN_HELPER_PRESETS: readonly ClaudeAuthTokenHelperPreset[] = [
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
] as const;
