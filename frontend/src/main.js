import { uploadFile, validateFile } from './upload.js';
import { createGallery } from './gallery.js';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const dropzone = $('dropzone');
const fileInput = $('file-input');
const progress = $('progress');

function setStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

const gallery = createGallery({ root: $('gallery'), stateEl: $('gallery-state'), setStatus });

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
