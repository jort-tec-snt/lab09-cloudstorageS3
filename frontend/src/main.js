import { uploadFile, validateFile } from './upload.js';
import { createGallery } from './gallery.js';
import { READ_URL_TTL_S } from './config.js';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const dropzone = $('dropzone');
const fileInput = $('file-input');
const progress = $('progress');

function setStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

// Vigencia de los enlaces de lectura: al vencer se piden nuevos automáticamente.
const lease = $('lease');
let leaseEnd = 0;
let leaseTimer = null;
function startLease(items) {
  clearInterval(leaseTimer);
  if (!items.length) {
    lease.hidden = true;
    return;
  }
  leaseEnd = Date.now() + READ_URL_TTL_S * 1000;
  lease.hidden = false;
  const tick = () => {
    const left = Math.max(0, Math.round((leaseEnd - Date.now()) / 1000));
    $('lease-time').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    $('lease-fill').style.transform = `scaleX(${left / READ_URL_TTL_S})`;
    lease.dataset.low = String(left <= 60);
    if (left === 0) gallery.refresh({ quiet: true });
  };
  tick();
  leaseTimer = setInterval(tick, 1000);
}

const gallery = createGallery({
  root: $('gallery'),
  stateEl: $('gallery-state'),
  countEl: $('count'),
  setStatus,
  onLoaded: startLease,
});

let busy = false;

async function handleFiles(fileList) {
  const files = Array.from(fileList);
  if (!files.length || busy) return;
  busy = true;
  dropzone.setAttribute('aria-disabled', 'true');
  let ok = 0;

  for (const file of files) {
    const problem = validateFile(file);
    if (problem) {
      setStatus(problem, 'error');
      continue;
    }
    progress.hidden = false;
    progress.value = 0;
    setStatus(`Subiendo "${file.name}"…`, 'info');
    try {
      await uploadFile(file, (pct) => {
        progress.value = pct;
      });
      ok += 1;
      setStatus(`"${file.name}" se subió correctamente.`, 'success');
    } catch (err) {
      setStatus(err.message, 'error');
    }
  }

  progress.hidden = true;
  fileInput.value = '';
  busy = false;
  dropzone.removeAttribute('aria-disabled');
  if (ok > 0) await gallery.refresh({ quiet: true });
}

fileInput.addEventListener('change', () => handleFiles(fileInput.files));

dropzone.addEventListener('click', (e) => {
  if (e.target !== fileInput) fileInput.click();
});
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});
['dragenter', 'dragover'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('is-over');
  }),
);
['dragleave', 'drop'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-over');
  }),
);
dropzone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

$('refresh-btn').addEventListener('click', () => gallery.refresh());

gallery.refresh();
