// Posición solar aproximada (algoritmo simplificado de la NOAA) y luz natural.
import { D2R, R2D, clamp } from './state.js';

const DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
export function dayOfYear(month, day) { return DAYS[month - 1] + day; }

// Devuelve elevación y azimut (grados, azimut desde el norte en sentido horario).
export function sunPosition({ hour, month, day, lat, lon, tz }) {
  const N = dayOfYear(month, day);
  const g = 2 * Math.PI / 365 * (N - 1 + (hour - 12) / 24);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const tst = hour * 60 + eqt + 4 * lon - 60 * tz;
  const ha = (tst / 4 - 180) * D2R, phi = lat * D2R;
  const cosZ = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(clamp(cosZ, -1, 1));
  let az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) + Math.PI;
  az = (az * R2D + 360) % 360;
  return { elev: 90 - zen * R2D, az };
}

// Busca la hora en que el sol cruza una elevación dada (mañana o tarde).
export function findHour(t, elev, afternoon) {
  let best = null, bd = 1e9;
  for (let h = afternoon ? 12 : 3; afternoon ? h <= 22 : h <= 12; h += 1 / 60) {
    const e = sunPosition({ ...t, hour: h }).elev, d = Math.abs(e - elev);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}
export function solarNoon(t) { let best = 12, be = -99; for (let h = 9; h <= 16; h += 1 / 60) { const e = sunPosition({ ...t, hour: h }).elev; if (e > be) { be = e; best = h; } } return { hour: best, elev: be }; }

export function phaseName(elev) {
  if (elev > 30) return 'Día';
  if (elev > 6) return 'Día, sol bajo';
  if (elev > -0.8) return 'Hora dorada';
  if (elev > -6) return 'Hora azul';
  if (elev > -12) return 'Crepúsculo';
  return 'Noche';
}

// Parámetros de luz natural según la elevación del sol.
export function daylight(elev) {
  const s = Math.sin(Math.max(elev, 0) * D2R);
  const am = elev > 0 ? 1 / (s + 0.15 * Math.pow(elev + 3.885, -1.253)) : 40;
  const sunLux = elev > -0.5 ? 115000 * Math.pow(0.72, Math.pow(am, 0.678)) * clamp((elev + 0.5) / 2, 0, 1) : 0;
  const sunK = elev <= 0 ? 2000 : clamp(2000 + 3600 * Math.pow(clamp(elev / 25, 0, 1), 0.6), 2000, 5600);
  // luz del cielo (irradiancia horizontal aproximada)
  let skyLux;
  if (elev > 0) skyLux = 2500 + 18000 * Math.pow(s, 0.8);
  else if (elev > -6) skyLux = 2500 * Math.pow(10, elev / 2.2);
  else if (elev > -18) skyLux = 4.5 * Math.pow(10, (elev + 6) / 4);
  else skyLux = 0.02;
  skyLux = Math.max(skyLux, 0.05); // luz de luna / ciudad
  const skyK = elev > 10 ? 8000 : elev > 0 ? 6500 : elev > -6 ? 11000 : 9000;
  return { sunLux, sunK, skyLux, skyK };
}

// Colores del cielo para el fondo (horizonte y cénit), en lineal y normalizados.
export function skyColors(elev) {
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * clamp(t, 0, 1));
  const day = { hz: [0.72, 0.84, 1.0], ze: [0.18, 0.38, 0.85] };
  const gold = { hz: [1.0, 0.58, 0.32], ze: [0.32, 0.42, 0.75] };
  const blue = { hz: [0.42, 0.42, 0.7], ze: [0.1, 0.14, 0.38] };
  const night = { hz: [0.05, 0.06, 0.12], ze: [0.01, 0.015, 0.04] };
  let c;
  if (elev > 12) c = day;
  else if (elev > 0) c = { hz: mix(gold.hz, day.hz, elev / 12), ze: mix(gold.ze, day.ze, elev / 12) };
  else if (elev > -6) c = { hz: mix(blue.hz, gold.hz, (elev + 6) / 6), ze: mix(blue.ze, gold.ze, (elev + 6) / 6) };
  else if (elev > -14) c = { hz: mix(night.hz, blue.hz, (elev + 14) / 8), ze: mix(night.ze, blue.ze, (elev + 14) / 8) };
  else c = night;
  return c;
}

export const hourLabel = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${String(hh % 24).padStart(2, '0')}:${String(mm === 60 ? 0 : mm).padStart(2, '0')}`; };
