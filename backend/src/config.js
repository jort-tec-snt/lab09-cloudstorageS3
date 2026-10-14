'use strict';

const UPLOAD_EXPIRES_SECONDS = 300; // regla 7: subida
const VIEW_EXPIRES_SECONDS = 900; // regla 7: visualización
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const KEY_PREFIX = 'originales/';

/**
 * Lee y valida la configuración desde un objeto de entorno.
 * Falla rápido (lanza Error) si falta algo. No lee credenciales: las toma el SDK.
 */
function loadConfig(env = process.env) {
  const missing = ['AWS_REGION', 'S3_BUCKET', 'CORS_ORIGINS'].filter(
    (name) => !env[name] || !String(env[name]).trim()
  );
  if (missing.length) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
  }

  const port = env.PORT === undefined || env.PORT === '' ? 3000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT inválido');
  }

  const corsOrigins = String(env.CORS_ORIGINS)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
    throw new Error('CORS_ORIGINS debe ser una lista de orígenes explícitos (sin "*")');
  }

  return {
    region: env.AWS_REGION.trim(),
    bucket: env.S3_BUCKET.trim(),
    port,
    corsOrigins,
    uploadExpiresSeconds: UPLOAD_EXPIRES_SECONDS,
    viewExpiresSeconds: VIEW_EXPIRES_SECONDS,
    maxSizeBytes: MAX_SIZE_BYTES,
    allowedTypes: ALLOWED_TYPES,
    keyPrefix: KEY_PREFIX,
    uploadRateLimit: { windowMs: 60 * 1000, limit: 20 },
  };
}

module.exports = {
  loadConfig,
  UPLOAD_EXPIRES_SECONDS,
  VIEW_EXPIRES_SECONDS,
  MAX_SIZE_BYTES,
  ALLOWED_TYPES,
  KEY_PREFIX,
};
