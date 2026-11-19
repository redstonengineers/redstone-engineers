import { useCallback, useEffect, useMemo, useState } from "react";
import { buildImportedData, classify, computeStats } from "../core/classify";
import { normalizeUsername } from "../core/normalize";
import { parseFileContent } from "../core/parse";
import { storage } from "../core/storage";
import type { ImportedData, ParsedFile } from "../core/types";

const MAX_BYTES = 200 * 1024 * 1024;

export function useCleaner() {
  const [data, setData] = useState<ImportedData | null>(() => storage.loadData());
  const [whitelist, setWhitelist] = useState<Set<string>>(() => new Set(storage.loadWhitelist()));
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  /** Archivos analizados que esperan decisión (TXT sin secciones). */
  const [pending, setPending] = useState<ParsedFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [persistFailed, setPersistFailed] = useState(false);

  useEffect(() => { storage.saveWhitelist([...whitelist]); }, [whitelist]);

  const accounts = useMemo(() => (data ? classify(data, whitelist) : []), [data, whitelist]);
  const stats = useMemo(() => computeStats(accounts), [accounts]);

  /** Selección efectiva: nunca incluye cuentas protegidas ni que ya no sean candidatas. */
  const effectiveSelected = useMemo(() => {
    const removable = new Set(accounts.filter((a) => a.removable).map((a) => a.key));
    return new Set([...selected].filter((k) => removable.has(k)));
  }, [accounts, selected]);

  const commit = useCallback((files: ParsedFile[], assign: Record<string, "followers" | "following"> = {}) => {
    const d = buildImportedData(files, assign);
    if (!Object.keys(d.following).length && !Object.keys(d.followers).length) {
      setError("No se encontraron cuentas en los archivos. Revisa que sean el export de TikTok (JSON o TXT).");
      return;
    }
    setData(d);
    setSelected(new Set());
    setPending(null);
    setError(null);
    setPersistFailed(!storage.saveData(d));
  }, []);

  const importFiles = useCallback(async (files: File[]) => {
    setError(null);
    setBusy(true);
    try {
      const parsed: ParsedFile[] = [];
      for (const f of files) {
        if (f.size > MAX_BYTES) throw new Error(`"${f.name}" es demasiado grande.`);
        if (!/\.(json|txt)$/i.test(f.name)) throw new Error(`"${f.name}": solo se admiten archivos .json o .txt.`);
        parsed.push(parseFileContent(f.name, await f.text()));
      }
      if (parsed.some((p) => p.unassigned.length > 0)) setPending(parsed);
      else commit(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setBusy(false);
    }
  }, [commit]);

  const toggleSelected = useCallback((key: string) => {
    setSelected((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }, []);
  const addSelected = useCallback((keys: string[]) => setSelected((s) => new Set([...s, ...keys])), []);
  const removeSelected = useCallback((keys: string[]) => setSelected((s) => { const n = new Set(s); keys.forEach((k) => n.delete(k)); return n; }), []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const addWhitelist = useCallback((raw: string): boolean => {
    const key = normalizeUsername(raw);
    if (!key) return false;
    setWhitelist((w) => new Set(w).add(key));
    setSelected((s) => { const n = new Set(s); n.delete(key); return n; });
    return true;
  }, []);
  const removeWhitelist = useCallback((key: string) => setWhitelist((w) => { const n = new Set(w); n.delete(key); return n; }), []);
  const toggleWhitelist = useCallback((key: string) => {
    setWhitelist((w) => { const n = new Set(w); n.has(key) ? n.delete(key) : n.add(key); return n; });
    setSelected((s) => { const n = new Set(s); n.delete(key); return n; });
  }, []);

  /** Borra los datos importados (y opcionalmente la lista blanca). */
  const deleteData = useCallback((includeWhitelist: boolean) => {
    storage.clearData();
    setData(null); setSelected(new Set()); setPending(null); setError(null);
    if (includeWhitelist) { storage.clearWhitelist(); setWhitelist(new Set()); }
  }, []);

  return {
    data, accounts, stats, whitelist, selected: effectiveSelected, pending, error, busy, persistFailed,
    importFiles, commit, cancelPending: () => setPending(null), dismissError: () => setError(null),
    toggleSelected, addSelected, removeSelected, clearSelection,
    addWhitelist, removeWhitelist, toggleWhitelist, deleteData,
  };
}
export type Cleaner = ReturnType<typeof useCleaner>;
