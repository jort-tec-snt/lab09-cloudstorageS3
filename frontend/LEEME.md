# Frontend

HTML, CSS y JavaScript vanilla (módulos ES). Sin dependencias ni paso de build.

## Ejecutar

```bash
python3 -m http.server 8080 --directory frontend
```

Abrir http://localhost:8080. El backend debe estar en http://localhost:3000 (se cambia en `src/config.js`).
El bucket necesita la configuración CORS de `infra/cors.json`.
