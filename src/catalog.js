// Catálogo de equipos, prácticas, mobiliario y lentes.
export const TYPES = {
  // equipos de iluminación
  hmi: { cat: 'luz', name: 'HMI', hard: true, powers: [575, 1200, 2500, 6000, 12000], eff: 85, kelvin: 5600, beam: [12, 50], barn: true, diff: true, gel: true,
    desc: 'Luz de descarga, muy potente y a 5600 K. Con lente Fresnel: en spot concentra, en flood reparte. Da sombra dura.' },
  fresnel: { cat: 'luz', name: 'Fresnel tungsteno', hard: true, powers: [300, 650, 1000, 2000], eff: 14, kelvin: 3200, beam: [15, 55], barn: true, diff: true, gel: true,
    desc: 'Lámpara halógena a 3200 K con lente Fresnel. Sombra dura y definida; con difusión o softbox se ablanda.' },
  powerflo: { cat: 'luz', name: 'PowerFlo', hard: false, lm: 12000, beamDeg: 110, barn: true, grid: true, kelvins: [3200, 5600],
    desc: 'Cuatro tubos fluorescentes dimerizables. Fuente grande y suave. Con grilla se controla el derrame.' },
  tube: { cat: 'luz', name: 'Tubo LED RGB', hard: false, lm: 1800, point: true, rgb: true,
    desc: 'Tubo LED tipo Astera: emite hacia todos lados, temperatura regulable o cualquier color.' },
  panel: { cat: 'luz', name: 'Panel LED color', hard: false, lm: 3000, beamDeg: 60, barn: true, grid: true, rgb: true, diff: true,
    desc: 'Panel LED RGB chico. Luz semisuave, temperatura regulable o color.' },
  // prácticas (aparecen en cuadro)
  velador: { cat: 'practica', name: 'Velador', practical: true, point: true, bulbs: 'led', kelvins: [2700, 3000, 4000, 6500], height: 0.75, shade: true,
    desc: 'Lámpara de mesa con pantalla. La pantalla corta la luz hacia los costados: ilumina arriba y abajo.' },
  pie: { cat: 'practica', name: 'Lámpara de pie', practical: true, point: true, bulbs: 'led', kelvins: [2700, 3000, 4000, 6500], height: 0, shade: true,
    desc: 'Lámpara de pie de 1,6 m con pantalla. Típica luz motivada de un living.' },
  colgante: { cat: 'practica', name: 'Lámpara colgante', practical: true, point: true, bulbs: 'led', kelvins: [2700, 3000, 4000, 6500], height: 2.1, cone: true,
    desc: 'Colgante con pantalla abierta hacia abajo: un cono de luz sobre la mesa.' },
  bombita: { cat: 'practica', name: 'Bombita desnuda', practical: true, point: true, bulbs: 'inc', kelvins: [2700], height: 2.2,
    desc: 'Lámpara incandescente colgando del cable, sin pantalla. Sombra dura en todas direcciones.' },
  vela: { cat: 'practica', name: 'Vela', practical: true, point: true, bulbs: 'vela', kelvins: [1850], height: 0.75,
    desc: 'Una vela da alrededor de 12 lúmenes a 1850 K. Hace falta subir mucho el ISO o abrir el diafragma.' },
  // control
  flag: { cat: 'control', name: 'Bandera', desc: 'Tela negra en un marco sobre un C-stand. Bloquea la luz: cuanto más cerca del sujeto, más definido el corte.' },
  bounce: { cat: 'control', name: 'Rebote 5 en 1', desc: 'Aro de 107 cm. Blanco rebota suave, plata más brillante, oro cálido, negro resta luz y difusión ablanda lo que pasa a través.' },
  // mobiliario
  mesa: { cat: 'mueble', name: 'Mesa', size: [1.4, 0.75, 0.8], desc: 'Mesa de 140 × 80 cm.' },
  silla: { cat: 'mueble', name: 'Silla', size: [0.45, 0.9, 0.5], desc: 'Silla de madera.' },
  sillon: { cat: 'mueble', name: 'Sillón', size: [1.9, 0.85, 0.85], desc: 'Sillón de tres cuerpos.' },
  biblioteca: { cat: 'mueble', name: 'Biblioteca', size: [1.0, 1.9, 0.35], desc: 'Estantería con libros.' },
  cama: { cat: 'mueble', name: 'Cama', size: [1.45, 0.55, 2.0], desc: 'Cama de dos plazas.' },
  escritorio: { cat: 'mueble', name: 'Escritorio', size: [1.2, 0.75, 0.6], desc: 'Escritorio con cajonera.' },
  // aberturas (solo interior)
  ventana: { cat: 'abertura', name: 'Ventana', desc: 'Se ubica sobre una pared. Por ella entra el sol directo y la luz del cielo según la hora.' },
  puerta: { cat: 'abertura', name: 'Puerta', desc: 'Se ubica sobre una pared. Abierta deja pasar la luz del otro lado.' },
};

