/*
 * Duck Race — les canards, dessinés par le code (aucune image).
 *
 * Chaque canard est dessiné une seule fois sur de petits canevas « hors écran » (des sprites),
 * puis recopié à chaque image : c'est beaucoup plus léger que de refaire les dégradés 60 fois par seconde.
 *
 * Le dessin utilise des unités abstraites (la boîte fait 176 × 152). Un sprite est fabriqué à la taille
 * voulue en multipliant ces unités par un facteur d'échelle.
 *
 * Un canard est composé de plusieurs sprites de même taille, superposés au moment du dessin :
 *   - `swim` : le corps vu sur l'eau (le bas du ventre s'estompe, comme s'il était immergé)
 *   - `air`  : le corps entier, pour l'envol
 *   - `wing` / `wingFar` : l'aile proche et l'aile lointaine, qui battent pendant l'envol
 *   - `feet` : les pattes, visibles seulement en l'air
 */
import { DUCKS } from './config.js';

/** Boîte de dessin (en unités). */
export const DUCK_BOX = { w: 176, h: 152 };
/** Longueur du canard, de la queue au bec (en unités) : c'est elle que `size` mesure en pixels. */
export const DUCK_LENGTH = 166;
/** Point du dessin autour duquel le canard pivote et qui sert de repère de position. */
export const PIVOT = { x: 82, y: 108 };
/** Hauteur de la ligne de flottaison par rapport au repère (unités, vers le bas). */
export const WATERLINE_OFFSET = 16;

const WING_PIVOT = { x: 100, y: 86 };
const FAR_WING_OFFSET = { x: 12, y: -16 };

const INK = '#0F2A44';

// --- Formes (chemins SVG) ------------------------------------------------------------------------

// Le corps est fait de trois formes qui se recouvrent : le corps, la queue relevée et la tête.
// Elles sont peintes avec le même dégradé, donc on ne voit pas les raccords.
const BODY_PARTS = [
  new Path2D('M 26 98 a 56 38 0 1 0 112 0 a 56 38 0 1 0 -112 0 Z'),
  new Path2D('M 34 94 C 22 86 14 76 12 64 C 11 58 16 56 21 58 C 36 62 50 68 58 80 Z'),
  new Path2D('M 90 54 a 28 28 0 1 0 56 0 a 28 28 0 1 0 -56 0 Z'),
];
const WING = new Path2D('M 102 80 C 80 66 44 70 30 96 C 46 112 84 112 104 98 C 110 92 108 84 102 80 Z');
const BEAK_UPPER = new Path2D('M 138 46 C 150 42 166 45 172 52 C 166 58 150 59 138 57 Z');
const BEAK_LOWER = new Path2D('M 138 56 C 152 58 166 57 171 54 C 167 62 152 64 138 62 Z');
const FOOT = new Path2D('M 54 126 C 64 124 80 126 88 135 C 78 147 62 147 54 139 Z');

// --- Petits outils de dessin ---------------------------------------------------------------------

/** Tache douce et elliptique (reflet ou ombre) : un dégradé radial étiré. */
function softBlob(ctx, cx, cy, rx, ry, rotation, inner, outer) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.scale(rx, ry);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

function ellipsePath(cx, cy, rx, ry, rotation = 0) {
  const path = new Path2D();
  path.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
  return path;
}

/** Remplit puis contourne une forme, avec un dégradé vertical. */
function paintShape(ctx, path, fill, stroke, lineWidth) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.stroke(path);
  ctx.fillStyle = fill;
  ctx.fill(path);
}

function verticalGradient(ctx, y0, y1, stops) {
  const gradient = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([at, color]) => gradient.addColorStop(at, color));
  return gradient;
}

// --- Accessoires : une forme reconnaissable par canard, même sans les couleurs -------------------

