// Planta 2D: dibujo, selección, arrastre, zoom.
import { S, UI, D2R, R2D, clamp, req, emit, $ } from './state.js';
import { TYPES, FLAG_SIZES, FACES, LENSES, SKINS } from './catalog.js';
import { isLight, itemName, beamHalf, lightColor, colorHex, camTarget, focusDist, dofRange, syncItem, placePerson, roomBounds, roomWalls, openingWorld, snapOpening, sunDirection, nat } from './engine.js';
import { hourLabel, phaseName } from './sun.js';

export const plan = $('#plan');
const PL = { x0: -4.5, x1: 4.5, z0: -3.2, z1: 5.8 };
export const PV = { custom: false, cx: 0, cz: 0, span: 9 };
const HANDLE = 0.75;
export function defaultBounds() {
  const m = S.env.mode;
  if (m === 'interior') { const b = roomBounds(), cz = Math.max(b.zF + 0.6, S.cam.z + 0.6), span = Math.max(b.x1 - b.x0 + 1.2, cz - b.zB + 0.8); const mz = (b.zB - 0.4 + cz) / 2; return { x0: -span / 2, x1: span / 2, z0: mz - span / 2, z1: mz + span / 2 }; }
  if (m === 'exterior') return { x0: -7, x1: 7, z0: -6.6, z1: 7.4 };
  return { x0: -4.5, x1: 4.5, z0: -(S.env.studio.dist + 0.7), z1: -(S.env.studio.dist + 0.7) + 9 };
}
function updPL(def) {
  if (def || !PV.custom) { Object.assign(PL, defaultBounds()); return; }
  Object.assign(PL, { x0: PV.cx - PV.span / 2, x1: PV.cx + PV.span / 2, z0: PV.cz - PV.span / 2, z1: PV.cz + PV.span / 2 });
}
const w2p = (x, z, W) => [(x - PL.x0) / (PL.x1 - PL.x0) * W, (z - PL.z0) / (PL.z1 - PL.z0) * W];
const p2w = (px, py, W) => [PL.x0 + px / W * (PL.x1 - PL.x0), PL.z0 + py / W * (PL.z1 - PL.z0)];
export function planWorld(clientX, clientY) { updPL(); const r = plan.getBoundingClientRect(); return p2w(clientX - r.left, clientY - r.top, r.width); }
export function planContains(clientX, clientY) { const r = plan.getBoundingClientRect(); return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom; }
export function zoomPlan(f, px, py) {
  updPL(); if (!PV.custom) { PV.cx = (PL.x0 + PL.x1) / 2; PV.cz = (PL.z0 + PL.z1) / 2; PV.span = PL.x1 - PL.x0; PV.custom = true; }
  const fx = px ?? 0.5, fy = py ?? 0.5, wx = PL.x0 + fx * PV.span, wz = PL.z0 + fy * PV.span, ns = clamp(PV.span * f, 2.5, 30);
  PV.cx = wx - (fx - 0.5) * ns; PV.cz = wz - (fy - 0.5) * ns; PV.span = ns; drawPlan();
}
let dragInfo = null;

