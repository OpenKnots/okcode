import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

/** Set in deploy (e.g. preview URL) so canonical and Open Graph URLs resolve. */
const site = process.env.PUBLIC_SITE_URL;

export default defineConfig({
  ...(site ? { site } : {}),
  integrations: [tailwind()],
  server: {
    port: Number(process.env.PORT ?? 4173),
  },
});
