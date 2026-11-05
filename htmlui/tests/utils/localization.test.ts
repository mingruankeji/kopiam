import { i18n } from "@lingui/core";
import { describe, expect, test } from "vitest";
import { string } from "yup";
import { resolveLocale } from "../../src/i18n";
import catalog from "../../src/locales/zh/messages.po?raw";

describe("Chinese localization", () => {
  test("has a translation for every extracted message and preserves placeholders", () => {
    expect(catalog).not.toMatch(/msgid ".+"\r?\nmsgstr ""(?:\r?\n|$)/);
    const pairs = [...catalog.matchAll(/msgid ("[^\n]+")\r?\nmsgstr ("[^\n]+")/g)];
    expect(pairs.length).toBeGreaterThan(500);
    for (const [, source, translation] of pairs) {
      const placeholders = (text: string) => [...text.matchAll(/\{[^{}]+\}/g)].map(([value]) => value).sort();
      expect(placeholders(JSON.parse(translation)), source).toEqual(placeholders(JSON.parse(source)));
    }
  });

  test("normalizes existing Kopia locale preferences", () => {
    expect(resolveLocale("zh-CN")).toBe("zh");
    expect(resolveLocale("zh-cn")).toBe("zh");
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("nb")).toBe("nb");
    expect(resolveLocale("en-US")).toBe("zh");
    expect(resolveLocale()).toBe("zh");
  });

  test("uses Chinese validation errors without changing field identifiers", async () => {
    i18n.activate("zh");
    const schema = string().required().label("Name");
    await expect(schema.validate("")).rejects.toThrow("请填写名称");
  });
});
