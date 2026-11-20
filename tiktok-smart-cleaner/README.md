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

## Autoclicker
La web no controla TikTok: genera un script con **solo** las cuentas seleccionadas (no mutuas, fuera de la lista blanca) que ejecutas tú en tu propia sesión de tiktok.com (consola o userscript).
- El script ignora cualquier botón «Amigos/Friends», así que los mutuos nunca se tocan, y cuenta cuántos omitió.
- No arranca solo (botón Iniciar), se detiene con Esc/Detener, tiene pausa mínima de 2 s y tope por ejecución.
- Si aparece verificación/captcha/límite, se detiene; no intenta evitarlo.
- Empieza siempre con el modo simulación. Automatizar acciones puede incumplir las condiciones de TikTok.
- Los selectores se han probado contra una página simulada, no contra TikTok real, cuyo HTML puede cambiar.

## Estructura
- `src/core` — normalización, parseo, clasificación, almacenamiento, exportación (con tests).
- `src/automation` — interfaz `AutomationProvider` y generador del **autoclicker**.
- `src/components`, `src/hooks` — interfaz y estado.
