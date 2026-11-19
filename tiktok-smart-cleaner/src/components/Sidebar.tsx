import { useState } from "react";
import { Bot, Check, ClipboardCopy, Download, ListChecks, Plus, Shield, X } from "lucide-react";
import { download, toCsv, toTxt } from "../core/export";
import type { Cleaner } from "../hooks/useCleaner";
import { listProviders, prepareTargets } from "../automation/registry";
import { AutoclickerPanel } from "./AutoclickerPanel";
import { Button, Card } from "./ui";

export function ReviewPanel({ c }: { c: Cleaner }) {
  const [copied, setCopied] = useState(false);
  const [provider, setProvider] = useState("autoclicker");

  // Doble barrera: la selección ya excluye lista blanca, y prepareTargets la vuelve a filtrar.
  const chosen = c.accounts.filter((a) => c.selected.has(a.key));
  const targets = prepareTargets(chosen.map((a) => ({ key: a.key, username: a.display })), c.whitelist);
  const safeChosen = chosen.filter((a) => targets.some((t) => t.key === a.key));
  const remaining = c.stats.totalFollowing - safeChosen.length;
  const pct = c.stats.totalFollowing ? (remaining / c.stats.totalFollowing) * 100 : 0;

  const copy = async () => {
    try { await navigator.clipboard.writeText(toTxt(safeChosen)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* sin permiso de portapapeles */ }
  };

  return (
    <Card className="p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><ListChecks size={16} className="text-accent" /> Revisión</h3>
      <div className="mt-3 text-3xl font-semibold tabular-nums text-white">{safeChosen.length.toLocaleString("es-ES")}</div>
      <p className="text-xs text-zinc-500">cuentas marcadas para dejar de seguir</p>
      <p className="mt-3 rounded-lg bg-ink-900 p-2.5 text-xs text-zinc-400">
        Seguirías a <b className="text-zinc-200">{remaining.toLocaleString("es-ES")}</b> cuentas ({pct.toFixed(1)} %).
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button disabled={!safeChosen.length} onClick={() => download("revision-tiktok.csv", toCsv(safeChosen), "text/csv")}><Download size={14} /> CSV</Button>
        <Button disabled={!safeChosen.length} onClick={() => download("revision-tiktok.txt", toTxt(safeChosen), "text/plain")}><Download size={14} /> TXT</Button>
        <Button disabled={!safeChosen.length} onClick={copy}>{copied ? <Check size={14} /> : <ClipboardCopy size={14} />} {copied ? "Copiado" : "Copiar"}</Button>
        <Button disabled={!safeChosen.length} onClick={c.clearSelection}><X size={14} /> Limpiar</Button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        Revisa la selección antes de actuar. Puedes exportarla y abrir cada perfil con <span className="text-zinc-300">↗</span>, o usar el autoclicker de abajo.
      </p>

      <div className="mt-4 border-t border-ink-700 pt-4">
        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400"><Bot size={14} /> Automatización</h4>
        <select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Proveedor de automatización"
          className="mt-2 w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-zinc-300">
          {listProviders().map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {provider === "autoclicker" ? (
          <AutoclickerPanel keys={targets.map((t) => t.key)} />
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">Revisión manual: no se automatiza nada. Cambia a «Autoclicker» para generar el script.</p>
        )}
      </div>
    </Card>
  );
}

export function WhitelistPanel({ c }: { c: Cleaner }) {
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState("");
  const list = [...c.whitelist].sort();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (c.addWhitelist(value)) { setValue(""); setMsg(""); } else setMsg("Escribe un usuario válido.");
  };
  return (
    <Card className="p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Shield size={16} className="text-violet-400" /> Lista blanca</h3>
      <p className="mt-1 text-xs text-zinc-500">Cuentas que cuentan como amigos aunque no te sigan. Nunca aparecerán para eliminar.</p>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="@usuario" aria-label="Añadir usuario a la lista blanca"
          className="min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm placeholder:text-zinc-600" />
        <Button type="submit" aria-label="Añadir"><Plus size={15} /></Button>
      </form>
      {msg && <p className="mt-1 text-xs text-red-300">{msg}</p>}
      <ul className="mt-3 max-h-48 space-y-1 overflow-auto">
        {list.map((k) => (
          <li key={k} className="flex items-center justify-between rounded-md bg-ink-900 px-2.5 py-1.5 text-sm">
            <span className="truncate text-zinc-200">@{k}</span>
            <button onClick={() => c.removeWhitelist(k)} aria-label={`Quitar @${k}`} className="text-zinc-500 hover:text-red-300"><X size={14} /></button>
          </li>
        ))}
        {list.length === 0 && <li className="text-xs text-zinc-600">Aún no hay excepciones.</li>}
      </ul>
    </Card>
  );
}
