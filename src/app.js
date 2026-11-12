'use strict';

/* =========================================================================
 * Doodle – simple drawing app
 *
 * Layers in the drawing sheet:
 *   #paint  – what the person draws (the eraser only affects this layer)
 *   #lines  – black lines of the colouring page, always on top, not erasable
 *
 * Every stroke is kept as a list of points, so undo is unlimited:
 * we simply redraw everything without the last stroke.
 *
 * User-visible text comes from i18n.js.
 * ========================================================================= */

const COLORS = [
  { key: 'black',  hex: '#1a1a1a' },
  { key: 'grey',   hex: '#9e9e9e' },
  { key: 'brown',  hex: '#8d5524' },
  { key: 'red',    hex: '#e53935' },
  { key: 'orange', hex: '#fb8c00' },
  { key: 'yellow', hex: '#fdd835' },
  { key: 'green',  hex: '#43a047' },
  { key: 'blue',   hex: '#1e88e5' },
  { key: 'purple', hex: '#8e24aa' },
  { key: 'pink',   hex: '#f48fb1' },
];

const PAGES = ['teddy', 'guitar', 'shoe'];

const BRUSH_SIZE = 12;        // CSS pixels at medium pressure
const ERASER_SIZE = 56;       // eraser diameter
const PAGE_MARGIN = 0.05;     // white space around a colouring page
const PALM_SIZE = 40;         // touches larger than this are a palm
const PEN_GRACE_MS = 1000;    // ignore fingers while the pen is nearby
const SESSION_SAVE_DELAY = 1200;
const SETTINGS_HOLD_MS = 3000;

const t = (key, params) => i18n.t(key, params);

/* ---------------------------------------------------------------------------
 * Platform: real Windows app (Tauri) or a preview in a plain browser.
 * ------------------------------------------------------------------------- */
const T = window.__TAURI__;

const api = T ? {
  invoke: (cmd, args, opts) => T.core.invoke(cmd, args, opts),
  async getSettings() { return this.invoke('get_settings'); },
  async setSettings(s) { return this.invoke('set_settings', { settings: s }); },
  async saveDrawing(bytes, fileName) {
    return this.invoke('save_drawing', bytes, { headers: { 'x-file-name': fileName } });
  },
  async saveSessionImage(bytes) { return this.invoke('save_session_image', bytes); },
  async saveSessionMeta(meta) { return this.invoke('save_session_meta', { meta }); },
  async loadSessionMeta() { return this.invoke('load_session_meta'); },
  async loadSessionImage() { return new Uint8Array(await this.invoke('load_session_image')); },
  async clearSessionImage() { return this.invoke('clear_session_image'); },
  async openFolder(path) { return this.invoke('open_folder', { path }); },
} : browserApi();

/** Stand-in for testing in a regular browser (e.g. on Linux). */
function browserApi() {
  const ls = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn(e); } },
  };
  const toB64 = (bytes) => { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); };
  const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const systemLanguage = () => ((navigator.language || 'en').toLowerCase().startsWith('nl') ? 'nl' : 'en');
  return {
    async getSettings() {
      const s = { saveDir: null, fingerDrawing: true, leftHanded: false, language: 'auto', ...ls.get('settings', {}) };
      const system = systemLanguage();
      return {
        ...s,
        systemLanguage: system,
        resolvedLanguage: s.language === 'auto' ? system : s.language,
        effectiveSaveDir: s.saveDir || i18n.t('browser.saveDir'),
      };
    },
    async setSettings(s) { ls.set('settings', s); },
    async saveDrawing(bytes, fileName) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
      a.download = fileName;
      a.click();
      return fileName;
    },
    async saveSessionImage(bytes) { ls.set('sessionImage', toB64(bytes)); },
    async saveSessionMeta(meta) { ls.set('sessionMeta', meta); },
    async loadSessionMeta() { return ls.get('sessionMeta', {}); },
    async loadSessionImage() { const b = ls.get('sessionImage', null); return b ? fromB64(b) : new Uint8Array(); },
    async clearSessionImage() { localStorage.removeItem('sessionImage'); },
    async openFolder() { alert(i18n.t('browser.folderOnlyInApp')); },
  };
}

