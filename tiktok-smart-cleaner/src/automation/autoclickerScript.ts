/**
 * Generador del script autoclicker.
 *
 * El script se ejecuta en la pestaña de tiktok.com del PROPIO usuario (consola o
 * userscript), con su sesión. Esta web nunca controla TikTok ni ve credenciales.
 *
 * Garantías del script generado:
 *  - Solo actúa sobre los usuarios incluidos en `targets` (coincidencia exacta normalizada).
 *  - Nunca pulsa botones "Amigos"/"Friends" (cuentas mutuas).
 *  - No arranca hasta que el usuario pulsa "Iniciar"; Esc o "Detener" lo paran al instante.
 *  - Ritmo fijo y lento, con tope por ejecución y tope diario.
 *  - Solo actúa dentro de la ventana «Siguiendo» de tu perfil (data-e2e="follow-info-popup").
 *  - Si aparece una verificación/captcha/límite, se DETIENE. No intenta saltárselos.
 */
export interface AutoclickerConfig {
  /** Claves normalizadas de las cuentas a dejar de seguir. */
  targets: string[];
  /** Pausa entre acciones (ms). */
  delayMs: number;
  /** Máximo de cuentas por ejecución. */
  maxPerRun: number;
  /** Máximo de cuentas por día (se cuenta en el navegador). */
  maxPerDay: number;
  /** Si true, solo resalta y registra; no hace clic. */
  dryRun: boolean;
}

export const MIN_DELAY_MS = 2000;

