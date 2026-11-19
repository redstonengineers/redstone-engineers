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
 *  - Ritmo fijo y lento, con tope por ejecución.
 *  - Si aparece una verificación/captcha/límite, se DETIENE. No intenta saltárselos.
 */
export interface AutoclickerConfig {
  /** Claves normalizadas de las cuentas a dejar de seguir. */
  targets: string[];
  /** Pausa entre acciones (ms). */
  delayMs: number;
  /** Máximo de cuentas por ejecución. */
  maxPerRun: number;
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
  var running = false, stopped = false, done = [], skipped = [], failed = 0, scanned = {};

  // ---------- UI ----------
  var box = document.createElement("div");
  box.setAttribute("style", "position:fixed;right:16px;bottom:16px;z-index:2147483647;width:300px;padding:14px;border-radius:12px;background:#0c0e13;color:#e4e4e7;border:1px solid #2a3140;font:13px system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)");
  box.innerHTML = '<div style="font-weight:600;color:#22d3ee;margin-bottom:6px">TikTok Smart Cleaner</div>' +
    '<div id="tsc-s" style="min-height:36px;color:#a1a1aa"></div>' +
    '<div style="display:flex;gap:8px;margin-top:10px"><button id="tsc-go" style="flex:1;padding:7px;border-radius:8px;border:0;background:#22d3ee;color:#07080b;font-weight:600;cursor:pointer"></button>' +
    '<button id="tsc-x" style="padding:7px 10px;border-radius:8px;border:1px solid #2a3140;background:#161a22;color:#e4e4e7;cursor:pointer">Detener</button></div>';
  document.body.appendChild(box);
  var $s = box.querySelector("#tsc-s"), $go = box.querySelector("#tsc-go"), $x = box.querySelector("#tsc-x");
  $go.textContent = CFG.dryRun ? "Iniciar simulación" : "Iniciar";
  var say = function (t) { $s.textContent = t; };
  say((CFG.dryRun ? "[SIMULACIÓN] " : "") + total + " cuentas en la lista. Abre tu lista de «Siguiendo» y pulsa Iniciar.");
  var onKey = function (e) { if (e.key === "Escape") stop("Detenido con Esc."); };
  document.addEventListener("keydown", onKey, true);
  function stop(msg) { stopped = true; if (msg) say(msg); }
  $x.onclick = function () { if (running) stop("Detenido por ti."); else { cleanup(); } };
  function cleanup() { document.removeEventListener("keydown", onKey, true); box.remove(); window.__tscLoaded = false; }

  // ---------- localizar filas ----------
  function handleOf(a) { var m = (a.getAttribute("href") || "").match(/\/@([^\/?#]+)/); return m ? norm(m[1]) : null; }
  function rows() {
    var out = {};
    document.querySelectorAll('a[href*="/@"]').forEach(function (a) {
      if (a.closest('[id*="inbox"],[data-e2e*="inbox"],[data-e2e*="notification"]')) return;   // panel de notificaciones: no es la lista Siguiendo
      var key = handleOf(a); if (!key || out[key]) return;
      var el = a;
      for (var i = 0; i < 7 && el.parentElement; i++) {
        el = el.parentElement;
        var keys = {}, n = 0;
        el.querySelectorAll('a[href*="/@"]').forEach(function (x) { var k = handleOf(x); if (k && !keys[k]) { keys[k] = 1; n++; } });
        if (n > 1) return;                       // contenedor demasiado grande: abortar para no confundir filas
        var btn = null;
        el.querySelectorAll("button").forEach(function (b) {
          var t = (b.textContent || "").trim();
          if (!btn && (FOLLOWING.test(t) || MUTUAL.test(t))) btn = b;
        });
        if (btn) { out[key] = { key: key, el: el, btn: btn, mutual: MUTUAL.test((btn.textContent || "").trim()) }; return; }
      }
    });
    return out;
  }
  function scroller(from) {
    var el = from;
    while (el && el !== document.body) { if (el.scrollHeight > el.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el; el = el.parentElement; }
    return document.scrollingElement || document.documentElement;
  }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var blocked = function () {
    var d = document.querySelectorAll('[role="dialog"],[class*="aptcha"],[id*="aptcha"]');
    for (var i = 0; i < d.length; i++) if (BLOCK.test(d[i].textContent || "")) return true;
    return false;
  };

  // ---------- bucle principal ----------
  async function run() {
    running = true; stopped = false; $go.disabled = true;
    var idle = 0, last = null;
    while (!stopped && done.length < CFG.maxPerRun && done.length < total) {
      if (blocked()) { stop("TikTok pide una verificación o ha limitado la acción. Detenido: resuélvelo tú y vuelve más tarde."); break; }
      var map = rows(), acted = false;
      for (var key in map) {
        if (stopped || done.length >= CFG.maxPerRun) break;
        if (!targets[key] || scanned[key]) continue;
        var r = map[key]; last = r.el;
        scanned[key] = true;
        if (r.mutual) { skipped.push(key); continue; }   // amigo mutuo (botón Amigos/Friends): nunca se toca
        r.el.scrollIntoView({ block: "center" });
        if (CFG.dryRun) {
          r.el.style.outline = "2px solid #22d3ee"; done.push(key); acted = true;
          say("[SIMULACIÓN] " + done.length + " marcadas · @" + key);
        } else {
          r.btn.click();
          await wait(1500);
          var after = (r.btn.isConnected ? (r.btn.textContent || "").trim() : "");
          if (!r.btn.isConnected || !FOLLOWING.test(after)) { done.push(key); failed = 0; say(done.length + "/" + Math.min(total, CFG.maxPerRun) + " · dejado de seguir @" + key); }
          else { failed++; say("@" + key + ": TikTok no confirmó el cambio (" + failed + "/3)."); if (failed >= 3) { stop("Demasiados fallos seguidos. Detenido por seguridad."); break; } }
          acted = true;
          await wait(CFG.delayMs);
        }
      }
      if (stopped) break;
      if (acted) { idle = 0; continue; }
      // nada nuevo visible: desplazar la lista para cargar más
      var sc = scroller(last || document.body), before = sc.scrollTop;
      sc.scrollBy(0, sc.clientHeight * 0.8);
      await wait(1200);
      if (sc.scrollTop === before) idle++; else idle = 0;
      if (idle >= 4) break;
    }
    running = false; $go.disabled = false; $go.textContent = "Cerrar";
    $go.onclick = cleanup;
    var left = total - done.length - skipped.length;
    say((stopped ? $s.textContent + " " : "") + "Fin: " + done.length + " " + (CFG.dryRun ? "marcadas" : "procesadas") + ", " + skipped.length + " omitidas por ser amigos mutuos (intactas), " + left + " no encontradas. Lista copiada al portapapeles.");
    try { navigator.clipboard.writeText(done.map(function (k) { return "@" + k; }).join("\n")); } catch (e) {}
    console.log("[TikTok Smart Cleaner] procesadas:", done);
  }
  $go.onclick = function () { if (!running) run(); };
})();
`;

export function buildAutoclickerScript(cfg: AutoclickerConfig): string {
  const safe: AutoclickerConfig = {
    targets: [...new Set(cfg.targets)],
    delayMs: Math.max(MIN_DELAY_MS, Math.floor(cfg.delayMs)),
    maxPerRun: Math.max(1, Math.floor(cfg.maxPerRun)),
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