/* ---------------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------------- */
const $ = (sel) => document.querySelector(sel);
const app = $('#app');
const stage = $('#stage');
const paint = $('#paint');
const lines = $('#lines');
const pctx = paint.getContext('2d');
const lctx = lines.getContext('2d');

const state = {
  color: COLORS[0].hex,
  tool: 'brush',          // 'brush' or 'eraser'
  page: null,             // colouring page id or null
  strokes: [],            // finished strokes (for undo)
  base: null,             // image from the previous session (cannot be undone)
  fileName: null,         // name this drawing is saved under
  settings: {
    saveDir: null,
    fingerDrawing: true,
    leftHanded: false,
    language: 'auto',
    systemLanguage: 'en',
    resolvedLanguage: 'en',
    effectiveSaveDir: '',
  },
  width: 0,               // drawing sheet in CSS pixels
  height: 0,
  dpr: 1,
};

let active = null;        // stroke being drawn right now
let lastPenTime = -Infinity;
let busy = false;         // saving / starting a new sheet
let closing = false;
let sessionTimer = null;
let lastError = null;     // { where, error } – shown to the caregiver
const pageImages = {};

/* ---------------------------------------------------------------------------
 * Build the buttons
 * ------------------------------------------------------------------------- */
function buildUi() {
  const colorsNav = $('#colors');
  for (const c of COLORS) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = c.hex;
    b.dataset.color = c.hex;
    b.dataset.i18nAria = `color.${c.key}`;
    onTap(b, () => { state.color = c.hex; state.tool = 'brush'; refreshSelection(); });
    colorsNav.appendChild(b);
  }

  const pagesNav = $('#pages');
  for (const id of PAGES) {
    const b = document.createElement('button');
    b.className = 'tool page';
    b.dataset.page = id;
    b.dataset.i18nAria = `page.${id}`;
    const img = document.createElement('img');
    img.src = `pages/${id}.svg`;
    img.alt = '';
    b.appendChild(img);
    onTap(b, () => newDrawing(id));
    pagesNav.appendChild(b);
  }

  onTap($('#btn-eraser'), () => { state.tool = 'eraser'; refreshSelection(); });
  onTap($('#btn-undo'), undo);
  onTap($('#btn-clear'), () => newDrawing(null));
  onTap($('#btn-stop'), shutdown);
  setupSettingsButton();
}

/** React to a tap with pen, finger or mouse (without delay). */
function onTap(el, fn) {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); });
  el.addEventListener('click', (e) => { e.preventDefault(); if (!busy && !closing) fn(); });
}

function refreshSelection() {
  document.querySelectorAll('.swatch').forEach((b) => {
    b.classList.toggle('selected', state.tool === 'brush' && b.dataset.color === state.color);
  });
  $('#btn-eraser').classList.toggle('selected', state.tool === 'eraser');
  document.querySelectorAll('.page').forEach((b) => {
    b.classList.toggle('selected', b.dataset.page === state.page);
  });
  $('#btn-undo').disabled = state.strokes.length === 0;
}

function applySettings() {
  i18n.setLanguage(state.settings.resolvedLanguage);
  app.classList.toggle('left-handed', !!state.settings.leftHanded);
  // The layout may change → the drawing sheet may change size.
  requestAnimationFrame(resize);
}

/* ---------------------------------------------------------------------------
 * Drawing sheet: size and redrawing
 * ------------------------------------------------------------------------- */
function resize() {
  const rect = stage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (w === state.width && h === state.height && dpr === state.dpr) return;
  state.width = w;
  state.height = h;
  state.dpr = dpr;
  for (const c of [paint, lines]) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }
  redrawPaint();
  renderLines();
}

