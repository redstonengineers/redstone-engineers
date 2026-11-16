"""Audiencia orgánica de un nicho: ¿el público viene del NICHO o de las SUSCRIPCIONES?

Idea: si los vídeos de un canal consiguen muchas más vistas que suscriptores tiene, la gente llega por el tema (búsqueda, sugeridos,
inicio, feed); si consiguen una fracción de sus suscriptores, el público es la propia base del canal y eso NO demuestra interés por el nicho.

  VSR (views-to-subscribers ratio) = vistas del vídeo / suscriptores del canal
Se usa la MEDIANA de los últimos vídeos (no la media: un éxito aislado la falsea) y se compara DENTRO del mismo formato (los Shorts llegan
por un feed de deslizar y su VSR sale inflado frente al vídeo largo).

LÍMITES REALES (no se disimulan):
  · Los umbrales son HIPÓTESIS iniciales (config/nichos/criterios.json → audiencia_organica); se recalibran con datos propios.
  · Los suscriptores son del día de la consulta, no del día de publicación; canales antiguos arrastran suscriptores inactivos (VSR bajo)
    y los canales con suscriptores comprados distorsionan la señal. Con < min_subs el ratio no se calcula.
  · Esto es una señal PÚBLICA aproximada. La medida exacta (% de vistas que vienen de suscriptores) solo existe en la analítica de un canal PROPIO.
  · Entradas: las pone el agente a partir de NexLev u otra fuente. Aquí no se consulta ninguna red ni se inventa ningún dato.
"""
from __future__ import annotations
import json, statistics
from pathlib import Path

UMBRALES = {
    'min_subs': 1000, 'min_videos': 5, 'dias_min': 14, 'dias_max': 365, 'ratio_un_exito': 5.0,
    'largo': {'depende_de_suscriptores_bajo': 0.2, 'organico_desde': 1.0},
    'short': {'depende_de_suscriptores_bajo': 0.6, 'organico_desde': 3.0},
    'subs_canal_pequeno': 50000, 'min_organicos_pequenos': 3, 'tope_si_faltan_pequenos': 10,
    'confianza_muestra': [[8, 1.0], [4, 0.6], [1, 0.3]], 'puntos_max': 20,
}


def cargar_umbrales(ruta: str | Path | None = None) -> dict:
    """Lee config/nichos/criterios.json (sección audiencia_organica) si existe; si no, los valores por defecto."""
    u = json.loads(json.dumps(UMBRALES))
    try:
        from engines.core import paths
        f = Path(ruta) if ruta else paths.p('config', 'nichos', 'criterios.json')
        if f.exists():
            for k, v in (json.loads(f.read_text(encoding='utf-8')).get('audiencia_organica') or {}).items():
                if k in u:
                    if isinstance(u[k], dict) and isinstance(v, dict): u[k].update(v)
                    else: u[k] = v
    except Exception:
        pass
    return u


def vsr(vistas, suscriptores, min_subs=None) -> float | None:
    """Vistas / suscriptores. None si faltan datos o el canal es tan pequeño que el ratio no significa nada."""
    m = UMBRALES['min_subs'] if min_subs is None else min_subs
    if vistas is None or suscriptores is None or suscriptores < m or vistas < 0: return None
    return vistas / suscriptores


def clasificar_canal(suscriptores, videos, formato='largo', u=None) -> dict:
    """videos: [{'vistas': int, 'dias': int}, …] (los últimos del canal). Devuelve la lectura de UN canal."""
    u = u or UMBRALES
    if formato not in ('largo', 'short'): raise ValueError("formato debe ser 'largo' o 'short'")
    base = {'formato': formato, 'suscriptores': suscriptores}
    if suscriptores is None or suscriptores < u['min_subs']:
        return {**base, 'clase': 'sin_dato', 'motivo': f"suscriptores ausentes o < {u['min_subs']} (el ratio no es fiable)"}
    ok = [v for v in videos if v.get('vistas') is not None and u['dias_min'] <= v.get('dias', -1) <= u['dias_max']]
    if len(ok) < u['min_videos']:
        return {**base, 'clase': 'sin_dato', 'motivo': f"solo {len(ok)} vídeos con {u['dias_min']}–{u['dias_max']} días (mínimo {u['min_videos']})"}
    rs = [v['vistas'] / suscriptores for v in ok]
    mediana, media = statistics.median(rs), statistics.fmean(rs)
    um = u[formato]
    clase = 'organico' if mediana >= um['organico_desde'] else 'depende_de_suscriptores' if mediana < um['depende_de_suscriptores_bajo'] else 'mixto'
    un_exito = mediana > 0 and media / mediana > u['ratio_un_exito']
    return {**base, 'clase': clase, 'vsr_mediano': round(mediana, 3), 'vsr_medio': round(media, 3), 'n_videos': len(ok),
            'un_exito_aislado': bool(un_exito), 'nota': 'la media está disparada por 1–2 vídeos: se usa la mediana' if un_exito else ''}


def _confianza(n, u):
    for minimo, f in u['confianza_muestra']:
        if n >= minimo: return f
    return 0.0


def puntuar_nicho(canales, formato='largo', u=None) -> dict:
    """canales: [{'canal': str, 'suscriptores': int, 'videos': [{'vistas','dias'},…]}, …] → puntos 0–20 y por qué."""
    u = u or UMBRALES
    lect = []
    for c in canales:
        r = clasificar_canal(c.get('suscriptores'), c.get('videos', []), formato, u); r['canal'] = c.get('canal', '?'); lect.append(r)
    validos = [r for r in lect if r['clase'] != 'sin_dato']
    n = len(validos)
    if n == 0:
        return {'puntos': 0, 'estado': 'sin_dato', 'motivo': 'ningún canal con datos suficientes', 'canales': lect}
    org = [r for r in validos if r['clase'] == 'organico']
    org_peq = [r for r in org if r['suscriptores'] < u['subs_canal_pequeno']]
    prop = len(org) / n
    f = _confianza(n, u)
    puntos = u['puntos_max'] * prop * f
    tope = None
    if len(org_peq) < u['min_organicos_pequenos']:
        tope = u['tope_si_faltan_pequenos']; puntos = min(puntos, tope)
    return {'puntos': round(puntos, 1), 'estado': 'ok', 'n_canales_validos': n, 'n_organicos': len(org), 'n_organicos_pequenos': len(org_peq),
            'proporcion_organicos': round(prop, 3), 'factor_confianza': f, 'tope_aplicado': tope,
            'lectura': ('el público viene del tema' if prop >= 0.6 and not tope else
                        'mixto: parte del público es la base de suscriptores' if prop >= 0.25 else 'domina la base de suscriptores: poca prueba de interés por el nicho'),
            'canales': lect}


def lectura_video(vistas, suscriptores, dias, formato='largo', u=None) -> dict:
    """Para UN vídeo viral visto durante la búsqueda de subnichos: ¿lo mueve el tema o el canal?"""
    u = u or UMBRALES
    r = vsr(vistas, suscriptores, u['min_subs'])
    if r is None: return {'señal': 'sin_dato', 'motivo': 'suscriptores ausentes o muy pocos'}
    if dias is not None and dias < u['dias_min']: return {'señal': 'demasiado_reciente', 'vsr': round(r, 3)}
    if r >= u[formato]['organico_desde']:
        return {'señal': 'el_tema_atrae' if suscriptores < u['subs_canal_pequeno'] else 'tema_atrae_pero_canal_grande', 'vsr': round(r, 3)}
    return {'señal': 'probable_base_de_suscriptores', 'vsr': round(r, 3)}
