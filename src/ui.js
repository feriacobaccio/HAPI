// Paneles, propiedades y controles de HAPI.
import * as THREE from 'three';
import { S, UI, $, $$, D2R, R2D, clamp, fmt, TSTOPS, ISOS, MAX_SHADOW_LIGHTS, req, on, emit, toast, nextId } from './state.js';
import { TYPES, BULBS, FLAG_SIZES, DIFF, GEL, FACES, LENSES, SKINS, CITIES, WOODS, BUTTERFLY_SIZES, BUTTERFLY_FACES, APPLE } from './catalog.js';
import { freeSpot } from './collide.js';
import * as E from './engine.js';
import { drawPlan, PV, zoomPlan, planWorld, planContains } from './plan.js';
import { sunPosition, findHour, solarNoon, phaseName, hourLabel, daylight } from './sun.js';
import { renderPresets } from './presets.js';

const pressSeg = (sel, attr, val) => $$(sel + ' button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset[attr]) === String(val)));
export const lightCount = () => S.items.filter(E.isLight).length;

/* ---------- items ---------- */
export function defaults(type) {
  const T = TYPES[type], it = { id: nextId(), type, x: 0, z: 2, y: 1.8, yaw: 0, pitch: 0, on: true, dim: 100 };
  if (T.powers) Object.assign(it, { p: type === 'hmi' ? 1 : 2, focus: 0.6, diff: 'none', gel: 'none', barn: { t: 0, b: 0, l: 0, r: 0 } });
  if (type === 'powerflo') Object.assign(it, { k: 3200, grid: 'none', barn: { t: 0, b: 0, l: 0, r: 0 } });
  if (type === 'panel') Object.assign(it, { k: 4300, mode: 'temp', rgb: '#ff3fa4', grid: 'none', diff: 'none', barn: { t: 0, b: 0, l: 0, r: 0 } });
  if (type === 'tube') Object.assign(it, { k: 5600, mode: 'rgb', rgb: '#3fd7ff', orient: 'v', y: 1.5 });
  if (type === 'flag') Object.assign(it, { size: '60x90', y: 1.6 });
  if (type === 'bounce') Object.assign(it, { face: 'white', y: 1.3 });
  if (T.practical) {
    const h = type === 'colgante' ? (S.env.mode === 'interior' ? S.env.room.h - 0.65 : 2.1) : type === 'bombita' ? (S.env.mode === 'interior' ? S.env.room.h - 0.55 : 2.2) : T.height;
    Object.assign(it, { y: h, p: type === 'vela' ? 0 : type === 'bombita' ? 2 : 2, k: T.kelvins[0], flicker: type === 'vela' });
  }
  if (T.cat === 'mueble') Object.assign(it, { y: 0, color: type === 'sillon' ? '#5a6b7a' : type === 'cama' ? '#c9b28f' : '#7a5634' });
  if (T.cat === 'grip') { it.y = 0; delete it.on; delete it.dim; }
  if (type === 'riel') it.len = 3.6;
  if (type === 'jib') Object.assign(it, { len: 4.5, arm: 15 });
  if (type === 'butterfly') Object.assign(it, { side: 2.44, face: 'diff', y: 2.8, pitch: -90 });
  if (type === 'applebox') Object.assign(it, { size: 'full', count: 1 });
  if (type === 'tarima') it.h = 0.4;
  if (type === 'ventana') Object.assign(it, { wall: 0, u: 0, w: 1.6, h: 1.3, sill: 0.9, y: 0 });
  if (type === 'puerta') Object.assign(it, { wall: 3, u: 0, w: 0.9, h: 2.05, sill: 0, open: 70, y: 0 });
  return it;
}
export function aimAtSubject(it, i = 0) { const h = S.people[i]._head; E.aimAt(it, h.x, h.y, h.z); }
export function addItem(type, pos) {
  const T = TYPES[type];
  if (T.cat === 'abertura' && S.env.mode !== 'interior') { toast('Las ventanas y puertas se agregan en escenas de interior.'); return null; }
  if (E.isLight({ type }) && lightCount() >= MAX_SHADOW_LIGHTS) { toast(`Máximo ${MAX_SHADOW_LIGHTS} luces con sombra. Quitá o apagá una para agregar otra.`); return null; }
  const it = defaults(type);
  if (pos) Object.assign(it, pos);
  else if (T.cat !== 'abertura') {
    const P = S.people[0], d = T.cat === 'mueble' ? 1.4 : type === 'flag' ? 1.1 : type === 'bounce' ? 1.4 : T.practical ? 1.3 : 2.6, base = Math.atan2(S.cam.x - P.x, S.cam.z - P.z);
    const cands = [-50, 50, -85, 85, -130, 130, 180, -30, 30, -160, 160];
    let best = cands[0], score = -1;
    for (const c of cands) {
      const a = base + c * D2R, x = P.x + Math.sin(a) * d, z = P.z + Math.cos(a) * d;
      const clear = S.items.reduce((m, o) => Math.min(m, Math.hypot(o.x - x, o.z - z)), 9);
      if (clear > 1.0) { best = c; score = clear; break; } if (clear > score) { score = clear; best = c; }
    }
    const a = base + best * D2R; it.x = Math.round((P.x + Math.sin(a) * d) * 20) / 20; it.z = Math.round((P.z + Math.cos(a) * d) * 20) / 20;
  }
  if (T.cat === 'abertura') E.snapOpening(it, pos ? pos.x : 0, pos ? pos.z : E.roomBounds().zB);
  if ((T.cat === 'luz' || T.cat === 'control') && !(pos && pos.yaw !== undefined)) { aimAtSubject(it); if (type === 'flag') it.pitch = 0; }
  if ((T.cat === 'mueble' || T.cat === 'grip') && it.type !== 'butterfly' && !(pos && pos.yaw !== undefined)) { const P = S.people[0]; it.yaw = Math.round(Math.atan2(P.x - it.x, P.z - it.z) * R2D / 15) * 15; }
  if (T.cat !== 'abertura') { const [fx, fz] = freeSpot(it, it.x, it.z, S.env.mode === 'interior' ? E.roomBounds() : null); it.x = fx; it.z = fz; }
  S.items.push(it); E.buildItem(it); return it;
}
export function select(id) { UI.sel = id; renderItems(); renderProps(); req(); drawPlan(); attachGizmo(); }
export function selectPerson(i) { UI.sel = null; UI.selPerson = i; syncPersonUI(); renderItems(); renderProps(); req(); drawPlan(); attachGizmo(); }
on('select', select); on('selectPerson', selectPerson);
on('itemMoved', it => { if (UI.sel === it.id) renderProps(true); updateLensInfo(); req(); });
on('peopleChanged', () => { syncPersonUI(); updateLensInfo(); renderProps(true); });
on('camChanged', () => updateLensInfo());
export let attachGizmo = () => {}; export const setAttachGizmo = f => { attachGizmo = f; };

/* ---------- library ---------- */
const LIBS = { libLuz: ['hmi', 'fresnel', 'powerflo', 'tube', 'panel'], libPractica: ['velador', 'pie', 'colgante', 'bombita', 'vela'], libControl: ['flag', 'bounce'], libMueble: ['mesa', 'silla', 'sillon', 'biblioteca', 'cama', 'escritorio', 'ventana', 'puerta'], libGrip: ['riel', 'dolly', 'jib', 'slider', 'steadicam', 'tripode', 'butterfly', 'applebox', 'tarima', 'escalera', 'bolsa'] };
const SUB = { hmi: '575 W a 12 kW · 5600 K', fresnel: '300 W a 2 kW · 3200 K', powerflo: 'Fluorescente · suave', tube: 'Tipo Astera · RGB', panel: 'RGB · semisuave', velador: 'LED 4 a 15 W', pie: 'LED 4 a 15 W', colgante: 'LED 4 a 15 W', bombita: 'Incandescente 25 a 100 W', vela: '12 lm · 1850 K', flag: 'Recorta la luz', bounce: 'Blanco, plata, oro, negro, difusión', ventana: 'Solo interior', puerta: 'Solo interior', riel: 'Tramos de 1,2 m', dolly: 'Carro con columna', jib: 'Brazo de 3 a 9 m', slider: '1,2 m', steadicam: 'Cámara en mano estable', tripode: 'Segunda cámara', butterfly: '6×6, 8×8, 12×12', applebox: 'Completo a pancake', tarima: '20 a 60 cm', escalera: '1,8 m', bolsa: 'Contrapeso' };
for (const [id, list] of Object.entries(LIBS)) $('#' + id).innerHTML = list.map(t => `<button data-add="${t}">${TYPES[t].name}<small>${SUB[t] || TYPES[t].desc.split('.')[0]}</small></button>`).join('');
let libDrag = null;
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-add]'); if (!b) return;
  libDrag = { type: b.dataset.add, x: e.clientX, y: e.clientY, moved: false };
});
document.addEventListener('pointermove', e => {
  if (!libDrag) return;
  if (!libDrag.moved && Math.hypot(e.clientX - libDrag.x, e.clientY - libDrag.y) > 8) { libDrag.moved = true; const g = $('#dragGhost'); g.textContent = TYPES[libDrag.type].name; g.hidden = false; }
  if (libDrag.moved) { const g = $('#dragGhost'); g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px'; }
});
document.addEventListener('pointerup', e => {
  if (!libDrag) return; const d = libDrag; libDrag = null; $('#dragGhost').hidden = true;
  let it = null;
  if (d.moved) { if (planContains(e.clientX, e.clientY)) { const [x, z] = planWorld(e.clientX, e.clientY); it = addItem(d.type, { x: Math.round(x * 20) / 20, z: Math.round(z * 20) / 20 }); } else return; }
  else it = addItem(d.type);
  if (it) { select(it.id); toast(TYPES[it.type].name + ' agregado. ' + (d.moved ? 'Ajustalo en Propiedades.' : 'Movelo en la planta o arrastralo desde la biblioteca.')); }
});

/* ---------- items list ---------- */
export function renderItems() {
  $('#items').innerHTML = S.items.map((it, i) => {
    const T = TYPES[it.type], col = E.isLight(it) ? (it.on ? E.colorHex(E.lightColor(it)) : '#444') : it.type === 'bounce' ? FACES[it.face].hex : T.cat === 'mueble' ? it.color : T.cat === 'grip' ? '#8d9096' : '#e8e4ee';
    return `<li data-id="${it.id}" class="${UI.sel === it.id ? 'sel' : ''}"><span class="dot" style="background:${col}"></span><span>${i + 1}. ${E.itemName(it)}</span>${E.isLight(it) ? `<button class="pw" data-pw="${it.id}" aria-pressed="${it.on}">${it.on ? 'ON' : 'OFF'}</button>` : '<span></span>'}</li>`;
  }).join('') || '<li class="note">Todavía no hay nada en el set. Agregá equipos arriba o elegí un esquema en Escena.</li>';
  $('#budget').textContent = `${lightCount()} de ${MAX_SHADOW_LIGHTS} luces con sombra en uso (el sol no cuenta).`;
}
$('#items').addEventListener('click', e => {
  const pw = e.target.closest('[data-pw]');
  if (pw) { const it = S.items.find(i => i.id === +pw.dataset.pw); it.on = !it.on; E.syncItem(it); renderItems(); renderProps(); return; }
  const li = e.target.closest('li[data-id]'); if (li) select(+li.dataset.id);
});

/* ---------- properties ---------- */
const rangeRow = (id, label, min, max, step, val, unit, dec = 0) => `<div class="f"><label for="${id}">${label}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><output id="${id}V">${fmt(+val, dec)}${unit}</output></div>`;
const segRow = (label, key, opts, cur) => `<div class="f"><span>${label}</span><div class="seg" data-key="${key}">${opts.map(([v, t]) => `<button data-v="${v}" aria-pressed="${String(v) === String(cur)}">${t}</button>`).join('')}</div></div>`;
export function renderProps(light) {
  const box = $('#props'), it = S.items.find(i => i.id === UI.sel);
  if (!it) {
    const P = S.people[UI.selPerson];
    box.dataset.id = '';
    box.innerHTML = `<h2>Propiedades</h2><p class="note">Seleccioná un equipo, mueble o abertura en la planta, en la lista de Equipos o en la vista Set 3D.</p>` +
      (P && P.on ? `<div class="meter"><span>Personaje ${UI.selPerson + 1}: <b>${({ sentado: 'sentado', pie: 'de pie', elevado: 'elevado' })[P.pose]}</b></span><span>Rotación <b>${Math.round(P.rot)}°</b></span></div><button class="btn" data-goto="personajes">Editar en Personajes</button>` : '');
    return;
  }
  if (light && box.dataset.id === String(it.id)) {
    updateReadouts(it);
    for (const k of ['y', 'yaw', 'pitch']) { const el = $('#p_' + k); if (el && document.activeElement !== el) { el.value = Math.round(it[k] * 100) / 100; $('#p_' + k + 'V').textContent = k === 'y' ? fmt(it.y, 2) + ' m' : fmt(it[k], 0) + '°'; } }
    return;
  }
  box.dataset.id = it.id;
  const T = TYPES[it.type]; let h = `<div class="head"><h3>${E.itemName(it)}</h3>${E.isLight(it) ? `<button class="btn" data-act="power" aria-pressed="${it.on}">${it.on ? 'Encendido' : 'Apagado'}</button>` : ''}</div><p class="desc">${T.desc}</p>`;
  if (E.isLight(it)) h += `<div class="meter" id="readout"></div>`;
  if (T.powers) h += segRow('Potencia', 'p', T.powers.map((w, i) => [i, w >= 1000 ? w / 1000 + 'K' : w]), it.p);
  if (T.practical && it.type !== 'vela') h += segRow('Lámpara', 'p', BULBS[T.bulbs].options.map(([w, lm], i) => [i, w + ' W']), it.p);
  if (T.practical && T.kelvins.length > 1) h += segRow('Temperatura', 'k', T.kelvins.map(k => [k, k + ' K']), it.k);
  if (T.practical) h += `<p class="note">${BULBS[T.bulbs].label} · ${BULBS[T.bulbs].options[it.p || 0][1]} lm</p>`;
  if (it.type === 'vela') h += segRow('Parpadeo', 'flicker', [[true, 'Sí'], [false, 'No']], it.flicker);
  if (E.isLight(it)) h += rangeRow('p_dim', 'Dimmer', 5, 100, 1, it.dim, '%');
  if (T.powers) h += rangeRow('p_focus', 'Spot ↔ Flood', 0, 1, 0.01, it.focus, '', 2);
  if (T.gel) h += segRow('Gel', 'gel', Object.keys(GEL).map(k => [k, k === 'none' ? 'Ninguno' : k.toUpperCase()]), it.gel);
  if (it.type === 'powerflo') h += segRow('Tubos', 'k', [[3200, '3200 K'], [5600, '5600 K']], it.k);
  if (T.rgb) { h += segRow('Modo', 'mode', [['temp', 'Temperatura'], ['rgb', 'Color RGB']], it.mode); h += it.mode === 'temp' ? rangeRow('p_k', 'Temperatura', 2700, 10000, 100, it.k, ' K') : `<div class="f"><label for="p_rgb">Color</label><input type="color" id="p_rgb" value="${it.rgb}"></div><p class="note" id="blackNote" ${E.isBlack(it.rgb) ? '' : 'hidden'}>El negro no es un color de luz: un LED en negro no emite nada. Para oscurecer, bajá el dimmer o usá una bandera.</p>`; }
  if (it.diff !== undefined && T.cat === 'luz') h += `<div class="f"><label for="p_diff">Difusión</label><select id="p_diff">${Object.entries(DIFF).map(([k, v]) => `<option value="${k}" ${k === it.diff ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div>`;
  if (T.grid) h += segRow('Grilla', 'grid', [['none', 'No'], [90, '90°'], [60, '60°'], [40, '40°']], it.grid);
  if (it.type === 'tube') h += segRow('Orientación', 'orient', [['v', 'Vertical'], ['h', 'Horizontal']], it.orient);
  if (it.type === 'flag') h += segRow('Tamaño', 'size', Object.keys(FLAG_SIZES).map(k => [k, k.replace('x', '×') + ' cm']), it.size);
  if (it.type === 'bounce') h += segRow('Cara', 'face', Object.entries(FACES).map(([k, v]) => [k, v.label]), it.face);
  if (it.type === 'riel') h += segRow('Largo', 'len', [1.2, 2.4, 3.6, 4.8, 6, 7.2, 9.6].map(v => [v, String(v).replace('.', ',') + ' m']), it.len);
  if (it.type === 'jib') { h += segRow('Brazo', 'len', [3, 4.5, 6, 9].map(v => [v, String(v).replace('.', ',') + ' m']), it.len); h += rangeRow('p_arm', 'Ángulo del brazo', -30, 60, 1, it.arm, '°'); }
  if (it.type === 'butterfly') { h += segRow('Marco', 'side', Object.entries(BUTTERFLY_SIZES).map(([k, v]) => [v, k + '×' + k]), it.side); h += segRow('Tela', 'face', Object.entries(BUTTERFLY_FACES), it.face); }
  if (it.type === 'applebox') { h += segRow('Tamaño', 'size', Object.entries(APPLE).map(([k, v]) => [k, v[3]]), it.size); h += segRow('Cantidad', 'count', [1, 2, 3, 4].map(v => [v, String(v)]), it.count); }
  if (it.type === 'tarima') h += segRow('Alto', 'h', [[0.2, '20 cm'], [0.4, '40 cm'], [0.6, '60 cm']], it.h);
  if (T.cat === 'mueble') h += `<div class="f"><label for="p_color">Color</label><select id="p_color">${Object.entries(WOODS).map(([k, v]) => `<option value="${k}" ${k === it.color ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`;
  if (T.cat === 'abertura') {
    h += rangeRow('p_w', 'Ancho', 0.6, 4, 0.05, it.w, ' m', 2) + rangeRow('p_h', 'Alto', 0.5, Math.min(2.6, S.env.room.h - 0.1), 0.05, it.h, ' m', 2);
    if (it.type === 'ventana') h += rangeRow('p_sill', 'Antepecho', 0, 1.5, 0.05, it.sill, ' m', 2);
    else h += rangeRow('p_open', 'Apertura', 0, 100, 5, it.open, '°');
    h += `<p class="note">Movela en la planta: se desliza por la pared más cercana.</p>`;
  } else {
    if (T.cat !== 'grip' || it.type === 'butterfly' || it.type === 'applebox') h += rangeRow('p_y', T.cat === 'mueble' || it.type === 'applebox' ? 'Elevación' : T.practical ? 'Altura de apoyo' : 'Altura', 0, T.cat === 'mueble' || it.type === 'applebox' ? 1.2 : it.type === 'butterfly' ? 6 : 4, 0.05, it.y, ' m', 2);
    h += rangeRow('p_yaw', 'Rotación', -180, 180, 1, it.yaw, '°');
    if ((T.cat === 'luz' || T.cat === 'control') && !(it.type === 'tube' && it.orient === 'v')) h += rangeRow('p_pitch', 'Inclinación', -85, 45, 1, it.pitch, '°');
    if (it.type === 'butterfly') h += rangeRow('p_pitch', 'Inclinación', -90, 90, 1, it.pitch, '°') + '<p class="note">−90°: horizontal sobre el actor, como un techo. 0°: vertical, como rebote o bandera gigante.</p>';
  }
  if (it.barn) h += `<p class="note">Viseras: 0° abiertas. Pasados los 30° cada hoja empieza a tapar el centro del haz.</p><div class="bd">${[['t', 'Arriba'], ['b', 'Abajo'], ['l', 'Izq.'], ['r', 'Der.']].map(([k, t]) => `<div class="f"><label for="p_b${k}">${t}</label><input type="range" id="p_b${k}" min="0" max="90" step="1" value="${it.barn[k]}"><output id="p_b${k}V">${it.barn[k]}°</output></div>`).join('')}</div>`;
  const two = S.people[1].on;
  h += `<div class="row">${T.cat === 'luz' || T.cat === 'control' ? `<button class="btn" data-act="aim">${two ? 'Apuntar al personaje 1' : 'Apuntar al sujeto'}</button>${two ? '<button class="btn" data-act="aim2">Apuntar al personaje 2</button>' : ''}` : ''}${T.cat !== 'abertura' ? '<button class="btn" data-act="dup">Duplicar</button>' : ''}<button class="btn" data-act="del">Quitar</button></div>`;
  box.innerHTML = h; updateReadouts(it);
}
function updateReadouts(it) {
  const r = $('#readout'); if (!r) return;
  E.updateLights();
  const P1 = S.people[0], P2 = S.people[1], Ea = E.illum(it, P1._head, null, true, 0), E2 = P2.on ? E.illum(it, P2._head, null, true, 1) : null;
  const T = Ea > 1 ? 2.8 * Math.sqrt(Ea / 215 * (ISOS[S.cam.iso] / 800) * E.shutterFactor()) : 0;
  const stop = TSTOPS.reduce((a, b) => Math.abs(Math.log(b / T)) < Math.abs(Math.log(a / T)) ? b : a, TSTOPS[0]);
  const hard = (TYPES[it.type].hard && (!it.diff || it.diff === 'none')) || it.type === 'bombita' || it.type === 'vela';
  r.innerHTML = `<span>${E2 != null ? 'Rostro 1' : 'En el rostro'} <b>${Ea < 1 ? (Ea > 0.05 ? Ea.toFixed(1) + ' lux' : '—') : Math.round(Ea) + ' lux'}</b></span>${E2 != null ? `<span>Rostro 2 <b>${E2 < 1 ? '—' : Math.round(E2) + ' lux'}</b></span>` : ''}<span>Diafragma sugerido <b>${Ea < 1 ? '—' : T > 22 ? '>T22' : T < 1.4 ? '<T1.4' : 'T' + stop}</b></span><span>Luz <b>${hard ? 'dura' : 'suave'}</b></span>${Ea < 1 && E.illum(it, P1._head, null) > 1 ? '<span class="tag warn">Bloqueada antes del rostro</span>' : ''}`;
}
$('#props').addEventListener('input', e => {
  const it = S.items.find(i => i.id === UI.sel); if (!it) return; const id = e.target.id, v = e.target.value, out = $('#' + id + 'V');
  const num = { p_dim: ['dim', '%', 0], p_focus: ['focus', '', 2], p_k: ['k', ' K', 0], p_y: ['y', ' m', 2], p_yaw: ['yaw', '°', 0], p_pitch: ['pitch', '°', 0], p_w: ['w', ' m', 2], p_h: ['h', ' m', 2], p_sill: ['sill', ' m', 2], p_open: ['open', '°', 0], p_arm: ['arm', '°', 0] }[id];
  if (num) { it[num[0]] = +v; if (out) out.textContent = fmt(+v, num[2]) + num[1]; if ((id === 'p_y' && TYPES[it.type].cat !== 'mueble' && !TYPES[it.type].practical) || id === 'p_arm') E.buildItem(it); }
  else if (id === 'p_rgb') { it.rgb = v; const bn = $('#blackNote'); if (bn) bn.hidden = !E.isBlack(v); }
  else if (id.startsWith('p_b')) { it.barn[id[3]] = +v; out.textContent = v + '°'; }
  else return;
  E.syncItem(it); updateReadouts(it); renderItems(); drawPlan();
});
$('#props').addEventListener('change', e => {
  const it = S.items.find(i => i.id === UI.sel); if (!it) return;
  if (e.target.id === 'p_diff') { it.diff = e.target.value; E.syncItem(it); renderProps(); }
  if (e.target.id === 'p_color') { it.color = e.target.value; E.buildItem(it); renderItems(); drawPlan(); }
});
$('#props').addEventListener('click', e => {
  const go = e.target.closest('[data-goto]'); if (go) { setTab(go.dataset.goto); return; }
  const it = S.items.find(i => i.id === UI.sel); if (!it) return;
  const seg = e.target.closest('.seg[data-key] button');
  if (seg) {
    const key = seg.parentElement.dataset.key, raw = seg.dataset.v, val = ['p', 'k', 'len', 'side', 'count', 'h'].includes(key) ? +raw : raw === 'true' ? true : raw === 'false' ? false : raw;
    it[key] = val; if (['p', 'orient', 'size', 'face', 'len', 'side', 'count', 'h'].includes(key)) E.buildItem(it); else E.syncItem(it);
    renderProps(); renderItems(); drawPlan(); return;
  }
  const act = e.target.closest('[data-act]'); if (!act) return; const a = act.dataset.act;
  if (a === 'power') { it.on = !it.on; E.syncItem(it); }
  if (a === 'aim') { aimAtSubject(it, 0); E.syncItem(it); toast('Apuntado a la cabeza del personaje 1.'); }
  if (a === 'aim2') { aimAtSubject(it, 1); E.syncItem(it); toast('Apuntado a la cabeza del personaje 2.'); }
  if (a === 'del') { E.removeItem(it); UI.sel = null; attachGizmo(); }
  if (a === 'dup') {
    if (E.isLight(it) && lightCount() >= MAX_SHADOW_LIGHTS) { toast(`Máximo ${MAX_SHADOW_LIGHTS} luces con sombra.`); return; }
    const c = JSON.parse(JSON.stringify(it, (k, v) => k === 'obj' || k === '_grp' ? undefined : v)); c.id = nextId(); c.x += 0.6; S.items.push(c); E.buildItem(c); UI.sel = c.id;
  }
  renderProps(); renderItems(); drawPlan(); req();
});

/* ---------- tabs ---------- */
export function setTab(t) { UI.tab = t; $$('#tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t)); $$('.tabpanel').forEach(p => p.hidden = p.dataset.panel !== t); try { localStorage.setItem('hapi-tab', t); } catch (_) {} }
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); });

/* ---------- scene panel ---------- */
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
$('#month').innerHTML = MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
$('#city').innerHTML = Object.entries(CITIES).map(([k, c]) => `<option value="${k}">${c.name}</option>`).join('');
export function syncScenePanel() {
  const env = S.env, m = env.mode;
  pressSeg('#envMode', 'm', m); pressSeg('#extKind', 'k', env.ext.kind);
  $$('[data-for]').forEach(p => { const f = p.dataset.for; p.hidden = f === 'natural' ? m === 'estudio' : f !== m; });
  $('#bgc').value = env.studio.color; setRange('bgd', env.studio.dist, v => v.toFixed(1) + ' m');
  setRange('rw', env.room.w, v => v.toFixed(1) + ' m'); setRange('rd', env.room.d, v => v.toFixed(1) + ' m'); setRange('rh', env.room.h, v => v.toFixed(2) + ' m');
  $('#rwall').value = env.room.wall; $('#rfloor').value = env.room.floor;
  const t = env.time; setRange('hour', t.hour, hourLabel); $('#month').value = t.month; $('#day').value = t.day; $('#city').value = t.city;
  $('#customLoc').hidden = t.city !== 'custom'; $('#lat').value = t.lat; $('#lon').value = t.lon; $('#tz').value = t.tz;
  setRange('north', t.north, v => v + '°'); setRange('amb', env.amb, v => v + ' lux');
  renderPresets(); updateSunInfo();
  $$('#libMueble [data-add="ventana"], #libMueble [data-add="puerta"]').forEach(b => b.disabled = m !== 'interior');
}
function setRange(id, v, show) { const el = $('#' + id); el.value = v; const o = $('#' + id + 'V'); if (o) o.textContent = show(+v); }
export function updateSunInfo() {
  if (S.env.mode === 'estudio') return;
  const t = S.env.time, p = sunPosition(t), dl = daylight(p.elev), noon = solarNoon(t);
  const card = ['norte', 'noreste', 'este', 'sudeste', 'sur', 'sudoeste', 'oeste', 'noroeste'][Math.round(p.az / 45) % 8];
  $('#sunInfo').innerHTML = `<span><b>${phaseName(p.elev)}</b></span><span>Sol a <b>${p.elev.toFixed(0)}°</b> de altura${p.elev > 0 ? `, desde el <b>${card}</b>` : ''}</span><span>Sol directo <b>${dl.sunLux >= 1000 ? Math.round(dl.sunLux / 1000) + ' mil' : Math.round(dl.sunLux)} lux</b> · cielo <b>${dl.skyLux >= 1000 ? Math.round(dl.skyLux / 1000) + ' mil' : dl.skyLux.toFixed(dl.skyLux < 10 ? 1 : 0)} lux</b></span><span>Mediodía solar <b>${hourLabel(noon.hour)}</b> a <b>${noon.elev.toFixed(0)}°</b></span>`;
  $('#hTime').textContent = `${hourLabel(t.hour)} · ${phaseName(p.elev)}`;
}
$('#envMode').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; setEnvMode(b.dataset.m); });
export function setEnvMode(m) {
  if (S.env.mode === m) return;
  if (m !== 'interior') { const ops = S.items.filter(i => TYPES[i.type].cat === 'abertura'); ops.forEach(o => S.items.splice(S.items.indexOf(o), 1)); }
  S.env.mode = m; PV.custom = false; S.env.amb = m === 'estudio' ? 1 : 0;
  if (m === 'interior') { const b = E.roomBounds(); if (S.cam.z > b.zF + 1.5) S.cam.z = Math.min(S.cam.z, b.zF + 1.2); }
  E.buildEnvironment(); syncScenePanel(); renderItems(); updateLensInfo(); drawPlan(); req();
}
$('#extKind').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.env.ext.kind = b.dataset.k; E.buildEnvironment(); syncScenePanel(); drawPlan(); });
const bindR = (id, fn, show) => { const el = $('#' + id), o = $('#' + id + 'V'); el.addEventListener('input', () => { fn(+el.value); if (o) o.textContent = show(+el.value); req(); drawPlan(); }); };
bindR('bgd', v => { S.env.studio.dist = v; E.buildEnvironment(); }, v => v.toFixed(1) + ' m');
$('#bgc').addEventListener('change', e => { S.env.studio.color = e.target.value; E.buildEnvironment(); drawPlan(); });
let roomT = 0; const roomRebuild = () => { clearTimeout(roomT); roomT = setTimeout(() => { S.items.filter(i => TYPES[i.type].cat === 'abertura').forEach(o => E.snapOpening(o, E.openingWorld(o).x, E.openingWorld(o).z)); E.buildEnvironment(); drawPlan(); }, 60); };
bindR('rw', v => { S.env.room.w = v; roomRebuild(); }, v => v.toFixed(1) + ' m');
bindR('rd', v => { S.env.room.d = v; roomRebuild(); }, v => v.toFixed(1) + ' m');
bindR('rh', v => { S.env.room.h = v; roomRebuild(); }, v => v.toFixed(2) + ' m');
$('#rwall').addEventListener('change', e => { S.env.room.wall = e.target.value; E.buildEnvironment(); });
$('#rfloor').addEventListener('change', e => { S.env.room.floor = e.target.value; E.buildEnvironment(); });
bindR('hour', v => { S.env.time.hour = v; updateSunInfo(); }, hourLabel);
bindR('north', v => { S.env.time.north = v; updateSunInfo(); }, v => v + '°');
bindR('amb', v => { S.env.amb = v; }, v => v + ' lux');
$('#month').addEventListener('change', e => { S.env.time.month = +e.target.value; updateSunInfo(); req(); drawPlan(); });
$('#day').addEventListener('change', e => { S.env.time.day = clamp(+e.target.value || 1, 1, 31); updateSunInfo(); req(); drawPlan(); });
$('#city').addEventListener('change', e => { const k = e.target.value, c = CITIES[k]; Object.assign(S.env.time, { city: k }); if (k !== 'custom') Object.assign(S.env.time, { lat: c.lat, lon: c.lon, tz: c.tz }); syncScenePanel(); req(); drawPlan(); });
for (const id of ['lat', 'lon', 'tz']) $('#' + id).addEventListener('change', e => { S.env.time[id] = +e.target.value; updateSunInfo(); req(); drawPlan(); });
$('#hourQuick').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const t = S.env.time, q = b.dataset.q;
  const H = { amanecer: () => findHour(t, 0, false), manana: () => findHour(t, 25, false), mediodia: () => solarNoon(t).hour, dorada: () => findHour(t, 5, true), azul: () => findHour(t, -4, true), noche: () => 22 }[q]();
  t.hour = Math.round(H * 12) / 12; syncScenePanel(); req(); drawPlan();
  toast(`${b.textContent}: ${hourLabel(t.hour)}`);
});

