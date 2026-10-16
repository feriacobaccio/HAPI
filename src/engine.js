// Motor 3D de HAPI: escena, entornos, equipos, luz y render.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { S, UI, D2R, R2D, clamp, TSTOPS, ISOS, EXP_K, req } from './state.js';
import { TYPES, DIFF, GRID, GEL, FACES, LENSES, BULBS, BUTTERFLY_FACES, APPLE, isLightType } from './catalog.js';
import { std, mesh, cyl, box, MAT, buildPersonMesh, standMesh, buildFixture, buildFlag, buildBounce, buildPractical, buildFurniture, buildGrip } from './build.js';
import { sunPosition, daylight, skyColors } from './sun.js';

RectAreaLightUniformsLib.init();

/* ---------- color ---------- */
export function kelvinRGB(k) {
  const t = k / 100; let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); b = 255; }
  return [clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255];
}
const lin = c => Math.pow(c, 2.2);
export const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
export const isBlack = h => Math.max(...hexRGB(h)) < 0.02;
// balance de blancos activo: el de la cámara, salvo durante el pase de la vista Set (adaptación propia)
let wbOverride = null;
const curWB = () => wbOverride ?? S.cam.wb;
function wbBalance(c) { const w = kelvinRGB(curWB()).map(lin); c = c.map((v, i) => v / w[i]); const m = Math.max(...c); return m > 1e-6 ? c.map(v => v / m) : [0, 0, 0]; }
export function kelvinColor(k) { return wbBalance(kelvinRGB(k).map(lin)); }
export function lightColor(it) {
  const T = TYPES[it.type];
  if ((it.type === 'tube' || it.type === 'panel') && it.mode === 'rgb') return wbBalance(hexRGB(it.rgb).map(lin));
  let k = T.kelvin || it.k || 2700; if (it.gel && it.gel !== 'none') k = GEL[it.gel].k;
  return kelvinColor(k);
}
export const colorHex = c => '#' + c.map(v => Math.round(255 * Math.pow(clamp(v, 0, 1), 1 / 2.2)).toString(16).padStart(2, '0')).join('');

/* ---------- renderer ---------- */
export const canvas = document.querySelector('#gl');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.autoClear = false;
export const QUALITY = { baja: { pr: 0.75, shadow: 512, dof: 16 }, media: { pr: 1, shadow: 1024, dof: 36 }, alta: { pr: 1.6, shadow: 2048, dof: 56 } };
export function applyQuality() {
  const q = QUALITY[UI.quality]; renderer.setPixelRatio(clamp((window.devicePixelRatio || 1) * q.pr, 0.6, 3));
  S.items.forEach(it => it.obj && it.obj.main && it.obj.main.shadow && setShadowSize(it.obj.main));
  setShadowSize(sun, 2); dofMat.defines.SAMPLES = q.dof; dofMat.needsUpdate = true; req();
}
function setShadowSize(L, mult = 1) {
  const q = QUALITY[UI.quality], s = L.isPointLight ? q.shadow / 2 : q.shadow * mult;
  if (L.shadow.mapSize.x !== s) { L.shadow.mapSize.set(s, s); if (L.shadow.map) { L.shadow.map.dispose(); L.shadow.map = null; } }
}

export const scene = new THREE.Scene();
const STUDIO_BG = new THREE.Color('#07060a');
export const hemi = new THREE.HemisphereLight(0xb8c0d0, 0x2a241e, 1); scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffffff, 0); sun.castShadow = true; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
scene.add(sun); scene.add(sun.target);

