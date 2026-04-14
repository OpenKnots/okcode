export interface ClaudeAuthTokenHelperPreset {
  readonly label: string;
  readonly command: string;
  readonly description: string;
}

export const CLAUDE_AUTH_TOKEN_HELPER_PRESETS: readonly ClaudeAuthTokenHelperPreset[] = [
  {
    label: "1Password",
    command: "op read op://shared/anthropic/token --no-newline",
    description: "Reads an Anthropic auth token from 1Password CLI.",
  },
  {
    label: "Bitwarden",
    command: "bw get notes anthropic-auth-token",
    description: "Reads an Anthropic auth token from Bitwarden CLI notes.",
  },
  {
    label: "Doppler",
    command: "doppler secrets get ANTHROPIC_AUTH_TOKEN --plain",
    description: "Reads ANTHROPIC_AUTH_TOKEN from Doppler.",
  },
] as const;
