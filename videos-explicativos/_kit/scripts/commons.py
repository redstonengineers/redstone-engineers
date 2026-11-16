"""commons.py · busca en Wikimedia Commons archivos con licencia libre
  python commons.py "archerfish spitting" [n=12]   → título | tipo | duración | licencia | autor
"""
import json, re, subprocess, sys, time, urllib.parse
UA = 'videos-explicativos/1.0'
def api(**p):
    p['format'] = 'json'
    for espera in (0, 20, 45, 90):
        time.sleep(espera)
        r = _get(p)
        try: return json.loads(r.stdout)
        except ValueError: print('  (límite de peticiones, reintento…)', file=sys.stderr)
    sys.exit('Wikimedia sigue limitando; prueba más tarde')
def _get(p):
    return subprocess.run(['curl', '-sS', '-m', '40', '-A', UA, '-G', 'https://commons.wikimedia.org/w/api.php'] +
                       sum([['--data-urlencode', f'{k}={v}'] for k, v in p.items()], []), capture_output=True, text=True)
    return json.loads(r.stdout)
def buscar(q, n=12):
    d = api(action='query', generator='search', gsrsearch=q + ' filetype:video|bitmap', gsrnamespace=6, gsrlimit=n,
            prop='imageinfo', iiprop='url|size|mime|mediatype|extmetadata|dimensions', iiurlwidth=1280)
    out = []
    for pg in (d.get('query', {}).get('pages', {})).values():
        ii = pg['imageinfo'][0]; m = ii.get('extmetadata', {})
        lic = m.get('LicenseShortName', {}).get('value', '?')
        aut = re.sub('<[^>]+>', '', m.get('Artist', {}).get('value', '?'))[:40]
        out.append((pg['title'], ii['mime'], round(ii.get('duration', 0)), ii['width'], ii['height'], lic, aut, ii['url'], pg.get('index', 0)))
    return sorted(out, key=lambda x: x[-1])
if __name__ == '__main__':
    for t, mi, du, w, h, lic, aut, url, _ in buscar(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 12):
        print(f'{t[5:70]} | {mi.split("/")[1]} {w}x{h} {du}s | {lic} | {aut}')