/* ---------- environment ---------- */
const envGroup = new THREE.Group(); scene.add(envGroup);
export const env = { walls: [], occluders: [], windowLights: [], bgMat: null };
const skyMat = new THREE.ShaderMaterial({
  uniforms: { hz: { value: new THREE.Vector3() }, ze: { value: new THREE.Vector3() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Vector3() }, ground: { value: new THREE.Vector3() } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform vec3 hz, ze, sunDir, sunCol, ground; varying vec3 vDir;
    void main(){ vec3 d = normalize(vDir); float y = d.y;
      vec3 c = y > 0.0 ? mix(hz, ze, pow(y, 0.45)) : mix(hz * 0.6, ground, clamp(-y * 8.0, 0.0, 1.0));
      float s = max(dot(d, sunDir), 0.0); c += sunCol * (pow(s, 900.0) * 60.0 + pow(s, 12.0) * 0.6) * step(-0.02, y);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  side: THREE.BackSide, depthWrite: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat); sky.castShadow = false; sky.receiveShadow = false;

export function roomBounds() { const r = S.env.room, zB = -r.d * 0.58; return { x0: -r.w / 2, x1: r.w / 2, zB, zF: zB + r.d, h: r.h }; }
export function roomWalls() {
  const b = roomBounds();
  const W = [[[b.x0, b.zB], [b.x1, b.zB]], [[b.x1, b.zB], [b.x1, b.zF]], [[b.x1, b.zF], [b.x0, b.zF]], [[b.x0, b.zF], [b.x0, b.zB]]];
  return W.map(([a, c], i) => {
    const dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz), dir = [dx / len, dz / len];
    return { i, a, b: c, len, dir, n: [-dir[1], dir[0]], center: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], rot: Math.atan2(-dir[1], dir[0]) };
  });
}
export function openingWorld(it) {
  const w = roomWalls()[it.wall]; return { x: w.center[0] + w.dir[0] * it.u, z: w.center[1] + w.dir[1] * it.u, y: it.sill + it.h / 2, wall: w };
}
export function snapOpening(it, x, z) {
  const walls = roomWalls(), others = S.items.filter(o => o !== it && (o.type === 'ventana' || o.type === 'puerta'));
  const ok = (wall, u) => { const w = walls[wall]; if (Math.abs(u) > w.len / 2 - it.w / 2 - 0.1 + 1e-6) return false; return !others.some(o => o.wall === wall && Math.abs(o.u - u) < (o.w + it.w) / 2 + 0.1); };
  const order = walls.map(w => { const px = x - w.center[0], pz = z - w.center[1]; return { w, u: px * w.dir[0] + pz * w.dir[1], d: Math.abs(px * w.n[0] + pz * w.n[1]) }; }).sort((a, b) => a.d - b.d);
  for (const { w, u } of order) {
    const lim = w.len / 2 - it.w / 2 - 0.1; if (lim < 0) continue;
    const u0 = clamp(u, -lim, lim);
    if (ok(w.i, u0)) { it.wall = w.i; it.u = u0; return true; }
    const cands = [];
    for (const o of others.filter(o => o.wall === w.i)) cands.push(o.u - (o.w + it.w) / 2 - 0.11, o.u + (o.w + it.w) / 2 + 0.11);
    const best = cands.filter(c => ok(w.i, c)).sort((a, b) => Math.abs(a - u0) - Math.abs(b - u0))[0];
    if (best !== undefined && Math.abs(best - u0) < 2.5) { it.wall = w.i; it.u = best; return true; }
  }
  return false;
}

function wallMat(hex) { const m = std(hex, { roughness: 0.92 }); m.shadowSide = THREE.DoubleSide; return m; }
export function buildEnvironment() {
  envGroup.clear(); env.walls = []; env.occluders = []; env.windowLights.forEach(l => l.dispose && l.dispose()); env.windowLights = [];
  const mode = S.env.mode;
  if (mode === 'estudio') {
    const floor = mesh(new THREE.PlaneGeometry(16, 16), std('#2b2830', { roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.castShadow = false; envGroup.add(floor);
    env.bgMat = std(S.env.studio.color, { roughness: 0.95 });
    const wall = mesh(new THREE.PlaneGeometry(9, 5.5), env.bgMat, 0, 2.75, -S.env.studio.dist); wall.castShadow = false; envGroup.add(wall);
    const sweep = mesh(new THREE.PlaneGeometry(9, 1.6), env.bgMat, 0, 0.004, -S.env.studio.dist + 0.8); sweep.rotation.x = -Math.PI / 2; sweep.castShadow = false; envGroup.add(sweep);
    env.floorY = 0;
  } else {
    envGroup.add(sky);
    const ext = S.env.ext.kind, gcol = mode === 'interior' ? '#55673f' : ext === 'calle' ? '#38383b' : ext === 'patio' ? '#8b8175' : '#4f6b3a';
    const ground = mesh(new THREE.PlaneGeometry(400, 400), std(gcol, { roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.002; ground.castShadow = false; envGroup.add(ground);
    env.groundCol = hexRGB(gcol).map(lin);
    if (mode === 'exterior' && ext === 'calle') {
      const walk = mesh(box(30, 0.15, 3), std('#77736d', { roughness: 0.95 }), 0, 0.075, -4.5); envGroup.add(walk); env.occluders.push(walk);
      const fac = mesh(box(30, 12, 0.4), std('#a69886', { roughness: 0.9 }), 0, 6, -6.2); envGroup.add(fac); env.occluders.push(fac);
      for (let i = -6; i <= 6; i++) for (let f = 0; f < 3; f++) { const w = mesh(box(1.1, 1.5, 0.1), std('#22262c', { roughness: 0.3, metalness: 0.3 }), i * 2.2, 2 + f * 3.4, -5.98); w.castShadow = false; envGroup.add(w); }
      const curb = mesh(box(30, 0.16, 0.2), std('#8c8780'), 0, 0.08, -2.95); envGroup.add(curb);
    } else if (mode === 'exterior' && ext === 'patio') {
      const wm = std('#c9bca8', { roughness: 0.92 });
      for (const [x, z, w, d] of [[0, -6, 12.4, 0.2], [0, 6, 12.4, 0.2], [-6.1, 0, 0.2, 12], [6.1, 0, 0.2, 12]]) { const m = mesh(box(w, 3, d), wm, x, 1.5, z); envGroup.add(m); env.occluders.push(m); }
    }
    if (mode === 'interior') buildRoom();
    env.floorY = 0;
  }
  placeSunCamera(); req();
}

function buildRoom() {
  const r = S.env.room, b = roomBounds(), wm = wallMat(r.wall);
  const floor = mesh(new THREE.PlaneGeometry(r.w, r.d), std(r.floor, { roughness: 0.8 }), 0, 0.001, (b.zB + b.zF) / 2); floor.rotation.x = -Math.PI / 2; floor.castShadow = false; envGroup.add(floor);
  const ceilM = wallMat('#e8e4dc'), ceil = mesh(new THREE.PlaneGeometry(r.w, r.d), ceilM, 0, r.h, (b.zB + b.zF) / 2); ceil.rotation.x = Math.PI / 2; envGroup.add(ceil); env.occluders.push(ceil);
  const ops = S.items.filter(i => i.type === 'ventana' || i.type === 'puerta');
  for (const w of roomWalls()) {
    const shape = new THREE.Shape(); shape.moveTo(-w.len / 2, 0); shape.lineTo(w.len / 2, 0); shape.lineTo(w.len / 2, r.h); shape.lineTo(-w.len / 2, r.h); shape.closePath();
    for (const o of ops.filter(o => o.wall === w.i)) {
      const h = new THREE.Path(), x0 = o.u - o.w / 2, x1 = o.u + o.w / 2, y0 = Math.max(o.sill, 0.001), y1 = Math.min(o.sill + o.h, r.h - 0.02);
      h.moveTo(x0, y0); h.lineTo(x0, y1); h.lineTo(x1, y1); h.lineTo(x1, y0); h.closePath(); shape.holes.push(h);
    }
    const m = mesh(new THREE.ShapeGeometry(shape), wm, w.center[0], 0, w.center[1]); m.rotation.y = w.rot; m.userData.wall = w.i;
    envGroup.add(m); env.walls.push(m); env.occluders.push(m);
    // zócalo
  }
  for (const o of ops) buildOpening(o);
}
const frameMat = std('#ece8e1', { roughness: 0.6 }), glassMat = new THREE.MeshStandardMaterial({ color: '#cfe6ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.12, depthWrite: false });
function buildOpening(o) {
  const p = openingWorld(o), g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = p.wall.rot; g.userData.id = o.id;
  const t = 0.06, fr = (w, h, x, y) => { const m = mesh(box(w, h, 0.12), frameMat, x, y, 0); m.userData.id = o.id; g.add(m); };
  fr(o.w + 2 * t, t, 0, o.sill + o.h + t / 2); if (o.type === 'ventana') fr(o.w + 2 * t, t, 0, o.sill - t / 2);
  fr(t, o.h, -o.w / 2 - t / 2, o.sill + o.h / 2); fr(t, o.h, o.w / 2 + t / 2, o.sill + o.h / 2);
  if (o.type === 'ventana') {
    fr(0.04, o.h, 0, o.sill + o.h / 2); fr(o.w, 0.04, 0, o.sill + o.h * 0.55);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), glassMat); gl.position.set(0, o.sill + o.h / 2, 0); gl.userData.id = o.id; g.add(gl);
  } else {
    const pivot = new THREE.Group(); pivot.position.set(-o.w / 2, 0, 0); pivot.rotation.y = -(o.open || 0) * D2R;
    const leaf = mesh(box(o.w, o.h, 0.04), std('#7a5634', { roughness: 0.7 }), o.w / 2, o.h / 2, 0.03); leaf.userData.id = o.id; pivot.add(leaf); g.add(pivot);
    env.occluders.push(leaf);
  }
  envGroup.add(g); o._grp = g;
  const L = new THREE.RectAreaLight(0xffffff, 0, o.w, o.h); L.position.set(p.x + p.wall.n[0] * 0.02, p.y, p.z + p.wall.n[1] * 0.02);
  L.lookAt(p.x + p.wall.n[0] * 2, p.y, p.z + p.wall.n[1] * 2); L.userData.op = o; envGroup.add(L); env.windowLights.push(L);
}
function placeSunCamera() {
  const ext = S.env.mode === 'interior' ? Math.max(S.env.room.w, S.env.room.d) / 2 + 2 : 11;
  const c = sun.shadow.camera; c.left = -ext; c.right = ext; c.top = ext; c.bottom = -ext; c.near = 1; c.far = 120; c.updateProjectionMatrix();
}
export function sunDirection() {
  const t = S.env.time, p = sunPosition(t), az = (p.az + t.north) * D2R, el = p.elev * D2R;
  return { dir: new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)), elev: p.elev, az: p.az };
}

/* ---------- people ---------- */
export const headWorld = new THREE.Vector3(0, 1.3, 0);
export function buildPeople() {
  S.people.forEach((P, i) => {
    if (P._grp) { scene.remove(P._grp); P._grp = null; }
    if (!P.on) return;
    const { group, headY } = buildPersonMesh(P, i);
    group.position.set(P.x, 0, P.z); group.rotation.y = P.rot * D2R; group.userData.person = i;
    group.traverse(m => { m.userData.person = i; });
    P._grp = group; P._eye = headY; P._head = new THREE.Vector3(P.x, headY, P.z); scene.add(group);
  });
  S.people.forEach(P => { if (!P._head) P._head = new THREE.Vector3(P.x, 1.3, P.z); });
  headWorld.copy(S.people[0]._head); req();
}
export function placePerson(P) { if (!P._grp) return; P._grp.position.set(P.x, 0, P.z); P._grp.rotation.y = P.rot * D2R; P._head.set(P.x, P._eye, P.z); headWorld.copy(S.people[0]._head); req(); }

/* ---------- items ---------- */
export const isLight = it => isLightType(it.type);
export function itemName(it) {
  const T = TYPES[it.type];
  if (T.powers) { const w = T.powers[it.p]; return `${T.name} ${w >= 1000 ? (w / 1000) + ' kW' : w + ' W'}`; }
  if (T.practical) { const b = BULBS[T.bulbs].options[it.p || 0]; return it.type === 'vela' ? 'Vela' : `${T.name} ${b[0]} W ${BULBS[T.bulbs].label.toLowerCase()}`; }
  if (it.type === 'bounce') return `Rebote · ${FACES[it.face].label.toLowerCase()}`;
  if (it.type === 'butterfly') { const ft = Math.round((it.side || 2.44) / 0.3048); return `Butterfly ${ft}×${ft} · ${BUTTERFLY_FACES[it.face].toLowerCase()}`; }
  if (it.type === 'riel') return `Riel ${(it.len || 3.6).toFixed(1)} m`;
  if (it.type === 'jib') return `Jimmy jib ${(it.len || 4.5).toFixed(1)} m`;
  if (it.type === 'applebox') return `Cajón de manzana ${APPLE[it.size || 'full'][3].toLowerCase()}${(it.count || 1) > 1 ? ' ×' + it.count : ''}`;
  if (it.type === 'tarima') return `Tarima ${Math.round((it.h || 0.4) * 100)} cm`;
  if (it.type === 'flag') return `Bandera ${it.size.replace('x', '×')}`;
  return T.name;
}
export function beamHalf(it) {
  const T = TYPES[it.type];
  let deg = T.powers ? T.beam[0] + (T.beam[1] - T.beam[0]) * it.focus : T.beamDeg || 180;
  if (it.grid && it.grid !== 'none') deg = Math.min(deg, GRID[it.grid]);
  if (it.diff && it.diff !== 'none') deg += DIFF[it.diff].a;
  return Math.min(deg / 2, 75) * D2R;
}
export function lumens(it) {
  const T = TYPES[it.type];
  if (T.powers) return T.powers[it.p] * T.eff;
  if (T.practical) return BULBS[T.bulbs].options[it.p || 0][1];
  return T.lm;
}
export function candela(it) {
  const T = TYPES[it.type]; if (!it.on) return 0;
  let lm = lumens(it), eff = 0.7;
  if (T.powers) eff = 0.12 + 0.28 * it.focus;
  if (it.type === 'powerflo') eff = 0.5;
  lm *= (it.dim / 100) * (it.diff ? DIFF[it.diff].f : 1) * (it.gel ? GEL[it.gel].f : 1) * (it.grid && it.grid !== 'none' ? 0.7 : 1);
  if (T.point) return lm / (4 * Math.PI);
  return lm * eff / (2 * Math.PI * (1 - Math.cos(beamHalf(it))));
}
function softness(it) {
  const T = TYPES[it.type]; let r = T.hard ? 1.2 : it.type === 'powerflo' ? 14 : it.type === 'tube' ? 10 : T.practical ? (it.type === 'bombita' || it.type === 'vela' ? 1.5 : 3) : 6;
  if (it.diff) r += DIFF[it.diff].r; return r;
}

export function buildItem(it) {
  removeItemObj(it);
  const T = TYPES[it.type];
  if (T.cat === 'abertura') { it.obj = { root: null, lights: [] }; buildEnvironment(); return; }
  const root = new THREE.Group(), head = new THREE.Group(); root.add(head); root.userData.id = it.id;
  const o = { root, head, lights: [], leaves: {} };
  if (T.cat === 'luz' || T.cat === 'control') standMesh(it.y, root);
  if (T.cat === 'luz') Object.assign(o, buildFixture(it, head));
  else if (it.type === 'flag') buildFlag(it, head);
  else if (it.type === 'bounce') {
    buildBounce(it, head);
    if (it.face !== 'black') {
      const bl = new THREE.SpotLight(0xffffff, 0, 0, FACES[it.face].ang / 2 * D2R, 1, 2); bl.position.set(0, 0, 0.06); bl.castShadow = it.face === 'diff';
      if (bl.castShadow) { setShadowSize(bl); bl.shadow.radius = 16; bl.shadow.camera.near = 0.08; bl.shadow.bias = -0.0005; }
      const tg = new THREE.Object3D(); tg.position.set(0, 0, 3); head.add(tg); bl.target = tg; head.add(bl); o.bounceLight = bl; o.bounceTarget = tg; o.lights.push(bl);
    }
  } else if (T.practical) Object.assign(o, buildPractical(it, head));
  else if (T.cat === 'grip') {
    if (it.type === 'butterfly') standMesh(it.y, root);
    buildGrip(it, root, head);
    if (it.type === 'butterfly' && it.face !== 'black') {
      const bl = new THREE.SpotLight(0xffffff, 0, 0, (it.face === 'diff' ? 80 : 75) / 2 * D2R, 1, 2); bl.position.set(0, 0, 0.06); bl.castShadow = it.face === 'diff';
      if (bl.castShadow) { setShadowSize(bl); bl.shadow.radius = 20; bl.shadow.camera.near = 0.1; bl.shadow.bias = -0.0005; }
      const tg = new THREE.Object3D(); tg.position.set(0, 0, 3); head.add(tg); bl.target = tg; head.add(bl); o.bounceLight = bl; o.bounceTarget = tg; o.lights.push(bl);
    }
  }
  else if (T.cat === 'mueble') buildFurniture(it, head);
  if (isLight(it)) {
    let L;
    if (T.point) { L = new THREE.PointLight(0xffffff, 1, 0, 2); L.shadow.camera.near = T.practical ? 0.04 : 0.05; L.shadow.bias = -0.002; if (T.practical) L.position.y = o.lightY; }
    else {
      L = new THREE.SpotLight(0xffffff, 1, 0, 0.5, 0.3, 2); L.position.set(0, 0, -0.01);
      const tg = new THREE.Object3D(); tg.position.set(0, 0, 4); head.add(tg); L.target = tg;
      L.shadow.camera.near = 0.03; L.shadow.bias = -0.0004;
    }
    setShadowSize(L); L.castShadow = true; head.add(L); o.main = L; o.lights.push(L);
    if (it.barn) {
      for (const k of ['t', 'b', 'l', 'r']) {
        const pv = new THREE.Group(), horiz = k === 't' || k === 'b', w = horiz ? o.w * 1.05 : o.hgt * 1.05, len = o.leafL;
        const leaf = mesh(new THREE.PlaneGeometry(w, len), MAT.leaf, 0, 0, len / 2);
        if (horiz) leaf.rotation.x = Math.PI / 2; else { leaf.rotation.y = Math.PI / 2; leaf.rotation.z = Math.PI / 2; }
        pv.add(leaf);
        pv.position.set(k === 'l' ? -o.w / 2 : k === 'r' ? o.w / 2 : 0, k === 't' ? o.hgt / 2 : k === 'b' ? -o.hgt / 2 : 0, 0.01);
        head.add(pv); o.leaves[k] = pv;
      }
    }
    if (it.diff !== undefined && T.cat === 'luz') {
      const dm = new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.35, side: THREE.DoubleSide }); dm.toneMapped = false;
      const dp = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), dm); dp.position.z = it.type === 'panel' ? 0.25 : 0.45; dp.castShadow = false; head.add(dp); o.diffPlane = dp;
    }
  }
  root.traverse(m => { if (m.isMesh) { m.userData.id = it.id; if (m.material && m.material.isMeshBasicMaterial) m.castShadow = false; } });
  it.obj = o; scene.add(root); syncItem(it);
}
export function removeItemObj(it) {
  if (!it.obj) return;
  if (it.obj.root) scene.remove(it.obj.root);
  it.obj.lights.forEach(l => { if (l.shadow && l.shadow.map) l.shadow.map.dispose(); });
  it.obj = null;
}
export function removeItem(it) {
  removeItemObj(it); S.items.splice(S.items.indexOf(it), 1);
  if (TYPES[it.type].cat === 'abertura') buildEnvironment();
  req();
}
export function syncItem(it) {
  const o = it.obj, T = TYPES[it.type]; if (!o) return;
  if (T.cat === 'abertura') { buildEnvironment(); return; }
  o.root.position.set(it.x, it.y, it.z); o.root.rotation.y = it.yaw * D2R;
  o.head.rotation.x = ((T.cat === 'luz' || T.cat === 'control') && !(it.type === 'tube' && it.orient === 'v')) || it.type === 'butterfly' ? -it.pitch * D2R : 0;
  if (o.leaves.t) { const b = it.barn; o.leaves.t.rotation.x = b.t * D2R; o.leaves.b.rotation.x = -b.b * D2R; o.leaves.l.rotation.y = b.l * D2R; o.leaves.r.rotation.y = -b.r * D2R; }
  if (o.diffPlane) { o.diffPlane.visible = it.diff !== 'none'; const s = it.diff === 'box' ? 1.4 : 1; o.diffPlane.scale.set(s, s, 1); o.diffPlane.material.opacity = it.diff === 'box' ? 0.8 : 0.3; }
  refreshEmissive(it);
  req();
}
function refreshEmissive(it) {
  const o = it.obj, T = TYPES[it.type]; if (!o || !isLight(it) || !o.emissive) return;
  const c = lightColor(it), col = new THREE.Color(c[0], c[1], c[2]);
  o.emissive.color.copy(it.on ? col.multiplyScalar(T.practical ? 2.5 : 1.4) : new THREE.Color('#222'));
}
export function aimAt(it, x, y, z) { const dx = x - it.x, dz = z - it.z, dy = y - it.y; it.yaw = Math.atan2(dx, dz) * R2D; it.pitch = Math.atan2(dy, Math.hypot(dx, dz)) * R2D; }

/* ---------- light evaluation ---------- */
const occRay = new THREE.Raycaster();
function occluderMeshes(excludePerson) {
  const occ = [...env.occluders];
  S.items.forEach(o => o.obj && o.obj.root && o.obj.root.traverse(m => { if (m.isMesh && m.castShadow) occ.push(m); }));
  S.people.forEach((P, i) => { if (P._grp && i !== excludePerson) P._grp.traverse(m => { if (m.isMesh) occ.push(m); }); });
  return occ;
}
function blocked(P, toPos, dist, excludePerson) {
  const dir = toPos.clone().sub(P), d = dist ?? dir.length(); dir.normalize();
  occRay.set(P.clone().addScaledVector(dir, 0.16), dir); occRay.far = d - 0.2;
  return occRay.intersectObjects(occluderMeshes(excludePerson), false).length > 0;
}
const tmpQ = new THREE.Quaternion();
function worldDir(obj) { return new THREE.Vector3(0, 0, 1).applyQuaternion(obj.getWorldQuaternion(tmpQ)); }
// lux en el punto P (normal N opcional) de una luz
export function illum(it, P, N, occ, personIdx) {
  const L = it.obj && it.obj.main; if (!L || !it.on) return 0;
  const lp = L.getWorldPosition(new THREE.Vector3()), to = P.clone().sub(lp), d2 = Math.max(0.04, to.lengthSq()); to.normalize();
  let cone = 1;
  if (L.isSpotLight) {
    const dir = L.target.getWorldPosition(new THREE.Vector3()).sub(lp).normalize(), c = dir.dot(to);
    const outer = Math.cos(L.angle), inner = Math.cos(L.angle * (1 - L.penumbra));
    cone = c <= outer ? 0 : c >= inner ? 1 : (c - outer) / (inner - outer);
  }
  const cosI = N ? Math.max(0, -N.dot(to)) : 1;
  if (occ && cone * cosI > 0 && blocked(P, lp, null, personIdx)) return 0;
  return L.intensity * cone * cosI / d2;
}
export function sunIllum(P, N, occ, personIdx) {
  if (S.env.mode === 'estudio' || sun.intensity <= 0) return 0;
  const d = sunDirection().dir, cosI = N ? Math.max(0, N.dot(d)) : 1;
  if (cosI <= 0) return 0;
  if (occ && blocked(P, P.clone().addScaledVector(d, 60), 60, personIdx)) return 0;
  return sun.intensity * cosI;
}
export function ambientLux() { return hemi.intensity * 0.5; }

export const nat = { elev: 0, az: 0, sunLux: 0, skyLux: 0 };
export function updateLights() {
  scene.updateMatrixWorld(true);
  // daylight
  if (S.env.mode !== 'estudio') {
    const sd = sunDirection(), dl = daylight(sd.elev); Object.assign(nat, { elev: sd.elev, az: sd.az, sunLux: dl.sunLux, skyLux: dl.skyLux });
    sun.position.copy(sd.dir).multiplyScalar(60); sun.target.position.set(0, 0, 0);
    sun.intensity = dl.sunLux; const sc = kelvinColor(dl.sunK); sun.color.setRGB(...sc); sun.visible = dl.sunLux > 0;
    const skc = kelvinColor(dl.skyK), cols = skyColors(sd.elev), wb = kelvinRGB(curWB()).map(lin), wmax = Math.max(...wb.map(v => 1 / v));
    const fix = c => c.map((v, i) => v / wb[i] / wmax);
    const Lsky = dl.skyLux / Math.PI * 1.15;
    skyMat.uniforms.hz.value.set(...fix(cols.hz).map(v => v * Lsky)); skyMat.uniforms.ze.value.set(...fix(cols.ze).map(v => v * Lsky * 0.9));
    skyMat.uniforms.sunDir.value.copy(sd.dir); skyMat.uniforms.sunCol.value.set(...sc.map(v => v * dl.sunLux / 30));
    skyMat.uniforms.ground.value.set(...env.groundCol.map(v => v * (dl.skyLux + dl.sunLux * Math.max(0, sd.dir.y)) * 0.08 / Math.PI));
    if (S.env.mode === 'exterior') {
      hemi.color.setRGB(...skc); hemi.groundColor.setRGB(...env.groundCol.map(v => v * 0.35 / Math.max(...env.groundCol)));
      hemi.intensity = dl.skyLux * 0.9 + S.env.amb;
    } else {
      // interior: luz de ventanas + rebote general estimado
      let flux = 0; const r = S.env.room;
      for (const L of env.windowLights) {
        const o = L.userData.op, open = o.type === 'puerta' ? Math.sin((o.open || 0) * D2R) : 1, area = o.w * o.h * open;
        const wn = roomWalls()[o.wall].n, sunIn = Math.max(0, -(wn[0] * sd.dir.x + wn[1] * sd.dir.z));
        const lum = (dl.skyLux / Math.PI) * 0.55 * open + dl.sunLux * sunIn * 0.04 * open;
        L.intensity = lum; L.color.setRGB(...skc); flux += area * lum * Math.PI + area * dl.sunLux * sunIn * Math.max(sd.dir.y, 0) * 0.6 * open;
      }
      const indirect = flux * 0.35 / (r.w * r.d + 2 * r.h * (r.w + r.d));
      hemi.color.setRGB(1, 0.97, 0.92); hemi.groundColor.setRGB(0.55, 0.47, 0.4);
      hemi.intensity = indirect + S.env.amb;
    }
  } else {
    sun.visible = false; sun.intensity = 0; hemi.color.set(0xb8c0d0); hemi.groundColor.set(0x2a241e); hemi.intensity = S.env.amb;
  }
  // fixtures and practicals
  for (const it of S.items) {
    if (!isLight(it) || !it.obj) continue;
    const L = it.obj.main, T = TYPES[it.type], c = lightColor(it);
    L.color.setRGB(c[0], c[1], c[2]); L.intensity = candela(it); L.visible = it.on; refreshEmissive(it);
    L.shadow.radius = softness(it);
    if (L.isSpotLight) { L.angle = beamHalf(it); L.penumbra = T.hard && (!it.diff || it.diff === 'none') ? 0.25 : 1; }
    if (T.practical && it.obj.shade) {
      const shadeL = it.on ? lumens(it) * (it.dim / 100) * 0.25 / (Math.PI * 0.25) : 0;
      it.obj.shade.emissive.setRGB(c[0], c[1], c[2]); it.obj.shade.emissiveIntensity = shadeL;
    }
    if (it.type === 'vela' && it.on && it.flicker) L.intensity *= 0.85 + Math.random() * 0.3;
  }
  scene.updateMatrixWorld(true);
  // bounces and diffusion frames
  for (const b of S.items) {
    if ((b.type !== 'bounce' && b.type !== 'butterfly') || !b.obj || !b.obj.bounceLight) continue;
    const A = b.type === 'butterfly' ? (b.side || 2.44) ** 2 : 0.9;
    const F = FACES[b.face], P = b.obj.head.getWorldPosition(new THREE.Vector3()), n = worldDir(b.obj.head);
    let rgb = [0, 0, 0], back = [0, 0, 0];
    const addLight = (E, c, front) => { const t = front ? rgb : back; t[0] += E * c[0]; t[1] += E * c[1]; t[2] += E * c[2]; };
    for (const it of S.items) {
      if (!isLight(it) || !it.on || !it.obj) continue;
      const Ef = illum(it, P, n), Eb = illum(it, P, n.clone().negate()), c = it.obj.main.color;
      if (Ef > 0) addLight(Ef, [c.r, c.g, c.b], true); if (Eb > 0) addLight(Eb, [c.r, c.g, c.b], false);
    }
    if (sun.visible) { const sd = sunDirection().dir, cf = n.dot(sd), sc = [sun.color.r, sun.color.g, sun.color.b]; if (cf > 0) addLight(sun.intensity * cf, sc, true); else addLight(-sun.intensity * cf, sc, false); }
    const bl = b.obj.bounceLight;
    if (b.face === 'diff') {
      // la difusión transmite hacia el lado opuesto a la luz dominante
      const Ef = Math.max(...rgb), Eb = Math.max(...back), fromBack = Eb >= Ef, src = fromBack ? back : rgb, E = Math.max(Ef, Eb);
      b.obj.bounceTarget.position.set(0, 0, fromBack ? 3 : -3); bl.position.z = fromBack ? 0.06 : -0.06;
      bl.intensity = 0.5 * E * A / Math.PI; if (E > 0) bl.color.setRGB(src[0] / E, src[1] / E, src[2] / E); b._lux = E;
    } else {
      const E = Math.max(...rgb); bl.intensity = F.rho * E * A / Math.PI;
      if (E > 0) bl.color.setRGB(rgb[0] / E * F.col[0], rgb[1] / E * F.col[1], rgb[2] / E * F.col[2]); b._lux = E;
    }
  }
}

/* ---------- cameras ---------- */
export const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 900);
export const setCam = new THREE.PerspectiveCamera(45, 1, 0.05, 900); setCam.layers.enable(1);
export const orbit = { th: 0.75, ph: 1.05, r: 9.5, tx: 0, ty: 1.0, tz: 0 };
export function placeSetCam() {
  const { th, ph, r, tx, ty, tz } = orbit;
  setCam.position.set(tx + r * Math.sin(ph) * Math.sin(th), ty + r * Math.cos(ph), tz + r * Math.sin(ph) * Math.cos(th)); setCam.lookAt(tx, ty, tz);
}
const camBody = new THREE.Group();
{
  const m = std('#2c2c33', { roughness: 0.5, metalness: 0.4 });
  camBody.add(new THREE.Mesh(box(0.16, 0.14, 0.22), m));
  const l = new THREE.Mesh(cyl(0.045, 0.05, 0.16, 16), std('#111', { roughness: 0.4 })); l.rotation.x = Math.PI / 2; l.position.z = -0.18; camBody.add(l);
  const tri = new THREE.Mesh(cyl(0.015, 0.015, 1, 6), m); tri.position.y = -0.55; camBody.add(tri);
  camBody.traverse(o => o.layers.set(1));
}
scene.add(camBody);
const frustumGeo = new THREE.BufferGeometry(); frustumGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(48), 3));
const frustum = new THREE.LineSegments(frustumGeo, new THREE.LineBasicMaterial({ color: '#FFB547', transparent: true, opacity: 0.7 })); frustum.layers.set(1); scene.add(frustum);

