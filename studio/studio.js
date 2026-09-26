import { BOARD, drawAll, drawEnd, drawPiece, inkBox, picture, replay } from './ink.js';
import { connect, StudioError } from './api.js';
import spots from './spots.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;

// Sizes in board units (the board is 1000 wide). The dots in the toolbar pick one of three.
const PEN_SIZES = [8, 14, 22];
const ERASER_SIZES = [24, 48, 96];
const SMALL_WIDTH = 96;

const board = $('[data-board]');
const canvas = $('[data-canvas]');
const ctx = canvas.getContext('2d');
const cursor = $('[data-cursor]');
const spotSelect = $('[data-spot]');
const nameInput = $('[data-name]');
const actual = $('[data-actual]');
const saveButton = $('[data-save]');
const watchButton = $('[data-watch]');
const statusLine = $('[data-status]');

let api;
let me; // who the link belongs to
let draftKey = 'studio-draft';
let strokes = [];
let undoStack = [];
let redoStack = [];
let current = { id: null, name: '', spot: null };
let dirty = false;
let saved = [];
let tool = 'pen';
let sizeIndex = 1;
let scale = 1;
let active = null; // the stroke being drawn right now, and which pointer is drawing it
let penSeen = false;
let clockBase = null; // lines each new stroke's times up after the doodle's earlier ones
let watching = null;
let lastPointer = null;

// ---------------------------------------------------------------------------------------------
// The private link. Its key is kept in this browser, then taken out of the address bar so it
// doesn't linger in history or get shared by accident.

function readKey() {
  const fromLink = new URLSearchParams(location.hash.slice(1)).get('key');
  if (fromLink) {
    try {
      localStorage.setItem('studio-key', fromLink);
    } catch {}
    history.replaceState(null, '', location.pathname + location.search);
    return fromLink;
  }
  try {
    return localStorage.getItem('studio-key');
  } catch {
    return null;
  }
}

function gate(message) {
  $('[data-app]').hidden = true;
  $('[data-gate]').hidden = false;
  $('[data-gate-message]').textContent = message;
}

// ---------------------------------------------------------------------------------------------
// Drawing

function status(message, isError = false) {
  statusLine.textContent = message;
  statusLine.classList.toggle('is-error', isError);
}

function redraw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawAll(ctx, strokes);
}

function fit() {
  const width = board.getBoundingClientRect().width;
  const size = Math.round(width * Math.min(window.devicePixelRatio || 1, 3));
  if (!size) return;
  stopWatching();
  canvas.width = canvas.height = size;
  scale = size / BOARD;
  redraw();
  placeCursor();
}

function boardPoint(e) {
  const r = board.getBoundingClientRect();
  return [clamp(((e.clientX - r.left) / r.width) * BOARD, 0, BOARD), clamp(((e.clientY - r.top) / r.height) * BOARD, 0, BOARD)];
}

// A pen reports how hard it's pressed. A mouse or finger doesn't, so it draws at the middle width.
const pressureOf = (e) => (e.pointerType === 'pen' ? clamp(e.pressure || 0, 0.1, 1) : 0.5);

function lastTime() {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const pts = strokes[i].pts;
    if (pts.length) return pts[pts.length - 2];
  }
  return -400;
}

/** Add a point to a stroke. Skips points too close to the last one to matter. */
function addPoint(s, e) {
  const [x, y] = boardPoint(e);
  const p = pressureOf(e);
  const pts = s.pts;
  const n = pts.length;
  if (n) {
    const dx = x - pts[n - 4];
    const dy = y - pts[n - 3];
    if (dx * dx + dy * dy < 0.5 && Math.abs(p - pts[n - 1]) < 0.05) return false;
  }
  const t = Math.max(n ? pts[n - 2] : 0, Math.round(e.timeStamp - clockBase));
  pts.push(round(x, 1), round(y, 1), t, round(p, 2));
  return true;
}

board.addEventListener('pointerdown', (e) => {
  if (watching) {
    stopWatching();
    return;
  }
  if (active) return;
  if (e.pointerType === 'pen') penSeen = true;
  // With a pen around, a touch is a resting hand, not drawing.
  if (e.pointerType === 'touch' && penSeen) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  try {
    board.setPointerCapture(e.pointerId); // keep the line going if the pen slips off the board
  } catch {}
  if (clockBase === null) clockBase = e.timeStamp - (lastTime() + 400);
  // Flipping the pen over to its eraser end erases, whatever tool is picked.
  const erasing = tool === 'eraser' || (e.pointerType === 'pen' && (e.buttons & 32) !== 0);
  const stroke = { tool: erasing ? 'eraser' : 'pen', w: (erasing ? ERASER_SIZES : PEN_SIZES)[sizeIndex], pts: [] };
  active = { pointer: e.pointerId, stroke };
  addPoint(stroke, e);
  moveCursor(e);
});

