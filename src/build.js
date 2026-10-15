// Geometría: personajes, equipos, mobiliario, prácticas.
import * as THREE from 'three';
import { TYPES, FLAG_SIZES, FACES, SKINS } from './catalog.js';

export const std = (hex, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.85, metalness: 0 }, o));
export function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; return m; }
export const cyl = (rt, rb, h, s = 16, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
export const sph = (r, s = 24) => new THREE.SphereGeometry(r, s, Math.round(s * 0.75));
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

export const MAT = {
  body: std('#1b1b1f', { roughness: 0.55, metalness: 0.4 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide }),
  flag: new THREE.MeshStandardMaterial({ color: '#0b0b0c', roughness: 1, side: THREE.DoubleSide }),
  dark: std('#2a2a2e', { roughness: 0.7 }),
  wood: std('#3a3530'),
  cloth1: std('#5f636b', { roughness: 0.9 }),
  cloth2: std('#6b5a4c', { roughness: 0.9 }),
  hair: std('#2a1f1a', { roughness: 0.8 }),
  eye: std('#e8e2da', { roughness: 0.3 }),
};
const skinMats = SKINS.map(h => std(h, { roughness: 0.6 }));

function limb(g, mat, a, b, r1, r2) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const m = mesh(cyl(r2, r1, len, 14), mat); m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); g.add(m);
  g.add(mesh(sph(r1, 12), mat, ...a)); g.add(mesh(sph(r2, 12), mat, ...b));
}

// Maniquí: devuelve { group, headY }
export function buildPersonMesh(P, idx) {
  const skin = skinMats[P.skin], cloth = idx === 0 ? MAT.cloth1 : MAT.cloth2;
  const g = new THREE.Group(), seated = P.pose === 'sentado', y0 = P.pose === 'elevado' ? 0.5 : 0;
  const hip = seated ? 0.5 : 0.92;
  if (P.pose === 'elevado') g.add(mesh(box(1.2, 0.5, 1.0), MAT.wood, 0, 0.25, 0));
  if (seated) { g.add(mesh(cyl(0.2, 0.2, 0.05, 24), MAT.wood, 0, 0.45, -0.05)); for (const [x, z] of [[-.13, -.16], [.13, -.16], [-.13, .08], [.13, .08]]) g.add(mesh(cyl(0.015, 0.015, 0.44, 8), MAT.dark, x, 0.22, z - 0.02)); }
  for (const s of [-1, 1]) {
    if (seated) { limb(g, cloth, [0.1 * s, y0 + hip, 0], [0.11 * s, y0 + hip, 0.42], 0.075, 0.06); limb(g, cloth, [0.11 * s, y0 + hip, 0.42], [0.11 * s, y0 + 0.06, 0.45], 0.058, 0.045); g.add(mesh(box(0.09, 0.06, 0.24), MAT.dark, 0.11 * s, y0 + 0.03, 0.5)); }
    else { limb(g, cloth, [0.1 * s, y0 + hip, 0], [0.1 * s, y0 + 0.48, 0.01], 0.075, 0.058); limb(g, cloth, [0.1 * s, y0 + 0.48, 0.01], [0.1 * s, y0 + 0.06, 0], 0.056, 0.045); g.add(mesh(box(0.09, 0.06, 0.24), MAT.dark, 0.1 * s, y0 + 0.03, 0.06)); }
  }
  const sh = y0 + hip + 0.55;
  g.add(mesh(cyl(0.19, 0.15, 0.58, 24), cloth, 0, y0 + hip + 0.27, 0, 1, 1, 0.62));
  g.add(mesh(sph(0.15, 20), cloth, 0, y0 + hip, 0, 1.05, 0.6, 0.7));
  for (const s of [-1, 1]) {
    g.add(mesh(sph(0.075, 14), cloth, 0.2 * s, sh, 0));
    if (seated) { limb(g, cloth, [0.21 * s, sh, 0], [0.23 * s, sh - 0.28, 0.1], 0.05, 0.042); limb(g, skin, [0.23 * s, sh - 0.28, 0.1], [0.14 * s, y0 + hip + 0.06, 0.34], 0.04, 0.032); g.add(mesh(sph(0.045, 12), skin, 0.13 * s, y0 + hip + 0.05, 0.38, 1, 0.7, 1.2)); }
    else { limb(g, cloth, [0.21 * s, sh, 0], [0.25 * s, sh - 0.3, 0], 0.05, 0.042); limb(g, skin, [0.25 * s, sh - 0.3, 0], [0.26 * s, sh - 0.56, 0.04], 0.04, 0.032); g.add(mesh(sph(0.045, 12), skin, 0.265 * s, sh - 0.63, 0.05, 0.8, 1.3, 1)); }
  }
  g.add(mesh(cyl(0.05, 0.058, 0.13, 16), skin, 0, sh + 0.07, 0));
  const hy = sh + 0.22;
  g.add(mesh(sph(0.112, 32), skin, 0, hy, 0, 0.86, 1.08, 0.98));
  g.add(mesh(sph(0.07, 20), skin, 0, hy - 0.08, 0.035, 0.95, 0.75, 0.9));
  const nose = mesh(new THREE.ConeGeometry(0.018, 0.052, 12), skin, 0, hy - 0.012, 0.112); nose.rotation.x = Math.PI / 2; g.add(nose);
  g.add(mesh(sph(0.03, 12), skin, 0, hy - 0.035, 0.11, 1, 0.6, 0.6));
  g.add(mesh(sph(0.1, 20), skin, 0, hy + 0.035, 0.03, 0.85, 0.32, 0.9));
  for (const s of [-1, 1]) { g.add(mesh(sph(0.016, 10), MAT.eye, 0.037 * s, hy + 0.005, 0.093)); g.add(mesh(sph(0.03, 12), skin, 0.098 * s, hy - 0.005, -0.005, 0.4, 1, 0.7)); }
  const hair = mesh(new THREE.SphereGeometry(0.119, 28, 14, 0, Math.PI * 2, 0, 1.25), MAT.hair, 0, hy + 0.012, -0.012, 0.9, 1.1, 1.02); hair.rotation.x = -0.45; g.add(hair);
  return { group: g, headY: hy };
}

