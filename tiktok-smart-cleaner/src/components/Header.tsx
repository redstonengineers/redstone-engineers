import { Activity, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "./ui";

export function Header({ hasData, onDelete }: { hasData: boolean; onDelete: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-ink-600 bg-ink-800 text-accent"><Activity size={18} /></div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white">TikTok Smart Cleaner</h1>
            <p className="text-xs text-zinc-500">Panel de limpieza de cuentas seguidas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 sm:inline-flex" title="Todo se procesa en tu navegador. No se envía nada a ningún servidor.">
            <ShieldCheck size={13} /> 100 % local
          </span>
          {hasData && <Button variant="danger" onClick={onDelete}><Trash2 size={14} /> <span className="hidden sm:inline">Eliminar datos</span></Button>}
        </div>
      </div>
    </header>
  );
}