export const CAM_H = { bajo: 0.6, alto: 2.4 };
export const CAM_A = { normal: 0, picado: -20, contrapicado: 20, holandes: 0 };
export function camTarget(c = S.cam) {
  if (c._target) return c._target.clone();
  const P1 = S.people[0], P2 = S.people[1];
  if (c.frame === 'p2' && P2.on) return P2._head.clone();
  if (c.frame === 'both' && P2.on) return P1._head.clone().add(P2._head).multiplyScalar(0.5);
  return P1._head.clone();
}
export function camHeight(c = S.cam) { if (c._hAbs != null) return c._hAbs; return clamp((c.h === 'normal' ? camTarget(c).y : CAM_H[c.h]) + c.hOff, 0.2, 3.6); }
const lensFovV = f => 2 * Math.atan(10.125 / f) * R2D;
export function placeCam() {
  const c = S.cam, y = camHeight(); cam.position.set(c.x, y, c.z);
  const T = camTarget(), yaw = Math.atan2(T.x - c.x, T.z - c.z) + Math.PI;
  const pitch = (c._pitch != null ? c._pitch : CAM_A[c.a] + c.tilt) * D2R, roll = (c._roll != null ? c._roll : c.a === 'holandes' ? 18 : 0) * D2R;
  cam.rotation.order = 'YXZ'; cam.rotation.set(pitch, yaw, roll);
  const L = LENSES[c.lens]; cam.fov = L.fish ? 90 : lensFovV(L.f); cam.updateProjectionMatrix();
  camBody.position.copy(cam.position); camBody.rotation.copy(cam.rotation);
  camBody.children[2].scale.y = y; camBody.children[2].position.y = -y / 2 - 0.07;
  const hw = L.fish ? Math.tan(68 * D2R) : 18 / L.f, hh = L.fish ? Math.tan(50 * D2R) : 10.125 / L.f, d = 4;
  const pts = [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]].map(([a, b]) => new THREE.Vector3(a * d, b * d, -d).applyEuler(cam.rotation).add(cam.position));
  const arr = frustumGeo.attributes.position.array; let k = 0; const push = v => { arr[k++] = v.x; arr[k++] = v.y; arr[k++] = v.z; };
  for (let i = 0; i < 4; i++) { push(cam.position); push(pts[i]); push(pts[i]); push(pts[(i + 1) % 4]); }
  frustumGeo.attributes.position.needsUpdate = true; frustumGeo.computeBoundingSphere();
}
export function focusDist() {
  const c = S.cam; if (c.fm === 'manual') return c.focus;
  const P = c.fm === 'p2' && S.people[1].on ? S.people[1] : S.people[0];
  const fwd = new THREE.Vector3(0, 0, -1).applyEuler(cam.rotation);
  return Math.max(0.3, P._head.clone().sub(cam.position).dot(fwd));
}
export function dofRange(Sm) {
  const L = LENSES[S.cam.lens], f = L.f, N = TSTOPS[S.cam.T], c = 0.03, s = Sm * 1000, H = f * f / (N * c) + f;
  return [s * (H - f) / (H + s - 2 * f) / 1000, s < H ? s * (H - f) / (H - s) / 1000 : Infinity];
}
export const shutterFactor = () => ((S.cam.shutter || 180) / 360 / (S.cam.fps || 24)) * 48;
export function exposure() { return EXP_K / (TSTOPS[S.cam.T] ** 2) / Math.pow(2, S.cam.nd / 0.3) * (ISOS[S.cam.iso] / 800) * shutterFactor(); }

