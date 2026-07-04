/* SPDX-License-Identifier: Apache-2.0 */
/*
 * App Icons Generator — client-side icon set builder.
 * Mirrors ios-icon-generator.sh: same names, same sizes, square output.
 * No external dependencies — the ZIP is written by hand (store method).
 */
'use strict';

// ---- Icon sizes (name -> pixel size). Kept in lockstep with ios-icon-generator.sh ----
const SIZES = [
  ['Icon-16', 16], ['Icon-16@2x', 32], ['Icon-32', 32], ['Icon-32@2x', 64],
  ['Icon-128', 128], ['Icon-128@2x', 256], ['Icon-256', 256], ['Icon-256@2x', 256],
  ['Icon-512', 512], ['Icon-512@2x', 1024],
  ['Icon-20', 20], ['Icon-20@2x', 40], ['Icon-20@3x', 60],
  ['Icon-29', 29], ['Icon-29@2x', 58], ['Icon-29@3x', 87],
  ['Icon-40', 40], ['Icon-40@2x', 80], ['Icon-40@3x', 120],
  ['Icon-60@2x', 120], ['Icon-60@3x', 180],
  ['Icon-76', 76], ['Icon-76@2x', 152], ['Icon-83.5@2x', 167],
  ['Icon-1024', 1024],
  ['Icon-24@2x', 48], ['Icon-27.5@2x', 55], ['Icon-86@2x', 172],
  ['Icon-98@2x', 196], ['Icon-108@2x', 216], ['Icon-44@2x', 88], ['Icon-50@2x', 100],
];

// ---- Canonical iOS AppIcon.appiconset mapping (drag-into-Xcode ready) ----
const APPICONSET = [
  ['iphone', '20x20', '2x', 'Icon-20@2x.png'],
  ['iphone', '20x20', '3x', 'Icon-20@3x.png'],
  ['iphone', '29x29', '2x', 'Icon-29@2x.png'],
  ['iphone', '29x29', '3x', 'Icon-29@3x.png'],
  ['iphone', '40x40', '2x', 'Icon-40@2x.png'],
  ['iphone', '40x40', '3x', 'Icon-40@3x.png'],
  ['iphone', '60x60', '2x', 'Icon-60@2x.png'],
  ['iphone', '60x60', '3x', 'Icon-60@3x.png'],
  ['ipad', '20x20', '1x', 'Icon-20.png'],
  ['ipad', '20x20', '2x', 'Icon-20@2x.png'],
  ['ipad', '29x29', '1x', 'Icon-29.png'],
  ['ipad', '29x29', '2x', 'Icon-29@2x.png'],
  ['ipad', '40x40', '1x', 'Icon-40.png'],
  ['ipad', '40x40', '2x', 'Icon-40@2x.png'],
  ['ipad', '76x76', '1x', 'Icon-76.png'],
  ['ipad', '76x76', '2x', 'Icon-76@2x.png'],
  ['ipad', '83.5x83.5', '2x', 'Icon-83.5@2x.png'],
  ['ios-marketing', '1024x1024', '1x', 'Icon-1024.png'],
];

function buildContentsJson() {
  const images = APPICONSET.map(([idiom, size, scale, filename]) => ({
    size, idiom, filename, scale,
  }));
  return JSON.stringify({ images, info: { version: 1, author: 'app-icons-generator' } }, null, 2);
}

// ---- DOM ----
const $ = (id) => document.getElementById(id);
const dropEl = $('drop');
const fileEl = $('file');
const statusEl = $('status');
const gridEl = $('grid');
const downloadBtn = $('download');
const resetBtn = $('reset');

let sourceBitmap = null;         // ImageBitmap of the loaded source
let generated = [];              // [{ name, size, blob }]
let objectUrls = [];             // preview URLs to revoke
let zipUrl = null;               // download URL to revoke
let genToken = 0;                // bumped on every load/reset; supersedes in-flight runs

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}

// ---- High-quality square downscale via progressive halving ----
function resizeSquare(bitmap, target) {
  let canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);

  // Halve repeatedly while we are more than 2x above the target — this keeps
  // small icons crisp instead of the mush a single big downscale produces.
  while (canvas.width > target * 2) {
    const nw = Math.max(target, Math.floor(canvas.width / 2));
    const nh = Math.max(target, Math.floor(canvas.height / 2));
    const next = document.createElement('canvas');
    next.width = nw; next.height = nh;
    const ctx = next.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, nw, nh);
    canvas = next;
  }

  const out = document.createElement('canvas');
  out.width = target; out.height = target;
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(canvas, 0, 0, target, target); // force square (parity with `sips -z`)
  return out;
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

// ---- Minimal ZIP writer (store / no compression; PNGs are already compressed) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function zipStore(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

  const chunks = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0, true);
    lh.setUint16(8, 0, true);          // method 0 = store
    lh.setUint16(10, dosTime, true);
    lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true);
    lh.setUint32(22, size, true);
    lh.setUint16(26, nameBytes.length, true);
    lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), nameBytes, f.data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, dosTime, true);
    cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint16(30, 0, true);
    cd.setUint16(32, 0, true);
    cd.setUint16(34, 0, true);
    cd.setUint16(36, 0, true);
    cd.setUint32(38, 0, true);
    cd.setUint32(42, offset, true);
    central.push({ header: new Uint8Array(cd.buffer), name: nameBytes });

    offset += 30 + nameBytes.length + size;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of central) {
    chunks.push(c.header, c.name);
    centralSize += c.header.length + c.name.length;
  }

  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(4, 0, true);
  eocd.setUint16(6, 0, true);
  eocd.setUint16(8, central.length, true);
  eocd.setUint16(10, central.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, centralStart, true);
  eocd.setUint16(20, 0, true);
  chunks.push(new Uint8Array(eocd.buffer));

  return new Blob(chunks, { type: 'application/zip' });
}