export function drawPlanTo(ctx, W, theme) {
  updPL(theme === 'paper');
  const dark = theme !== 'paper', C = dark ? { bg: '#0b0a0f', grid: '#1f1c27', grid2: '#2c2837', fg: '#ede9f2', mut: '#8d86a0', flag: '#e8e4ee', wall: '#cfc8bd' } : { bg: '#ffffff', grid: '#ecebf0', grid2: '#d8d6de', fg: '#16141b', mut: '#6b6677', flag: '#16141b', wall: '#16141b' };
  const m = W / (PL.x1 - PL.x0), F = (k = 44) => `${Math.round(W / k)}px "Archivo", system-ui, sans-serif`;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, W);
  const step = m < 18 ? 5 : 1;
  for (let x = Math.ceil(PL.x0 / step) * step; x <= PL.x1; x += step) { const [px] = w2p(x, 0, W); ctx.strokeStyle = x === 0 ? C.grid2 : C.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, W); ctx.stroke(); }
  for (let z = Math.ceil(PL.z0 / step) * step; z <= PL.z1; z += step) { const [, py] = w2p(0, z, W); ctx.strokeStyle = z === 0 ? C.grid2 : C.grid; ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke(); }
  ctx.fillStyle = C.mut; ctx.font = `${Math.round(W / 40)}px "JetBrains Mono", monospace`; ctx.fillText(step + ' m', 6, W - 8);
  // environment
  const mode = S.env.mode;
  if (mode === 'estudio') {
    const [bx0, by] = w2p(-4.5, -S.env.studio.dist, W), [bx1] = w2p(4.5, -S.env.studio.dist, W);
    ctx.fillStyle = S.env.studio.color; ctx.fillRect(bx0, by - m * 0.12, bx1 - bx0, m * 0.12); ctx.strokeStyle = C.mut; ctx.strokeRect(bx0, by - m * 0.12, bx1 - bx0, m * 0.12);
    ctx.fillStyle = C.mut; ctx.font = F(48); ctx.fillText('FONDO', bx0 + 6, by - m * 0.18);
  } else if (mode === 'interior') {
    const b = roomBounds(), [a0, a1] = w2p(b.x0, b.zB, W), [c0, c1] = w2p(b.x1, b.zF, W);
    ctx.fillStyle = dark ? '#16131c' : '#f6f4f0'; ctx.fillRect(a0, a1, c0 - a0, c1 - a1);
    const ops = S.items.filter(i => i.type === 'ventana' || i.type === 'puerta');
    for (const w of roomWalls()) {
      const cuts = ops.filter(o => o.wall === w.i).map(o => [o.u - o.w / 2, o.u + o.w / 2]).sort((p, q) => p[0] - q[0]);
      let s = -w.len / 2; const segs = [];
      for (const [u0, u1] of cuts) { segs.push([s, u0]); s = u1; } segs.push([s, w.len / 2]);
      ctx.strokeStyle = C.wall; ctx.lineWidth = Math.max(3, m * 0.12); ctx.lineCap = 'butt';
      for (const [u0, u1] of segs) { if (u1 <= u0) continue; const p0 = w2p(w.center[0] + w.dir[0] * u0, w.center[1] + w.dir[1] * u0, W), p1 = w2p(w.center[0] + w.dir[0] * u1, w.center[1] + w.dir[1] * u1, W); ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.stroke(); }
    }
    for (const o of ops) {
      const p = openingWorld(o), w = p.wall, sel = UI.sel === o.id && dark, e = (u, n = 0) => w2p(p.x + w.dir[0] * u + w.n[0] * n, p.z + w.dir[1] * u + w.n[1] * n, W);
      ctx.strokeStyle = sel ? '#FFB547' : o.type === 'ventana' ? '#7CC7FF' : C.fg; ctx.lineWidth = 2;
      if (o.type === 'ventana') { for (const n of [-0.04, 0.04]) { ctx.beginPath(); ctx.moveTo(...e(-o.w / 2, n)); ctx.lineTo(...e(o.w / 2, n)); ctx.stroke(); } }
      else { const hinge = e(-o.w / 2), a = (o.open || 0) * D2R, tip = w2p(p.x + (w.dir[0] * Math.cos(a) + w.n[0] * Math.sin(a)) * o.w - w.dir[0] * o.w / 2, p.z + (w.dir[1] * Math.cos(a) + w.n[1] * Math.sin(a)) * o.w - w.dir[1] * o.w / 2, W); ctx.beginPath(); ctx.moveTo(...hinge); ctx.lineTo(...tip); ctx.stroke(); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(...tip); ctx.lineTo(...e(o.w / 2)); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = C.fg; ctx.font = F(theme === 'paper' ? 58 : 50); const lp = e(0, 0.35); ctx.fillText((theme === 'paper' ? labelNum(o) + ' ' : '') + TYPES[o.type].name, lp[0] - 18, lp[1]);
    }
  } else if (mode === 'exterior') {
    const k = S.env.ext.kind; ctx.fillStyle = dark ? '#c9bca833' : '#c9bca8';
    if (k === 'calle') { const [x0, z0] = w2p(-15, -6.4, W), [x1, z1] = w2p(15, -6, W); ctx.fillRect(x0, z0, x1 - x0, z1 - z0); const [, s0] = w2p(0, -6, W), [, s1] = w2p(0, -3, W); ctx.fillStyle = dark ? '#ffffff10' : '#00000010'; ctx.fillRect(0, s0, W, s1 - s0); ctx.fillStyle = C.mut; ctx.font = F(50); ctx.fillText('FACHADA · VEREDA', 8, s0 - 6); }
    if (k === 'patio') { ctx.strokeStyle = C.wall; ctx.lineWidth = Math.max(3, m * 0.2); const [x0, z0] = w2p(-6.1, -6, W), [x1, z1] = w2p(6.1, 6, W); ctx.strokeRect(x0, z0, x1 - x0, z1 - z0); }
  }
  // camera wedge
  const c = S.cam, L = LENSES[c.lens], [cx, cz] = w2p(c.x, c.z, W), TT = camTarget(), yaw = Math.atan2(TT.x - c.x, TT.z - c.z), half = L.fish ? 68.75 * D2R : Math.atan(18 / L.f), len = 7 * m;
  ctx.fillStyle = dark ? '#FFB5471f' : '#FFB54733'; ctx.strokeStyle = '#FFB547'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx, cz); ctx.lineTo(cx + Math.sin(yaw - half) * len, cz + Math.cos(yaw - half) * len); ctx.lineTo(cx + Math.sin(yaw + half) * len, cz + Math.cos(yaw + half) * len); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + Math.sin(yaw - half) * len, cz + Math.cos(yaw - half) * len); ctx.lineTo(cx, cz); ctx.lineTo(cx + Math.sin(yaw + half) * len, cz + Math.cos(yaw + half) * len); ctx.stroke();
  if (S.cam.dof && !L.fish) {
    const fd = focusDist(), [n0, f0] = dofRange(fd), ux = Math.sin(yaw), uz = Math.cos(yaw), px = -uz, pz = ux, span = 1.6, f1 = Math.min(f0, 12);
    const pt = (d, s) => w2p(c.x + ux * d + px * s, c.z + uz * d + pz * s, W);
    ctx.fillStyle = dark ? '#7CC7FF1c' : '#7CC7FF30'; const q = [pt(n0, -span), pt(n0, span), pt(f1, span), pt(f1, -span)];
    ctx.beginPath(); ctx.moveTo(...q[0]); q.slice(1).forEach(v => ctx.lineTo(...v)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7CC7FF'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(...pt(fd, -span)); ctx.lineTo(...pt(fd, span)); ctx.stroke(); ctx.setLineDash([]);
  }
  // beams
  for (const it of S.items) {
    if (!isLight(it) || !it.on || TYPES[it.type].point) continue;
    const [x, z] = w2p(it.x, it.z, W), h = beamHalf(it), y = it.yaw * D2R, l = 3 * m, col = colorHex(lightColor(it));
    const g = ctx.createRadialGradient(x, z, 0, x, z, l); g.addColorStop(0, col + (dark ? '55' : '66')); g.addColorStop(1, col + '00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, z); ctx.arc(x, z, l, Math.PI / 2 - y - h, Math.PI / 2 - y + h); ctx.closePath(); ctx.fill();
    if (!dark) { ctx.setLineDash([8, 6]); ctx.strokeStyle = '#9a94a8'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
  }
  // furniture under everything else
  for (const it of S.items) {
    const T = TYPES[it.type]; if (T.cat !== 'mueble') continue;
    const [x, z] = w2p(it.x, it.z, W), sel = UI.sel === it.id && dark;
    ctx.save(); ctx.translate(x, z); ctx.rotate(-it.yaw * D2R);
    const [w, , d] = T.size; ctx.fillStyle = dark ? (it.color || '#7a5634') + '88' : '#e9e4dc'; ctx.strokeStyle = sel ? '#FFB547' : C.fg; ctx.lineWidth = sel ? 3 : 1.2;
    ctx.fillRect(-w / 2 * m, -d / 2 * m, w * m, d * m); ctx.strokeRect(-w / 2 * m, -d / 2 * m, w * m, d * m);
    ctx.beginPath(); ctx.moveTo(-w / 2 * m, d / 2 * m); ctx.lineTo(w / 2 * m, d / 2 * m); ctx.lineWidth = sel ? 4 : 2.5; ctx.stroke();
    ctx.restore();
    ctx.fillStyle = C.mut; ctx.font = F(theme === 'paper' ? 58 : 52); ctx.fillText((theme === 'paper' ? labelNum(it) + ' ' : '') + T.name, x - m * 0.3, z + 4);
  }
  // people
  S.people.forEach((P, i) => {
    if (!P.on) return;
    const [sx, sz] = w2p(P.x, P.z, W), sr = P.rot * D2R, act = dark && UI.selPerson === i && UI.sel == null;
    ctx.fillStyle = SKINS[P.skin]; ctx.strokeStyle = act ? '#FFB547' : C.fg; ctx.lineWidth = act ? 3 : 1.5;
    ctx.beginPath(); ctx.ellipse(sx, sz, m * 0.24, m * 0.15, -sr, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx, sz, m * 0.11, 0, 7); ctx.fillStyle = dark ? '#2a1f1a' : '#6b5040'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx + Math.sin(sr) * m * 0.11, sz + Math.cos(sr) * m * 0.11); ctx.lineTo(sx + Math.sin(sr) * m * 0.22, sz + Math.cos(sr) * m * 0.22); ctx.strokeStyle = C.fg; ctx.lineWidth = 2; ctx.stroke();
    if (dark) { const [hx, hz] = w2p(P.x + Math.sin(sr) * HANDLE, P.z + Math.cos(sr) * HANDLE, W); ctx.fillStyle = act ? '#fff' : '#ffffff55'; ctx.beginPath(); ctx.arc(hx, hz, act ? 5 : 3.5, 0, 7); ctx.fill(); }
    ctx.fillStyle = C.fg; ctx.font = F(theme === 'paper' ? 55 : 44); ctx.fillText('Personaje ' + (i + 1), sx + m * 0.26, sz + m * 0.05);
  });
  // equipment and control
  for (const it of S.items) {
    const T = TYPES[it.type]; if (T.cat === 'mueble' || T.cat === 'abertura') continue;
    const [x, z] = w2p(it.x, it.z, W), y = it.yaw * D2R, sel = UI.sel === it.id && dark;
    ctx.save(); ctx.translate(x, z); ctx.rotate(-y);
    if (T.practical) {
      const col = it.on ? colorHex(lightColor(it)) : '#555';
      if (it.on) { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, m * 0.9); g.addColorStop(0, col + '88'); g.addColorStop(1, col + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, m * 0.9, 0, 7); ctx.fill(); }
      ctx.fillStyle = col; ctx.strokeStyle = sel ? '#FFB547' : C.fg; ctx.lineWidth = sel ? 3 : 1.5; ctx.beginPath(); ctx.arc(0, 0, m * (it.type === 'vela' ? 0.06 : 0.14), 0, 7); ctx.fill(); ctx.stroke();
    } else if (isLight(it)) {
      const col = it.on ? colorHex(lightColor(it)) : '#555';
      ctx.fillStyle = col; ctx.strokeStyle = sel ? '#FFB547' : C.fg; ctx.lineWidth = sel ? 3 : 1.5;
      if (it.type === 'powerflo') { ctx.fillRect(-m * 0.6, -m * 0.08, m * 1.2, m * 0.16); ctx.strokeRect(-m * 0.6, -m * 0.08, m * 1.2, m * 0.16); }
      else if (it.type === 'tube') { if (it.orient === 'h') { ctx.fillRect(-m * 0.56, -m * 0.04, m * 1.12, m * 0.08); ctx.strokeRect(-m * 0.56, -m * 0.04, m * 1.12, m * 0.08); } else { ctx.beginPath(); ctx.arc(0, 0, m * 0.08, 0, 7); ctx.fill(); ctx.stroke(); } }
      else if (it.type === 'panel') { ctx.fillRect(-m * 0.16, -m * 0.05, m * 0.32, m * 0.1); ctx.strokeRect(-m * 0.16, -m * 0.05, m * 0.32, m * 0.1); }
      else { const r = m * (0.14 + it.p * 0.03); ctx.beginPath(); ctx.moveTo(-r, -r * 1.3); ctx.lineTo(r, -r * 1.3); ctx.lineTo(r * 1.2, r * 0.3); ctx.lineTo(-r * 1.2, r * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    } else if (it.type === 'flag') {
      const w = FLAG_SIZES[it.size][0] * m; ctx.strokeStyle = sel ? '#FFB547' : C.flag; ctx.lineWidth = sel ? 7 : 5; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.stroke();
    } else if (it.type === 'bounce') {
      const w = 0.535 * m;
      if (!dark) { ctx.strokeStyle = C.fg; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(w, 0); ctx.stroke(); }
      ctx.strokeStyle = sel ? '#FFB547' : it.face === 'black' ? C.fg : FACES[it.face].hex; ctx.lineWidth = sel ? 6 : 4; ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(w, 0); ctx.stroke();
      ctx.strokeStyle = C.mut; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, m * 0.35); ctx.stroke();
    }
    ctx.restore();
    if (dark && !T.practical) { const [hx, hz] = w2p(it.x + Math.sin(y) * HANDLE, it.z + Math.cos(y) * HANDLE, W); ctx.fillStyle = sel ? '#fff' : '#ffffff55'; ctx.beginPath(); ctx.arc(hx, hz, sel ? 5 : 3.5, 0, 7); ctx.fill(); }
    ctx.fillStyle = C.fg; ctx.font = F(theme === 'paper' ? 55 : 46);
    ctx.fillText((theme === 'paper' ? labelNum(it) + ' ' : '') + itemName(it), x + m * 0.2, z - m * 0.2);
  }
  // camera icon
  ctx.save(); ctx.translate(cx, cz); ctx.rotate(-yaw); ctx.fillStyle = '#FFB547'; ctx.strokeStyle = C.bg; ctx.lineWidth = 2;
  ctx.fillRect(-m * 0.12, -m * 0.18, m * 0.24, m * 0.3); ctx.strokeRect(-m * 0.12, -m * 0.18, m * 0.24, m * 0.3);
  ctx.beginPath(); ctx.moveTo(-m * 0.07, m * 0.12); ctx.lineTo(m * 0.07, m * 0.12); ctx.lineTo(m * 0.1, m * 0.24); ctx.lineTo(-m * 0.1, m * 0.24); ctx.closePath(); ctx.fill(); ctx.restore();
  if (!(S.move.A && S.move.B)) { ctx.fillStyle = '#FFB547'; ctx.font = F(44); ctx.fillText('CÁMARA · ' + L.label, cx + m * 0.25, cz + m * 0.3); }
  // A/B
  const AB = ['A', 'B'].filter(k => S.move[k]);
  if (AB.length) {
    const pts = AB.map(k => w2p(S.move[k].x, S.move[k].z, W));
    if (pts.length === 2) { ctx.strokeStyle = '#FFB547'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.stroke(); ctx.setLineDash([]); }
    AB.forEach((k, i) => { const [x, z] = pts[i]; ctx.strokeStyle = '#FFB547'; ctx.lineWidth = 2; ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(x, z, m * 0.2, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#FFB547'; ctx.font = `600 ${Math.round(m * 0.24)}px "Archivo", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(k, x, z + 1); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; });
  }
  // compass + sun
  if (mode !== 'estudio') {
    const R = W * 0.07, ox = W - R - 12, oy = R + 12, n = S.env.time.north * D2R;
    ctx.fillStyle = dark ? '#0b0a0fcc' : '#ffffffcc'; ctx.beginPath(); ctx.arc(ox, oy, R + 6, 0, 7); ctx.fill();
    ctx.strokeStyle = C.mut; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ox, oy, R, 0, 7); ctx.stroke();
    const nx = ox + Math.sin(n) * R, ny = oy - Math.cos(n) * R;
    ctx.strokeStyle = C.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(nx, ny); ctx.stroke();
    ctx.fillStyle = C.fg; ctx.font = `600 ${Math.round(W / 38)}px "Archivo", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', ox + Math.sin(n) * (R + 0) * 0.62 + Math.cos(n) * 9, oy - Math.cos(n) * R * 0.62 + Math.sin(n) * 9);
    const sd = sunDirection();
    if (sd.elev > -6) {
      const a = (sd.az + S.env.time.north) * D2R, rr = R * (1 - Math.max(0, sd.elev) / 90), sx = ox + Math.sin(a) * rr, sy = oy - Math.cos(a) * rr;
      ctx.fillStyle = sd.elev > 0 ? '#FFC94D' : '#7CC7FF'; ctx.beginPath(); ctx.arc(sx, sy, W / 70, 0, 7); ctx.fill();
      // sun ray across set
      if (sd.elev > 0) { const [ax, az] = w2p(0, 0, W), dx = Math.sin(a), dz = -Math.cos(a); ctx.strokeStyle = '#FFC94D88'; ctx.lineWidth = 2; ctx.setLineDash([10, 6]); ctx.beginPath(); ctx.moveTo(ax + dx * W * 0.45, az + dz * W * 0.45); ctx.lineTo(ax + dx * m * 0.6, az + dz * m * 0.6); ctx.stroke(); ctx.setLineDash([]); }
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.mut; ctx.font = `${Math.round(W / 50)}px "JetBrains Mono", monospace`;
    ctx.fillText(`${hourLabel(S.env.time.hour)} · ${phaseName(sd.elev)}`, ox - R - 6, oy + R + 22);
  }
  // live measurement
  if (dark && dragInfo) {
    ctx.font = `${Math.round(W / 40)}px "JetBrains Mono", monospace`; const tw = ctx.measureText(dragInfo.text).width + 12, [tx, tz] = w2p(dragInfo.x, dragInfo.z, W);
    const bx = clamp(tx + 14, 4, W - tw - 4), by = clamp(tz - 30, 4, W - 26);
    ctx.fillStyle = '#000c'; ctx.fillRect(bx, by, tw, 22); ctx.fillStyle = '#FFB547'; ctx.fillText(dragInfo.text, bx + 6, by + 15);
  }
}
const labelNum = it => (S.items.indexOf(it) + 1) + '.';
export function drawPlan() {
  const dpr = window.devicePixelRatio || 1, W = Math.round(plan.clientWidth * dpr);
  if (!W) return; if (plan.width !== W) { plan.width = W; plan.height = W; }
  drawPlanTo(plan.getContext('2d'), W, 'dark');
}

function measure(x, z) {
  const P = S.people[UI.selPerson] && S.people[UI.selPerson].on ? S.people[UI.selPerson] : S.people[0];
  const d = Math.hypot(x - P.x, z - P.z);
  const camA = Math.atan2(S.cam.x - P.x, S.cam.z - P.z), a = Math.atan2(x - P.x, z - P.z);
  let ang = (a - camA) * R2D; ang = ((ang + 540) % 360) - 180;
  return `${d.toFixed(2)} m · ${Math.abs(ang).toFixed(0)}° ${ang > 2 ? 'izq.' : ang < -2 ? 'der.' : ''} de cámara`;
}

let pdrag = null;
plan.addEventListener('pointerdown', e => {
  updPL(); const r = plan.getBoundingClientRect(), W = r.width, px = e.clientX - r.left, py = e.clientY - r.top, m = W / (PL.x1 - PL.x0);
  let best = null, bd = 14;
  const test = (tx, tz, kind, id) => { const [ax, az] = w2p(tx, tz, W), d = Math.hypot(ax - px, az - py); if (d < bd) { bd = d; best = { kind, id }; } };
  for (const it of S.items) { if (TYPES[it.type].cat === 'abertura' || TYPES[it.type].practical) continue; const y = it.yaw * D2R; test(it.x + Math.sin(y) * HANDLE, it.z + Math.cos(y) * HANDLE, 'rot', it.id); }
  S.people.forEach((P, i) => { if (!P.on) return; const r0 = P.rot * D2R; test(P.x + Math.sin(r0) * HANDLE, P.z + Math.cos(r0) * HANDLE, 'prot', i); });
  for (const it of S.items) { if (TYPES[it.type].cat === 'abertura') { const p = openingWorld(it); test(p.x, p.z, 'move', it.id); } else if (TYPES[it.type].cat !== 'mueble') test(it.x, it.z, 'move', it.id); }
  S.people.forEach((P, i) => { if (P.on) test(P.x, P.z, 'person', i); });
  test(S.cam.x, S.cam.z, 'cam', null);
  if (!best) { // furniture by footprint
    const [wx, wz] = p2w(px, py, W);
    for (const it of [...S.items].reverse()) { const T = TYPES[it.type]; if (T.cat !== 'mueble') continue; const a = -it.yaw * D2R, dx = wx - it.x, dz = wz - it.z, lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a); if (Math.abs(lx) < T.size[0] / 2 && Math.abs(lz) < T.size[2] / 2) { best = { kind: 'move', id: it.id }; break; } }
  }
  if (!best) { bd = 0.4 * m; for (const it of S.items) test(it.x, it.z, 'move', it.id); }
  plan.setPointerCapture(e.pointerId);
  if (!best) { pdrag = { kind: 'pan', x: e.clientX, y: e.clientY }; plan.style.cursor = 'grabbing'; return; }
  pdrag = best;
  if (best.kind === 'person' || best.kind === 'prot') emit('selectPerson', best.id);
  else if (best.id != null) emit('select', best.id);
});
plan.addEventListener('pointermove', e => {
  if (!pdrag) return;
  updPL(); const r = plan.getBoundingClientRect(), [wx, wz] = p2w(e.clientX - r.left, e.clientY - r.top, r.width);
  const snap = v => Math.round(v * 20) / 20;
  if (pdrag.kind === 'pan') {
    if (!PV.custom) { PV.cx = (PL.x0 + PL.x1) / 2; PV.cz = (PL.z0 + PL.z1) / 2; PV.span = PL.x1 - PL.x0; PV.custom = true; }
    const k = PV.span / r.width; PV.cx -= (e.clientX - pdrag.x) * k; PV.cz -= (e.clientY - pdrag.y) * k; pdrag.x = e.clientX; pdrag.y = e.clientY; drawPlan(); return;
  }
  if (pdrag.kind === 'person' || pdrag.kind === 'prot') {
    const P = S.people[pdrag.id];
    if (pdrag.kind === 'person') { P.x = snap(wx); P.z = snap(wz); dragInfo = null; }
    else P.rot = Math.round(Math.atan2(wx - P.x, wz - P.z) * R2D / 5) * 5;
    placePerson(P); emit('peopleChanged'); req(); drawPlan(); return;
  }
  if (pdrag.kind === 'cam') { S.cam.x = snap(wx); S.cam.z = snap(wz); dragInfo = { x: wx, z: wz, text: measure(wx, wz).replace(/ · .*$/, ' del personaje') }; emit('camChanged'); req(); drawPlan(); return; }
  const it = S.items.find(i => i.id === pdrag.id); if (!it) return;
  if (TYPES[it.type].cat === 'abertura') { snapOpening(it, wx, wz); }
  else if (pdrag.kind === 'move') { it.x = snap(wx); it.z = snap(wz); dragInfo = { x: it.x, z: it.z, text: measure(it.x, it.z) }; }
  else { it.yaw = Math.round(Math.atan2(wx - it.x, wz - it.z) * R2D); dragInfo = { x: it.x, z: it.z, text: `rotación ${it.yaw}°` }; }
  syncItem(it); emit('itemMoved', it); drawPlan();
});
plan.addEventListener('pointerup', () => { pdrag = null; dragInfo = null; plan.style.cursor = 'default'; drawPlan(); });
plan.addEventListener('wheel', e => { e.preventDefault(); const r = plan.getBoundingClientRect(); zoomPlan(e.deltaY > 0 ? 1.15 : 1 / 1.15, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }, { passive: false });
