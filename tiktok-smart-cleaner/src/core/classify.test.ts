import { describe, expect, it } from "vitest";
import { buildImportedData, classify, computeStats } from "./classify";
import { normalizeUsername } from "./normalize";
import { parseFileContent, parseJson, parseTxt } from "./parse";

const tiktokJson = JSON.stringify({
  "Profile And Settings": {
    Follower: { FansList: [{ Date: "2023-01-01 10:00:00", UserName: "Ana_01" }, { Date: "2023-01-02", UserName: "bob" }, { UserName: "carl" }] },
    Following: { Following: [{ Date: "2023-02-01", UserName: "ana_01" }, { UserName: "@Dave" }, { UserName: "eve" }, { UserName: "bob.x" }] },
  },
});

describe("normalizeUsername", () => {
  it("normaliza formato pero no identidad", () => {
    expect(normalizeUsername("  @Ana_01 ")).toBe("ana_01");
    expect(normalizeUsername("https://www.tiktok.com/@Ana_01?lang=es")).toBe("ana_01");
    expect(normalizeUsername("ana​_01")).toBe("ana_01");
    expect(normalizeUsername("ana_01")).not.toBe(normalizeUsername("ana_02"));
  });
});

describe("parseJson", () => {
  it("extrae seguidores y seguidos del formato actual", () => {
    const p = parseJson(tiktokJson);
    expect(p.followers).toHaveLength(3);
    expect(p.following).toHaveLength(4);
    expect(p.unassigned).toHaveLength(0);
  });
  it("soporta la variante Activity > Follower List", () => {
    const p = parseJson(JSON.stringify({ Activity: { "Follower List": { FansList: [{ UserName: "a" }] }, "Following List": { Following: [{ UserName: "b" }] } } }));
    expect(p.followers.map((e) => e.username)).toEqual(["a"]);
    expect(p.following.map((e) => e.username)).toEqual(["b"]);
  });
  it("rechaza JSON inválido", () => {
    expect(() => parseJson("{no")).toThrow();
  });
});

describe("parseTxt", () => {
  it("lee secciones con Date/UserName", () => {
    const p = parseTxt("Following\n\nDate: 2023-01-01\nUserName: a\n\nFans\n\nDate: 2023-01-02\nUserName: b\n");
    expect(p.following).toEqual([{ username: "a", date: "2023-01-01" }]);
    expect(p.followers).toEqual([{ username: "b", date: "2023-01-02" }]);
  });
  it("deja sin asignar las listas sin sección", () => {
    const p = parseTxt("@a\n@b\nc");
    expect(p.unassigned.map((e) => e.username)).toEqual(["a", "b", "c"]);
  });
  it("parseFileContent elige el parser por contenido", () => {
    expect(parseFileContent("x.txt", tiktokJson).followers).toHaveLength(3);
  });
});

describe("classify", () => {
  const data = buildImportedData([parseJson(tiktokJson)]);
  it("amigos, no mutuos y seguidores por coincidencia exacta", () => {
    const c = classify(data, new Set());
    const by = (k: string) => c.find((a) => a.key === k)!;
    expect(by("ana_01").category).toBe("friend");
    expect(by("dave").category).toBe("nonMutual");
    expect(by("eve").category).toBe("nonMutual");
    // "bob" me sigue pero "bob.x" (parecido) NO es la misma cuenta
    expect(by("bob").category).toBe("followerOnly");
    expect(by("bob.x").category).toBe("nonMutual");
    expect(by("carl").category).toBe("followerOnly");
  });
  it("la lista blanca nunca es removible", () => {
    const c = classify(data, new Set(["dave"]));
    const dave = c.find((a) => a.key === "dave")!;
    expect(dave.category).toBe("friend");
    expect(dave.removable).toBe(false);
    expect(c.filter((a) => a.removable).map((a) => a.key).sort()).toEqual(["bob.x", "eve"]);
  });
  it("estadísticas", () => {
    const s = computeStats(classify(data, new Set(["dave"])));
    expect(s).toMatchObject({ totalFollowing: 4, totalFollowers: 3, mutualFriends: 1, whitelistedKept: 1, friends: 2, nonMutual: 2, followersOnly: 2 });
    expect(s.keepPercent).toBe(50);
  });
});
