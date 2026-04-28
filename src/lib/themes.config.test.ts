import { describe, it, expect } from "vitest";
import { getThemeConfig, ALL_THEME_IDS, THEME_CONFIGS, ThemeId } from "./themes.config";

describe("themes.config", () => {
  describe("getThemeConfig", () => {
    it("returns the correct config for a valid theme ID", () => {
      const darkConfig = getThemeConfig("dark");
      expect(darkConfig).toBeDefined();
      expect(darkConfig.id).toBe("dark");
      expect(darkConfig.scheme).toBe("dark");
      expect(darkConfig.tokens).toBeDefined();
      expect(darkConfig.tokens.background).toBeDefined();

      const lightConfig = getThemeConfig("light");
      expect(lightConfig).toBeDefined();
      expect(lightConfig.id).toBe("light");
      expect(lightConfig.scheme).toBe("light");
      expect(lightConfig.tokens).toBeDefined();
    });

    it("returns the fallback (first theme) for an invalid theme ID at runtime", () => {
      const invalidId = "non-existent-theme" as ThemeId;
      const fallbackConfig = getThemeConfig(invalidId);

      expect(fallbackConfig).toBeDefined();
      // Should default to the first config in the array
      expect(fallbackConfig.id).toBe(THEME_CONFIGS[0].id);
      expect(fallbackConfig).toEqual(THEME_CONFIGS[0]);
    });
  });

  describe("ALL_THEME_IDS", () => {
    it("contains all ids from THEME_CONFIGS", () => {
      const expectedIds = THEME_CONFIGS.map(t => t.id);
      expect(ALL_THEME_IDS).toEqual(expectedIds);
      expect(ALL_THEME_IDS.length).toBeGreaterThan(0);
      expect(ALL_THEME_IDS).toContain("dark");
      expect(ALL_THEME_IDS).toContain("light");
    });
  });

  describe("THEME_CONFIGS structure", () => {
    it("has required structural properties for each theme", () => {
      THEME_CONFIGS.forEach(theme => {
        expect(theme.id).toBeDefined();
        expect(theme.label).toBeDefined();
        expect(theme.scheme).toMatch(/^(light|dark)$/);
        expect(theme.tokens).toBeDefined();
        expect(theme.tokens.background).toBeDefined();
        expect(theme.tokens.foreground).toBeDefined();
        expect(theme.lighting).toBeDefined();
      });
    });
  });
});