board.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'touch') moveCursor(e);
  if (!active || e.pointerId !== active.pointer) return;
  const s = active.stroke;
  const events = e.getCoalescedEvents?.() ?? [];
  for (const ev of events.length ? events : [e]) {
    if (addPoint(s, ev) && s.pts.length >= 8) drawPiece(ctx, s, s.pts.length / 4 - 1);
  }
  ctx.globalCompositeOperation = 'source-over';
});

function endStroke(e) {
  if (!active || e.pointerId !== active.pointer) return;
  const s = active.stroke;
  active = null;
  drawEnd(ctx, s);
  ctx.globalCompositeOperation = 'source-over';
  commit({ type: 'add', stroke: s });
}

board.addEventListener('pointerup', endStroke);
board.addEventListener('pointercancel', endStroke);
board.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && cursor.classList.add('is-shown'));
board.addEventListener('pointerleave', () => cursor.classList.remove('is-shown'));

function moveCursor(e) {
  const r = board.getBoundingClientRect();
  lastPointer = [e.clientX - r.left, e.clientY - r.top];
  placeCursor();
}

function placeCursor() {
  if (!lastPointer) return;
  const width = board.getBoundingClientRect().width;
  const d = Math.max(4, ((tool === 'eraser' ? ERASER_SIZES : PEN_SIZES)[sizeIndex] * width) / BOARD);
  cursor.style.width = cursor.style.height = `${d}px`;
  cursor.style.transform = `translate(${lastPointer[0] - d / 2}px, ${lastPointer[1] - d / 2}px)`;
}

// ---------------------------------------------------------------------------------------------
// Undo, redo, and clear

function apply(action) {
  if (action.type === 'add') strokes.push(action.stroke);
  else strokes = [];
}

function revert(action) {
  if (action.type === 'add') strokes.pop();
  else strokes = action.strokes;
}

function commit(action) {
  apply(action);
  undoStack.push(action);
  redoStack = [];
  changed();
}

function undo() {
  stopWatching();
  const action = undoStack.pop();
  if (!action) return;
  revert(action);
  redoStack.push(action);
  redraw();
  changed();
}

function redo() {
  stopWatching();
  const action = redoStack.pop();
  if (!action) return;
  apply(action);
  undoStack.push(action);
  redraw();
  changed();
}

function clearBoard() {
  stopWatching();
  if (!strokes.length) return;
  commit({ type: 'clear', strokes });
  redraw();
}

function changed() {
  dirty = true;
  saveDraft();
  refresh();
  status('Not saved yet.');
}

function refresh() {
  $('[data-undo]').disabled = !undoStack.length;
  $('[data-redo]').disabled = !redoStack.length;
  $('[data-clear]').disabled = !strokes.length;
  watchButton.disabled = !strokes.length;
  scheduleActual();
}

// ---------------------------------------------------------------------------------------------
// Tools

