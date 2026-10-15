// Guardar/abrir escenas, autoguardado, deshacer y exportaciones JPG.
import * as THREE from 'three';
import { S, UI, $, TSTOPS, ISOS, uidCounter, req, toast } from './state.js';
import { TYPES, DIFF, LENSES, CITIES } from './catalog.js';
import * as E from './engine.js';
import { drawPlan, drawPlanTo } from './plan.js';
import { renderItems, renderProps, syncScenePanel, syncCamUI, refreshMove, describeMove, snapLabel, snapCam, applySnap, attachGizmo } from './ui.js';
import { sunPosition, hourLabel, phaseName } from './sun.js';

const VERSION = 1;
export function serialize() {
  const strip = (k, v) => (k === 'obj' || k === '_grp' || k === '_head' || k === '_eye' || k === '_diffused' || k === '_lux' || (typeof k === 'string' && k.startsWith('_') && k !== '')) ? undefined : v;
  return JSON.stringify({ app: 'HAPI', version: VERSION, name: S.name, env: S.env, items: S.items, people: S.people, cam: S.cam, move: S.move }, strip);
}
export function restore(str) {
  const d = JSON.parse(str);
  if (d.app !== 'HAPI') throw new Error('No es un archivo de HAPI');
  S.items.slice().forEach(it => E.removeItemObj(it)); S.items.length = 0;
  S.name = d.name || 'Escena sin título'; $('#sceneName').value = S.name;
  Object.assign(S.env, d.env); Object.assign(S.env.time, d.env.time); Object.assign(S.env.room, d.env.room);
  S.people.forEach((P, i) => { if (P._grp) E.scene.remove(P._grp); P._grp = null; Object.assign(P, d.people[i]); });
  Object.keys(S.cam).forEach(k => { if (k.startsWith('_')) delete S.cam[k]; }); Object.assign(S.cam, d.cam);
  S.move.A = d.move.A; S.move.B = d.move.B;
  E.buildEnvironment(); E.buildPeople();
  for (const it of d.items) { S.items.push(it); }
  S.items.forEach(it => { if (TYPES[it.type].cat !== 'abertura') E.buildItem(it); });
  E.buildEnvironment();
  uidCounter.v = Math.max(uidCounter.v, ...S.items.map(i => i.id + 1), 1);
  if (!S.people[UI.selPerson].on) UI.selPerson = 0; UI.sel = null;
  syncScenePanel(); syncCamUI(); renderItems(); renderProps(); refreshMove(); attachGizmo(); drawPlan(); req();
}

/* undo: un solo paso */
let undoSnap = null, pending = null, pendT = 0;
const undoBtn = $('#undo');
function begin(e) { if (e && e.target && e.target.closest && e.target.closest('#undo')) return; if (!pending) pending = serialize(); }
function commit() {
  clearTimeout(pendT);
  pendT = setTimeout(() => { if (!pending) return; const now = serialize(); if (now !== pending) { undoSnap = pending; undoBtn.disabled = false; scheduleAutosave(); } pending = null; }, 40);
}
document.addEventListener('pointerdown', begin, true);
document.addEventListener('pointerup', commit, true);
document.addEventListener('change', commit, true);
document.addEventListener('keydown', e => { if (!(e.ctrlKey || e.metaKey)) begin(e); }, true);
document.addEventListener('keyup', commit, true);
export function undo() {
  if (!undoSnap) { toast('No hay nada para deshacer.'); return; }
  const s = undoSnap; undoSnap = null; pending = null; undoBtn.disabled = true; restore(s); toast('Se deshizo el último cambio.');
}
undoBtn.addEventListener('click', undo);

/* autoguardado local */
let autoT = 0;
export function scheduleAutosave() { clearTimeout(autoT); autoT = setTimeout(() => { try { localStorage.setItem('hapi-autosave', serialize()); } catch (_) {} }, 800); }
export function loadAutosave() { try { const s = localStorage.getItem('hapi-autosave'); if (s) { restore(s); return true; } } catch (_) {} return false; }

