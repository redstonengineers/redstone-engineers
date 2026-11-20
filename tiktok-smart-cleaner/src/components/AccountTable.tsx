import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Lock, Search, Shield, ShieldOff } from "lucide-react";
import { profileUrl } from "../core/export";
import type { Category, ClassifiedAccount } from "../core/types";
import type { Cleaner } from "../hooks/useCleaner";
import { Card, cx } from "./ui";

type Filter = "all" | "friend" | "nonMutual" | "followerOnly" | "whitelist" | "selected";
type Sort = "name" | "dateDesc" | "dateAsc";
const PAGE = 50;

const BADGE: Record<Category, { label: string; cls: string }> = {
  friend: { label: "Amigo", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  nonMutual: { label: "No mutua", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  followerOnly: { label: "Seguidor", cls: "border-sky-500/30 bg-sky-500/10 text-sky-300" },
};

export function AccountTable({ c }: { c: Cleaner }) {
  const [filter, setFilter] = useState<Filter>("nonMutual");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [page, setPage] = useState(0);

  const counts = useMemo(() => ({
    all: c.accounts.length,
    friend: c.accounts.filter((a) => a.category === "friend").length,
    nonMutual: c.accounts.filter((a) => a.category === "nonMutual").length,
    followerOnly: c.accounts.filter((a) => a.category === "followerOnly").length,
    whitelist: c.accounts.filter((a) => a.whitelisted && a.iFollow).length,
    selected: c.selected.size,
  }), [c.accounts, c.selected]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    const list = c.accounts.filter((a) => {
      if (q && !a.key.includes(q) && !a.display.toLowerCase().includes(q)) return false;
      switch (filter) {
        case "all": return true;
        case "whitelist": return a.whitelisted && a.iFollow;
        case "selected": return c.selected.has(a.key);
        default: return a.category === filter;
      }
    });
    const cmp: Record<Sort, (x: ClassifiedAccount, y: ClassifiedAccount) => number> = {
      name: (x, y) => x.key.localeCompare(y.key),
      dateDesc: (x, y) => (y.date ?? "").localeCompare(x.date ?? "") || x.key.localeCompare(y.key),
      dateAsc: (x, y) => (x.date ?? "9").localeCompare(y.date ?? "9") || x.key.localeCompare(y.key),
    };
    return list.sort(cmp[sort]);
  }, [c.accounts, c.selected, filter, query, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  useEffect(() => { setPage(0); }, [filter, query, sort]);
  useEffect(() => { if (page >= pages) setPage(pages - 1); }, [page, pages]);
  const visible = rows.slice(page * PAGE, page * PAGE + PAGE);

  const selectable = rows.filter((a) => a.removable);
  const selectedInView = selectable.filter((a) => c.selected.has(a.key)).length;
  const allChecked = selectable.length > 0 && selectedInView === selectable.length;

  const tabs: [Filter, string][] = [
    ["nonMutual", "No mutuas"], ["friend", "Amigos"], ["followerOnly", "Seguidores"],
    ["whitelist", "Lista blanca"], ["selected", "Seleccionadas"], ["all", "Todas"],
  ];

  return (
    <Card className="overflow-hidden">
      <div className="space-y-3 border-b border-ink-700 p-4">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtros">
          {tabs.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={cx("rounded-md border px-2.5 py-1 text-xs transition",
                filter === k ? "border-accent/50 bg-accent/10 text-accent" : "border-ink-600 text-zinc-400 hover:bg-ink-700 hover:text-zinc-200")}>
              {l} <span className="ml-1 tabular-nums text-zinc-500">{counts[k].toLocaleString("es-ES")}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-52 flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar usuario…" aria-label="Buscar usuario"
              className="w-full rounded-lg border border-ink-600 bg-ink-900 py-2 pl-9 pr-3 text-sm placeholder:text-zinc-600" />
          </label>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar"
            className="rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-zinc-300">
            <option value="name">Nombre (A-Z)</option>
            <option value="dateDesc">Más recientes primero</option>
            <option value="dateAsc">Más antiguas primero</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 border-b border-ink-700 bg-ink-900/60 px-4 py-2 text-xs text-zinc-400">
        <input type="checkbox" aria-label="Seleccionar todas las cuentas filtradas" checked={allChecked} disabled={selectable.length === 0}
          ref={(el) => { if (el) el.indeterminate = selectedInView > 0 && !allChecked; }}
          onChange={() => (allChecked ? c.removeSelected(selectable.map((a) => a.key)) : c.addSelected(selectable.map((a) => a.key)))} />
        <span>
          {selectable.length > 0
            ? `Seleccionar las ${selectable.length.toLocaleString("es-ES")} cuentas revisables del filtro actual (${selectedInView} marcadas)`
            : "No hay cuentas revisables en este filtro"}
        </span>
      </div>

      <ul className="divide-y divide-ink-700">
        {visible.map((a) => (
          <li key={a.key + a.category} className={cx("flex items-center gap-3 px-4 py-2.5", c.selected.has(a.key) && "bg-accent/5")}>
            {a.removable ? (
              <input type="checkbox" aria-label={`Seleccionar @${a.display}`} checked={c.selected.has(a.key)} onChange={() => c.toggleSelected(a.key)} />
            ) : (
              <span title={a.whitelisted ? "Protegida por la lista blanca" : a.followsMe ? "Amigo mutuo: no se elimina" : "No la sigues"}
                className="grid h-4 w-4 place-items-center text-zinc-600"><Lock size={13} /></span>
            )}
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-700 text-xs font-semibold uppercase text-zinc-300">{a.display.slice(0, 1)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-white">@{a.display}</div>
              <div className="text-xs text-zinc-500">{a.date ? a.date.slice(0, 10) : "sin fecha"}{a.whitelisted && " · lista blanca"}</div>
            </div>
            <span className={cx("hidden rounded-full border px-2 py-0.5 text-xs sm:inline", BADGE[a.category].cls)}>{BADGE[a.category].label}</span>
            {a.iFollow && (
              <button onClick={() => c.toggleWhitelist(a.key)} aria-pressed={a.whitelisted}
                title={a.whitelisted ? "Quitar de la lista blanca" : "Marcar como amigo (lista blanca)"}
                className={cx("rounded-md p-1.5 hover:bg-ink-700", a.whitelisted ? "text-violet-300" : "text-zinc-500 hover:text-zinc-200")}>
                {a.whitelisted ? <ShieldOff size={15} /> : <Shield size={15} />}
              </button>
            )}
            <a href={profileUrl(a.display)} target="_blank" rel="noopener noreferrer" title="Abrir perfil en TikTok (nueva pestaña)"
              className="rounded-md p-1.5 text-zinc-500 hover:bg-ink-700 hover:text-zinc-200"><ExternalLink size={15} /></a>
          </li>
        ))}
        {visible.length === 0 && <li className="px-4 py-12 text-center text-sm text-zinc-500">No hay cuentas que coincidan.</li>}
      </ul>

      <div className="flex items-center justify-between border-t border-ink-700 px-4 py-2.5 text-xs text-zinc-500">
        <span>{rows.length.toLocaleString("es-ES")} resultados</span>
        <div className="flex items-center gap-2">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Página anterior" className="rounded p-1 hover:bg-ink-700 disabled:opacity-30"><ChevronLeft size={16} /></button>
          <span className="tabular-nums">{page + 1} / {pages}</span>
          <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Página siguiente" className="rounded p-1 hover:bg-ink-700 disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
      </div>
    </Card>
  );
}
