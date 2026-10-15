// Colisiones simples en planta (rectángulos orientados + rango de altura).
import { S, D2R, clamp } from './state.js';
import { TYPES, APPLE } from './catalog.js';

// Huella de un elemento: centro, medio ancho/profundidad, giro y rango de altura.
export function footprint(o) {
  if (o.pose) { // personaje
    const seated = o.pose === 'sentado';
    return { x: o.x, z: o.z + (seated ? 0.15 : 0), hw: 0.26, hd: seated ? 0.4 : 0.2, yaw: o.rot, y0: 0, y1: o.pose === 'elevado' ? 2.3 : 1.8, person: true };
  }
  const T = TYPES[o.type], y = o.y || 0;
  if (T.cat === 'abertura') return null;
  if (T.cat === 'mueble') { const [w, h, d] = T.size; return { x: o.x, z: o.z, hw: w / 2, hd: d / 2, yaw: o.yaw, y0: y, y1: y + h }; }
  if (T.practical) {
    const r = { velador: 0.17, pie: 0.24, colgante: 0.22, bombita: 0.05, vela: 0.05 }[o.type];
    const [a, b] = { velador: [0, 0.55], pie: [0, 1.7], colgante: [-0.25, 0.6], bombita: [-0.1, 0.55], vela: [0, 0.2] }[o.type];
    return { x: o.x, z: o.z, hw: r, hd: r, yaw: 0, y0: y + a, y1: y + b };
  }
  if (T.cat === 'luz' || T.cat === 'control' || o.type === 'butterfly') return { x: o.x, z: o.z, hw: 0.3, hd: 0.3, yaw: 0, y0: 0, y1: y + 0.4, stand: true };
  const g = {
    riel: [0.4, (o.len || 3.6) / 2, 0, 0.06], dolly: [0.38, 0.55, 0.06, 1.0], jib: [0.45, 0.45, 0, 1.4], slider: [0.25, 0.7, 0, 1.0],
    steadicam: [0.3, 0.3, 0, 1.8], tripode: [0.3, 0.3, 0, 1.6], tarima: [0.6, 1.2, 0, o.h || 0.4], escalera: [0.25, 0.4, 0, 1.85], bolsa: [0.22, 0.15, 0, 0.14],
  }[o.type];
  if (o.type === 'applebox') { const [w, h, d] = APPLE[o.size || 'full']; return { x: o.x, z: o.z, hw: w / 2, hd: d / 2, yaw: o.yaw, y0: y, y1: y + h * (o.count || 1) }; }
  if (!g) return null;
  return { x: o.x, z: o.z, hw: g[0], hd: g[1], yaw: o.yaw, y0: y + g[2], y1: y + g[3] };
}
function axes(f) { const a = (f.yaw || 0) * D2R; return [[Math.cos(a), -Math.sin(a)], [Math.sin(a), Math.cos(a)]]; }
function corners(f) { const [u, v] = axes(f); return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([s, t]) => [f.x + u[0] * f.hw * s + v[0] * f.hd * t, f.z + u[1] * f.hw * s + v[1] * f.hd * t]); }
function overlap2D(a, b) {
  const ca = corners(a), cb = corners(b);
  for (const ax of [...axes(a), ...axes(b)]) {
    const pa = ca.map(c => c[0] * ax[0] + c[1] * ax[1]), pb = cb.map(c => c[0] * ax[0] + c[1] * ax[1]);
    if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
  }
  return true;
}
// pares que sí pueden superponerse (sentarse, subirse, montar la cámara, etc.)
const SIT = new Set(['silla', 'sillon', 'cama', 'tarima', 'applebox']);
const ON_RAIL = new Set(['dolly', 'slider', 'tripode', 'steadicam']);
function allowed(a, b, fa, fb) {
  if (fa.person && b && SIT.has(b.type)) return true;
  if (fb.person && a && SIT.has(a.type)) return true;
  if (a && b && ((a.type === 'riel' && ON_RAIL.has(b.type)) || (b.type === 'riel' && ON_RAIL.has(a.type)))) return true;
  if (a && b && (a.type === 'bolsa' || b.type === 'bolsa')) return true;
  return false;
}
export function collides(obj, x, z, yaw) {
  const f = footprint({ ...obj, x, z, ...(obj.pose ? { rot: yaw ?? obj.rot } : { yaw: yaw ?? obj.yaw }) }); if (!f) return false;
  const others = [...S.items.filter(o => o !== obj), ...S.people.filter(P => P.on && P !== obj)];
  for (const o of others) {
    const g = footprint(o); if (!g) continue;
    if (!(f.y0 < g.y1 - 0.01 && g.y0 < f.y1 - 0.01)) continue;
    if (allowed(obj.pose ? null : obj, o.pose ? null : o, f, g)) continue;
    if (overlap2D(f, g)) return true;
  }
  return false;
}
// límites: dentro de la habitación en interiores
export function clampToRoom(obj, x, z, bounds) {
  if (S.env.mode !== 'interior' || !bounds) return [x, z];
  const f = footprint({ ...obj, x, z }); const r = f ? Math.max(f.hw, f.hd) * 0.7 : 0.1;
  return [clamp(x, bounds.x0 + r, bounds.x1 - r), clamp(z, bounds.zB + r, bounds.zF - r)];
}
// mueve hacia (x,z) deslizando si choca; devuelve la posición válida
export function resolveMove(obj, nx, nz, bounds) {
  [nx, nz] = clampToRoom(obj, nx, nz, bounds);
  if (!collides(obj, nx, nz)) return [nx, nz];
  if (!collides(obj, nx, obj.z)) return [nx, obj.z];
  if (!collides(obj, obj.x, nz)) return [obj.x, nz];
  return [obj.x, obj.z];
}
// busca un lugar libre cerca de (x,z)
export function freeSpot(obj, x, z, bounds) {
  for (let r = 0; r <= 3; r += 0.25) for (let a = 0; a < 360; a += r ? 30 : 360) {
    let px = x + Math.sin(a * D2R) * r, pz = z + Math.cos(a * D2R) * r;
    [px, pz] = clampToRoom(obj, px, pz, bounds);
    if (!collides(obj, px, pz)) return [Math.round(px * 20) / 20, Math.round(pz * 20) / 20];
  }
  return [x, z];
}
