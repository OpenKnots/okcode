import { readFile, writeFile } from "node:fs/promises";

import { stripProviderAttribution } from "@okcode/shared/generatedTextSanitization";

async function main() {
  const commitMessagePath = process.argv[2];
  if (!commitMessagePath) {
    console.error(
      "Usage: bun run scripts/strip-provider-attribution-from-commit-message.ts <commit-message-file>",
    );
    process.exit(1);
  }

  const original = await readFile(commitMessagePath, "utf8");
  const sanitized = `${stripProviderAttribution(original)}\n`;

  if (sanitized !== original) {
    await writeFile(commitMessagePath, sanitized, "utf8");
  }
}

await main();
