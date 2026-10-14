import { listImages, deleteImage } from './api.js';

/** "originales/1700000000000-9f2c4a1b7d3e5f60-mi_foto.png" -> "mi foto.png" */
export function readableName(key) {
  const last = key.split('/').pop() || key;
  return last.replace(/^\d{8,}-[0-9a-f]{16}-/, '').replace(/_/g, ' ');
}

function formatSize(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Visor modal con navegación por teclado (← → Esc). */
function openViewer(items, startIndex) {
  let index = startIndex;
  const dialog = document.createElement('dialog');
  dialog.className = 'viewer';

  const stage = document.createElement('div');
  stage.className = 'viewer-stage';
  const full = document.createElement('img');
  stage.append(full);

  const bar = document.createElement('div');
  bar.className = 'viewer-bar';
  const name = document.createElement('p');
  name.className = 'viewer-name';
  const actions = document.createElement('div');
  actions.className = 'viewer-actions';

  const mk = (label, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-secondary';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };
  const prev = mk('Anterior', () => show(index - 1));
  const next = mk('Siguiente', () => show(index + 1));
  const close = mk('Cerrar', () => dialog.close());
  actions.append(prev, next, close);
  bar.append(name, actions);
  dialog.append(stage, bar);

  function show(i) {
    index = (i + items.length) % items.length;
    const item = items[index];
    full.src = item.url;
    full.alt = readableName(item.key);
    name.textContent = `${readableName(item.key)} (${index + 1} de ${items.length})`;
    prev.disabled = next.disabled = items.length < 2;
  }

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  show(index);
  dialog.showModal();
}

/**
 * Controla la galería dentro de `root`. `setStatus(msg, type)` informa al usuario.
 * `onLoaded(items)` se llama tras cada carga correcta (reinicia la vigencia de los enlaces).
 */
export function createGallery({ root, stateEl, countEl, setStatus, onLoaded = () => {} }) {
  let items = [];

  function showState(text, type) {
    stateEl.textContent = text;
    stateEl.dataset.type = type;
    stateEl.hidden = !text;
  }

  function buildCard(item, index) {
    const name = readableName(item.key);
    const li = document.createElement('li');
    li.className = 'card';

    const frame = document.createElement('button');
    frame.type = 'button';
    frame.className = 'card-media';
    frame.setAttribute('aria-label', `Ver ${name} en tamaño completo`);

    const img = document.createElement('img');
    img.alt = name;
    img.loading = 'lazy';
    img.src = item.url;

    const retry = document.createElement('span');
    retry.className = 'btn btn-secondary';
    retry.textContent = 'No cargó. Pulsa para recargar';
    retry.hidden = true;

    let broken = false;
    img.addEventListener('error', () => {
      broken = true;
      img.hidden = true;
      retry.hidden = false;
    });
    frame.addEventListener('click', () => (broken ? refresh() : openViewer(items, index)));
    frame.append(img, retry);

    const bar = document.createElement('div');
    bar.className = 'card-bar';
    const text = document.createElement('div');
    text.className = 'card-text';
    const title = document.createElement('p');
    title.className = 'card-title';
    title.title = name;
    title.textContent = name;
    const meta = document.createElement('p');
    meta.className = 'card-meta';
    const date = item.lastModified ? new Date(item.lastModified) : null;
    meta.textContent =
      formatSize(item.size) +
      (date && !Number.isNaN(date.getTime()) ? `, ${date.toLocaleDateString('es-PE')}` : '');
    text.append(title, meta);

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

    bar.append(text, del);
    li.append(frame, bar);
    return li;
  }

  async function refresh({ quiet = false } = {}) {
    if (!quiet) showState('Cargando imágenes…', 'loading');
    root.setAttribute('aria-busy', 'true');
    try {
      items = await listImages();
      root.replaceChildren(...items.map(buildCard));
      if (countEl) countEl.textContent = items.length ? `${items.length}` : '';
      showState(items.length ? '' : 'Aún no hay imágenes. Suelta la primera arriba.', 'empty');
      onLoaded(items);
    } catch (err) {
      items = [];
      root.replaceChildren();
      if (countEl) countEl.textContent = '';
      showState(`No se pudo cargar la galería. ${err.message}`, 'error');
    } finally {
      root.removeAttribute('aria-busy');
    }
  }

  return { refresh };
}
