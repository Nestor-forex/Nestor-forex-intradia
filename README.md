# Rama `datos` — lo que va viendo el vigía

Esta rama **no tiene código**. Guarda lo que el vigía por hora va anotando,
para que la rama `main` no quede sepultada bajo 24 commits diarios.

- `estado/vigia.json` — la foto de la última revisión. Sirve para saber qué
  señales ya estaban y cuáles son nuevas. Se sobrescribe cada hora.
- `historial/senales.jsonl` — **una línea por señal nueva**, con sus niveles
  tal como se le darían a Néstor. Este es el historial que permite después
  comprobar si la app acierta.
- `historial/corridas.jsonl` — una línea por revisión, haya señales o no.
  El campo `minuto` mide la puntualidad del reloj de GitHub Actions: si el
  cron pide "en punto" y aquí sale 40, llegó 40 minutos tarde.

Formato `.jsonl`: un objeto JSON por línea. Se lee de arriba abajo en orden
cronológico y se le puede añadir al final sin releer lo anterior.

Lo escribe `.github/workflows/vigia.yml` desde la rama `main`.