function setupContext(ctx) {
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function redrawPaint() {
  setupContext(pctx);
  pctx.globalCompositeOperation = 'source-over';
  pctx.clearRect(0, 0, state.width, state.height);
  if (state.base) pctx.drawImage(state.base, 0, 0, state.width, state.height);
  for (const s of state.strokes) drawStroke(s);
  pctx.globalCompositeOperation = 'source-over';
}

function pageRect(img) {
  const mw = state.width * PAGE_MARGIN;
  const mh = state.height * PAGE_MARGIN;
  const aw = state.width - 2 * mw;
  const ah = state.height - 2 * mh;
  const iw = img.naturalWidth || 1000;
  const ih = img.naturalHeight || 1000;
  const scale = Math.min(aw / iw, ah / ih);
  const w = iw * scale;
  const h = ih * scale;
  return { x: (state.width - w) / 2, y: (state.height - h) / 2, w, h };
}

function loadPageImage(id) {
  if (!pageImages[id]) {
    pageImages[id] = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `pages/${id}.svg`;
    });
  }
  return pageImages[id];
}

async function renderLines() {
  const page = state.page;
  const img = page ? await loadPageImage(page).catch(() => null) : null;
  if (page !== state.page) return; // another page was chosen meanwhile
  setupContext(lctx);
  lctx.clearRect(0, 0, state.width, state.height);
  if (img) {
    const r = pageRect(img);
    lctx.drawImage(img, r.x, r.y, r.w, r.h);
  }
}

/* ---------------------------------------------------------------------------
 * Drawing strokes
 * ------------------------------------------------------------------------- */
function strokeWidth(stroke, pressure) {
  if (stroke.erase) return ERASER_SIZE;
  const p = Math.min(1, Math.max(0.1, pressure));
  return BRUSH_SIZE * (0.6 + 0.8 * p);
}

function prepareStroke(stroke) {
  pctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
  pctx.strokeStyle = stroke.color;
  pctx.fillStyle = stroke.color;
}

function drawDot(stroke, pt) {
  prepareStroke(stroke);
  pctx.beginPath();
  pctx.arc(pt.x, pt.y, strokeWidth(stroke, pt.p) / 2, 0, Math.PI * 2);
  pctx.fill();
}

function drawSegment(stroke, a, b) {
  prepareStroke(stroke);
  pctx.lineWidth = strokeWidth(stroke, b.p);
  pctx.beginPath();
  pctx.moveTo(a.x, a.y);
  pctx.lineTo(b.x, b.y);
  pctx.stroke();
}

function drawStroke(stroke) {
  const pts = stroke.pts;
  drawDot(stroke, pts[0]);
  for (let i = 1; i < pts.length; i++) drawSegment(stroke, pts[i - 1], pts[i]);
}

/* ---------------------------------------------------------------------------
 * Pen, finger and mouse
 * ------------------------------------------------------------------------- */
let stageRect = null;

function pointOf(e) {
  return {
    x: e.clientX - stageRect.left,
    y: e.clientY - stageRect.top,
    p: e.pointerType === 'mouse' ? 0.5 : (e.pressure || 0.5),
  };
}

/** Back end of the Surface Pen, or its eraser button. */
function isPenEraser(e) {
  return e.pointerType === 'pen' && ((e.buttons & 32) !== 0 || e.button === 5);
}

function isPalm(e) {
  return Math.max(e.width || 0, e.height || 0) > PALM_SIZE;
}

function touchAllowed(e) {
  if (!state.settings.fingerDrawing) return false;
  if (performance.now() - lastPenTime < PEN_GRACE_MS) return false;
  return !isPalm(e);
}

function cancelActive() {
  if (!active) return;
  active = null;
  redrawPaint();
}