// ---- Rendering ----
function clearOutput() {
  gridEl.innerHTML = '';
  objectUrls.forEach(URL.revokeObjectURL);
  objectUrls = [];
  if (zipUrl) { URL.revokeObjectURL(zipUrl); zipUrl = null; }
  generated = [];
  downloadBtn.disabled = true;
}

function addPreviewCell(name, size, blob) {
  const url = URL.createObjectURL(blob);
  objectUrls.push(url);
  const cell = document.createElement('div');
  cell.className = 'cell';
  const shown = Math.min(size, 80);
  cell.innerHTML =
    `<div class="frame"><img src="${url}" width="${shown}" height="${shown}" alt="${name}"></div>` +
    `<div class="name">${name}.png</div><div class="px">${size}×${size}</div>`;
  gridEl.appendChild(cell);
}

async function loadFile(file) {
  if (!file) return;
  if (!/^image\//.test(file.type)) { setStatus('That is not an image file.', 'warn'); return; }
  const token = ++genToken;      // supersede any in-flight generation
  clearOutput();
  resetBtn.disabled = false;
  try {
    if (sourceBitmap && sourceBitmap.close) sourceBitmap.close();
    sourceBitmap = await createImageBitmap(file);
  } catch (e) {
    setStatus('Could not read that image.', 'warn');
    return;
  }
  if (token !== genToken) return; // a newer load started while decoding
  const w = sourceBitmap.width, h = sourceBitmap.height;
  if (w !== h) {
    setStatus(`Heads up: source is ${w}×${h} (not square) — icons will be squished. Using it anyway…`, 'warn');
  } else if (w < 1024) {
    setStatus(`Source is ${w}×${w}. Below 1024 the largest sizes will upscale. Generating…`, 'warn');
  } else {
    setStatus(`Source ${w}×${h} loaded. Generating 32 sizes…`);
  }
  await generateAll(token);
}

async function generateAll(token) {
  generated = [];
  gridEl.innerHTML = '';
  for (let i = 0; i < SIZES.length; i++) {
    if (token !== genToken) return; // superseded by a newer load/reset
    const [name, size] = SIZES[i];
    const canvas = resizeSquare(sourceBitmap, size);
    const blob = await canvasToPngBlob(canvas);
    generated.push({ name, size, blob });
    addPreviewCell(name, size, blob);
    if (i % 4 === 0) setStatus(`Generating ${i + 1}/${SIZES.length}…`);
  }
  if (token !== genToken) return;
  setStatus(`Done — ${generated.length} icons ready. Click “Download .zip”.`, 'ok');
  downloadBtn.disabled = false;
}

async function buildZip() {
  const files = [];
  const byName = {};
  for (const g of generated) {
    const data = new Uint8Array(await g.blob.arrayBuffer());
    byName[g.name + '.png'] = data;
    files.push({ name: `all-icons/${g.name}.png`, data });
  }
  // Xcode-ready appiconset: Contents.json + only the referenced files
  const enc = new TextEncoder();
  files.push({ name: 'AppIcon.appiconset/Contents.json', data: enc.encode(buildContentsJson()) });
  const seen = new Set();
  for (const [, , , filename] of APPICONSET) {
    if (seen.has(filename)) continue;
    seen.add(filename);
    const data = byName[filename];
    if (data) files.push({ name: `AppIcon.appiconset/${filename}`, data });
  }
  return zipStore(files);
}

async function onDownload() {
  downloadBtn.disabled = true;
  setStatus('Packaging .zip…');
  const blob = await buildZip();
  if (zipUrl) URL.revokeObjectURL(zipUrl);
  zipUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = zipUrl;
  a.download = 'AppIcons.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setStatus(`Downloaded AppIcons.zip (${generated.length} sizes + AppIcon.appiconset).`, 'ok');
  downloadBtn.disabled = false;
}

function resetAll() {
  genToken++;                     // cancel any in-flight generation
  clearOutput();
  if (sourceBitmap && sourceBitmap.close) sourceBitmap.close();
  sourceBitmap = null;
  fileEl.value = '';
  resetBtn.disabled = true;
  setStatus('Waiting for an image…');
}

// ---- Wiring ----
dropEl.addEventListener('click', () => fileEl.click());
dropEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileEl.click(); } });
fileEl.addEventListener('change', () => loadFile(fileEl.files[0]));

['dragenter', 'dragover'].forEach((ev) =>
  dropEl.addEventListener(ev, (e) => { e.preventDefault(); dropEl.classList.add('dragover'); }));
['dragleave', 'drop'].forEach((ev) =>
  dropEl.addEventListener(ev, (e) => { e.preventDefault(); dropEl.classList.remove('dragover'); }));
dropEl.addEventListener('drop', (e) => {
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) loadFile(f);
});

downloadBtn.addEventListener('click', onDownload);
resetBtn.addEventListener('click', resetAll);
