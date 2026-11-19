# TikTok Smart Cleaner

Panel local para clasificar las cuentas que sigues en TikTok a partir del archivo de datos que descargas desde la propia app.
React + TypeScript + Tailwind CSS + Lucide.

```bash
npm install
npm run dev      # desarrollo
npm test         # tests del núcleo (parseo y clasificación)
npm run build    # producción (CSP sin conexiones salientes)
```

## Qué hace
- **Importa** JSON o TXT del export de TikTok (uno o varios archivos) y extrae seguidores y seguidos.
- **Clasifica** por igualdad exacta de usuario normalizado (sin `@`, minúsculas, sin caracteres invisibles); nunca por similitud:
  amigos (mutuos), no mutuos (sigo, no me siguen) y solo seguidores.
- **Lista blanca**: cuentas marcadas como amigas aunque no haya reciprocidad; nunca pueden seleccionarse para eliminar.
- **Panel**: estadísticas, % que se conserva, búsqueda, filtros, orden, selección individual y masiva, exportación CSV/TXT.
- **Privacidad**: todo en el navegador (localStorage), sin red, sin contraseñas; botón para borrar los datos.

## Estructura
- `src/core` — normalización, parseo, clasificación, almacenamiento, exportación (con tests).
- `src/automation` — interfaz `AutomationProvider` para una futura integración *autorizada*. Hoy solo existe el proveedor manual; no hay scraping ni acciones automáticas sobre TikTok.
- `src/components`, `src/hooks` — interfaz y estado.
