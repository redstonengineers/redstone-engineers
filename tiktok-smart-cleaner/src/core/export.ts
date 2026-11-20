import type { ClassifiedAccount } from "./types";

export const profileUrl = (username: string) => `https://www.tiktok.com/@${encodeURIComponent(username)}`;

/** Neutraliza inyección de fórmulas al abrir el CSV en hojas de cálculo. */
const csvCell = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(accounts: readonly ClassifiedAccount[]): string {
  const rows = [["usuario", "perfil", "me_sigue", "fecha_seguimiento"]];
  for (const a of accounts) rows.push([a.display, profileUrl(a.display), a.followsMe ? "si" : "no", a.date ?? ""]);
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

export function toTxt(accounts: readonly ClassifiedAccount[]): string {
  return accounts.map((a) => `@${a.display}`).join("\n");
}

export function download(fileName: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