const ACCESSORIES = {
  // Nœud rouge sur l'arrière de la tête
  bow(ctx) {
    const red = verticalGradient(ctx, 14, 44, [[0, '#FF7A66'], [1, '#E23B2A']]);
    const lobes = [
      new Path2D('M 100 32 C 92 20 78 20 76 30 C 76 40 90 42 100 32 Z'),
      new Path2D('M 100 32 C 106 18 120 14 124 24 C 126 34 110 42 100 32 Z'),
    ];
    lobes.forEach((lobe) => paintShape(ctx, lobe, red, '#B7281B', 2.6));
    paintShape(ctx, ellipsePath(100, 32, 6.4, 6.4), '#F0503E', '#B7281B', 2.6);
  },

  // Lunettes de piscine : lentille bleue devant l'œil, bandeau autour de la tête
  goggles(ctx) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(118, 47);
    ctx.bezierCurveTo(108, 42, 98, 44, 90, 51);
    ctx.stroke();
    paintShape(ctx, ellipsePath(129, 49, 12, 11.5), 'rgba(150, 225, 255, 0.55)', INK, 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(129, 49, 7.2, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();
  },

  // Lunettes de soleil en forme de cœur
  shades(ctx) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(119, 44);
    ctx.lineTo(94, 46);
    ctx.stroke();
    const heart = new Path2D('M 130 60 C 117 52 114 40 121 37 C 126 35 130 39 130 42 C 130 39 134 35 139 37 C 146 40 143 52 130 60 Z');
    paintShape(ctx, heart, '#3C1E52', INK, 3);
    softBlob(ctx, 123, 43, 5, 3.2, -0.6, 'rgba(255,170,215,0.95)', 'rgba(255,170,215,0)');
  },

  // Béret bleu marine, un peu de travers
  beret(ctx) {
    const navy = verticalGradient(ctx, 16, 42, [[0, '#4A5FA8'], [1, '#1F2E66']]);
    ctx.save();
    ctx.translate(113, 29);
    ctx.rotate(-0.2);
    paintShape(ctx, ellipsePath(0, 0, 26, 11.5), navy, '#16204A', 3);
    paintShape(ctx, ellipsePath(0, 7, 18, 4.5), '#2B3B7C', '#16204A', 1.6);
    ctx.restore();
    paintShape(ctx, ellipsePath(108, 16, 3.8, 3.8), '#4A5FA8', '#16204A', 2);
  },

  // Plume jaune plantée à l'arrière de la tête
  feather(ctx) {
    const leaf = new Path2D('M 106 34 C 94 28 86 14 90 0 C 104 6 114 22 106 34 Z');
    paintShape(ctx, leaf, verticalGradient(ctx, 0, 34, [[0, '#FFE680'], [1, '#FFC21F']]), '#C98A00', 2.6);
    ctx.strokeStyle = '#C98A00';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(106, 34);
    ctx.quadraticCurveTo(98, 18, 90, 2);
    ctx.stroke();
  },
};

// --- Les sprites ---------------------------------------------------------------------------------