/* ---------- people ---------- */
const AP = () => S.people[UI.selPerson];
export function syncPersonUI() {
  const P = AP(), two = S.people[1].on;
  pressSeg('#ptab', 'i', UI.selPerson); $('#ptab button[data-i="1"]').disabled = !two;
  $('#p2toggle').textContent = two ? 'Quitar 2° personaje' : 'Agregar 2° personaje';
  pressSeg('#pose', 'pose', P.pose); $('#srot').value = ((P.rot + 540) % 360) - 180; $('#srotV').textContent = fmt(+$('#srot').value, 0) + '°';
  $$('#skin button').forEach((b, i) => b.setAttribute('aria-pressed', i === P.skin));
  for (const [sel, attr] of [['#frame', 'fr'], ['#focusMode', 'fm']]) $$(sel + ' button').forEach(b => { if (b.dataset[attr] !== 'p1' && b.dataset[attr] !== 'manual') b.disabled = !two; });
  if (!two && S.cam.frame !== 'p1') S.cam.frame = 'p1';
  if (!two && S.cam.fm === 'p2') S.cam.fm = 'p1';
  pressSeg('#frame', 'fr', S.cam.frame); pressSeg('#focusMode', 'fm', S.cam.fm);
}
$('#skin').innerHTML = SKINS.map((h, i) => `<button data-s="${i}" style="background:${h}" aria-label="Tono de piel ${i + 1}"></button>`).join('');
$('#skin').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; AP().skin = +b.dataset.s; E.buildPeople(); syncPersonUI(); drawPlan(); });
$('#ptab').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.disabled) selectPerson(+b.dataset.i); });
$('#p2toggle').addEventListener('click', () => {
  const P2 = S.people[1]; P2.on = !P2.on;
  if (P2.on) { const P1 = S.people[0]; P2.x = P1.x + 0.9; P2.z = P1.z - 0.4; P2.rot = -60; P1.rot = P1.rot || 40; UI.selPerson = 1; toast('Personaje 2 agregado. Con “Plano conjunto” la cámara encuadra a los dos.'); }
  else UI.selPerson = 0;
  E.buildPeople(); syncPersonUI(); updateLensInfo(); renderProps(); drawPlan();
});
$('#pose').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; AP().pose = b.dataset.pose; E.buildPeople(); syncPersonUI(); updateLensInfo(); drawPlan(); });
$('#rotq').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const P = AP(); P.rot = Math.round(Math.atan2(S.cam.x - P.x, S.cam.z - P.z) * R2D + +b.dataset.o); E.placePerson(P); syncPersonUI(); drawPlan(); });
bindR('srot', v => { AP().rot = v; E.placePerson(AP()); }, v => fmt(v, 0) + '°');