const BODY = String.raw`
(function () {
  if (window.__tscLoaded) { alert("TikTok Smart Cleaner ya está cargado en esta página."); return; }
  window.__tscLoaded = true;
  var CFG = __CFG__;
  var norm = function (s) {
    try { s = decodeURIComponent(String(s)); } catch (e) { s = String(s); }
    return s.normalize("NFKC").replace(/[​-‍⁠﻿­]/g, "").trim().replace(/^@+/, "").toLowerCase();
  };
  var targets = {}; CFG.targets.forEach(function (t) { targets[norm(t)] = true; });
  var total = CFG.targets.length;
  var FOLLOWING = /^(following|siguiendo)$/i, MUTUAL = /^(friends|amigos)$/i;
  var BLOCK = /captcha|verify|verific|too many|demasiad|try again later|int[eé]ntalo m[aá]s tarde|l[ií]mite|suspicious|sospech/i;
  var POPUP = '[data-e2e="follow-info-popup"]';
  var running = false, stopped = false, done = [], skipped = [], failed = 0, scanned = {}, seen = {};

  // ---------- presupuesto diario (guardado en este navegador) ----------
  var today = new Date().toISOString().slice(0, 10), DKEY = "tsc:day";
  function dayCount() { try { var d = JSON.parse(localStorage.getItem(DKEY) || "{}"); return d.date === today ? d.n : 0; } catch (e) { return 0; } }
  function addDay(k) { try { localStorage.setItem(DKEY, JSON.stringify({ date: today, n: dayCount() + k })); } catch (e) {} }
  var dayLeft = function () { return Math.max(0, CFG.maxPerDay - dayCount()); };

  // ---------- UI ----------
  var box = document.createElement("div");
  box.setAttribute("style", "position:fixed;right:16px;bottom:16px;z-index:2147483647;width:310px;padding:14px;border-radius:12px;background:#0c0e13;color:#e4e4e7;border:1px solid #2a3140;font:13px system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)");
  box.innerHTML = '<div style="font-weight:600;color:#22d3ee;margin-bottom:6px">TikTok Smart Cleaner</div>' +
    '<div id="tsc-s" style="min-height:36px;color:#a1a1aa"></div>' +
    '<div style="display:flex;gap:8px;margin-top:10px"><button id="tsc-go" style="flex:1;padding:7px;border-radius:8px;border:0;background:#22d3ee;color:#07080b;font-weight:600;cursor:pointer"></button>' +
    '<button id="tsc-x" style="padding:7px 10px;border-radius:8px;border:1px solid #2a3140;background:#161a22;color:#e4e4e7;cursor:pointer">Detener</button></div>';
  document.body.appendChild(box);
  var $s = box.querySelector("#tsc-s"), $go = box.querySelector("#tsc-go"), $x = box.querySelector("#tsc-x");
  $go.textContent = CFG.dryRun ? "Iniciar simulación" : "Iniciar";
  var say = function (t) { $s.textContent = t; };
  say((CFG.dryRun ? "[SIMULACIÓN] " : "") + total + " cuentas en la lista. Hoy quedan " + dayLeft() + " de " + CFG.maxPerDay + ". Abre tu perfil → Siguiendo y pulsa Iniciar.");
  var onKey = function (e) { if (e.key === "Escape") stop("Detenido con Esc."); };
  document.addEventListener("keydown", onKey, true);
  function stop(msg) { stopped = true; if (msg) say(msg); }
  $x.onclick = function () { if (running) stop("Detenido por ti."); else { cleanup(); } };
  function cleanup() { document.removeEventListener("keydown", onKey, true); box.remove(); window.__tscLoaded = false; }

  // ---------- localizar filas (SOLO dentro de la ventana «Siguiendo») ----------
  function handleOf(a) { var m = (a.getAttribute("href") || "").match(/\/@([^\/?#]+)/); return m ? norm(m[1]) : null; }
  function rows(root) {
    var out = {};
    root.querySelectorAll('[data-e2e="follow-button"]').forEach(function (btn) {
      var t = (btn.textContent || "").trim();
      var mutual = MUTUAL.test(t);
      if (!mutual && !FOLLOWING.test(t)) return;
      var el = btn, key = null;
      for (var i = 0; i < 8 && el.parentElement && el.parentElement !== root; i++) {
        el = el.parentElement;
        var keys = {}, n = 0, first = null;
        el.querySelectorAll('a[href*="/@"]').forEach(function (x) { var k = handleOf(x); if (k && !keys[k]) { keys[k] = 1; n++; first = k; } });
        if (n > 1) return;                      // contenedor demasiado grande: no arriesgar
        if (n === 1) { key = first; break; }
      }
      if (key && !out[key]) out[key] = { key: key, el: el, btn: btn, mutual: mutual };
    });
    return out;
  }
  function scroller(root) {
    var all = root.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)) return e;
    }
    return root;
  }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var blocked = function () {
    var d = document.querySelectorAll('[role="dialog"],[class*="aptcha"],[id*="aptcha"]');
    for (var i = 0; i < d.length; i++) if (BLOCK.test(d[i].textContent || "")) return true;
    return false;
  };
  var seenCount = function () { return Object.keys(seen).length; };

  // ---------- bucle principal ----------
  async function run() {
    var root = document.querySelector(POPUP);
    if (!root) { say("No veo la ventana «Siguiendo». Ve a TU perfil y pulsa el contador «Siguiendo» (no el menú de la izquierda)."); return; }
    if (!CFG.dryRun && dayLeft() <= 0) { say("Has alcanzado el límite de hoy (" + CFG.maxPerDay + "). Sigue mañana."); return; }
    running = true; stopped = false; $go.disabled = true;
    var idle = 0, reason = "";
    while (!stopped && done.length < CFG.maxPerRun && done.length < total && (CFG.dryRun || dayLeft() > 0)) {
      if (blocked()) { reason = "TikTok pide verificación o ha limitado la acción. Detenido: resuélvelo tú y vuelve más tarde."; stop(reason); break; }
      root = document.querySelector(POPUP);
      if (!root) { reason = "Se cerró la ventana «Siguiendo»."; stop(reason); break; }
      var map = rows(root), acted = false;
      for (var key in map) { seen[key] = 1; }
      for (var key2 in map) {
        if (stopped || done.length >= CFG.maxPerRun || (!CFG.dryRun && dayLeft() <= 0)) break;
        if (!targets[key2] || scanned[key2]) continue;
        var r = map[key2];
        scanned[key2] = true;
        if (r.mutual) { skipped.push(key2); continue; }     // amigo mutuo (botón Amigos/Friends): nunca se toca
        r.el.scrollIntoView({ block: "center" });
        if (CFG.dryRun) {
          r.el.style.outline = "2px solid #22d3ee"; done.push(key2); acted = true;
          say("[SIMULACIÓN] " + done.length + " marcadas · @" + key2);
        } else {
          r.btn.click();
          await wait(1500);
          var after = (r.btn.isConnected ? (r.btn.textContent || "").trim() : "");
          if (!r.btn.isConnected || !FOLLOWING.test(after)) { done.push(key2); failed = 0; addDay(1); say(done.length + " hechas (hoy " + dayCount() + "/" + CFG.maxPerDay + ") · @" + key2); }
          else { failed++; say("@" + key2 + ": TikTok no confirmó el cambio (" + failed + "/3)."); if (failed >= 3) { reason = "Demasiados fallos seguidos. Detenido por seguridad."; stop(reason); break; } }
          acted = true;
          await wait(CFG.delayMs);
        }
      }
      if (stopped) break;
      if (acted) { idle = 0; continue; }
      // nada nuevo que hacer en lo cargado: bajar la ventana para que TikTok cargue más filas
      var sc = scroller(root), before = seenCount(), top = sc.scrollTop;
      sc.scrollTo({ top: sc.scrollHeight, behavior: "auto" });
      await wait(1800);
      var after2 = rows(root); for (var k3 in after2) seen[k3] = 1;
      if (sc.scrollTop === top && seenCount() === before) idle++; else idle = 0;
      if (idle >= 4) { reason = "TikTok no carga más filas (" + seenCount() + " vistas en total)."; break; }
    }
    running = false; $go.disabled = false; $go.textContent = "Cerrar";
    $go.onclick = cleanup;
    var left = total - done.length - skipped.length;
    if (!reason && !stopped) reason = done.length >= CFG.maxPerRun ? "Tope por ejecución alcanzado." : (!CFG.dryRun && dayLeft() <= 0 ? "Límite diario alcanzado." : "");
    say("Fin: " + done.length + " " + (CFG.dryRun ? "marcadas" : "procesadas") + ", " + skipped.length + " amigos mutuos omitidos (intactos), " + left + " no vistas todavía. Filas cargadas por TikTok: " + seenCount() + ". " + (stopped ? $s.textContent.replace(/^Fin:.*$/, "") : reason));
    try { navigator.clipboard.writeText(done.map(function (k) { return "@" + k; }).join("\n")); } catch (e) {}
    console.log("[TikTok Smart Cleaner] procesadas:", done, "omitidas por amigos:", skipped, "filas vistas:", seenCount());
  }
  $go.onclick = function () { if (!running) run(); };
})();
`;