function paintBody(ctx, duck, swimming) {
  // Contour de la couleur sombre du canard, puis remplissage dégradé (clair en haut, sombre en bas)
  const fill = verticalGradient(ctx, 24, 138, [[0, duck.light], [0.42, duck.color], [1, duck.dark]]);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = duck.dark;
  BODY_PARTS.forEach((part) => ctx.stroke(part));
  ctx.fillStyle = fill;
  BODY_PARTS.forEach((part) => ctx.fill(part));

  // Relief et reflets de plastique : peints uniquement sur ce qui est déjà dessiné
  ctx.globalCompositeOperation = 'source-atop';
  softBlob(ctx, 84, 142, 74, 32, 0, 'rgba(8, 28, 58, 0.36)', 'rgba(8, 28, 58, 0)');
  softBlob(ctx, 70, 74, 40, 9, -0.12, 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0)');
  softBlob(ctx, 108, 38, 16, 8.5, -0.5, 'rgba(255,255,255,0.78)', 'rgba(255,255,255,0)');
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill(ellipsePath(103, 36, 4.4, 2.4, -0.5));
  ctx.globalCompositeOperation = 'source-over';

  // Bec
  const upper = verticalGradient(ctx, 42, 60, [[0, '#FFB347'], [1, '#FF8A1F']]);
  paintShape(ctx, BEAK_LOWER, '#E8730A', '#B85400', 2.4);
  paintShape(ctx, BEAK_UPPER, upper, '#B85400', 2.4);

  // Joue et œil
  softBlob(ctx, 133, 63, 7, 5, 0, 'rgba(255, 110, 140, 0.5)', 'rgba(255, 110, 140, 0)');
  ctx.fillStyle = INK;
  ctx.fill(ellipsePath(128, 48, 3.9, 4.3));
  ctx.fillStyle = '#fff';
  ctx.fill(ellipsePath(129.4, 46.4, 1.4, 1.4));

  ACCESSORIES[duck.accessory]?.(ctx);

  if (swimming) {
    // Le bas du ventre s'estompe : le canard est dans l'eau
    ctx.globalCompositeOperation = 'destination-out';
    const fade = verticalGradient(ctx, 112, 140, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 112, DUCK_BOX.w, DUCK_BOX.h - 112);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function paintWing(ctx, duck, far) {
  const fill = far
    ? verticalGradient(ctx, 66, 112, [[0, duck.color], [1, duck.dark]])
    : verticalGradient(ctx, 66, 112, [[0, duck.light], [0.6, duck.color], [1, duck.color]]);
  paintShape(ctx, WING, fill, duck.dark, 4);
  // Quelques plumes sur le bout de l'aile
  ctx.strokeStyle = duck.dark;
  ctx.globalAlpha = far ? 0.4 : 0.6;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  [[44, 88, 62, 91], [42, 96, 64, 99], [48, 104, 68, 105]].forEach(([x0, y0, x1, y1]) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  if (!far) {
    ctx.globalCompositeOperation = 'source-atop';
    softBlob(ctx, 80, 78, 22, 7, -0.2, 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'source-over';
  }
}

function paintFeet(ctx) {
  [0, 24].forEach((dx) => {
    ctx.save();
    ctx.translate(dx, 0);
    paintShape(ctx, FOOT, '#FF8A1F', '#B85400', 2.4);
    ctx.restore();
  });
}

/**
 * Fabrique les sprites d'un canard.
 * @param {number} index  numéro du canard dans DUCKS
 * @param {number} size   longueur du canard à l'écran, en pixels CSS
 * @param {number} dpr    densité de pixels de l'écran
 */
export function buildDuckSprites(index, size, dpr = 1) {
  const duck = DUCKS[index];
  const k = (size / DUCK_LENGTH) * dpr;     // pixels d'image par unité de dessin
  const w = Math.ceil(DUCK_BOX.w * k);
  const h = Math.ceil(DUCK_BOX.h * k);

  const make = (paint) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.scale(k, k);
    paint(ctx);
    return canvas;
  };

  return {
    index,
    size,
    dpr,
    w,
    h,
    swim: make((ctx) => paintBody(ctx, duck, true)),
    air: make((ctx) => paintBody(ctx, duck, false)),
    wing: make((ctx) => paintWing(ctx, duck, false)),
    wingFar: make((ctx) => paintWing(ctx, duck, true)),
    feet: make(paintFeet),
  };
}

/**
 * Dessine un canard, son repère (PIVOT) placé en (x, y), dans un contexte exprimé en pixels CSS.
 * @param {object} pose
 * @param {number} [pose.angle]  inclinaison du corps en radians (positif = le bec plonge)
 * @param {number} [pose.wing]   angle de l'aile en radians : 0 = repliée, positif = relevée
 * @param {boolean} [pose.air]   vrai en l'air : corps entier, pattes visibles, aile lointaine battante
 * @param {number} [pose.alpha]
 */
export function drawDuck(ctx, sprites, x, y, pose = {}) {
  const { angle = 0, wing = 0.1, air = false, alpha = 1 } = pose;
  const u = sprites.size / DUCK_LENGTH;           // pixels CSS par unité de dessin
  const width = sprites.w / sprites.dpr;
  const height = sprites.h / sprites.dpr;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  // On se place sur l'origine de la boîte de dessin
  ctx.translate(-PIVOT.x * u, -PIVOT.y * u);

  const drawWing = (image, offsetX, offsetY, rotation) => {
    ctx.save();
    ctx.translate((WING_PIVOT.x + offsetX) * u, (WING_PIVOT.y + offsetY) * u);
    ctx.rotate(rotation);
    ctx.drawImage(image, -WING_PIVOT.x * u, -WING_PIVOT.y * u, width, height);
    ctx.restore();
  };

  // Derrière le corps : aile lointaine (en l'air) et pattes
  if (air) {
    drawWing(sprites.wingFar, FAR_WING_OFFSET.x, FAR_WING_OFFSET.y, wing * 0.9 + 0.12);
    ctx.drawImage(sprites.feet, 0, 0, width, height);
  }
  ctx.drawImage(air ? sprites.air : sprites.swim, 0, 0, width, height);
  drawWing(sprites.wing, 0, 0, wing);

  ctx.restore();
}

/**
 * Dessine le portrait d'un canard dans un <canvas> (cartes du menu, classement des résultats).
 * La taille d'affichage du canevas est fixée ici, en pixels CSS.
 */
export function paintPortrait(canvas, index, size, dpr = Math.min(window.devicePixelRatio || 1, 2)) {
  const sprites = buildDuckSprites(index, size, dpr);
  canvas.width = sprites.w;
  canvas.height = sprites.h;
  canvas.style.width = `${sprites.w / dpr}px`;
  canvas.style.height = `${sprites.h / dpr}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, sprites.w, sprites.h);
  const u = size / DUCK_LENGTH;
  drawDuck(ctx, sprites, PIVOT.x * u, PIVOT.y * u, { air: true, wing: 0.18 });
}