/* ---------- camera ---------- */
export function updateLensInfo() {
  E.placeCam();
  const L = LENSES[S.cam.lens], TG = E.camTarget(), d = Math.hypot(S.cam.x - TG.x, S.cam.z - TG.z);
  const hf = L.fish ? 137.5 : 2 * Math.atan(18 / L.f) * R2D, width = L.fish ? null : 2 * d * 18 / L.f;
  $('#lensinfo').innerHTML = `${L.label}: ángulo horizontal <b>${hf.toFixed(0)}°</b> · distancia <b>${d.toFixed(1)} m</b>${width ? ` · cuadro de <b>${width.toFixed(1)} m</b> de ancho` : ' · deforma las líneas rectas'}`;
  const fd = E.focusDist(), [n0, f0] = E.dofRange(fd);
  $('#focus').value = S.cam.fm === 'manual' ? S.cam.focus : Math.min(12, fd); $('#focusV').textContent = (S.cam.fm === 'manual' ? S.cam.focus : fd).toFixed(2) + ' m';
  $('#dofinfo').innerHTML = L.fish ? 'Con el ojo de pez casi todo queda en foco: la profundidad de campo no se simula con este lente.' : !S.cam.dof ? 'Profundidad de campo desactivada: todo se ve nítido.' :
    `Foco a <b>${fd.toFixed(2)} m</b> · zona nítida de <b>${n0.toFixed(2)} m</b> a <b>${isFinite(f0) ? f0.toFixed(2) + ' m' : 'infinito'}</b>${isFinite(f0) ? ` (<b>${f0 - n0 < 1 ? Math.round((f0 - n0) * 100) + ' cm' : (f0 - n0).toFixed(2) + ' m'}</b>)` : ''}.`;
  $('#hLens').textContent = L.label; $('#hT').textContent = 'T' + TSTOPS[S.cam.T] + (S.cam.nd ? ' · ND ' + S.cam.nd.toFixed(1) : ''); $('#hIso').textContent = 'ISO ' + ISOS[S.cam.iso];
  $('#hWb').textContent = 'WB ' + S.cam.wb + 'K'; $('#hFps').textContent = `${S.cam.fps} fps · ${S.cam.shutter}°`; $('#shutterV').textContent = `= 1/${Math.round(S.cam.fps * 360 / S.cam.shutter)} s`; $('#hFocus').textContent = S.cam.dof && !L.fish ? 'Foco ' + fd.toFixed(1) + ' m' : '';
  $('#hCam').textContent = `Cámara ${E.camHeight().toFixed(2)} m · ${({ normal: 'normal', picado: 'picado', contrapicado: 'contrapicado', holandes: 'holandés' })[S.cam.a]}${S.cam.tilt ? ' ' + (S.cam.tilt > 0 ? '+' : '−') + Math.abs(S.cam.tilt) + '°' : ''}`;
  if (S.env.mode === 'estudio') $('#hTime').textContent = '';
}
export function syncCamUI() {
  pressSeg('#lens', 'l', S.cam.lens); pressSeg('#camH', 'h', S.cam.h); pressSeg('#camA', 'a', S.cam.a); pressSeg('#nd', 'nd', S.cam.nd);
  setRange('hoff', S.cam.hOff, v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(0) + ' cm');
  setRange('tilt', S.cam.tilt, v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + '°');
  pressSeg('#shutter', 'sh', S.cam.shutter); pressSeg('#fps', 'fps', S.cam.fps);
  setRange('iris', S.cam.T, v => 'T' + TSTOPS[v]); setRange('iso', S.cam.iso, v => String(ISOS[v])); setRange('wb', S.cam.wb, v => v + ' K');
  $('#dof').checked = S.cam.dof; syncPersonUI(); updateLensInfo(); req();
}
let blkT = 0;
export function setLens(k) {
  if (S.cam.lens === k) return; S.cam.lens = k; pressSeg('#lens', 'l', k);
  const b = $('#blk'); b.textContent = 'Cambio de lente · ' + LENSES[k].label; b.classList.add('on'); clearTimeout(blkT);
  blkT = setTimeout(() => { b.classList.remove('on'); req(); }, 550); updateLensInfo(); drawPlan(); req();
}
$('#lens').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLens(b.dataset.l); });
$('#camH').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.cam.h = b.dataset.h; pressSeg('#camH', 'h', S.cam.h); updateLensInfo(); req(); });
$('#camA').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; S.cam.a = b.dataset.a; pressSeg('#camA', 'a', S.cam.a); updateLensInfo(); req(); });
$('#frame').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; S.cam.frame = b.dataset.fr; syncPersonUI(); updateLensInfo(); drawPlan(); req(); });
$('#focusMode').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; S.cam.fm = b.dataset.fm; if (S.cam.fm === 'manual') { E.placeCam(); S.cam.focus = Math.round(E.focusDist() * 20) / 20; } syncPersonUI(); updateLensInfo(); drawPlan(); req(); });
$('#nd').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.cam.nd = +b.dataset.nd; pressSeg('#nd', 'nd', S.cam.nd); updateLensInfo(); req(); });
$('#dof').addEventListener('change', e => { S.cam.dof = e.target.checked; updateLensInfo(); drawPlan(); req(); });
const bindC = (id, fn, show) => { const el = $('#' + id), o = $('#' + id + 'V'); el.addEventListener('input', () => { fn(+el.value); if (o) o.textContent = show(+el.value); updateLensInfo(); drawPlan(); req(); }); };
bindC('hoff', v => S.cam.hOff = v, v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(0) + ' cm');
bindC('tilt', v => S.cam.tilt = v, v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + '°');
bindC('iris', v => S.cam.T = v, v => 'T' + TSTOPS[v]);
bindC('iso', v => S.cam.iso = v, v => String(ISOS[v]));
$('#shutter').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.cam.shutter = +b.dataset.sh; pressSeg('#shutter', 'sh', S.cam.shutter); updateLensInfo(); req(); });
$('#fps').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.cam.fps = +b.dataset.fps; pressSeg('#fps', 'fps', S.cam.fps); updateLensInfo(); req(); });
bindC('wb', v => { S.cam.wb = v; S.items.forEach(E.syncItem); renderItems(); }, v => v + ' K');
bindC('focus', v => { S.cam.focus = v; if (S.cam.fm !== 'manual') { S.cam.fm = 'manual'; syncPersonUI(); } }, v => v.toFixed(2) + ' m');