stage.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (busy || closing) return;
  if (e.pointerType === 'pen') lastPenTime = performance.now();

  if (active) {
    // The pen always wins over a finger or palm.
    if (e.pointerType === 'pen' && active.pointerType === 'touch') cancelActive();
    else return;
  }
  if (e.pointerType === 'touch' && !touchAllowed(e)) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  stageRect = stage.getBoundingClientRect();
  const stroke = {
    erase: state.tool === 'eraser' || isPenEraser(e),
    color: state.color,
    pts: [pointOf(e)],
  };
  active = { pointerId: e.pointerId, pointerType: e.pointerType, stroke };
  try { stage.setPointerCapture(e.pointerId); } catch { /* not critical */ }
  drawDot(stroke, stroke.pts[0]);
});

stage.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'pen') lastPenTime = performance.now();
  if (!active || e.pointerId !== active.pointerId) return;
  if (active.pointerType === 'touch' && isPalm(e)) { cancelActive(); return; }

  const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
  const list = events.length ? events : [e];
  const { stroke } = active;
  for (const ev of list) {
    const pt = pointOf(ev);
    const prev = stroke.pts[stroke.pts.length - 1];
    if (Math.abs(pt.x - prev.x) < 0.5 && Math.abs(pt.y - prev.y) < 0.5) continue;
    stroke.pts.push(pt);
    drawSegment(stroke, prev, pt);
  }
});

function finishStroke(e) {
  if (!active || e.pointerId !== active.pointerId) return;
  if (e.pointerType === 'pen') lastPenTime = performance.now();
  state.strokes.push(active.stroke);
  active = null;
  pctx.globalCompositeOperation = 'source-over';
  refreshSelection();
  scheduleSessionSave();
}

stage.addEventListener('pointerup', finishStroke);
stage.addEventListener('pointercancel', finishStroke);
stage.addEventListener('lostpointercapture', finishStroke);

/* ---------------------------------------------------------------------------
 * Undo, new sheet, saving
 * ------------------------------------------------------------------------- */
function undo() {
  if (active || state.strokes.length === 0) return;
  state.strokes.pop();
  redrawPaint();
  refreshSelection();
  scheduleSessionSave();
}

function hasContent() {
  return state.strokes.length > 0 || state.base !== null;
}

function pad(n) { return String(n).padStart(2, '0'); }

