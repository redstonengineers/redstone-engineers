import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AccountTable } from "./components/AccountTable";
import { Header } from "./components/Header";
import { ImportPanel } from "./components/ImportPanel";
import { ReviewPanel, WhitelistPanel } from "./components/Sidebar";
import { StatsGrid } from "./components/StatsGrid";
import { Button, Modal } from "./components/ui";
import { useCleaner } from "./hooks/useCleaner";

export default function App() {
  const c = useCleaner();
  const [confirm, setConfirm] = useState(false);
  const [alsoWhitelist, setAlsoWhitelist] = useState(false);

  return (
    <div className="min-h-full">
      <Header hasData={!!c.data} onDelete={() => setConfirm(true)} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {!c.data ? (
          <ImportPanel c={c} />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
              <span>Importado: {c.data.sources.join(", ")} · {new Date(c.data.importedAt).toLocaleString("es-ES")}</span>
              {c.persistFailed && (
                <span className="flex items-center gap-1 text-amber-300"><AlertTriangle size={13} /> No se pudo guardar en este navegador; los datos se perderán al cerrar.</span>
              )}
            </div>
            <StatsGrid s={c.stats} />
            <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
              <AccountTable c={c} />
              <div className="space-y-6 lg:sticky lg:top-20">
                <ReviewPanel c={c} />
                <WhitelistPanel c={c} />
              </div>
            </div>
          </div>
        )}
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-zinc-600">
        Herramienta independiente, no afiliada a TikTok. Procesamiento local: tus datos no salen de este navegador.
      </footer>

      {confirm && (
        <Modal title="Eliminar datos importados" onClose={() => setConfirm(false)}>
          <p className="text-sm text-zinc-400">Se borrarán de este navegador las listas importadas y la clasificación. Esta acción no se puede deshacer.</p>
          <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={alsoWhitelist} onChange={(e) => setAlsoWhitelist(e.target.checked)} />
            Borrar también la lista blanca
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setConfirm(false)}>Cancelar</Button>
            <Button variant="danger" onClick={() => { c.deleteData(alsoWhitelist); setConfirm(false); setAlsoWhitelist(false); }}>Eliminar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