/* incident metering */
export function meterFace(quiet) {
  E.updateLights();
  const P = S.cam.frame === 'p2' && S.people[1].on ? S.people[1] : S.people[0], pi = S.people.indexOf(P), H = P._head;
  // fuentes candidatas: equipos, sol, ventanas y rebotes → lux para una normal dada
  const srcs = [];
  for (const it of S.items) if (E.isLight(it) && it.on && it.obj) srcs.push(N => E.illum(it, H, N, true, pi));
  srcs.push(N => E.sunIllum(H, N, true, pi));
  for (const L of E.env.windowLights) {
    if (!(L.intensity > 0)) continue; const o = L.userData.op, wn = E.roomWalls()[o.wall].n, open = o.type === 'puerta' ? Math.sin((o.open || 0) * D2R) : 1;
    srcs.push(N => { const to = H.clone().sub(L.position), d2 = Math.max(0.2, to.lengthSq()); to.normalize(); const cw = Math.max(0, to.x * wn[0] + to.z * wn[1]), cf = N ? Math.max(0, -N.dot(to)) : 1; return L.intensity * o.w * o.h * open * cw * cf / d2; });
  }
  for (const b of S.items) if ((b.type === 'bounce' || b.type === 'butterfly') && b.obj && b.obj.bounceLight) {
    const L = b.obj.bounceLight;
    srcs.push(N => { const lp = L.getWorldPosition(new THREE.Vector3()), to = H.clone().sub(lp), d2 = Math.max(0.1, to.lengthSq()); to.normalize(); const dir = L.target.getWorldPosition(new THREE.Vector3()).sub(lp).normalize(); return dir.dot(to) > Math.cos(L.angle) ? L.intensity * (N ? Math.max(0, -N.dot(to)) : 1) / d2 : 0; });
  }
  const total = N => srcs.reduce((m, f) => m + f(N), 0) + E.ambientLux();
  const Ncam = new THREE.Vector3(S.cam.x - H.x, 0, S.cam.z - H.z).normalize();
  // dirección de la luz principal: la que más aporta sin normal
  let bestN = Ncam, bestE = total(Ncam);
  for (let a = 0; a < 360; a += 30) for (const el of [0, 35]) { const N = new THREE.Vector3(Math.sin(a * D2R) * Math.cos(el * D2R), Math.sin(el * D2R), Math.cos(a * D2R) * Math.cos(el * D2R)); if (N.dot(Ncam) < -0.2) continue; const v = total(N); if (v > bestE) { bestE = v; bestN = N; } }
  const Ex = (total(Ncam) + bestE) / 2; // domo apuntado entre la cámara y la luz principal
  if (Ex < 0.3) { if (!quiet) toast('Casi no llega luz al rostro: encendé o apuntá un equipo.'); return; }
  const isoF = ISOS[S.cam.iso] / 800 * E.shutterFactor(), Tn = 2.8 * Math.sqrt(Ex * isoF / 215 * Math.pow(2, -S.cam.nd / 0.3));
  let best = 0; TSTOPS.forEach((t, i) => { if (Math.abs(Math.log(t / Tn)) < Math.abs(Math.log(TSTOPS[best] / Tn))) best = i; });
  S.cam.T = best; setRange('iris', best, v => 'T' + TSTOPS[v]);
  const tip = Tn > 25 ? ' Sobra luz: bajá el ISO o agregá ND.' : Tn < 1.3 ? ' Falta luz: subí el ISO o sumá luz.' : '';
  $('#meterV').textContent = `${Ex >= 10 ? Math.round(Ex) : Ex.toFixed(1)} lux en el rostro${S.people[1].on ? ' del personaje ' + (pi + 1) : ''} → T${TSTOPS[best]}.${tip}`;
  updateLensInfo(); req();
}
$('#meter').addEventListener('click', () => meterFace(false));

