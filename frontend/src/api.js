import { API_BASE } from './config.js';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* respuesta sin JSON */
  }
  if (!res.ok) {
    throw new Error((body && body.error) || `Error del servidor (${res.status}).`);
  }
  return body;
}

export function requestUploadUrl({ filename, contentType, sizeBytes }) {
  return request('/api/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType, sizeBytes }),
  });
}

export function listImages() {
  return request('/api/images');
}

export function deleteImage(key) {
  // Se codifica cada segmento, pero se conserva la '/' como separador.
  const encoded = key.split('/').map(encodeURIComponent).join('/');
  return request(`/api/images/${encoded}`, { method: 'DELETE' });
}
