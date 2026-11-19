import type { ImportedData } from "./types";

/**
 * Persistencia 100 % local (localStorage del navegador). Nada sale del dispositivo.
 */
const DATA_KEY = "tsc:data:v1";
const WL_KEY = "tsc:whitelist:v1";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // cuota excedida o almacenamiento bloqueado: la app sigue funcionando en memoria
  }
}

export const storage = {
  loadData: () => read<ImportedData>(DATA_KEY),
  saveData: (d: ImportedData) => write(DATA_KEY, d),
  clearData: () => localStorage.removeItem(DATA_KEY),
  loadWhitelist: (): string[] => read<string[]>(WL_KEY) ?? [],
  saveWhitelist: (list: string[]) => write(WL_KEY, list),
  clearWhitelist: () => localStorage.removeItem(WL_KEY),
  clearAll() {
    localStorage.removeItem(DATA_KEY);
    localStorage.removeItem(WL_KEY);
  },
};