export function standMesh(h, parent) {
  const s = new THREE.Group();
  s.add(mesh(cyl(0.016, 0.02, h, 8), MAT.body, 0, -h / 2, 0));
  for (let i = 0; i < 3; i++) { const a = i * 2.094; const l = mesh(box(0.02, 0.02, 0.5), MAT.body, Math.sin(a) * 0.22, -h + 0.08, Math.cos(a) * 0.22); l.rotation.y = a; l.rotation.x = 0.3; s.add(l); }
  parent.add(s); return s;
}

const basic = c => { const m = new THREE.MeshBasicMaterial({ color: c }); m.toneMapped = false; return m; };

// Construye la parte visible de un equipo dentro de "head"; devuelve datos de geometría.
export function buildFixture(it, head) {
  const T = TYPES[it.type], o = {};
  if (T.powers) {
    const R = (it.type === 'hmi' ? 0.11 : 0.08) + it.p * 0.025, len = R * 2.4;
    const body = mesh(cyl(R * 1.1, R * 1.25, len, 20), MAT.body, 0, 0, -len / 2); body.rotation.x = Math.PI / 2; head.add(body);
    if (it.type === 'hmi') head.add(mesh(box(R * 1.4, R * 0.8, len * 0.8), MAT.body, 0, R * 1.3, -len / 2));
    const lens = new THREE.Mesh(new THREE.CircleGeometry(R, 28), basic('#fff')); lens.position.z = 0.002; head.add(lens); o.emissive = lens.material;
    const yoke = mesh(new THREE.TorusGeometry(R * 1.35, 0.012, 6, 24, Math.PI), MAT.body, 0, 0, -len / 2); yoke.rotation.z = Math.PI; head.add(yoke);
    Object.assign(o, { w: R * 2, hgt: R * 2, leafL: R * 1.9 });
  } else if (it.type === 'powerflo') {
    const W = 1.2, H = 0.5; head.add(mesh(box(W, H, 0.1), MAT.body, 0, 0, -0.06));
    const tm = basic('#fff');
    for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(cyl(0.017, 0.017, W - 0.08, 10), tm); t.rotation.z = Math.PI / 2; t.position.set(0, -H / 2 + 0.08 + i * (H - 0.16) / 3, 0); head.add(t); }
    Object.assign(o, { emissive: tm, w: W, hgt: H, leafL: 0.3 });
  } else if (it.type === 'panel') {
    const W = 0.32; head.add(mesh(box(W, W, 0.05), MAT.body, 0, 0, -0.03));
    const f = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.03, W - 0.03), basic('#fff')); f.position.z = 0.002; head.add(f);
    Object.assign(o, { emissive: f.material, w: W, hgt: W, leafL: 0.18 });
  } else if (it.type === 'tube') {
    const tm = basic('#fff'), t = new THREE.Mesh(cyl(0.026, 0.026, 1.12, 14), tm); if (it.orient === 'h') t.rotation.z = Math.PI / 2; head.add(t); o.emissive = tm;
  }
  return o;
}

