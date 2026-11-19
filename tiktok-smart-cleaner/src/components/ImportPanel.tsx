import { useRef, useState } from "react";
import { AlertTriangle, FileJson, Lock, Upload, X } from "lucide-react";
import type { Cleaner } from "../hooks/useCleaner";
import type { ParsedFile } from "../core/types";
import { Button, Card, Modal, cx } from "./ui";

export function ImportPanel({ c }: { c: Cleaner }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const pick = (list: FileList | null) => { if (list?.length) c.importFiles([...list]); };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-white">Importa tus datos de TikTok</h2>
        <p className="mt-1 text-sm text-zinc-400">Sube el archivo que descargaste desde TikTok. Detectaremos quién te sigue y a quién sigues.</p>

        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
          className={cx(
            "mt-5 flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition",
            drag ? "border-accent bg-accent/5" : "border-ink-600 hover:border-zinc-500 hover:bg-ink-800/60",
          )}
        >
          <Upload className="text-accent" size={28} />
          <span className="text-sm font-medium text-white">{c.busy ? "Procesando…" : "Arrastra aquí tu archivo o haz clic para elegirlo"}</span>
          <span className="text-xs text-zinc-500">Formatos admitidos: .json y .txt · puedes subir varios archivos a la vez</span>
        </button>
        <input ref={input} type="file" accept=".json,.txt,application/json,text/plain" multiple hidden
          onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />

        {c.error && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1">{c.error}</span>
            <button onClick={c.dismissError} aria-label="Descartar"><X size={14} /></button>
          </div>
        )}
      </Card>

      <div className="space-y-6">
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><FileJson size={16} className="text-accent" /> Cómo obtener el archivo</h3>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-zinc-400">
            <li>En TikTok: <span className="text-zinc-200">Perfil → Menú → Ajustes y privacidad → Cuenta → Descargar tus datos</span>.</li>
            <li>Elige el formato <span className="text-zinc-200">JSON</span> (o TXT).</li>
            <li>Solicita los datos, espera el aviso y descarga el archivo.</li>
            <li>Si es un .zip, descomprímelo y sube el .json.</li>
          </ol>
        </Card>
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Lock size={16} className="text-emerald-400" /> Privacidad</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-zinc-400">
            <li>• El archivo se lee en tu navegador y no se sube a ningún servidor.</li>
            <li>• Nunca se pide tu contraseña de TikTok.</li>
            <li>• Puedes borrar todo cuando quieras.</li>
          </ul>
        </Card>
      </div>

      {c.pending && <AssignModal files={c.pending} onCancel={c.cancelPending} onConfirm={c.commit} />}
    </div>
  );
}

/** TXT sin secciones: el usuario indica si cada archivo es de seguidores o de seguidos. */
function AssignModal({ files, onCancel, onConfirm }: {
  files: ParsedFile[]; onCancel: () => void;
  onConfirm: (f: ParsedFile[], a: Record<string, "followers" | "following">) => void;
}) {
  const needs = files.filter((f) => f.unassigned.length > 0);
  const [choice, setChoice] = useState<Record<string, "followers" | "following">>({});
  const ready = needs.every((f) => choice[f.fileName]);
  return (
    <Modal title="¿Qué contiene cada archivo?" onClose={onCancel}>
      <p className="mb-4 text-sm text-zinc-400">No hemos podido detectar la sección en estos archivos. Indica qué lista contiene cada uno.</p>
      <div className="space-y-3">
        {needs.map((f) => (
          <div key={f.fileName} className="rounded-lg border border-ink-600 p-3">
            <p className="truncate text-sm text-white">{f.fileName} <span className="text-zinc-500">· {f.unassigned.length} cuentas</span></p>
            <div className="mt-2 flex gap-2">
              {([["following", "Cuentas que sigo"], ["followers", "Mis seguidores"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => setChoice((s) => ({ ...s, [f.fileName]: v }))}
                  className={cx("flex-1 rounded-md border px-2 py-1.5 text-xs", choice[f.fileName] === v ? "border-accent bg-accent/10 text-accent" : "border-ink-600 text-zinc-300 hover:bg-ink-700")}>{l}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" disabled={!ready} onClick={() => onConfirm(files, choice)}>Continuar</Button>
      </div>
    </Modal>
  );
}
