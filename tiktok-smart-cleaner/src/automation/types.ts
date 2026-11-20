/**
 * ARQUITECTURA DE AUTOMATIZACIÓN (preparada, NO implementada)
 *
 * Idea: la app decide QUÉ cuentas revisar; un "proveedor" decide CÓMO se ejecuta.
 * Cualquier proveedor futuro debe ser una integración AUTORIZADA (p. ej. una API
 * oficial de TikTok con consentimiento OAuth del propio usuario, si algún día
 * ofrece este permiso). Quedan fuera por diseño: scraping, automatización de la
 * interfaz, evasión de protecciones, o pedir la contraseña del usuario.
 *
 * Reglas que cualquier proveedor debe cumplir:
 *  1. Solo recibe cuentas que el usuario seleccionó explícitamente.
 *  2. Nunca recibe cuentas de la lista blanca (el motor las filtra antes).
 *  3. Requiere confirmación del usuario antes de ejecutar (`requiresConfirmation`).
 *  4. Expone `dryRun` para previsualizar sin cambiar nada.
 */
export interface UnfollowTarget {
  /** Usuario normalizado (clave de comparación). */
  key: string;
  /** Nombre para mostrar. */
  username: string;
}

export type ActionStatus = "pending" | "done" | "skipped" | "failed";

export interface ActionResult {
  key: string;
  status: ActionStatus;
  message?: string;
}

export interface AuthorizationState {
  authorized: boolean;
  /** Ámbito concedido por el usuario, p. ej. ["following.manage"]. */
  scopes: string[];
  /** Texto que explica al usuario qué se autoriza exactamente. */
  description: string;
}

export interface AutomationProvider {
  readonly id: string;
  readonly label: string;
  /** Siempre true: nunca se ejecuta nada sin confirmación explícita. */
  readonly requiresConfirmation: true;
  /** Estado de la autorización otorgada por el usuario (OAuth oficial, etc.). */
  getAuthorization(): Promise<AuthorizationState>;
  /** Simula la operación; no modifica nada. */
  dryRun(targets: readonly UnfollowTarget[]): Promise<ActionResult[]>;
  /** Ejecuta la operación. Solo llamar tras confirmación del usuario. */
  execute(targets: readonly UnfollowTarget[], signal?: AbortSignal): Promise<ActionResult[]>;
}
