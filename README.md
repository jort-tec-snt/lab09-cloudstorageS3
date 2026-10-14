# Galería de imágenes con Amazon S3 privado

Galería de imágenes que guarda los archivos en un **bucket privado de Amazon S3** y los sube y muestra mediante **URLs prefirmadas**. El navegador nunca recibe credenciales de AWS: el backend firma enlaces temporales y el navegador habla directo con S3.

Proyecto del curso Desarrollo de Soluciones en la Nube (TECSUP), laboratorio 9: Cloud Storage con S3.

## Cómo funciona

```
Navegador ── POST /api/upload-url ──▶ Backend (Express + AWS SDK v3)
    ▲                                      │ devuelve URL prefirmada (PUT, 300 s)
    │                                      ▼
    └──────── PUT directo con la URL ──▶ Amazon S3 (bucket privado)

Navegador ── GET /api/images ────────▶ Backend ── lista y firma lecturas (GET, 900 s)
Navegador ── DELETE /api/images/<key> ▶ Backend ── elimina el objeto
```

- La subida va **directo a S3**, sin pasar por el backend.
- El backend genera la clave del objeto (`originales/<marca-de-tiempo>-<hex>-<nombre>`); el cliente no la elige.
- Las URLs de subida duran 300 s y las de lectura 900 s. La galería renueva los enlaces de lectura sola cuando vencen.

## Seguridad

- Bucket **privado** con Block Public Access activado y cifrado en reposo SSE-S3 (AES-256).
- Política de bucket que **obliga HTTPS** (`aws:SecureTransport`).
- Usuario IAM de la aplicación con **mínimo privilegio**: solo `GetObject`, `PutObject`, `DeleteObject` y `ListBucket` sobre este bucket.
- Sin credenciales en el frontend ni en Git. Las claves viven solo en el archivo `.env` del backend, que está ignorado por Git.
- Validación de tipo (`image/jpeg`, `image/png`, `image/webp`) y tamaño (menor que 5 MB) en el frontend **y** en el backend. El tamaño y el tipo quedan firmados en la URL.
- Claves validadas: siempre bajo `originales/`, sin `..`, `//` ni segmentos `.`.
- Límite de 20 solicitudes por minuto en `/api/upload-url`.
- CORS del bucket limitado a los orígenes locales.
- Versionado activado y regla de ciclo de vida para versiones y clases de almacenamiento más baratas.

## Requisitos

- Node.js 18 o superior y [pnpm](https://pnpm.io/)
- Un bucket de S3 y un usuario IAM con la política de mínimo privilegio descrita arriba
- Python 3 (solo para servir el frontend en local)

## Puesta en marcha

1. **Bucket y permisos.** Crea el bucket privado y aplica la configuración de `infra/`:

   ```bash
   aws s3api put-bucket-cors --bucket <BUCKET> --cors-configuration file://infra/cors.json
   ```

2. **Backend.**

   ```bash
   cd backend
   cp .env.example .env     # completa S3_BUCKET y las credenciales del usuario IAM
   pnpm install
   pnpm test
   pnpm start               # http://localhost:3000
   ```

3. **Frontend**, en otra terminal:

   ```bash
   python3 -m http.server 8080 --directory frontend
   ```

   Abre **http://localhost:8080** (no `127.0.0.1` ni `0.0.0.0`, que no coinciden con el CORS del bucket).

## API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/upload-url` | Valida `filename`, `contentType` y `sizeBytes` y devuelve una URL prefirmada de subida |
| `GET` | `/api/images` | Lista las imágenes con URLs prefirmadas de lectura |
| `DELETE` | `/api/images/<key>` | Elimina una imagen (la clave debe estar bajo `originales/`) |

## Estructura

```
backend/    API Express con AWS SDK v3 y pruebas (node --test)
frontend/   HTML, CSS y JavaScript sin dependencias ni build
infra/      Configuración de S3: CORS y ciclo de vida
```

## Mejoras previstas

- IAM Role en EC2 para eliminar las credenciales del `.env`
- Validación por magic bytes y antivirus sobre los archivos subidos
- WAF y rate limiting por usuario
- Autenticación con Cognito, miniaturas con Lambda y frontend en S3 con CloudFront (HTTPS)
