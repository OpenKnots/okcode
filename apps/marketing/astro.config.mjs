import { defineConfig } from "astro/config";

/** Set in deploy (e.g. preview URL) so canonical and Open Graph URLs resolve. */
const site = process.env.PUBLIC_SITE_URL;

export default defineConfig({
  ...(site ? { site } : {}),
  server: {
    port: Number(process.env.PORT ?? 4173),
  },
});