export const BULBS = {
  led: { label: 'LED', options: [[4, 350], [7, 600], [9, 806], [12, 1055], [15, 1400]] },
  inc: { label: 'Incandescente', options: [[25, 220], [40, 415], [60, 710], [100, 1340]] },
  vela: { label: 'Vela', options: [[0, 12]] },
};

export const FLAG_SIZES = { '45x60': [0.45, 0.6], '60x90': [0.6, 0.9], '120x120': [1.2, 1.2] };
export const DIFF = { none: { f: 1, r: 0, a: 0, label: 'Sin difusión' }, q: { f: 0.85, r: 5, a: 4, label: '1/4' }, h: { f: 0.7, r: 9, a: 8, label: '1/2' }, full: { f: 0.5, r: 14, a: 14, label: 'Completa' }, box: { f: 0.42, r: 20, a: 22, label: 'Softbox' } };
export const GRID = { none: 0, 90: 90, 60: 60, 40: 40 };
export const GEL = { none: { k: 0, f: 1, label: 'Sin gel' }, cto: { k: 3200, f: 0.6, label: 'CTO' }, ctb: { k: 5600, f: 0.35, label: 'CTB' } };
export const FACES = {
  white: { label: 'Blanco', rho: 0.8, col: [1, 1, 1], ang: 80, hex: '#f1f0ec' }, silver: { label: 'Plata', rho: 0.95, col: [1, 1, 1], ang: 50, hex: '#c9ccd3' },
  gold: { label: 'Oro', rho: 0.75, col: [1, 0.78, 0.45], ang: 55, hex: '#d4a441' }, black: { label: 'Negro', rho: 0.03, col: [1, 1, 1], ang: 80, hex: '#111111' },
  diff: { label: 'Difusión', rho: 0, col: [1, 1, 1], ang: 80, hex: '#e9e9f0' },
};
export const WOODS = { '#7a5634': 'Madera', '#3b2a1e': 'Wengué', '#c9b28f': 'Roble claro', '#e8e4dc': 'Blanco', '#2b2b2e': 'Negro', '#5a6b7a': 'Azul gris', '#8a3b2e': 'Bordó' };
export const LENSES = { fish: { f: 15, label: 'Ojo de pez 15 mm', fish: true }, 18: { f: 18, label: '18 mm' }, 50: { f: 50, label: '50 mm' }, 90: { f: 90, label: '90 mm' }, 135: { f: 135, label: '135 mm' } };
export const SKINS = ['#f2d3bd', '#e2b594', '#c9926c', '#a8704b', '#7a4a2e', '#4d2f1f'];
export const CITIES = {
  bsas: { name: 'Buenos Aires', lat: -34.6, lon: -58.38, tz: -3 },
  cba: { name: 'Córdoba', lat: -31.42, lon: -64.18, tz: -3 },
  mza: { name: 'Mendoza', lat: -32.89, lon: -68.84, tz: -3 },
  salta: { name: 'Salta', lat: -24.78, lon: -65.41, tz: -3 },
  ush: { name: 'Ushuaia', lat: -54.8, lon: -68.3, tz: -3 },
  mvd: { name: 'Montevideo', lat: -34.9, lon: -56.16, tz: -3 },
  scl: { name: 'Santiago de Chile', lat: -33.45, lon: -70.67, tz: -4 },
  cdmx: { name: 'Ciudad de México', lat: 19.43, lon: -99.13, tz: -6 },
  mad: { name: 'Madrid', lat: 40.42, lon: -3.7, tz: 1 },
  custom: { name: 'Otra (latitud y longitud)', lat: -34.6, lon: -58.38, tz: -3 },
};
export const isLightType = t => !!(TYPES[t] && (TYPES[t].lm || TYPES[t].powers || TYPES[t].practical));
