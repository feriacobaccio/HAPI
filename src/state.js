// Estado global de HAPI y utilidades compartidas.
export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fmt = (v, d = 1) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
export const lerp = (a, b, t) => a + (b - a) * t;

export const TSTOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
export const ISOS = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
export const EXP_K = 0.11; // ISO 800: 215 lux a T2.8 ≈ gris medio
export const MAX_SHADOW_LIGHTS = 8;

function todayParts() { const d = new Date(); return { month: d.getMonth() + 1, day: d.getDate() }; }

export function defaultState() {
  const t = todayParts();
  return {
    name: 'Escena sin título',
    env: {
      mode: 'estudio',
      studio: { color: '#6d6d70', dist: 2.5 },
      room: { w: 7, d: 6, h: 2.7, wall: '#cdc6ba', floor: '#6e5a48' },
      ext: { kind: 'abierto' },
      time: { hour: 14, month: t.month, day: t.day, city: 'bsas', lat: -34.6, lon: -58.38, tz: -3, north: 0 },
      amb: 4,
    },
    items: [],
    people: [
      { x: 0, z: 0, pose: 'sentado', rot: 0, skin: 2, on: true },
      { x: 0.9, z: -0.5, pose: 'pie', rot: 0, skin: 4, on: false },
    ],
    cam: { x: 0, z: 3.4, h: 'normal', a: 'normal', tilt: 0, hOff: 0, lens: '50', T: 2, iso: 3, wb: 5600, nd: 0, frame: 'p1', dof: true, fm: 'p1', focus: 3.4 },
    move: { A: null, B: null },
  };
}

export const S = defaultState();
export const UI = { sel: null, selPerson: 0, view: 'monitor', pip: true, quality: 'media', tab: 'escena', present: false };
export let uidCounter = { v: 1 };
export const nextId = () => uidCounter.v++;

// render invalidation + simple event bus
let dirty = true;
export const req = () => { dirty = true; };
export const takeDirty = () => { const d = dirty; dirty = false; return d; };
const handlers = {};
export const on = (ev, fn) => (handlers[ev] = handlers[ev] || []).push(fn);
export const emit = (ev, ...a) => (handlers[ev] || []).forEach(f => f(...a));

let toastT = 0;
export function toast(t) {
  const el = $('#toast'); if (!el) return;
  el.textContent = t; el.classList.add('show'); clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 3400);
}