export function buildFlag(it, head) { const [w, h] = FLAG_SIZES[it.size]; head.add(mesh(box(w, h, 0.012), MAT.flag)); }

export function buildBounce(it, head) {
  const F = FACES[it.face], metal = it.face === 'silver' || it.face === 'gold';
  const mat = it.face === 'diff' ? new THREE.MeshStandardMaterial({ color: F.hex, transparent: true, opacity: 0.45, side: THREE.DoubleSide, roughness: 1 })
    : new THREE.MeshStandardMaterial({ color: F.hex, roughness: metal ? 0.35 : 0.9, metalness: metal ? 0.8 : 0, side: THREE.DoubleSide });
  const d = mesh(new THREE.CircleGeometry(0.535, 40), mat); head.add(d);
  head.add(mesh(new THREE.TorusGeometry(0.535, 0.008, 6, 48), MAT.body));
}

// Prácticas: devuelve { lightPos (local), emissive }
export function buildPractical(it, root) {
  const em = basic('#fff'), shadeMat = new THREE.MeshStandardMaterial({ color: '#efe3cc', roughness: 0.9, side: THREE.DoubleSide, emissive: '#000000' });
  const o = { emissive: em, shade: shadeMat };
  const bulb = r => { const b = new THREE.Mesh(sph(r, 14), em); b.castShadow = false; return b; };
  if (it.type === 'velador') {
    root.add(mesh(cyl(0.07, 0.09, 0.03, 20), MAT.dark, 0, 0.015, 0));
    root.add(mesh(cyl(0.012, 0.012, 0.32, 8), MAT.dark, 0, 0.18, 0));
    const b = bulb(0.03); b.position.y = 0.36; root.add(b);
    const sh = mesh(cyl(0.11, 0.17, 0.22, 28, true), shadeMat, 0, 0.4, 0); root.add(sh);
    o.lightY = 0.36;
  } else if (it.type === 'pie') {
    root.add(mesh(cyl(0.14, 0.16, 0.03, 20), MAT.dark, 0, 0.015, 0));
    root.add(mesh(cyl(0.013, 0.013, 1.45, 8), MAT.dark, 0, 0.74, 0));
    const b = bulb(0.035); b.position.y = 1.47; root.add(b);
    root.add(mesh(cyl(0.16, 0.24, 0.3, 30, true), shadeMat, 0, 1.52, 0));
    o.lightY = 1.47;
  } else if (it.type === 'colgante') {
    root.add(mesh(cyl(0.004, 0.004, 0.6, 6), MAT.dark, 0, 0.3, 0));
    const b = bulb(0.035); b.position.y = -0.06; root.add(b);
    const sh = mesh(new THREE.ConeGeometry(0.22, 0.2, 30, 1, true), shadeMat, 0, -0.02, 0); root.add(sh);
    o.lightY = -0.07;
  } else if (it.type === 'bombita') {
    root.add(mesh(cyl(0.003, 0.003, 0.5, 6), MAT.dark, 0, 0.27, 0));
    root.add(mesh(cyl(0.016, 0.016, 0.04, 10), MAT.dark, 0, 0.02, 0));
    const b = bulb(0.03); b.position.y = -0.03; b.scale.set(1, 1.25, 1); root.add(b);
    o.lightY = -0.03;
  } else if (it.type === 'vela') {
    root.add(mesh(cyl(0.035, 0.035, 0.15, 18), std('#efe8d8', { roughness: 0.6 }), 0, 0.075, 0));
    const fl = new THREE.Mesh(sph(0.012, 10), em); fl.scale.set(0.6, 1.8, 0.6); fl.position.y = 0.175; fl.castShadow = false; root.add(fl);
    o.lightY = 0.18;
  }
  return o;
}

