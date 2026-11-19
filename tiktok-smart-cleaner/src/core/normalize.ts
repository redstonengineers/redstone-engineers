/**
 * Normalización de nombres de usuario de TikTok.
 *
 * La clasificación se hace por IGUALDAD EXACTA de la clave normalizada,
 * nunca por similitud. La normalización solo elimina diferencias de formato
 * que no cambian la identidad de la cuenta:
 *   - espacios alrededor y caracteres invisibles
 *   - "@" inicial y URLs de perfil (tiktok.com/@usuario)
 *   - mayúsculas/minúsculas (TikTok no distingue entre ellas)
 *   - forma Unicode (NFKC)
 */
const INVISIBLE = /[​-‍⁠﻿­]/g;

export function normalizeUsername(input: string): string {
  let s = String(input ?? "").normalize("NFKC").replace(INVISIBLE, "").trim();
  const url = s.match(/tiktok\.com\/@([^/?#\s]+)/i);
  if (url) s = url[1];
  s = s.replace(/^@+/, "").trim();
  return s.toLowerCase();
}

/** TikTok: letras, números, "_" y "." (hasta 24 caracteres). Se acepta Unicode por seguridad. */
export function isPlausibleUsername(key: string): boolean {
  return key.length > 0 && key.length <= 64 && !/\s/.test(key);
}

export function displayName(input: string): string {
  return String(input ?? "").normalize("NFKC").replace(INVISIBLE, "").trim().replace(/^@+/, "");
}