/* ---------- camera move A → B ---------- */
const SNAP_KEYS = ['x', 'z', 'h', 'hOff', 'a', 'tilt', 'lens', 'frame', 'fm', 'focus'];
export function snapCam() { const s = {}; SNAP_KEYS.forEach(k => s[k] = S.cam[k]); s.hAbs = E.camHeight(); s.pitch = E.CAM_A[S.cam.a] + S.cam.tilt; s.roll = S.cam.a === 'holandes' ? 18 : 0; const t = E.camTarget(); s.target = { x: t.x, y: t.y, z: t.z }; return s; }
export function applySnap(s) { SNAP_KEYS.forEach(k => S.cam[k] = s[k]); syncCamUI(); drawPlan(); }
export function describeMove() {
  const A = S.move.A, B = S.move.B; if (!A || !B) return '';
  const T = A.target, rA = Math.hypot(A.x - T.x, A.z - T.z), rB = Math.hypot(B.x - T.x, B.z - T.z), d = Math.hypot(B.x - A.x, B.z - A.z);
  const dr = rB - rA, lat = Math.sqrt(Math.max(0, d * d - dr * dr)), dh = B.hAbs - A.hAbs, parts = [];
  if (Math.abs(dr) > 0.15 && Math.abs(dr) >= lat) parts.push(`${dr < 0 ? 'dolly in (se acerca)' : 'dolly out (se aleja)'} ${Math.abs(dr).toFixed(2)} m`);
  else if (lat > 0.15) { const aA = Math.atan2(A.x - T.x, A.z - T.z), aB = Math.atan2(B.x - T.x, B.z - T.z); let da = Math.abs(aB - aA) * R2D; if (da > 180) da = 360 - da; parts.push(da > 25 ? `travelling circular de ${da.toFixed(0)}° alrededor del sujeto` : `travelling lateral de ${lat.toFixed(2)} m`); }
  if (Math.abs(dh) > 0.05) parts.push(`${dh > 0 ? 'subida' : 'bajada'} de ${Math.round(Math.abs(dh) * 100)} cm (grúa)`);
  if (Math.abs(B.pitch - A.pitch) >= 3) parts.push(`tilt de ${B.pitch - A.pitch > 0 ? '+' : '−'}${Math.abs(B.pitch - A.pitch).toFixed(0)}°`);
  if (A.lens !== B.lens) parts.push(`cambio de lente ${LENSES[A.lens].label} → ${LENSES[B.lens].label}: con lentes fijos necesitás un corte`);
  return parts.length ? parts.join(' + ') : 'cámara fija (A y B son iguales)';
}
export const snapLabel = s => `${LENSES[s.lens].label} · a ${Math.hypot(s.x - s.target.x, s.z - s.target.z).toFixed(1)} m · altura ${s.hAbs.toFixed(2)} m`;
let playing = false;
export function refreshMove() {
  const A = S.move.A, B = S.move.B;
  $('#goA').disabled = !A; $('#goB').disabled = !B; $('#railAB').disabled = !(A && B); $('#playMove').disabled = !(A && B) || playing; $('#dlAB').disabled = !(A && B); $('#clearAB').disabled = !(A || B);
  $('#moveinfo').innerHTML = !A && !B ? 'Todavía no hay posiciones guardadas.' : `${A ? `<b>A</b> ${snapLabel(A)}` : 'A sin guardar'}<br>${B ? `<b>B</b> ${snapLabel(B)}` : 'B sin guardar'}${A && B ? `<br>Movimiento: <b>${describeMove()}</b>` : ''}`;
  drawPlan(); req();
}
$('#saveA').addEventListener('click', () => { S.move.A = snapCam(); refreshMove(); toast('Posición A guardada.'); });
$('#saveB').addEventListener('click', () => { S.move.B = snapCam(); refreshMove(); toast('Posición B guardada.'); });
$('#goA').addEventListener('click', () => applySnap(S.move.A));
$('#goB').addEventListener('click', () => applySnap(S.move.B));
$('#clearAB').addEventListener('click', () => { S.move.A = S.move.B = null; refreshMove(); });
$('#railAB').addEventListener('click', () => {
  const A = S.move.A, B = S.move.B; if (!A || !B) return;
  const d = Math.hypot(B.x - A.x, B.z - A.z); if (d < 0.3) { toast('A y B están en el mismo lugar: no hace falta riel.'); return; }
  const len = Math.min(9.6, Math.ceil((d + 1.2) / 1.2) * 1.2), yaw = Math.atan2(B.x - A.x, B.z - A.z) * R2D;
  const rail = defaults('riel'); Object.assign(rail, { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2, yaw, len }); S.items.push(rail); E.buildItem(rail);
  const dl = defaults('dolly'); Object.assign(dl, { x: A.x, z: A.z, yaw }); S.items.push(dl); E.buildItem(dl);
  renderItems(); drawPlan(); req(); toast(`Riel de ${len.toFixed(1).replace('.', ',')} m y carro agregados entre A y B.`);
});
$('#playMove').addEventListener('click', () => {
  const A = S.move.A, B = S.move.B; if (!A || !B || playing) return;
  playing = true; refreshMove(); setView('monitor'); applySnap(A);
  const dur = 1000 * clamp(Math.hypot(B.x - A.x, B.z - A.z) * 1.2 + Math.abs(B.hAbs - A.hAbs) * 2, 2.5, 7), t0 = performance.now(), l = (a, b, t) => a + (b - a) * t;
  const tA = new THREE.Vector3(A.target.x, A.target.y, A.target.z), tB = new THREE.Vector3(B.target.x, B.target.y, B.target.z);
  const step = now => {
    const t = clamp((now - t0) / dur, 0, 1), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    Object.assign(S.cam, { x: l(A.x, B.x, e), z: l(A.z, B.z, e), _hAbs: l(A.hAbs, B.hAbs, e), _pitch: l(A.pitch, B.pitch, e), _roll: l(A.roll, B.roll, e), _target: tA.clone().lerp(tB, e) });
    if (A.fm === 'manual' && B.fm === 'manual') S.cam.focus = l(A.focus, B.focus, e);
    updateLensInfo(); drawPlan(); req();
    if (t < 1) requestAnimationFrame(step);
    else { ['_hAbs', '_pitch', '_roll', '_target'].forEach(k => delete S.cam[k]); playing = false; if (A.lens !== B.lens) setLens(B.lens); applySnap(B); refreshMove(); }
  };
  requestAnimationFrame(step);
});

/* ---------- views ---------- */
export function setView(v) { UI.view = v; pressSeg('#vtabs', 'v', v); attachGizmo(); req(); }
$('#vtabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); });
$('#pip').addEventListener('change', e => { UI.pip = e.target.checked; req(); });
$('#thirdsChk').addEventListener('change', e => { $('#thirds').hidden = !e.target.checked; });
export function layoutHud() {
  const { mon, pip } = E.layout, hud = $('#hud'), pl = $('#pipl');
  hud.style.display = UI.view === 'monitor' ? '' : 'none';
  hud.classList.toggle('narrow', mon.w < 560);
  Object.assign(hud.style, { left: mon.x + 'px', top: mon.y + 'px', width: mon.w + 'px', height: mon.h + 'px' });
  pl.hidden = !UI.pip; Object.assign(pl.style, { left: (pip.x + 6) + 'px', top: (pip.y + 6) + 'px' });
  pl.textContent = UI.view === 'monitor' ? 'SET 3D' : 'MONITOR · ' + LENSES[S.cam.lens].label;
  $('#hint').hidden = UI.view !== 'set';
}
