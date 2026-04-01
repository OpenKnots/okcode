import { describe, expect, it } from "vitest";

import { formatShortTimestamp, getTimestampFormatOptions } from "./timestampFormat";

describe("getTimestampFormatOptions", () => {
  it("omits hour12 when locale formatting is requested", () => {
    expect(getTimestampFormatOptions("locale", true)).toEqual({
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  });

  it("builds a 12-hour formatter with seconds when requested", () => {
    expect(getTimestampFormatOptions("12-hour", true)).toEqual({
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  });

  it("builds a 24-hour formatter without seconds when requested", () => {
    expect(getTimestampFormatOptions("24-hour", false)).toEqual({
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
  });
});

describe("formatShortTimestamp", () => {
  it("formats against the selected app locale instead of the ambient locale", () => {
    const isoDate = "2026-03-31T13:05:06.000Z";

    const english = formatShortTimestamp(isoDate, "locale", "en");
    const french = formatShortTimestamp(isoDate, "locale", "fr");

    expect(english).not.toEqual(french);
  });

  it("uses locale-specific formatter caches", () => {
    const isoDate = "2026-03-31T13:05:06.000Z";

    const firstEnglish = formatShortTimestamp(isoDate, "locale", "en");
    const secondEnglish = formatShortTimestamp(isoDate, "locale", "en");
    const chinese = formatShortTimestamp(isoDate, "locale", "zh-CN");

    expect(firstEnglish).toEqual(secondEnglish);
    expect(chinese).not.toEqual(firstEnglish);
  });
});
