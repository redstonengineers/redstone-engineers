import { normalizeUsername } from "./normalize";
import type {
  AccountSource,
  ClassifiedAccount,
  ImportedData,
  ParsedFile,
  RawEntry,
  Stats,
} from "./types";

function toMap(entries: RawEntry[], into: Record<string, AccountSource> = {}) {
  for (const e of entries) {
    const key = normalizeUsername(e.username);
    if (!key) continue;
    // duplicados: gana el primero, conservando la fecha si faltaba
    if (!into[key]) into[key] = { display: e.username, date: e.date };
    else if (!into[key].date && e.date) into[key].date = e.date;
  }
  return into;
}

/**
 * Combina uno o varios archivos analizados. `assignUnassigned` indica a qué lista
 * pertenecen las entradas que no traían sección (decisión del usuario).
 */
export function buildImportedData(
  files: ParsedFile[],
  assignUnassigned: Record<string, "followers" | "following"> = {},
): ImportedData {
  const followers: Record<string, AccountSource> = {};
  const following: Record<string, AccountSource> = {};
  for (const f of files) {
    toMap(f.followers, followers);
    toMap(f.following, following);
    const target = assignUnassigned[f.fileName];
    if (target && f.unassigned.length) toMap(f.unassigned, target === "followers" ? followers : following);
  }
  return {
    importedAt: new Date().toISOString(),
    sources: files.map((f) => f.fileName),
    followers,
    following,
  };
}

/**
 * Clasificación por IGUALDAD EXACTA de usuarios normalizados (sin similitud).
 *  - friend:       sigo + me sigue, o está en la lista blanca (y la sigo)
 *  - nonMutual:    sigo, no me sigue, no está en la lista blanca
 *  - followerOnly: me sigue, no la sigo
 * Las cuentas de la lista blanca NUNCA son `removable`.
 */
export function classify(data: ImportedData, whitelist: ReadonlySet<string>): ClassifiedAccount[] {
  const out: ClassifiedAccount[] = [];
  for (const [key, src] of Object.entries(data.following)) {
    const followsMe = key in data.followers;
    const whitelisted = whitelist.has(key);
    const isFriend = followsMe || whitelisted;
    out.push({
      key,
      display: src.display,
      category: isFriend ? "friend" : "nonMutual",
      iFollow: true,
      followsMe,
      whitelisted,
      date: src.date,
      removable: !isFriend,
    });
  }
  for (const [key, src] of Object.entries(data.followers)) {
    if (key in data.following) continue;
    out.push({
      key,
      display: src.display,
      category: "followerOnly",
      iFollow: false,
      followsMe: true,
      whitelisted: whitelist.has(key),
      date: src.date,
      removable: false,
    });
  }
  return out;
}

export function computeStats(accounts: readonly ClassifiedAccount[]): Stats {
  let totalFollowing = 0, totalFollowers = 0, mutual = 0, wl = 0, nonMutual = 0, fo = 0;
  for (const a of accounts) {
    if (a.iFollow) {
      totalFollowing++;
      if (a.category === "friend") (a.followsMe ? mutual++ : wl++);
      else nonMutual++;
    }
    if (a.followsMe) totalFollowers++;
    if (a.category === "followerOnly") fo++;
  }
  const friends = mutual + wl;
  return {
    totalFollowing,
    totalFollowers,
    mutualFriends: mutual,
    whitelistedKept: wl,
    friends,
    nonMutual,
    followersOnly: fo,
    keepPercent: totalFollowing === 0 ? 0 : (friends / totalFollowing) * 100,
  };
}
