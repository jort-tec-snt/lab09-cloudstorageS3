'use strict';

const { ALLOWED_TYPES, MAX_SIZE_BYTES, KEY_PREFIX } = require('./config');

const MAX_FILENAME_LENGTH = 100;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_')
    .slice(-MAX_FILENAME_LENGTH);
}

/** Valida el body de POST /api/upload-url y devuelve datos normalizados. */
function validateUploadRequest(body) {
  if (!body || typeof body !== 'object') throw new ValidationError('Body inválido');
  const { filename, contentType, sizeBytes } = body;

  if (typeof filename !== 'string' || filename.trim() === '') {
    throw new ValidationError('filename es obligatorio');
  }
  if (typeof contentType !== 'string' || !ALLOWED_TYPES.includes(contentType)) {
    throw new ValidationError('Tipo no permitido (solo jpeg, png, webp)');
  }
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    throw new ValidationError('sizeBytes debe ser un entero positivo');
  }
  if (sizeBytes >= MAX_SIZE_BYTES) {
    throw new ValidationError('El archivo supera 5 MB');
  }

  const safeName = sanitizeFilename(filename.trim());
  if (!safeName || safeName.includes('..')) throw new ValidationError('filename inválido');
  return { filename: safeName, contentType, sizeBytes };
}

/** Valida una key recibida del cliente (prefijo, sin '..' ni '//'). */
function validateKey(key) {
  if (typeof key !== 'string' || key.length === 0 || key.length > 1024) {
    throw new ValidationError('Key inválida');
  }
  if (
    !key.startsWith(KEY_PREFIX) ||
    key === KEY_PREFIX ||
    key.includes('..') ||
    key.includes('//') ||
    key.includes('\\') ||
    /[\x00-\x1f]/.test(key) ||
    key.split('/').some((segment) => segment === '.' || segment === '')
  ) {
    throw new ValidationError('Key inválida');
  }
  return key;
}

module.exports = { ValidationError, sanitizeFilename, validateUploadRequest, validateKey };
