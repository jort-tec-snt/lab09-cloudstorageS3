// URL base del backend. Es la única constante de entorno del frontend.
// Servir con: python3 -m http.server 8080 --directory frontend
export const API_BASE = 'http://localhost:3000';

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_SIZE_BYTES = 5 * 1024 * 1024;
// Debe coincidir con la vigencia de las URLs de lectura del backend (900 s).
export const READ_URL_TTL_S = 900;