function setTool(next) {
  tool = next;
  $$('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === next)));
  placeCursor();
}

function setSize(next) {
  sizeIndex = clamp(next, 0, PEN_SIZES.length - 1);
  $$('[data-size]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.size) === sizeIndex)));
  placeCursor();
}

// ---------------------------------------------------------------------------------------------
// Placing a doodle. The list of places only exists when the owner runs the studio on their own
// computer, so artists never see it, and the online studio doesn't contain it at all.

const spotNamed = (name) => spots.find((s) => s.name === name);
const placing = () => Boolean(me?.owner && spots.length);

function fillSpots() {
  const taken = new Map(saved.filter((d) => d.spot).map((d) => [d.spot, d.id]));
  spotSelect.replaceChildren(new Option('Not placed yet', ''));
  for (const page of [...new Set(spots.map((s) => s.page))]) {
    const group = document.createElement('optgroup');
    group.label = page;
    for (const s of spots.filter((spot) => spot.page === page)) {
      const other = taken.has(s.name) && taken.get(s.name) !== current.id;
      group.append(new Option(`${s.name} · ${s.note}${other ? '  (taken)' : ''}`, s.name));
    }
    spotSelect.append(group);
  }
  spotSelect.value = current.spot ?? '';
}

function showSpot() {
  const spot = spotNamed(current.spot);
  const idea = $('[data-idea]');
  idea.hidden = !spot;
  idea.textContent = spot ? `Idea: ${spot.note}` : '';
  $('[data-place-note]').textContent = !current.id
    ? 'Save it first, then pick its spot.'
    : spot ? `Shows on ${spot.page}.` : '';
  spotSelect.disabled = !current.id;
  $('[data-actual-caption]').textContent = spot ? 'Actual size in its spot' : 'How it looks small';
  scheduleActual();
}

spotSelect.addEventListener('change', async () => {
  const spot = spotSelect.value || null;
  try {
    await api.assign(current.id, spot);
    current.spot = spot;
    showSpot();
    await loadList();
  } catch (err) {
    status(err.message, true);
    spotSelect.value = current.spot ?? '';
  }
});

const currentName = () => nameInput.value.trim();

nameInput.addEventListener('input', () => {
  current.name = currentName();
  changed();
});

let actualTimer = 0;
function scheduleActual() {
  clearTimeout(actualTimer);
  actualTimer = setTimeout(drawActual, 120);
}

function drawActual() {
  const crop = inkBox(strokes);
  const actx = actual.getContext('2d');
  if (!crop) {
    actual.width = actual.height = 0;
    return;
  }
  // Shown at its spot's width (or a typical small width), and as tall as its shape needs.
  const width = spotNamed(current.spot)?.width ?? SMALL_WIDTH;
  const height = (width * crop[3]) / crop[2];
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const pic = picture(strokes, crop, Math.max(width, height) * dpr);
  actual.width = pic.width;
  actual.height = pic.height;
  actual.style.width = `${width}px`;
  actx.drawImage(pic, 0, 0);
}

// ---------------------------------------------------------------------------------------------
// Watching it draw itself again, the way it was drawn

function watch() {
  if (watching) return stopWatching();
  if (!strokes.length) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  board.classList.add('is-watching');
  watchButton.lastChild.textContent = ' Stop';
  const run = replay(ctx, strokes, { maxDuration: 12000 });
  watching = run;
  run.done.then(() => watching === run && stopWatching());
}

function stopWatching() {
  if (!watching) return;
  const run = watching;
  watching = null;
  run.stop();
  board.classList.remove('is-watching');
  watchButton.lastChild.textContent = ' Watch it';
  redraw();
}

// ---------------------------------------------------------------------------------------------
// Saving, opening, and the list of saved doodles

function saveDraft() {
  try {
    localStorage.setItem(draftKey, JSON.stringify({ id: current.id, name: current.name, strokes, dirty }));
  } catch {}
}

function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(draftKey) || 'null');
  } catch {
    return null;
  }
}

function load({ id = null, name = '', spot = null, strokes: next = [] }, isDirty = false) {
  stopWatching();
  current = { id, name, spot };
  strokes = next;
  undoStack = [];
  redoStack = [];
  clockBase = null;
  dirty = isDirty;
  nameInput.value = name;
  spotSelect.value = spot ?? '';
  showSpot();
  redraw();
  refresh();
  saveDraft();
  markCurrent();
  status('');
}

const unsavedOk = () => !dirty || !strokes.length || confirm("What's on the board isn't saved yet. Leave it?");

async function save() {
  const crop = inkBox(strokes);
  if (!crop) return status('Draw something first.', true);
  const name = currentName();
  if (!name) {
    status('Give it a name first.', true);
    nameInput.focus();
    return;
  }
  saveButton.disabled = true;
  status('Saving…');
  try {
    const long = Math.min(1200, Math.round(Math.max(crop[2], crop[3]) * 2));
    const image = picture(strokes, crop, long).toDataURL('image/png');
    const thumb = picture(strokes, crop, 240).toDataURL('image/png');
    current.id = await api.save({ id: current.id, name, strokes: { v: 1, size: BOARD, crop, strokes }, image, thumb });
    current.name = name;
    dirty = false;
    saveDraft();
    status(me.owner ? 'Saved.' : 'Saved. Yousef can see it now.');
    showSpot();
    await loadList();
  } catch (err) {
    status(err.message, true);
  } finally {
    saveButton.disabled = false;
  }
}

async function open(id) {
  if (id === current.id && !dirty) return;
  if (!unsavedOk()) return;
  status('Opening…');
  try {
    const doodle = await api.get(id);
    load({ id: doodle.id, name: doodle.name, spot: doodle.spot, strokes: doodle.strokes.strokes });
    status('');
  } catch (err) {
    status(err.message, true);
  }
}

