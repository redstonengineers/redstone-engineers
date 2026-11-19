import { useMemo, useState } from "react";
import { AlertTriangle, Check, ClipboardCopy, Download, MousePointerClick } from "lucide-react";
import { MIN_DELAY_MS, buildAutoclickerScript, buildUserscript } from "../automation/autoclickerScript";
import { download } from "../core/export";
import { Button } from "./ui";

/** `keys` ya viene filtrado: solo no mutuas y fuera de la lista blanca. */
export function AutoclickerPanel({ keys }: { keys: string[] }) {
  const [delay, setDelay] = useState(4);
  const [max, setMax] = useState(25);
  const [dry, setDry] = useState(true);
  const [ack, setAck] = useState(false);
  const [copied, setCopied] = useState(false);

  const cfg = useMemo(() => ({ targets: keys, delayMs: Math.max(MIN_DELAY_MS, delay * 1000), maxPerRun: max, dryRun: dry }), [keys, delay, max, dry]);
  const ready = keys.length > 0 && (dry || ack);

  const copy = async () => {
    try { await navigator.clipboard.writeText(buildAutoclickerScript(cfg)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* sin permiso */ }
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-ink-600 bg-ink-900 p-3 text-xs text-zinc-400">
      <div className="flex items-center gap-2 font-semibold text-zinc-200"><MousePointerClick size={14} className="text-accent" /> Autoclicker</div>
      <p>Genera un script con solo las cuentas marcadas. <b className="text-zinc-200">Los amigos mutuos y la lista blanca nunca se incluyen</b>, y el script además ignora cualquier botón «Amigos».</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">Pausa (s)
          <input type="number" min={MIN_DELAY_MS / 1000} max={60} value={delay} onChange={(e) => setDelay(Number(e.target.value) || 4)}
            className="w-full rounded-md border border-ink-600 bg-ink-850 px-2 py-1.5 text-sm text-zinc-200" />
        </label>
        <label className="space-y-1">Máx. por ejecución
          <input type="number" min={1} max={200} value={max} onChange={(e) => setMax(Math.max(1, Number(e.target.value) || 25))}
            className="w-full rounded-md border border-ink-600 bg-ink-850 px-2 py-1.5 text-sm text-zinc-200" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-zinc-300"><input type="checkbox" checked={dry} onChange={(e) => setDry(e.target.checked)} /> Simulación (solo resalta, no hace clic)</label>
      {!dry && (
        <label className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200">
          <input type="checkbox" className="mt-0.5" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span><AlertTriangle size={12} className="mr-1 inline" />Entiendo que automatizar acciones puede incumplir las condiciones de TikTok y limitar mi cuenta. Lo hago bajo mi responsabilidad.</span>
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button disabled={!ready} onClick={copy}>{copied ? <Check size={14} /> : <ClipboardCopy size={14} />} {copied ? "Copiado" : "Copiar"}</Button>
        <Button disabled={!ready} onClick={() => download("tiktok-smart-cleaner.user.js", buildUserscript(cfg), "text/javascript")}><Download size={14} /> .user.js</Button>
      </div>
      <ol className="list-decimal space-y-1 pl-4">
        <li>Empieza con <b>Simulación</b> para ver qué marcaría.</li>
        <li>En tiktok.com abre tu perfil → <b>Siguiendo</b>.</li>
        <li>Abre la consola (F12) y pega el script, o instala el .user.js.</li>
        <li>Pulsa <b>Iniciar</b>. <b>Esc</b> o <b>Detener</b> lo paran al instante.</li>
      </ol>
      <p>Ritmo lento y tope por ejecución. Si TikTok pide verificación o limita la acción, el script se detiene; no intenta evitarlo.</p>
    </div>
  );
}
