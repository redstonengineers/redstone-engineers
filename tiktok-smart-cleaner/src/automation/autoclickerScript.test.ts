import { describe, expect, it } from "vitest";
import { MIN_DELAY_MS, buildAutoclickerScript, buildUserscript } from "./autoclickerScript";

describe("buildAutoclickerScript", () => {
  const cfg = { targets: ["ana", "bob.x", "</script><b>"], delayMs: 100, maxPerRun: 0, dryRun: false };
  it("genera JavaScript sintácticamente válido", () => {
    expect(() => new Function(buildAutoclickerScript(cfg))).not.toThrow();
    expect(() => new Function(buildUserscript(cfg))).not.toThrow();
  });
  it("aplica un ritmo mínimo y un tope mínimo", () => {
    const s = buildAutoclickerScript(cfg);
    expect(s).toContain(`"delayMs":${MIN_DELAY_MS}`);
    expect(s).toContain('"maxPerRun":1');
  });
  it("escapa < y no deja inyectar etiquetas", () => {
    expect(buildAutoclickerScript(cfg)).not.toContain("</script>");
  });
  it("solo incluye los usuarios indicados, sin duplicados", () => {
    const s = buildAutoclickerScript({ ...cfg, targets: ["a", "a", "b"] });
    expect(s).toContain('"targets":["a","b"]');
  });
});