async function remove(item) {
  if (!confirm(`Delete "${item.name || 'this doodle'}"?`)) return;
  try {
    await api.remove(item.id);
    // Deleting the one on the board keeps it there, just unsaved.
    if (current.id === item.id) {
      current.id = null;
      current.spot = null;
      showSpot();
      dirty = true;
      saveDraft();
      status('Deleted. It\'s still on the board if you want to save it again.');
    }
    await loadList();
  } catch (err) {
    status(err.message, true);
  }
}

async function loadList() {
  saved = await api.list();
  const list = $('[data-saved]');
  list.replaceChildren(
    ...saved.map((item) => {
      const li = document.createElement('li');
      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'open';
      openButton.dataset.id = item.id;
      const img = new Image();
      img.src = item.thumb;
      img.alt = '';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = item.name;
      openButton.append(img, name);
      if (me.owner) {
        const artist = document.createElement('span');
        artist.className = 'artist';
        artist.textContent = item.spot ? `${item.artist} · placed` : item.artist;
        openButton.append(artist);
      }
      openButton.addEventListener('click', () => open(item.id));
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'delete';
      del.textContent = '×';
      del.setAttribute('aria-label', `Delete ${item.name}`);
      del.addEventListener('click', () => remove(item));
      li.append(openButton, del);
      return li;
    }),
  );
  $('[data-empty]').hidden = saved.length > 0;
  // A restored draft doesn't know its spot, so take it from the list.
  const mine = saved.find((item) => item.id === current.id);
  if (mine) current.spot = mine.spot ?? null;
  if (placing()) {
    fillSpots();
    showSpot();
  }
  markCurrent();
}

function markCurrent() {
  $$('.saved .open').forEach((b) => b.classList.toggle('is-current', b.dataset.id === current.id));
}

// ---------------------------------------------------------------------------------------------
// Starting up

async function start(key) {
  api = connect(key);
  draftKey = `studio-draft-${key.slice(0, 8)}`;
  try {
    me = await api.hello();
  } catch (err) {
    const status = err instanceof StudioError ? err.status : 0;
    if (status === 403) gate("This link doesn't work anymore. Ask Yousef for a new one.");
    else if (status === 404) gate("The studio isn't set up yet. (Yousef: run supabase/studio.sql in Supabase.)");
    else gate(err.message);
    return;
  }

  $('[data-gate]').hidden = true;
  $('[data-app]').hidden = false;
  $('[data-hello]').textContent = me.practice
    ? 'Practice mode: saved in this browser only'
    : me.owner ? "You're seeing everyone's doodles" : 'Hi!';
  $('[data-list-title]').textContent = me.owner ? 'All doodles' : 'Your doodles';
  $('[data-place]').hidden = !placing();
  if (placing()) fillSpots();

  new ResizeObserver(fit).observe(board);
  const draft = readDraft();
  if (draft?.strokes?.length) {
    load(draft, draft.dirty);
    if (draft.dirty) status('Picked up where you left off. Not saved yet.');
  } else {
    load({});
  }
  loadList().catch((err) => status(err.message, true));
}

$$('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
$$('[data-size]').forEach((b) => b.addEventListener('click', () => setSize(Number(b.dataset.size))));
$('[data-undo]').addEventListener('click', undo);
$('[data-redo]').addEventListener('click', redo);
$('[data-clear]').addEventListener('click', clearBoard);
saveButton.addEventListener('click', save);
watchButton.addEventListener('click', watch);
$('[data-new]').addEventListener('click', () => unsavedOk() && load({}));

addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, select, textarea, dialog')) return;
  const key = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (mod && key === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  } else if (mod && key === 'y') {
    e.preventDefault();
    redo();
  } else if (mod && key === 's') {
    e.preventDefault();
    save();
  } else if (mod || e.altKey) {
    return;
  } else if (key === 'b' || key === 'p') {
    setTool('pen');
  } else if (key === 'e') {
    setTool('eraser');
  } else if (key === '[') {
    setSize(sizeIndex - 1);
  } else if (key === ']') {
    setSize(sizeIndex + 1);
  }
});

addEventListener('beforeunload', (e) => {
  if (dirty && strokes.length) e.preventDefault();
});

const key = readKey();
if (key) start(key);
else gate('This studio is private. Open it with the link Yousef sent you.');
