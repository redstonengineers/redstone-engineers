import { displayName, isPlausibleUsername, normalizeUsername } from "./normalize";
import type { ParsedFile, RawEntry } from "./types";

const USER_KEYS = ["username", "user_name", "uniqueid", "unique_id", "handle", "nickname_id"];
const DATE_KEYS = ["date", "datetime", "time", "createtime", "followdate"];

function pickKey(obj: Record<string, unknown>, candidates: string[]): string | undefined {
  for (const k of Object.keys(obj)) {
    if (candidates.includes(k.toLowerCase().replace(/[\s-]/g, ""))) return k;
  }
  return undefined;
}

function entryFromObject(obj: Record<string, unknown>): RawEntry | null {
  const uk = pickKey(obj, USER_KEYS);
  if (!uk) return null;
  const raw = obj[uk];
  if (typeof raw !== "string" || !isPlausibleUsername(normalizeUsername(raw))) return null;
  const dk = pickKey(obj, DATE_KEYS);
  const date = dk && typeof obj[dk] === "string" ? (obj[dk] as string) : undefined;
  return { username: displayName(raw), date };
}

type Role = "followers" | "following" | null;

/** Decide el rol de una sección a partir del nombre de sus claves ancestras. */
function roleFromPath(path: string[]): Role {
  // La clave más cercana al array manda; así "Following List" > "Following" no se confunde.
  for (let i = path.length - 1; i >= 0; i--) {
    const k = path[i].toLowerCase();
    if (k.includes("following") || k.includes("seguido")) return "following";
    if (k.includes("fans") || k.includes("follower") || k.includes("seguidor")) return "followers";
  }
  return null;
}

/**
 * Recorre cualquier estructura JSON buscando arrays de objetos con nombre de usuario.
 * Funciona con las variantes conocidas del export de TikTok, por ejemplo:
 *   Profile And Settings > Follower > FansList[]   { Date, UserName }
 *   Profile And Settings > Following > Following[] { Date, UserName }
 *   Activity > Follower List > FansList[]  /  Activity > Following List > Following[]
 */
export function parseJson(text: string, fileName = "archivo.json"): ParsedFile {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }
  const out: ParsedFile = { fileName, followers: [], following: [], unassigned: [] };

  const visit = (node: unknown, path: string[], depth: number) => {
    if (depth > 12 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      const entries: RawEntry[] = [];
      let objectItems = 0;
      for (const item of node) {
        if (typeof item === "string") {
          const key = normalizeUsername(item);
          if (isPlausibleUsername(key)) entries.push({ username: displayName(item) });
        } else if (item && typeof item === "object" && !Array.isArray(item)) {
          objectItems++;
          const e = entryFromObject(item as Record<string, unknown>);
          if (e) entries.push(e);
        }
      }
      if (entries.length > 0) {
        const role = roleFromPath(path);
        (role ? out[role] : out.unassigned).push(...entries);
      }
      // seguir bajando solo si había objetos que no eran entradas de usuario
      if (objectItems > entries.length) node.forEach((n) => visit(n, path, depth + 1));
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      visit(v, [...path, k], depth + 1);
    }
  };
  visit(root, [], 0);
  return out;
}

const SECTION_FOLLOWING = /^(following(\s*list)?|seguidos|siguiendo|cuentas seguidas)\s*:?\s*$/i;
const SECTION_FOLLOWERS = /^(followers?(\s*list)?|fans(\s*list)?|fans\s*and\s*followers|seguidores)\s*:?\s*$/i;
const USER_LINE = /^\s*(user\s*name|username|usuario|user)\s*[:=]\s*(.+?)\s*$/i;
const DATE_LINE = /^\s*(date|fecha)\s*[:=]\s*(.+?)\s*$/i;

/**
 * TXT: formato de TikTok ("Date: ...\nUserName: ...") con cabeceras de sección,
 * o listas sencillas con un usuario por línea bajo una cabecera.
 * Sin cabeceras, las entradas quedan "sin asignar" para que el usuario las asigne.
 */
export function parseTxt(text: string, fileName = "archivo.txt"): ParsedFile {
  const out: ParsedFile = { fileName, followers: [], following: [], unassigned: [] };
  let role: Role = null;
  let pendingDate: string | undefined;

  const push = (name: string, date?: string) => {
    const key = normalizeUsername(name);
    if (!isPlausibleUsername(key)) return;
    (role ? out[role] : out.unassigned).push({ username: displayName(name), date });
  };

  for (const rawLine of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const bare = line.replace(/^[#=\-*\s]+|[#=\-*\s]+$/g, "");
    if (SECTION_FOLLOWING.test(bare)) { role = "following"; pendingDate = undefined; continue; }
    if (SECTION_FOLLOWERS.test(bare)) { role = "followers"; pendingDate = undefined; continue; }
    const d = line.match(DATE_LINE);
    if (d) { pendingDate = d[2]; continue; }
    const u = line.match(USER_LINE);
    if (u) { push(u[2], pendingDate); pendingDate = undefined; continue; }
    // línea suelta: un usuario por línea (o separados por comas/;)
    if (!/:\s/.test(line)) {
      for (const part of line.split(/[,;\t]+/)) if (part.trim()) push(part);
    }
  }
  return out;
}

export function parseFileContent(fileName: string, text: string): ParsedFile {
  const trimmed = text.replace(/^﻿/, "").trimStart();
  const looksJson = /\.json$/i.test(fileName) || trimmed.startsWith("{") || trimmed.startsWith("[");
  return looksJson ? parseJson(text, fileName) : parseTxt(text, fileName);
}