export function buildAutoclickerScript(cfg: AutoclickerConfig): string {
  const safe: AutoclickerConfig = {
    targets: [...new Set(cfg.targets)],
    delayMs: Math.max(MIN_DELAY_MS, Math.floor(cfg.delayMs)),
    maxPerRun: Math.max(1, Math.floor(cfg.maxPerRun)),
    maxPerDay: Math.max(1, Math.floor(cfg.maxPerDay)),
    dryRun: !!cfg.dryRun,
  };
  // JSON válido y seguro dentro de un <script>/consola (escapa < y separadores Unicode)
  const json = JSON.stringify(safe)
    .split("<").join("\\u003c")
    .split(String.fromCharCode(0x2028)).join("\\u2028")
    .split(String.fromCharCode(0x2029)).join("\\u2029");
  return BODY.replace("__CFG__", () => json).trim();
}

/** Mismo script como userscript (Tampermonkey/Violentmonkey). No arranca solo: exige pulsar Iniciar. */
export function buildUserscript(cfg: AutoclickerConfig): string {
  return `// ==UserScript==
// @name         TikTok Smart Cleaner (autoclicker)
// @namespace    tiktok-smart-cleaner
// @version      1.0
// @description  Deja de seguir SOLO las cuentas que seleccionaste. Requiere pulsar Iniciar.
// @match        https://www.tiktok.com/*
// @grant        none
// ==/UserScript==

${buildAutoclickerScript(cfg)}
`;
}
