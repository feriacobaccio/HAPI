// Esquemas de ejemplo por tipo de escena.
import { S, UI, $, req, toast } from './state.js';
import * as E from './engine.js';
import { addItem, aimAtSubject, syncScenePanel, syncCamUI, renderItems, renderProps, meterFace, refreshMove } from './ui.js';
import { findHour, solarNoon, sunPosition } from './sun.js';
import { drawPlan, PV } from './plan.js';

const P1 = () => S.people[0];
function base(mode, cam, person) {
  S.items.slice().forEach(it => E.removeItemObj(it)); S.items.length = 0;
  S.env.mode = mode; PV.custom = false;
  Object.assign(S.people[0], { x: 0, z: 0, rot: 0, pose: 'sentado' }, person || {}); S.people[1].on = false; UI.selPerson = 0; UI.sel = null;
  Object.assign(S.cam, { x: 0, z: 3.4, lens: '50', h: 'normal', a: 'normal', tilt: 0, hOff: 0, T: 2, iso: 3, nd: 0, frame: 'p1', fm: 'p1', wb: 5600 }, cam || {});
  S.move.A = S.move.B = null;
}
function aimPt(it, x, y, z) { E.aimAt(it, x, y, z); E.syncItem(it); }
export const PRESETS = {
  estudio: {
    'Tres puntos': () => {
      base('estudio', { wb: 3200 }); S.env.studio.color = '#6d6d70';
      E.buildEnvironment(); E.buildPeople();
      addItem('fresnel', { x: -1.8, z: 1.5, y: 2.1, p: 2, focus: 0.7, diff: 'q' });
      addItem('powerflo', { x: 1.9, z: 1.3, y: 1.5, dim: 35, k: 3200 });
      addItem('fresnel', { x: 1.1, z: -1.5, y: 2.5, p: 1, focus: 0.4, barn: { t: 15, b: 10, l: 0, r: 0 } });
    },
    'Clave baja': () => {
      base('estudio', { x: 0.4, z: 3, lens: '90', wb: 3200 }); S.env.studio.color = '#141414';
      E.buildEnvironment(); E.buildPeople();
      addItem('fresnel', { x: -1.5, z: 1.0, y: 2.2, p: 1, focus: 0.35, barn: { t: 12, b: 8, l: 0, r: 18 } });
      const f = addItem('flag', { x: -0.55, z: -0.75, y: 1.5, size: '60x90', yaw: 0 }); aimPt(f, -1.5, 1.5, 1.0); f.pitch = 0; E.syncItem(f);
      addItem('bounce', { x: 1.0, z: 0.4, y: 1.3, face: 'black' });
    },
    'Color': () => {
      base('estudio', { z: 3.6, h: 'bajo', a: 'contrapicado', T: 1 }, { pose: 'pie' }); S.env.studio.color = '#23324a';
      E.buildEnvironment(); E.buildPeople();
      addItem('tube', { x: -1.2, z: -0.6, y: 1.2, mode: 'rgb', rgb: '#ff2f9a' });
      addItem('tube', { x: 1.2, z: -0.6, y: 1.2, mode: 'rgb', rgb: '#23d7ff' });
      addItem('panel', { x: 0, z: -2.1, y: 0.5, mode: 'rgb', rgb: '#7b3cff', pitch: 10, yaw: 180 });
      addItem('panel', { x: 1.2, z: 1.8, y: 1.6, mode: 'temp', k: 5600, dim: 30, diff: 'full' });
    },
    'Vacío': () => { base('estudio'); E.buildEnvironment(); E.buildPeople(); },
  },
  interior: {
    'Ventana de mañana': () => {
      base('interior', { x: 0.6, z: 2.2, lens: '50' }, { x: 0, z: -0.6, rot: -60, pose: 'sentado' });
      Object.assign(S.env.room, { w: 6, d: 5.5, h: 2.7, wall: '#cdc6ba', floor: '#6e5a48' });
      Object.assign(S.env.time, { hour: 10 }); E.buildEnvironment();
      // ventana en la pared izquierda, orientada al este
      const b = E.roomBounds(); S.env.time.north = 90;
      addItem('ventana', { x: b.x0, z: -0.6, w: 1.8, h: 1.4, sill: 0.8 });
      E.buildPeople();
      addItem('mesa', { x: -0.9, z: -0.6, yaw: 90 });
      addItem('bounce', { x: 1.0, z: 0.1, y: 1.2, face: 'white' });
    },
    'Living de noche': () => {
      base('interior', { x: 0.3, z: 2.3, lens: '50', iso: 5, wb: 3200 }, { x: 0, z: -0.9, rot: 0, pose: 'sentado' });
      Object.assign(S.env.room, { w: 6.5, d: 6, h: 2.7, wall: '#8f9c8a', floor: '#6e5a48' });
      Object.assign(S.env.time, { hour: 22.5 }); E.buildEnvironment(); E.buildPeople();
      addItem('sillon', { x: 0, z: -1.55, yaw: 0 });
      addItem('mesa', { x: 1.6, z: -1.5, yaw: 0, color: '#3b2a1e' });
      addItem('velador', { x: 1.25, z: -1.5, y: 0.75, p: 2, k: 2700 });
      addItem('pie', { x: -1.4, z: -1.9, y: 0, p: 3, k: 3000 });
      addItem('biblioteca', { x: -2.4, z: -2.6, yaw: 0 });
      addItem('ventana', { x: 3.3, z: -0.8, w: 1.4, h: 1.4, sill: 0.9 });
    },
    'Vacío': () => { base('interior', { z: 2.2 }); E.buildEnvironment(); E.buildPeople(); },
  },
  exterior: {
    'Mediodía duro': () => {
      base('exterior', { z: 3.6, iso: 0 }, { pose: 'pie' }); S.env.ext.kind = 'abierto';
      const t = S.env.time; t.hour = Math.round(solarNoon(t).hour * 12) / 12; t.north = 0;
      E.buildEnvironment(); E.buildPeople();
    },
    'Hora dorada con rebote': () => {
      base('exterior', { z: 3.6, iso: 1, lens: '90' }, { pose: 'pie' }); S.env.ext.kind = 'abierto';
      const t = S.env.time; t.hour = Math.round(findHour(t, 7, true) * 12) / 12;
      const az = sunPosition(t).az; t.north = Math.round(((360 - az + 20) % 360) / 5) * 5; // sol detrás del personaje
      E.buildEnvironment(); E.buildPeople();
      addItem('bounce', { x: 0.7, z: 1.2, y: 1.2, face: 'gold' });
    },
    'Noche en la calle': () => {
      base('exterior', { z: 3.4, iso: 5, wb: 3200 }, { pose: 'pie', z: -2 }); S.env.ext.kind = 'calle';
      S.env.time.hour = 22.5; E.buildEnvironment(); E.buildPeople();
      addItem('bombita', { x: -1.2, z: -2.6, y: 2.6, p: 3 });
      addItem('panel', { x: 1.6, z: -0.6, y: 1.8, mode: 'rgb', rgb: '#4a7dff', dim: 40 });
    },
    'Vacío': () => { base('exterior', { iso: 0 }, { pose: 'pie' }); E.buildEnvironment(); E.buildPeople(); },
  },
};
export function applyPreset(mode, name) {
  PRESETS[mode][name]();
  syncScenePanel(); syncCamUI(); renderItems(); renderProps(); meterFace(true); refreshMove(); drawPlan(); req();
}
export function renderPresets() {
  const box = $('#presets'); const m = S.env.mode;
  box.innerHTML = '<span class="note" style="width:100%">Esquemas de ejemplo:</span>' + Object.keys(PRESETS[m]).map(n => `<button data-p="${n}">${n}</button>`).join('');
}
$('#presets').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (!b) return; applyPreset(S.env.mode, b.dataset.p); toast('Esquema cargado: ' + b.dataset.p + '.'); });