/* fisheye + depth of field post passes (HDR → tone mapping) */
const post = (frag, uniforms, defines = {}) => new THREE.ShaderMaterial({ uniforms, defines, depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: frag });
const cubeRT = new THREE.WebGLCubeRenderTarget(768, { type: THREE.HalfFloatType, generateMipmaps: false });
const cubeCam = new THREE.CubeCamera(0.05, 900, cubeRT); scene.add(cubeCam);
const fishMat = post(`uniform samplerCube tCube; uniform mat3 rot; uniform float f, aspect; varying vec2 vUv;
  void main(){ vec2 p = (vUv * 2.0 - 1.0) * vec2(18.0, 18.0 / aspect); float r = length(p); float th = r / f;
    if (th > 1.5707) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    vec2 d2 = r > 0.0 ? p / r : vec2(0.0); vec3 dir = rot * vec3(sin(th) * d2.x, sin(th) * d2.y, -cos(th));
    gl_FragColor = vec4(textureCube(tCube, dir).rgb, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`, { tCube: { value: cubeRT.texture }, rot: { value: new THREE.Matrix3() }, f: { value: 15 }, aspect: { value: 16 / 9 } });
export const dofMat = post(`uniform sampler2D tColor, tDepth; uniform float near, far, focus, fmm, N, maxR, on; uniform vec2 res; varying vec2 vUv;
  float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
  float coc(float D){ float s = focus * 1000.0, dm = D * 1000.0; float c = abs(fmm * fmm / (N * (s - fmm)) * (dm - s) / dm); return min(c / 36.0 * res.x * 0.5, maxR) * on; }
  void main(){
    float dc = lin(texture2D(tDepth, vUv).x); float rc = coc(dc); vec3 col = texture2D(tColor, vUv).rgb;
    if (rc > 0.6) { vec3 acc = col; float ws = 1.0;
      for (int i = 0; i < SAMPLES; i++) { float fi = float(i); float r = sqrt((fi + 0.5) / float(SAMPLES)) * rc; float a = fi * 2.39996;
        vec2 uv2 = vUv + vec2(cos(a), sin(a)) * r / res; float ds = lin(texture2D(tDepth, uv2).x); float rs = coc(ds); if (ds > dc) rs = min(rs, rc);
        float w = smoothstep(r - 1.0, r + 0.5, rs); acc += texture2D(tColor, uv2).rgb * w; ws += w; }
      col = acc / ws; }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`, { tColor: { value: null }, tDepth: { value: null }, near: { value: 0.05 }, far: { value: 900 }, focus: { value: 3 }, fmm: { value: 50 }, N: { value: 2.8 }, res: { value: new THREE.Vector2(1, 1) }, maxR: { value: 20 }, on: { value: 1 } }, { SAMPLES: 36 });
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fishScene = new THREE.Scene(); fishScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fishMat));
const dofScene = new THREE.Scene(); dofScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dofMat));
let rt = null;

