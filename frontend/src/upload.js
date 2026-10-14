import { ALLOWED_TYPES, MAX_SIZE_BYTES } from './config.js';
import { requestUploadUrl } from './api.js';

/** Devuelve un mensaje de error en español o null si el archivo es válido. */
export function validateFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `"${file.name}": tipo no permitido. Solo se aceptan JPEG, PNG o WebP.`;
  }
  if (file.size <= 0) return `"${file.name}": el archivo está vacío.`;
  if (file.size >= MAX_SIZE_BYTES) {
    return `"${file.name}": supera el límite de 5 MB.`;
  }
  return null;
}

/** PUT directo a S3 con progreso (fetch no expone progreso de subida). */
function putToS3(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error('S3 rechazó la subida. La URL pudo haber expirado; inténtalo de nuevo.'));
    xhr.onerror = () => reject(new Error('Falló la conexión con S3 durante la subida.'));
    xhr.send(file);
  });
}

/**
 * Valida, pide la URL prefirmada y sube el archivo directamente a S3.
 * Lanza Error con mensaje legible si algo falla.
 */
export async function uploadFile(file, onProgress = () => {}) {
  const problem = validateFile(file);
  if (problem) throw new Error(problem);

  const { uploadUrl } = await requestUploadUrl({
    filename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });
  await putToS3(uploadUrl, file, onProgress);
}