/* descargas */
let dlCap = null;
try { if (window.claude && window.claude.use) dlCap = window.claude.use('downloads').catch(() => null); } catch (_) {}
export async function saveBlob(name, blob) {
  const d = dlCap ? await dlCap : null;
  if (d) {
    try { await d.save({ filename: name, data: blob }); toast('Descarga lista: ' + name); }
    catch (err) { toast(err && err.code === 'declined' ? 'Descarga cancelada.' : 'No se pudo descargar en esta vista.'); }
    return;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Descarga lista: ' + name);
}
const toBlob = cv => new Promise(r => cv.toBlob(r, 'image/jpeg', 0.92));
const slug = s => (s || 'escena').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'escena';

$('#sceneName').addEventListener('input', e => { S.name = e.target.value; scheduleAutosave(); });
$('#save').addEventListener('click', () => saveBlob(slug(S.name) + '.hapi.json', new Blob([serialize()], { type: 'application/json' })));
$('#open').addEventListener('click', () => $('#openFile').click());
$('#openFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try { const prev = serialize(); restore(await f.text()); undoSnap = prev; undoBtn.disabled = false; toast('Escena abierta: ' + S.name); scheduleAutosave(); }
  catch (_) { toast('No se pudo abrir ese archivo. Tiene que ser una escena guardada con HAPI (.hapi.json).'); }
  e.target.value = '';
});