function makeFileName() {
  const d = new Date();
  return `${t('file.prefix')} ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
    + `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.png`;
}

function canvasBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('image_failed')); return; }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}

/** Remember an error for the caregiver; the person drawing never sees errors. */
function reportError(where, err) {
  console.error(where, err);
  lastError = { where, error: err };
}

/** Save the drawing (white + drawing + colouring page lines) as PNG. */
async function saveDrawingIfNeeded() {
  if (!hasContent()) return;
  try {
    const out = document.createElement('canvas');
    out.width = paint.width;
    out.height = paint.height;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(paint, 0, 0);
    ctx.drawImage(lines, 0, 0);
    if (!state.fileName) state.fileName = makeFileName();
    await api.saveDrawing(await canvasBytes(out), state.fileName);
  } catch (err) {
    reportError('where.saveDrawing', err);
  }
}

function sessionMeta() {
  return { page: state.page, fileName: state.fileName };
}

function scheduleSessionSave() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(saveSessionNow, SESSION_SAVE_DELAY);
}

/** Save in between, so drawing can continue after a restart. */
async function saveSessionNow() {
  clearTimeout(sessionTimer);
  sessionTimer = null;
  try {
    if (hasContent()) await api.saveSessionImage(await canvasBytes(paint));
    else await api.clearSessionImage();
    await api.saveSessionMeta(sessionMeta());
  } catch (err) {
    reportError('where.saveSession', err);
  }
}

/** Clear or pick a colouring page: save the current drawing, start a new sheet. */
async function newDrawing(page) {
  if (busy || active) return;
  busy = true;
  try {
    clearTimeout(sessionTimer);
    await saveDrawingIfNeeded();
    state.strokes = [];
    state.base = null;
    state.fileName = null;
    state.page = page;
    redrawPaint();
    await renderLines();
    refreshSelection();
    stage.classList.remove('fresh');
    void stage.offsetWidth; // restart the animation
    stage.classList.add('fresh');
    await saveSessionNow();
  } finally {
    busy = false;
  }
}

async function restoreSession() {
  try {
    const meta = (await api.loadSessionMeta()) || {};
    state.page = PAGES.includes(meta.page) ? meta.page : null;
    state.fileName = meta.fileName || null;
    const bytes = await api.loadSessionImage();
    if (bytes && bytes.length) {
      state.base = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    }
  } catch (err) {
    reportError('where.loadSession', err);
    state.base = null;
  }
}

/** Stop: save everything first, only then close the window. */
async function shutdown() {
  if (closing) return;
  closing = true;
  if (active) finishStroke({ pointerId: active.pointerId, pointerType: active.pointerType });
  await saveSessionNow();
  await saveDrawingIfNeeded();
  if (T) {
    await T.window.getCurrentWindow().destroy();
  } else {
    closing = false;
    alert(t('browser.closed'));
  }
}

/* ---------------------------------------------------------------------------
 * Caregiver settings (hold for 3 seconds)
 * ------------------------------------------------------------------------- */
function setupSettingsButton() {
  const btn = $('#btn-settings');
  let timer = null;
  const cancel = () => { clearTimeout(timer); timer = null; btn.classList.remove('holding'); };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch { /* not critical */ }
    btn.classList.add('holding');
    timer = setTimeout(() => { cancel(); openSettings(); }, SETTINGS_HOLD_MS);
  });
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointercancel', cancel);
  btn.addEventListener('lostpointercapture', cancel);
}

let pendingUpdate = null;

async function loadSettings() {
  try {
    state.settings = await api.getSettings();
  } catch (err) {
    reportError('where.loadSettings', err);
  }
}

/** Show the current settings in the panel (also after a language change). */
function renderSettingsPanel() {
  const s = state.settings;
  $('#set-dir').textContent = s.effectiveSaveDir || '';
  $('#set-finger').checked = !!s.fingerDrawing;
  $(s.leftHanded ? '#set-left' : '#set-right').checked = true;
  const lang = ['en', 'nl'].includes(s.language) ? s.language : 'auto';
  document.querySelector(`input[name="language"][value="${lang}"]`).checked = true;
  $('#set-lang-auto').textContent = t('settings.language.auto', {
    lang: LANGUAGE_NAMES[s.systemLanguage] || LANGUAGE_NAMES.en,
  });
  const errorEl = $('#set-error');
  errorEl.hidden = !lastError;
  errorEl.textContent = lastError
    ? t('settings.lastError', { error: `${t(lastError.where)}: ${i18n.error(lastError.error)}` })
    : '';
  if (pendingUpdate) {
    $('#set-update-install').textContent = t('settings.update.install', { version: pendingUpdate.version });
  }
}

async function openSettings() {
  await loadSettings();
  try {
    $('#set-version').textContent = T ? await T.app.getVersion() : t('browser.version');
  } catch { /* not critical */ }
  renderSettingsPanel();
  $('#settings').hidden = false;
}

async function storeSettings(patch) {
  const next = { ...state.settings, ...patch };
  try {
    await api.setSettings({
      saveDir: next.saveDir || null,
      fingerDrawing: !!next.fingerDrawing,
      leftHanded: !!next.leftHanded,
      language: next.language || 'auto',
    });
  } catch (err) {
    reportError('where.saveSettings', err);
  }
  await loadSettings();
  applySettings();
  renderSettingsPanel();
}

function setupSettingsPanel() {
  $('#set-close').addEventListener('click', () => { $('#settings').hidden = true; });

  $('#set-finger').addEventListener('change', (e) => storeSettings({ fingerDrawing: e.target.checked }));
  $('#set-left').addEventListener('change', () => storeSettings({ leftHanded: true }));
  $('#set-right').addEventListener('change', () => storeSettings({ leftHanded: false }));
  document.querySelectorAll('input[name="language"]').forEach((input) => {
    input.addEventListener('change', () => storeSettings({ language: input.value }));
  });

  $('#set-dir-change').addEventListener('click', async () => {
    if (!T) return;
    const dir = await T.dialog.open({
      directory: true,
      title: t('settings.folder.pick'),
      defaultPath: state.settings.effectiveSaveDir || undefined,
    });
    if (typeof dir === 'string' && dir) await storeSettings({ saveDir: dir });
  });
  $('#set-dir-default').addEventListener('click', () => storeSettings({ saveDir: null }));
  $('#set-dir-open').addEventListener('click', async () => {
    try { await api.openFolder(state.settings.effectiveSaveDir); } catch (err) { reportError('where.openFolder', err); }
  });

  const status = $('#set-update-status');
  const installBtn = $('#set-update-install');

  $('#set-update-check').addEventListener('click', async () => {
    if (!T) { status.textContent = t('settings.update.desktopOnly'); return; }
    status.textContent = t('settings.update.checking');
    installBtn.hidden = true;
    try {
      pendingUpdate = await T.updater.check();
      if (pendingUpdate) {
        status.textContent = t('settings.update.available', { version: pendingUpdate.version });
        installBtn.textContent = t('settings.update.install', { version: pendingUpdate.version });
        installBtn.hidden = false;
      } else {
        status.textContent = t('settings.update.none');
      }
    } catch (err) {
      status.textContent = t('settings.update.checkFailed');
      reportError('where.checkUpdate', err);
    }
  });

  installBtn.addEventListener('click', async () => {
    if (!pendingUpdate) return;
    installBtn.disabled = true;
    try {
      // Save everything first: the installer closes the app.
      await saveSessionNow();
      await saveDrawingIfNeeded();
      let total = 0;
      let done = 0;
      await pendingUpdate.downloadAndInstall((ev) => {
        if (ev.event === 'Started') total = ev.data.contentLength || 0;
        if (ev.event === 'Progress') {
          done += ev.data.chunkLength;
          status.textContent = total
            ? t('settings.update.downloading', { percent: Math.round((done / total) * 100) })
            : t('settings.update.downloadingNoSize');
        }
        if (ev.event === 'Finished') status.textContent = t('settings.update.installing');
      });
      await T.process.relaunch();
    } catch (err) {
      status.textContent = t('settings.update.installFailed');
      reportError('where.installUpdate', err);
      installBtn.disabled = false;
    }
  });
}

/* ---------------------------------------------------------------------------
 * Disable unwanted browser behaviour
 * ------------------------------------------------------------------------- */
function lockDownBrowser() {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dragstart', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => {
    if (!e.target.closest || !e.target.closest('#settings')) e.preventDefault();
  });
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    const blocked = k === 'f5' || k === 'f3' || k === 'f7' || k === 'f12'
      || ((e.ctrlKey || e.metaKey) && ['r', 'p', 'f', 'g', 's', 'o', 'u', '+', '-', '=', '0'].includes(k));
    if (blocked) e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); }
  });
  // Ctrl + mouse wheel = zoom: not allowed.
  document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
}

/* ---------------------------------------------------------------------------
 * Startup
 * ------------------------------------------------------------------------- */
async function init() {
  lockDownBrowser();
  buildUi();
  setupSettingsPanel();
  PAGES.forEach((id) => loadPageImage(id).catch(() => {}));

  await loadSettings();
  i18n.setLanguage(state.settings.resolvedLanguage);
  app.classList.toggle('left-handed', !!state.settings.leftHanded);

  await restoreSession();
  resize();
  redrawPaint();
  await renderLines();
  refreshSelection();

  window.addEventListener('resize', () => requestAnimationFrame(resize));

  if (T) {
    // Also on Alt+F4 or Windows shutdown: save first.
    await T.window.getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      await shutdown();
    });
  }
}

init();
