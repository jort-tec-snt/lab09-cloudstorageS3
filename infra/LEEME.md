# Infraestructura

## CORS del bucket

Permite que el navegador suba (PUT) y descargue (GET) directamente desde S3 con URLs prefirmadas.

```bash
aws s3api put-bucket-cors --bucket <BUCKET> --cors-configuration file://infra/cors.json
```

Verificar: `aws s3api get-bucket-cors --bucket <BUCKET>`

Nota: en producción, `AllowedOrigins` debe contener únicamente el dominio real de la aplicación (sin `localhost`).
