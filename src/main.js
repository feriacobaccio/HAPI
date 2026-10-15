// HAPI — arranque, bucle de render y controles de la vista 3D.
import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { S, UI, $, clamp, takeDirty, req, toast } from './state.js';
import { TYPES } from './catalog.js';
import * as E from './engine.js';
import { drawPlan, plan, zoomPlan, PV } from './plan.js';
import * as U from './ui.js';
import { applyPreset } from './presets.js';
import { undo, loadAutosave, scheduleAutosave } from './io.js';

/* ---------- vista Set 3D: órbita, selección y gizmo ---------- */
const canvas = E.canvas;
const tc = new TransformControls(E.setCam, canvas);
tc.setSize(0.8); tc.setSpace('world');
const tcHelper = tc.getHelper(); E.scene.add(tcHelper); E.gizmo.helper = tcHelper;
let tcTarget = null;
tc.addEventListener('objectChange', () => {
  const o = tc.object; if (!o || !tcTarget) return;
  const snap = v => Math.round(v * 20) / 20;
  if (tcTarget.person != null) { const P = S.people[tcTarget.person]; P.x = snap(o.position.x); P.z = snap(o.position.z); o.position.y = 0; E.placePerson(P); U.syncPersonUI(); U.updateLensInfo(); }
  else { const it = S.items.find(i => i.id === tcTarget.id); if (!it) return; it.x = snap(o.position.x); it.z = snap(o.position.z); it.y = clamp(snap(o.position.y), 0, 4.5); E.syncItem(it); U.renderProps(true); }
  drawPlan(); req();
});
tc.addEventListener('change', req);
U.setAttachGizmo(() => {
  tc.detach(); tcTarget = null;
  if (UI.view !== 'set') return;
  const it = S.items.find(i => i.id === UI.sel);
  if (it && it.obj && it.obj.root && TYPES[it.type].cat !== 'abertura') { tc.attach(it.obj.root); tcTarget = { id: it.id }; tc.showY = true; }
  else if (UI.sel == null) { const P = S.people[UI.selPerson]; if (P && P._grp) { tc.attach(P._grp); tcTarget = { person: UI.selPerson }; tc.showY = false; } }
  req();
});

let drag = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
function inSetArea(e) {
  if (UI.view !== 'set') return false; if (!UI.pip) return true;
  const r = canvas.getBoundingClientRect(), p = E.layout.pip, x = e.clientX - r.left, y = e.clientY - r.top;
  return !(x > p.x && y > p.y && x < p.x + p.w && y < p.y + p.h);
}
canvas.addEventListener('pointerdown', e => {
  if (!inSetArea(e) || tc.dragging || tc.axis) return;
  canvas.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey, moved: false };
});
canvas.addEventListener('pointermove', e => {
  if (!drag || tc.dragging) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  const o = E.orbit;
  if (drag.pan) { const s = o.r * 0.0016, rt = new THREE.Vector3().setFromMatrixColumn(E.setCam.matrix, 0); o.tx -= rt.x * dx * s; o.tz -= rt.z * dx * s; o.ty = clamp(o.ty + dy * s, 0, 4); }
  else { o.th -= dx * 0.006; o.ph = clamp(o.ph - dy * 0.006, 0.12, 1.55); }
  req();
});
canvas.addEventListener('pointerup', e => {
  if (drag && !drag.moved && !drag.pan) {
    const r = canvas.getBoundingClientRect(), hit = E.pickAt((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (hit && hit.id != null) U.select(hit.id); else if (hit && hit.person != null) U.selectPerson(hit.person);
  }
  drag = null;
});
canvas.addEventListener('wheel', e => { if (!inSetArea(e)) return; e.preventDefault(); E.orbit.r = clamp(E.orbit.r * (1 + Math.sign(e.deltaY) * 0.08), 1.5, 60); req(); }, { passive: false });

/* ---------- planta: zoom ---------- */
$('#zIn').addEventListener('click', () => zoomPlan(1 / 1.3));
$('#zOut').addEventListener('click', () => zoomPlan(1.3));
$('#zFit').addEventListener('click', () => { PV.custom = false; drawPlan(); });

/* ---------- presentación y calidad ---------- */
function setPresent(on) {
  UI.present = on; document.body.classList.toggle('present', on); $('#exitPresent').hidden = !on;
  if (on && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  req();
}
$('#present').addEventListener('click', () => setPresent(true));
$('#exitPresent').addEventListener('click', () => setPresent(false));
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && UI.present) setPresent(false); });
$('#quality').addEventListener('change', e => { UI.quality = e.target.value; E.applyQuality(); try { localStorage.setItem('hapi-quality', UI.quality); } catch (_) {} });

/* ---------- teclado ---------- */
document.addEventListener('keydown', e => {
  const ae = document.activeElement, typing = ae && (/TEXTAREA|SELECT/.test(ae.tagName) || (ae.tagName === 'INPUT' && ['text', 'number', 'color', 'search'].includes(ae.type)));
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !typing) { e.preventDefault(); undo(); return; }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase(), L = ['fish', '18', '50', '90', '135'];
  if (k >= '1' && k <= '5') U.setLens(L[+k - 1]);
  else if (k === 'v') U.setView(UI.view === 'monitor' ? 'set' : 'monitor');
  else if (k === 'p') setPresent(!UI.present);
  else if (k === 'escape' && UI.present) setPresent(false);
  else if ((k === 'delete' || k === 'backspace') && UI.sel != null) { const it = S.items.find(i => i.id === UI.sel); if (it) { E.removeItem(it); UI.sel = null; U.renderItems(); U.renderProps(); drawPlan(); U.attachGizmo(); } }
});

/* ---------- bucle ---------- */
function loop() {
  try {
    const flick = S.items.some(i => i.type === 'vela' && i.on && i.flicker);
    if (takeDirty() || flick) { E.render(); U.layoutHud(); }
  } catch (err) { console.error(err); }
  finally { requestAnimationFrame(loop); }
}

/* ---------- arranque ---------- */
try { const q = localStorage.getItem('hapi-quality'); if (q) { UI.quality = q; $('#quality').value = q; } } catch (_) {}
E.applyQuality();
E.buildEnvironment(); E.buildPeople();
let restored = false;
try { restored = loadAutosave(); } catch (_) { restored = false; }
if (!restored) applyPreset('estudio', 'Tres puntos');
else toast('Se recuperó tu última escena. Para empezar de nuevo, elegí un esquema en la pestaña Escena.');
let tab = 'escena'; try { tab = localStorage.getItem('hapi-tab') || 'escena'; } catch (_) {}
U.setTab(tab); U.setView('monitor'); U.syncScenePanel(); U.syncCamUI(); U.renderItems(); U.renderProps(); U.refreshMove();
new ResizeObserver(() => req()).observe($('#stage'));
new ResizeObserver(() => drawPlan()).observe(plan);
if (document.fonts) document.fonts.ready.then(() => drawPlan());
document.addEventListener('change', scheduleAutosave);
requestAnimationFrame(loop);
window.__hapi = { S, UI, E };
