import { listImages, deleteImage } from './api.js';

/** "originales/1700000000000-mi_foto.png" -> "mi foto.png" */
export function readableName(key) {
  const last = key.split('/').pop() || key;
  return last.replace(/^\d{8,}-/, '').replace(/_/g, ' ');
}

function formatSize(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Controla la galería dentro de `root`. `setStatus(msg, type)` informa al usuario.
 */
export function createGallery({ root, stateEl, setStatus }) {
  function showState(text, type) {
    stateEl.textContent = text;
    stateEl.dataset.type = type;
    stateEl.hidden = !text;
  }

  function buildCard(item) {
    const name = readableName(item.key);
    const li = document.createElement('li');
    li.className = 'card';

    const frame = document.createElement('div');
    frame.className = 'card-media';

    const img = document.createElement('img');
    img.alt = name;
    img.loading = 'lazy';
    img.src = item.url;

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-secondary';
    retry.textContent = 'Recargar';
    retry.hidden = true;
    retry.addEventListener('click', () => refresh());

    img.addEventListener('error', () => {
      img.hidden = true;
      retry.hidden = false;
    });
    frame.append(img, retry);

    const body = document.createElement('div');
    body.className = 'card-body';
    const title = document.createElement('p');
    title.className = 'card-title';
    title.textContent = name;
    const meta = document.createElement('p');
    meta.className = 'card-meta';
    const date = item.lastModified ? new Date(item.lastModified) : null;
    meta.textContent =
      formatSize(item.size) +
      (date && !Number.isNaN(date.getTime()) ? ` · ${date.toLocaleDateString('es-PE')}` : '');

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn btn-danger';
    del.textContent = 'Eliminar';
    del.setAttribute('aria-label', `Eliminar ${name}`);
    del.addEventListener('click', async () => {
      if (!window.confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
      del.disabled = true;
      try {
        await deleteImage(item.key);
        setStatus(`"${name}" se eliminó correctamente.`, 'success');
        await refresh({ quiet: true });
      } catch (err) {
        del.disabled = false;
        setStatus(err.message, 'error');
      }
    });

    body.append(title, meta, del);
    li.append(frame, body);
    return li;
  }

  async function refresh({ quiet = false } = {}) {
    if (!quiet) showState('Cargando imágenes…', 'loading');
    root.setAttribute('aria-busy', 'true');
    try {
      const items = await listImages();
      root.replaceChildren(...items.map(buildCard));
      showState(items.length ? '' : 'Aún no hay imágenes. Sube la primera.', 'empty');
    } catch (err) {
      root.replaceChildren();
      showState(`No se pudo cargar la galería. ${err.message}`, 'error');
    } finally {
      root.removeAttribute('aria-busy');
    }
  }

  return { refresh };
}