/* leyendas */
export function legendLines() {
  const L = LENSES[S.cam.lens], env = S.env, PN = { sentado: 'sentado', pie: 'de pie', elevado: 'elevado' };
  const lines = S.items.map((it, i) => {
    const T = TYPES[it.type]; let s = `${i + 1}. ${E.itemName(it)}`;
    if (T.cat === 'abertura') return s + ` · ${it.w.toFixed(2)} × ${it.h.toFixed(2)} m` + (it.type === 'ventana' ? ` · antepecho ${it.sill.toFixed(2)} m` : ` · abierta ${it.open}°`);
    s += ` · altura ${it.y.toFixed(2)} m`;
    if (E.isLight(it)) {
      s += ` · ${it.on ? 'dimmer ' + it.dim + '%' : 'apagado'}`;
      if (T.powers) s += ` · ${it.focus < 0.35 ? 'spot' : it.focus > 0.7 ? 'flood' : 'medio'}${it.gel !== 'none' ? ' · gel ' + it.gel.toUpperCase() : ''}`;
      if (it.diff && it.diff !== 'none') s += ' · difusión ' + DIFF[it.diff].label;
      if (it.grid && it.grid !== 'none') s += ' · grilla ' + it.grid + '°';
      if (it.type === 'tube' || it.type === 'panel') s += it.mode === 'rgb' ? ' · color ' + it.rgb : ' · ' + it.k + ' K';
      if (it.type === 'powerflo' || T.practical) s += ' · ' + it.k + ' K';
      if (it.barn && Object.values(it.barn).some(v => v > 0)) s += ` · viseras ${it.barn.t}/${it.barn.b}/${it.barn.l}/${it.barn.r}°`;
    }
    return s;
  });
  const cam = `Cámara: ${L.label} · altura ${E.camHeight().toFixed(2)} m · ${S.cam.a}${S.cam.tilt ? ' ' + S.cam.tilt + '°' : ''} · T${TSTOPS[S.cam.T]} · ISO ${ISOS[S.cam.iso]} · ${S.cam.fps} fps ${S.cam.shutter}°${S.cam.nd ? ' · ND ' + S.cam.nd.toFixed(1) : ''} · balance ${S.cam.wb} K`;
  let place;
  if (env.mode === 'estudio') place = `Estudio · fondo ${$('#bgc').selectedOptions[0].textContent.toLowerCase()} a ${env.studio.dist.toFixed(1)} m`;
  else { const p = sunPosition(env.time); place = `${env.mode === 'interior' ? `Interior ${env.room.w.toFixed(1)} × ${env.room.d.toFixed(1)} m` : 'Exterior · ' + ({ abierto: 'terreno abierto', calle: 'calle', patio: 'patio' })[env.ext.kind]} · ${hourLabel(env.time.hour)} del ${env.time.day}/${env.time.month} en ${CITIES[env.time.city].name} · ${phaseName(p.elev).toLowerCase()}, sol a ${p.elev.toFixed(0)}°`; }
  const people = S.people.filter(P => P.on).map((P, i) => `Personaje ${i + 1}: ${PN[P.pose]}`).join(' · ');
  return { lines, cam, place, people };
}
$('#dlPlan').addEventListener('click', async () => {
  const W = 1600, { lines, cam, place, people } = legendLines(), lh = 34;
  const mv = S.move.A && S.move.B ? ['Movimiento A → B: ' + describeMove(), 'A: ' + snapLabel(S.move.A) + '  ·  B: ' + snapLabel(S.move.B)] : [];
  const all = mv.concat(lines), cv = document.createElement('canvas'); cv.width = W; cv.height = W + 190 + all.length * lh; const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); drawPlanTo(ctx, W, 'paper');
  ctx.fillStyle = '#16141b'; ctx.font = '600 40px Archivo, system-ui, sans-serif'; ctx.fillText(S.name + ' · planta de iluminación', 60, W + 64);
  ctx.font = '25px Archivo, system-ui, sans-serif'; ctx.fillStyle = '#4b4657'; ctx.fillText(place, 60, W + 104); ctx.fillText(cam + ' · ' + people, 60, W + 138);
  ctx.fillStyle = '#16141b'; all.forEach((l, i) => ctx.fillText(l, 60, W + 185 + lh * i));
  ctx.fillStyle = '#9a94a8'; ctx.font = '20px Archivo, system-ui, sans-serif'; ctx.fillText('Hecho con HAPI · Herramienta de Armado de Plantas de Iluminación', 60, cv.height - 16);
  await saveBlob(slug(S.name) + '-planta.jpg', await toBlob(cv)); drawPlan();
});
function frameStrip(ctx, y, W, title, a, b) {
  ctx.fillStyle = '#0e0d12'; ctx.fillRect(0, y, W, 150);
  ctx.fillStyle = '#FFB547'; ctx.font = '600 34px Archivo, system-ui, sans-serif'; ctx.fillText(title, 40, y + 52);
  ctx.fillStyle = '#ede9f2'; ctx.font = '23px Archivo, system-ui, sans-serif'; ctx.fillText(a, 40, y + 92); ctx.fillText(b, 40, y + 126);
}
$('#dlShot').addEventListener('click', async () => {
  const W = 1920, H = 1080, fr = E.grabFrame(W, H), out = document.createElement('canvas'); out.width = W; out.height = H + 150; const ctx = out.getContext('2d');
  ctx.drawImage(fr, 0, 0); const { cam, place, people } = legendLines();
  frameStrip(ctx, H, W, S.name + ' · plano de referencia', cam, place + ' · ' + people);
  await saveBlob(slug(S.name) + '-plano.jpg', await toBlob(out));
});
$('#dlAB').addEventListener('click', async () => {
  const A = S.move.A, B = S.move.B; if (!A || !B) return;
  const keep = snapCam(), W = 1920, H = 1080, out = document.createElement('canvas'); out.width = W; out.height = 2 * (H + 150) + 80; const ctx = out.getContext('2d');
  ctx.fillStyle = '#0e0d12'; ctx.fillRect(0, 0, W, out.height); let y = 0;
  for (const [k, s] of [['A', A], ['B', B]]) {
    applySnap(s); const fr = E.grabFrame(W, H); ctx.drawImage(fr, 0, y);
    ctx.fillStyle = '#FFB547'; ctx.fillRect(30, y + 30, 90, 90); ctx.fillStyle = '#1a1206'; ctx.font = '800 64px Archivo, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(k, 75, y + 98); ctx.textAlign = 'left';
    const { cam, place } = legendLines(); frameStrip(ctx, y + H, W, `Cuadro ${k} · ${k === 'A' ? 'inicio' : 'final'} del movimiento`, cam, place); y += H + 150;
  }
  ctx.fillStyle = '#ede9f2'; ctx.font = '26px Archivo, system-ui, sans-serif'; ctx.fillText('Movimiento A → B: ' + describeMove(), 40, y + 50);
  applySnap(keep); await saveBlob(slug(S.name) + '-cuadros-A-B.jpg', await toBlob(out));
});
