# Estado del proyecto (2026-11-15) · léelo primero en una sesión nueva
- Nicho definitivo: depredadores y supervivencia en el reino animal, español, horizontal 16:9, ~15 min, imagen real con licencia, SIN diapositivas ni zoom. Registro: database/niches.json.
- Primer vídeo: «2026-11-15 · depredadores 1/» → voz.txt (8 puntos, ~1.466 palabras ≈ 10 min) y fuentes.md. Falta decidir si se alarga a 15 min.
- Voz: ElevenLabs (Duke, voice_id 5vRWedd4xV6g3a1SoelU), tomas ≤5.000 caracteres; decir el coste exacto en créditos ANTES de generar. Conectar la cuenta nueva (conector personalizado https://api.elevenlabs.io/v1/mcp).
- Imágenes: Pexels pausado (no da claves). Plan: Pixabay (PIXABAY_API_KEY en variables del entorno; la clave va en la query, no en cabecera). Comprobar licencia antes de publicar.
- Siguiente: piloto de 60 s con clips reales + subtítulos, sin tarjetas grandes, para aprobación ANTES de gastar créditos. Motor/kit: _kit/ (render reanudable, mezcla.py).
- Reglas: no pegar secretos en el chat; hechos con fuente; hipótesis marcadas; quitar lo no verificado.
- Descartado: países (borrador Bolivia en «2026-11-15 · bolivia 15min/»), Anticitera, Voynich, hielo.

## Estilo visual probado (2026-11-16)
- Referencia: canal Captain Workout (fondo azul claro, personaje gris oscuro anatómico, comparaciones DÍA 1/DÍA 30, resaltado rojo/verde). NO copiar su mascota (cabeza con "W"): usar personaje propio (gris grafito, visor amarillo).
- Imágenes: ElevenLabs conector «ElevenLabs-7e8f506f», modelo bytedance-seedream-5.5, sin texto en la imagen. Coste medido: ~98 créditos (sin referencia), ~127 (con referencia del personaje). Para mantener el personaje: creative_add_flow_asset_node + connect_from.
- Rótulos: se ponen aparte (HTML→PNG + ffmpeg overlay con fade), nunca dentro de la imagen (el modelo comete erratas).
- Magnific (plan gratuito): sin referencias de imagen; descartado para este estilo.
- Pruebas: pruebas-estilo/prueba_estilo_seedream_10s.mp4 y creatina_*.jpg
