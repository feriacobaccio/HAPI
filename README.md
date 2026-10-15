# HAPI · Herramienta de Armado de Plantas de Iluminación

HAPI es un software libre para **enseñar y diseñar la iluminación** de una escena audiovisual. Corre en el navegador, sin instalar nada, en Windows, Mac, Linux y Chromebooks.

Se arma el set en una planta, se ubican luces, banderas, rebotes, muebles y personajes, y se ve el resultado en un **monitor de cámara** con lentes fijos, diafragma, ISO, filtros ND, balance de blancos y profundidad de campo.

> Proyecto hecho por pasión docente, sin fines comerciales. Las contribuciones son bienvenidas.

## Qué incluye

- **Tres tipos de escena:** estudio con fondo, interior (habitación con ventanas y puertas) y exterior (terreno abierto, calle o patio).
- **Luz natural según la hora:** posición aproximada del sol por hora, fecha y ciudad, con brújula para orientar el set. Amanecer, mediodía, hora dorada, hora azul y noche.
- **Equipos:** HMI (575 W a 12 kW), Fresnel de tungsteno, PowerFlo, tubo LED RGB, panel LED; viseras, difusión, grillas, gelatinas CTO/CTB.
- **Prácticas:** velador, lámpara de pie, colgante, bombita incandescente y vela, con distintas potencias.
- **Control:** banderas y rebote 5 en 1 (blanco, plata, oro, negro y difusión).
- **Mobiliario básico:** mesa, silla, sillón, biblioteca, cama y escritorio.
- **Personajes:** hasta dos, sentado, de pie o elevado, con rotación y tono de piel.
- **Cámara:** ojo de pez 15 mm, 18, 50, 90 y 135 mm; altura y angulación; movimiento A → B.
- **Medición:** lux en el rostro y diafragma sugerido.
- **Entregables:** planta en JPG con leyenda, plano de referencia en JPG, cuadros A y B, y la escena como archivo `.hapi.json` para volver a abrirla.

## Usarlo

- **En línea:** la versión publicada en GitHub Pages (ver *Publicar*).
- **Sin internet:** descargar `hapi-offline.html` y abrirlo con Chrome o Edge.

## Desarrollo

Requiere Node.js 18 o superior.

```bash
npm install
npm run dev           # servidor local con recarga
npm run build         # sitio web en dist/
npm run build:single  # un solo HTML en dist-single/ para usar sin internet
```

### Estructura

| Archivo | Qué hace |
|---|---|
| `src/state.js` | Estado de la escena y utilidades |
| `src/catalog.js` | Catálogo de equipos, prácticas, muebles, lentes y ciudades |
| `src/sun.js` | Posición solar aproximada y luz natural |
| `src/build.js` | Geometría: personajes, equipos, muebles y prácticas |
| `src/engine.js` | Motor 3D: entornos, luces, cámara, profundidad de campo, render |
| `src/plan.js` | Planta 2D: dibujo, arrastre y zoom |
| `src/ui.js` | Paneles y propiedades |
| `src/presets.js` | Esquemas de ejemplo |
| `src/io.js` | Guardar, abrir, autoguardado, deshacer y exportaciones |
| `src/main.js` | Arranque, bucle de render y vista 3D |

## Publicar en GitHub Pages

1. Subir este repositorio a GitHub (rama `main`).
2. En **Settings → Pages**, elegir **Source: GitHub Actions**.
3. Cada vez que se sube un cambio a `main`, el sitio se publica solo. El HTML para usar sin internet queda en `.../hapi-offline.html`.

## Precisión

HAPI es una **aproximación visual en tiempo real** pensada para planificar y aprender. Las intensidades parten de valores reales (lúmenes, lux, candelas), pero no reemplaza a un fotómetro ni a una prueba de cámara. La posición del sol es aproximada.

## Hoja de ruta

Ver [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Licencia

[MIT](LICENSE). Usa [three.js](https://threejs.org) (MIT).