// Mobiliario (origen en el piso, frente hacia +z)
export function buildFurniture(it, root) {
  const c = std(it.color || '#7a5634', { roughness: 0.7 }), fab = std(it.color || '#5a6b7a', { roughness: 0.95 });
  const T = TYPES[it.type];
  if (it.type === 'mesa' || it.type === 'escritorio') {
    const [w, h, d] = T.size; root.add(mesh(box(w, 0.04, d), c, 0, h - 0.02, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) root.add(mesh(box(0.05, h - 0.04, 0.05), c, sx * (w / 2 - 0.05), (h - 0.04) / 2, sz * (d / 2 - 0.05)));
    if (it.type === 'escritorio') root.add(mesh(box(0.4, 0.45, d - 0.06), c, w / 2 - 0.23, h - 0.27, 0));
  } else if (it.type === 'silla') {
    root.add(mesh(box(0.45, 0.04, 0.45), c, 0, 0.45, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) root.add(mesh(box(0.035, 0.45, 0.035), c, sx * 0.2, 0.225, sz * 0.2));
    root.add(mesh(box(0.45, 0.45, 0.03), c, 0, 0.7, -0.21));
  } else if (it.type === 'sillon') {
    root.add(mesh(box(1.9, 0.42, 0.85), fab, 0, 0.21, 0));
    root.add(mesh(box(1.9, 0.45, 0.2), fab, 0, 0.62, -0.33));
    for (const s of [-1, 1]) root.add(mesh(box(0.18, 0.25, 0.85), fab, s * 0.86, 0.53, 0));
  } else if (it.type === 'biblioteca') {
    root.add(mesh(box(1.0, 1.9, 0.03), c, 0, 0.95, -0.16));
    for (const s of [-1, 1]) root.add(mesh(box(0.03, 1.9, 0.35), c, s * 0.485, 0.95, 0));
    const bookCols = ['#7b2e2e', '#2e4a7b', '#c9a24a', '#3d6b47', '#d9d2c4', '#4a3b5c'];
    for (let i = 0; i < 5; i++) {
      root.add(mesh(box(0.94, 0.025, 0.33), c, 0, 0.02 + i * 0.45, 0));
      if (i < 4) { let x = -0.45; let k = i; while (x < 0.42) { const w = 0.03 + ((k * 37) % 5) * 0.008, h = 0.24 + ((k * 13) % 4) * 0.03; root.add(mesh(box(w, h, 0.22), std(bookCols[k % 6], { roughness: 0.8 }), x + w / 2, 0.035 + i * 0.45 + h / 2, 0.02)); x += w + 0.004; k++; } }
    }
  } else if (it.type === 'cama') {
    root.add(mesh(box(1.45, 0.3, 2.0), c, 0, 0.15, 0));
    root.add(mesh(box(1.4, 0.22, 1.95), std('#e9e6df', { roughness: 0.95 }), 0, 0.41, 0));
    root.add(mesh(box(1.45, 0.9, 0.06), c, 0, 0.45, -1.0));
    for (const s of [-1, 1]) root.add(mesh(box(0.55, 0.12, 0.35), std('#f2f0ea', { roughness: 0.95 }), s * 0.33, 0.58, -0.72));
  }
}

// Gripería (origen en el piso, frente hacia +z)
const GRIP = { metal: std('#8d9096', { roughness: 0.35, metalness: 0.8 }), black: std('#1d1d21', { roughness: 0.6, metalness: 0.3 }), wood: std('#b08a5a', { roughness: 0.8 }), rubber: std('#151515', { roughness: 0.9 }) };
export function buildGrip(it, root, head) {
  const M = GRIP;
  if (it.type === 'riel') {
    const L = it.len || 3.6;
    for (const s of [-1, 1]) { const r = mesh(cyl(0.02, 0.02, L, 10), M.metal, s * 0.31, 0.05, 0); r.rotation.x = Math.PI / 2; root.add(r); }
    for (let z = -L / 2 + 0.15; z <= L / 2 - 0.1; z += 0.6) root.add(mesh(box(0.75, 0.03, 0.08), M.wood, 0, 0.015, z));
  } else if (it.type === 'dolly') {
    root.add(mesh(box(0.75, 0.12, 1.1), M.black, 0, 0.14, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const w = mesh(cyl(0.06, 0.06, 0.05, 14), M.rubber, sx * 0.31, 0.07, sz * 0.42); w.rotation.z = Math.PI / 2; root.add(w); }
    root.add(mesh(cyl(0.06, 0.07, 0.7, 12), M.metal, 0, 0.55, 0.25));
    root.add(mesh(box(0.35, 0.05, 0.25), M.black, 0, 0.92, 0.25));
    root.add(mesh(box(0.5, 0.06, 0.3), M.black, 0, 0.23, -0.35));
  } else if (it.type === 'jib') {
    const L = it.len || 4.5, a = (it.arm || 15) * Math.PI / 180;
    for (let i = 0; i < 3; i++) { const t = i * 2.094, l = mesh(box(0.05, 0.05, 1.0), M.black, Math.sin(t) * 0.4, 0.45, Math.cos(t) * 0.4); l.rotation.y = t; l.rotation.x = 0.55; root.add(l); }
    root.add(mesh(cyl(0.06, 0.06, 1.2, 10), M.black, 0, 0.6, 0));
    const pivot = new THREE.Group(); pivot.position.y = 1.25; pivot.rotation.x = -a; root.add(pivot);
    const arm = mesh(box(0.12, 0.14, L + 1.2), M.metal, 0, 0, L / 2 - 0.6); pivot.add(arm);
    pivot.add(mesh(box(0.3, 0.3, 0.4), M.black, 0, -0.1, -1.0));
    const cam = mesh(box(0.16, 0.16, 0.25), M.black, 0, -0.18, L); pivot.add(cam);
  } else if (it.type === 'slider') {
    for (const z of [-0.6, 0.6]) { for (let i = 0; i < 3; i++) { const t = i * 2.094, l = mesh(box(0.025, 0.025, 1.0), M.black, Math.sin(t) * 0.18, 0.45, z + Math.cos(t) * 0.18); l.rotation.y = t; l.rotation.x = 0.2; root.add(l); } }
    for (const s of [-1, 1]) { const r = mesh(cyl(0.015, 0.015, 1.3, 8), M.metal, s * 0.05, 0.92, 0); r.rotation.x = Math.PI / 2; root.add(r); }
    root.add(mesh(box(0.15, 0.05, 0.15), M.black, 0, 0.96, 0));
  } else if (it.type === 'steadicam') {
    root.add(mesh(cyl(0.16, 0.13, 0.75, 14), M.black, 0, 1.15, 0, 1, 1, 0.7));
    root.add(mesh(new THREE.SphereGeometry(0.11, 14, 10), M.black, 0, 1.65, 0));
    for (const s of [-1, 1]) root.add(mesh(cyl(0.07, 0.06, 0.8, 10), M.black, s * 0.1, 0.4, 0));
    const armV = mesh(box(0.05, 0.05, 0.5), M.metal, 0.22, 1.1, 0.25); root.add(armV);
    root.add(mesh(cyl(0.015, 0.015, 0.7, 8), M.metal, 0.22, 1.0, 0.5));
    root.add(mesh(box(0.14, 0.14, 0.24), M.black, 0.22, 1.38, 0.5));
  } else if (it.type === 'tripode') {
    for (let i = 0; i < 3; i++) { const t = i * 2.094, l = mesh(box(0.03, 0.03, 1.45), M.black, Math.sin(t) * 0.28, 0.7, Math.cos(t) * 0.28); l.rotation.y = t; l.rotation.x = 0.4; root.add(l); }
    root.add(mesh(box(0.14, 0.12, 0.14), M.black, 0, 1.4, 0));
    root.add(mesh(box(0.15, 0.14, 0.24), M.black, 0, 1.53, 0));
    const ln = mesh(cyl(0.04, 0.045, 0.12, 12), M.rubber, 0, 1.53, 0.17); ln.rotation.x = Math.PI / 2; root.add(ln);
  } else if (it.type === 'applebox') {
    const [w, h, d] = { full: [0.51, 0.2, 0.3], half: [0.51, 0.1, 0.3], quarter: [0.51, 0.05, 0.3], pancake: [0.51, 0.025, 0.3] }[it.size || 'full'];
    for (let i = 0; i < (it.count || 1); i++) root.add(mesh(box(w, h, d), M.wood, 0, h / 2 + i * h, 0));
  } else if (it.type === 'tarima') {
    const h = it.h || 0.4; root.add(mesh(box(1.2, h, 2.4), M.wood, 0, h / 2, 0));
  } else if (it.type === 'escalera') {
    for (const s of [-1, 1]) for (const x of [-0.22, 0.22]) { const l = mesh(box(0.04, 1.85, 0.04), M.metal, x, 0.9, s * 0.3); l.rotation.x = s * 0.18; root.add(l); }
    for (let i = 1; i < 6; i++) root.add(mesh(box(0.44, 0.03, 0.1), M.metal, 0, i * 0.3, 0.3 - i * 0.05));
  } else if (it.type === 'bolsa') {
    root.add(mesh(new THREE.SphereGeometry(0.14, 12, 8), std('#5c5a3a', { roughness: 1 }), 0, 0.07, 0, 1.6, 0.5, 1));
  } else if (it.type === 'butterfly') {
    const s = it.side || 2.44, F = FACES[it.face] || FACES.diff, mat = it.face === 'diff' ? new THREE.MeshStandardMaterial({ color: '#f4f4f6', transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 1 }) : new THREE.MeshStandardMaterial({ color: F.hex, roughness: 0.95, side: THREE.DoubleSide });
    head.add(mesh(new THREE.PlaneGeometry(s, s), mat));
    for (const [x, y, w, h] of [[0, s / 2, s, 0.04], [0, -s / 2, s, 0.04], [s / 2, 0, 0.04, s], [-s / 2, 0, 0.04, s]]) head.add(mesh(box(w, h, 0.04), GRIP.metal, x, y, 0));
  }
}
