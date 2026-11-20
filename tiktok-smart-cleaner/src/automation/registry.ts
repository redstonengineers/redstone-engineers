import type { ActionResult, AuthorizationState, AutomationProvider, UnfollowTarget } from "./types";

/**
 * Proveedor por defecto: revisión manual. No automatiza nada; el usuario abre
 * cada perfil y deja de seguirlo por sí mismo en la app oficial de TikTok.
 */
export const manualProvider: AutomationProvider = {
  id: "manual",
  label: "Revisión manual",
  requiresConfirmation: true,
  async getAuthorization(): Promise<AuthorizationState> {
    return {
      authorized: true,
      scopes: [],
      description: "No requiere autorización: tú ejecutas cada acción en TikTok.",
    };
  },
  async dryRun(targets) {
    return targets.map((t): ActionResult => ({ key: t.key, status: "pending" }));
  },
  async execute(targets) {
    return targets.map((t): ActionResult => ({
      key: t.key,
      status: "skipped",
      message: "Acción manual: abre el perfil y deja de seguir desde TikTok.",
    }));
  },
};

/**
 * Autoclicker: la web solo GENERA el script; lo ejecuta el usuario en su propia sesión
 * de tiktok.com (ver autoclickerScript.ts). La web no se comunica con TikTok.
 */
export const autoclickerProvider: AutomationProvider = {
  id: "autoclicker",
  label: "Autoclicker (script en tu navegador)",
  requiresConfirmation: true,
  async getAuthorization(): Promise<AuthorizationState> {
    return {
      authorized: true,
      scopes: ["browser-session"],
      description: "Lo ejecutas tú en tu sesión de TikTok y puedes detenerlo en cualquier momento.",
    };
  },
  async dryRun(targets) {
    return targets.map((t): ActionResult => ({ key: t.key, status: "pending" }));
  },
  async execute(targets) {
    return targets.map((t): ActionResult => ({
      key: t.key, status: "pending", message: "Pendiente: se ejecuta con el script en tu navegador.",
    }));
  },
};

const providers = new Map<string, AutomationProvider>([
  [manualProvider.id, manualProvider],
  [autoclickerProvider.id, autoclickerProvider],
]);

/** Punto de extensión futuro: registrar una integración autorizada. */
export function registerProvider(p: AutomationProvider) {
  providers.set(p.id, p);
}
export const listProviders = () => [...providers.values()];

/**
 * Único camino hacia un proveedor. Garantiza la lista blanca: aunque la UI falle,
 * una cuenta protegida jamás llega a un proveedor.
 */
export function prepareTargets(
  selected: readonly UnfollowTarget[],
  whitelist: ReadonlySet<string>,
): UnfollowTarget[] {
  return selected.filter((t) => !whitelist.has(t.key));
}
