import { describe, expect, it } from "vitest";
import enMessages from "./messages/en.json";
import esMessages from "./messages/es.json";
import frMessages from "./messages/fr.json";
import zhCNMessages from "./messages/zh-CN.json";

const catalogs = {
  en: enMessages,
  es: esMessages,
  fr: frMessages,
  "zh-CN": zhCNMessages,
} as const;

describe("message catalogs", () => {
  it("keep every locale in sync with the English source catalog", () => {
    const englishKeys = Object.keys(catalogs.en).toSorted();

    for (const [locale, messages] of Object.entries(catalogs)) {
      expect(Object.keys(messages).toSorted(), `catalog keys for ${locale}`).toEqual(englishKeys);
    }
  });
});
