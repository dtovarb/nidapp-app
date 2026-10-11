// Genera los íconos de la app (PWA y tiendas) a partir de una casita pixel art.
// Uso: node scripts/make-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'fs';

// Casita 16×16: cada letra es un color de la paleta.
const art = [
  '................',
  '.......RR.......',
  '......RRRR......',
  '.....RRRRRR.....',
  '....RRRRRRRR....',
  '...RRRRRRRRRR...',
  '..RRRRRRRRRRRR..',
  '...WWWWWWWWWW...',
  '...WBBWWWWBBW...',
  '...WBBWWWWBBW...',
  '...WWWWDDWWWW...',
  '...WWWWDDWWWW...',
  '...WWWWDDWWWW...',
  '..GGGGGGGGGGGG..',
  '................',
  '................',
];
const palette = { R: '#ff5d8f', W: '#fffdf5', B: '#48a7e8', D: '#9b5de5', G: '#6acb7a' };

function svg(size, padding, bg) {
  const cell = (size - padding * 2) / 16;
  const rects = art.flatMap((row, y) => [...row].map((c, x) => palette[c]
    ? `<rect x="${(padding + x * cell).toFixed(2)}" y="${(padding + y * cell).toFixed(2)}" width="${(cell + 0.5).toFixed(2)}" height="${(cell + 0.5).toFixed(2)}" fill="${palette[c]}" stroke="#202036" stroke-width="${(cell * 0.08).toFixed(2)}"/>`
    : '')).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${bg.rx}" fill="${bg.fill}"/>${rects}</svg>`);
}

mkdirSync('public/icons', { recursive: true });
const out = [
  // Fondo violeta en todas las versiones (es el ícono que se ve al instalar la app).
  ['public/icons/icon-192.png', 192, 30, { fill: '#a56de7', rx: 40 }],
  ['public/icons/icon-512.png', 512, 80, { fill: '#a56de7', rx: 104 }],
  // Maskable: el sistema recorta en círculo o gota, por eso lleva más margen y fondo completo.
  ['public/icons/maskable-512.png', 512, 104, { fill: '#a56de7', rx: 0 }],
  ['public/icons/apple-touch-icon.png', 180, 28, { fill: '#a56de7', rx: 0 }],
  ['app/icon.png', 64, 6, { fill: '#a56de7', rx: 14 }],
];
for (const [file, size, pad, bg] of out) await sharp(svg(size, pad, bg)).png().toFile(file);
console.log('Íconos generados');