/* ---------- render ---------- */
export const gizmo = { helper: null };
function sizeCanvas() {
  const r = canvas.getBoundingClientRect(), pr = renderer.getPixelRatio();
  if (canvas.width !== Math.round(r.width * pr) || canvas.height !== Math.round(r.height * pr)) renderer.setSize(r.width, r.height, false);
  return { w: r.width, h: r.height };
}
function bgFor() { return S.env.mode === 'estudio' ? STUDIO_BG : null; }
export function renderMonitor(x, y, w, h) {
  const L = LENSES[S.cam.lens]; renderer.toneMappingExposure = exposure();
  if (gizmo.helper) gizmo.helper.visible = false;
  scene.background = bgFor();
  const pr = renderer.getPixelRatio(), W = Math.round(w * pr), H = Math.round(h * pr);
  if (L.fish) {
    cubeCam.position.copy(cam.position); cubeCam.update(renderer, scene);
    fishMat.uniforms.rot.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(cam.rotation)); fishMat.uniforms.aspect.value = w / h;
    renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.render(fishScene, quadCam);
  } else {
    cam.aspect = w / h; cam.updateProjectionMatrix();
    if (!rt || rt.width !== W || rt.height !== H) { if (rt) { rt.depthTexture.dispose(); rt.dispose(); } rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 0 }); rt.depthTexture = new THREE.DepthTexture(W, H); rt.depthTexture.type = THREE.UnsignedIntType; }
    renderer.setRenderTarget(rt); renderer.setScissorTest(false); renderer.setClearColor(0x000000); renderer.clear(); renderer.render(scene, cam); renderer.setRenderTarget(null); renderer.setScissorTest(true);
    const u = dofMat.uniforms; u.tColor.value = rt.texture; u.tDepth.value = rt.depthTexture; u.near.value = cam.near; u.far.value = cam.far;
    u.focus.value = focusDist(); u.fmm.value = L.f; u.N.value = TSTOPS[S.cam.T]; u.res.value.set(W, H); u.maxR.value = W * 0.016; u.on.value = S.cam.dof ? 1 : 0;
    renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h); renderer.render(dofScene, quadCam);
  }
}
// La vista Set no usa los ajustes de cámara (diafragma, ISO, ND, obturador, balance de blancos):
// se adapta sola a la luz que llega al personaje, como tus ojos al entrar al set.
function lightKelvin(it) { const T = TYPES[it.type]; return it.gel && it.gel !== 'none' ? GEL[it.gel].k : (T.kelvin || it.k || 2700); }
export function setAdapt() {
  const H = S.people[0]._head; let lux = ambientLux(), mired = 0, wsum = 0;
  const add = (E, k) => { if (E > 0 && k) { mired += E * 1e6 / k; wsum += E; } };
  for (const it of S.items) {
    if (!isLight(it) || !it.on || !it.obj) continue;
    const E = illum(it, H); lux += E;
    if (!((it.type === 'tube' || it.type === 'panel') && it.mode === 'rgb')) add(E, lightKelvin(it));
  }
  if (S.env.mode !== 'estudio') {
    const dl = daylight(nat.elev);
    add(ambientLux(), dl.skyK);
    for (const L of env.windowLights) {
      const o = L.userData.op, n = roomWalls()[o.wall].n, to = H.clone().sub(L.position), d2 = Math.max(0.5, to.lengthSq()); to.normalize();
      const Ew = L.intensity * L.width * L.height * Math.max(0, n[0] * to.x + n[1] * to.z) / d2; lux += Ew; add(Ew, dl.skyK);
    }
    if (S.env.mode === 'exterior' && sun.visible) { const y = Math.max(0, sunDirection().dir.y), Es = sun.intensity * Math.max(y, 0.7 * Math.sqrt(1 - y * y)); lux += Es; add(Es, dl.sunK); }
  }
  // adaptación parcial, como el ojo: una luz cálida se sigue viendo algo cálida
  const m = wsum > 0 ? 0.65 * (mired / wsum) + 0.35 * (1e6 / 5600) : 1e6 / 5600;
  return { lux: Math.max(lux, 60), wb: clamp(1e6 / m, 2000, 10000) };
}
const SET_K = 14; // calibrado con los esquemas de ejemplo: el personaje queda algo más claro que en el monitor
export function renderSet(x, y, w, h, A) {
  renderer.toneMappingExposure = SET_K / A;
  const keep = hemi.intensity; hemi.intensity = keep + 0.42 * A / SET_K; // relleno para ver el set aunque esté oscuro
  if (gizmo.helper) gizmo.helper.visible = UI.view === 'set';
  setCam.aspect = w / h; setCam.updateProjectionMatrix();
  renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h);
  scene.background = S.env.mode === 'estudio' ? new THREE.Color('#0d0c12') : null; renderer.clear(); renderer.render(scene, setCam);
  hemi.intensity = keep;
}
export const layout = { mon: { x: 0, y: 0, w: 1, h: 1 }, pip: { x: 0, y: 0, w: 1, h: 1 } };
export function fit169(w, h) { let mw = w, mh = w * 9 / 16; if (mh > h) { mh = h; mw = h * 16 / 9; } return { x: (w - mw) / 2, y: (h - mh) / 2, w: mw, h: mh }; }
export function render() {
  const { w, h } = sizeCanvas();
  placeCam(); placeSetCam();
  renderer.setScissorTest(true); renderer.setViewport(0, 0, w, h); renderer.setScissor(0, 0, w, h); renderer.setClearColor('#050407'); renderer.clear();
  renderer.shadowMap.needsUpdate = true;
  const mon = fit169(w, h), pipW = Math.min(w * 0.3, 360), pipH = pipW * 9 / 16, px = w - pipW - 10, py = 10;
  let fresh = false;
  const monitorPass = (...a) => { wbOverride = null; updateLights(); fresh = true; renderMonitor(...a); };
  const setPass = (...a) => { if (!fresh) { wbOverride = null; updateLights(); } const ad = setAdapt(); wbOverride = ad.wb; updateLights(); fresh = false; renderSet(...a, ad.lux); };
  try {
    if (UI.view === 'monitor') { monitorPass(mon.x, h - mon.y - mon.h, mon.w, mon.h); if (UI.pip) setPass(px, py, pipW, pipH); }
    else { setPass(0, 0, w, h); if (UI.pip) monitorPass(px, py, pipW, pipH); }
  } finally { wbOverride = null; }
  renderer.setScissorTest(false);
  layout.mon = mon; layout.pip = { x: px, y: h - py - pipH, w: pipW, h: pipH }; layout.w = w; layout.h = h;
}
// captura del monitor a un canvas 2D
export function grabFrame(W = 1920, H = 1080) {
  const pr = renderer.getPixelRatio();
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  updateLights(); placeCam(); renderer.shadowMap.needsUpdate = true; renderer.setScissorTest(true); renderer.setClearColor('#000');
  renderer.setViewport(0, 0, W, H); renderer.setScissor(0, 0, W, H); renderer.clear(); renderMonitor(0, 0, W, H); renderer.setScissorTest(false);
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(canvas, 0, 0, W, H);
  renderer.setPixelRatio(pr); req(); return c;
}

/* ---------- picking in set view ---------- */
const ray = new THREE.Raycaster(); ray.layers.enable(1);
export function pickAt(nx, ny) {
  ray.setFromCamera({ x: nx, y: ny }, setCam);
  const objs = [...S.items.filter(i => i.obj && i.obj.root).map(i => i.obj.root), ...S.items.filter(i => i._grp).map(i => i._grp), ...S.people.filter(P => P._grp).map(P => P._grp)];
  const ops = S.items.filter(i => i.obj && !i.obj.root && i._grp);
  for (const h of ray.intersectObjects(objs.concat(ops.map(o => o._grp)), true)) {
    let o = h.object; while (o && o.userData.id == null && o.userData.person == null) o = o.parent;
    if (o) return o.userData.id != null ? { id: o.userData.id } : { person: o.userData.person };
  }
  return null;
}
