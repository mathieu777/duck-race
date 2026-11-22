/*
 * Duck Race — le décor et le dessin de la course.
 *
 * Ce module sait dessiner un lac au soleil couchant, ses rives, ses lignes de bouées, les ligne de
 * départ et d'arrivée, et les canards. Il ne décide de rien : on lui donne l'état de la course
 * (race.js) et il dessine. Tout ce qui est coûteux (rives, motifs d'eau, bouées, sprites) est
 * préparé une fois dans des canevas « hors écran » à chaque changement de taille d'écran.
 *
 * Repères :
 *  - Le monde est une piste horizontale très longue ; `camera.x` est l'abscisse (dans le monde) du bord
 *    gauche de l'écran. Un canard à la progression `p` (0 à 1) est en `worldX(p)`.
 *  - Les 5 couloirs sont empilés verticalement entre deux rives ; le couloir d'un canard est son numéro.
 */
import { COLORS, DUCKS, HUD_SPACE, COMPACT_HEIGHT, WORLD, FLIGHT, HOP } from './config.js';
import { buildDuckSprites, drawDuck, WATERLINE_OFFSET, DUCK_LENGTH } from './sprites.js';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mix = (a, b, t) => a + (b - a) * t;
const FONT_DISPLAY = "'DynaPuff', 'Figtree', system-ui, sans-serif";
const FONT_UI = "'Figtree', system-ui, sans-serif";

/** Hasard reproductible : le décor est toujours le même d'un lancement à l'autre. */
function mulberry(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(width, height, dpr) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { canvas, ctx };
}

/** Rectangle à coins arrondis (écrit à la main : `roundRect` n'existe pas sur les anciens iPhone). */
function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// --- Fabrication du décor (une fois par taille d'écran) --------------------------------------------

const WATER_STOPS = ['#45DDE2', '#1DB9D8', '#0D83BB'];

/** Tuile de petites vaguelettes blanches, qui se répète sans raccord visible. */
function makeWaveTile(dpr) {
  const w = 512;
  const h = 256;
  const { canvas, ctx } = makeCanvas(w, h, dpr);
  const rnd = mulberry(7);
  ctx.lineCap = 'round';
  for (let i = 0; i < 30; i += 1) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 7 + rnd() * 13;
    const alpha = 0.16 + rnd() * 0.24;
    const width = 1.5 + rnd() * 1.5;
    for (const dx of [-w, 0, w]) {
      for (const dy of [-h, 0, h]) {
        if (x + dx < -r * 2 || x + dx > w + r * 2 || y + dy < -r * 2 || y + dy > h + r * 2) continue;
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();
      }
    }
  }
  return canvas;
}

const BANKS = {
  far: {
    deep: '#0B5A4F', mid: '#1C8A5E', edge: '#47B56F', bush: '#168255', bushLight: '#7ACB5A',
    reeds: ['#0B5A4F', '#157A58', '#3FAE6E', '#B7E06A'], stone: '#BDB6A3',
  },
  near: {
    deep: '#0A4D46', mid: '#167A56', edge: '#3BAA68', bush: '#12714E', bushLight: '#6FC456',
    reeds: ['#0A4D46', '#0F6B50', '#3AAE6F', '#C2E56E'], stone: '#CBC4AF',
  },
};

/**
 * Une rive qui se répète à l'horizontale. y = 0 est le côté terre, y = height le bord de l'eau.
 * `scale` agrandit les détails (la rive proche est plus grosse que la rive lointaine).
 */
function paintBank(ctx, w, h, seed, scale, palette) {
  const rnd = mulberry(seed);
  const soil = ctx.createLinearGradient(0, 0, 0, h);
  soil.addColorStop(0, palette.deep);
  soil.addColorStop(0.7, palette.mid);
  soil.addColorStop(1, palette.edge);
  ctx.fillStyle = soil;
  ctx.fillRect(0, 0, w, h);

  // Dessine un objet et sa copie de l'autre côté de la tuile s'il déborde (pour le raccord)
  const wrapped = (x, radius, draw) => {
    draw(x);
    if (x - radius < 0) draw(x + w);
    if (x + radius > w) draw(x - w);
  };

  // Buissons : des amas de boules en volume, éclairées par le soleil du côté droit
  for (let i = 0; i < 8; i += 1) {
    const x = rnd() * w;
    const y = h * (0.4 + rnd() * 0.22);
    const r = (12 + rnd() * 13) * scale;
    const blobs = Array.from({ length: 3 + Math.floor(rnd() * 2) }, () => [
      (rnd() - 0.5) * r * 2, (rnd() - 0.5) * r * 0.5, r * (0.7 + rnd() * 0.5),
    ]);
    wrapped(x, r * 2, (xx) => {
      for (const [ox, oy, br] of blobs) {
        const light = ctx.createRadialGradient(xx + ox + br * 0.35, y + oy - br * 0.35, br * 0.1, xx + ox, y + oy, br);
        light.addColorStop(0, palette.bushLight);
        light.addColorStop(0.55, palette.bush);
        light.addColorStop(1, palette.deep);
        ctx.fillStyle = light;
        ctx.beginPath();
        ctx.arc(xx + ox, y + oy, br, 0, TAU);
        ctx.fill();
      }
    });
  }

  // Fleurs minuscules dans l'herbe
  const petals = ['#FFFFFF', '#FFD3E4', '#FFE680'];
  for (let i = 0; i < 24; i += 1) {
    const x = rnd() * w;
    const y = h * (0.3 + rnd() * 0.5);
    const color = petals[Math.floor(rnd() * petals.length)];
    const r = (1.6 + rnd() * 1.4) * scale;
    wrapped(x, r, (xx) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(xx, y, r, 0, TAU);
      ctx.fill();
    });
  }

  // Cailloux au bord de l'eau
  for (let i = 0; i < 9; i += 1) {
    const x = rnd() * w;
    const rx = (4 + rnd() * 7) * scale;
    const ry = rx * (0.5 + rnd() * 0.15);
    wrapped(x, rx, (xx) => {
      ctx.fillStyle = palette.stone;
      ctx.beginPath();
      ctx.ellipse(xx, h - ry * 0.8, rx, ry, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(xx - rx * 0.25, h - ry * 1.15, rx * 0.5, ry * 0.35, 0, 0, TAU);
      ctx.fill();
    });
  }

  // Roseaux, dont certains portent une quenouille
  ctx.lineCap = 'round';
  for (let i = 0; i < 52; i += 1) {
    const x = rnd() * w;
    const len = (14 + rnd() * 40) * scale;
    const lean = (rnd() - 0.5) * 16 * scale;
    const color = palette.reeds[Math.floor(rnd() * palette.reeds.length)];
    const lineWidth = (1.5 + rnd() * 1.6) * scale;
    const cattail = rnd() < 0.18;
    wrapped(x, 30 * scale, (xx) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(xx, h + 2);
      ctx.quadraticCurveTo(xx + lean * 0.2, h - len * 0.6, xx + lean, h - len);
      ctx.stroke();
      if (cattail) {
        ctx.fillStyle = '#7A4A2B';
        ctx.beginPath();
        ctx.ellipse(xx + lean, h - len - 3 * scale, 2.6 * scale, 7 * scale, lean * 0.02, 0, TAU);
        ctx.fill();
      }
    });
  }

  // Liseré clair : l'eau lèche la rive
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(0, h - 3 * scale, w, 3 * scale);
}

/** Guirlande de fanions accrochée à la rive du fond (une tuile de 360 px, qui se répète). */
function paintBunting(ctx, tileW, edgeY) {
  const span = 360;
  const colors = [...DUCKS.map((d) => d.color), COLORS.buoy];
  for (let start = 0; start < tileW; start += span) {
    const topY = edgeY - 34;
    ctx.fillStyle = '#5B3B22';
    ctx.fillRect(start - 1.5, topY - 2, 3, 38);
    // La guirlande pend entre deux poteaux : un arc
    const sag = (x) => topY + Math.sin((Math.PI * (x - start)) / span) * 38;
    ctx.strokeStyle = 'rgba(15,42,68,0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = start; x <= start + span; x += 6) {
      if (x === start) ctx.moveTo(x, sag(x)); else ctx.lineTo(x, sag(x));
    }
    ctx.stroke();
    for (let i = 1; i < 10; i += 1) {
      const x = start + (span / 10) * i;
      const y = sag(x);
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x + 8, y);
      ctx.lineTo(x, y + 18);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function makeBank(layout, kind) {
  const w = 1080;
  const far = kind === 'far';
  const bankH = far ? layout.trackTop + 16 : layout.H - layout.trackBottom + 16;
  const extra = far ? 32 : 0;                 // place pour la guirlande qui pend sur l'eau
  const { canvas, ctx } = makeCanvas(w, bankH + extra, layout.dpr);
  if (far) {
    paintBank(ctx, w, bankH, 11, 1, BANKS.far);
    paintBunting(ctx, w, bankH);
  } else {
    // La rive proche est vue de l'autre côté : on retourne le dessin, l'eau est en haut
    ctx.translate(0, bankH);
    ctx.scale(1, -1);
    paintBank(ctx, w, bankH, 23, 1.35, BANKS.near);
  }
  return { canvas, w, h: bankH + extra, bankH };
}

/** Tuile « une bouée blanche » le long d'une corde (elle se répète tous les ROPE_PERIOD pixels). */
const ROPE_PERIOD = 38;
function makeRopeTile(dpr) {
  const w = ROPE_PERIOD;
  const h = 24;
  const { canvas, ctx } = makeCanvas(w, h, dpr);
  ctx.strokeStyle = 'rgba(246,251,251,0.75)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(w, 12);
  ctx.stroke();
  [[ROPE_PERIOD / 2, COLORS.foam, '#A6C4CF']].forEach(([cx, color, edge]) => {
    ctx.fillStyle = 'rgba(3,52,82,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, 16, 9.5, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.arc(cx, 12, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, 11.4, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(cx - 2.6, 8, 3, 1.8, -0.5, 0, TAU);
    ctx.fill();
  });
  return canvas;
}

function makeChecker(dpr) {
  const { canvas, ctx } = makeCanvas(24, 24, dpr);
  ctx.fillStyle = COLORS.foam;
  ctx.fillRect(0, 0, 24, 24);
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(0, 0, 12, 12);
  ctx.fillRect(12, 12, 12, 12);
  return canvas;
}

/** Voile final : bords assombris, lumière dorée en haut à droite, dégradés derrière l'interface. */
function makeVignette(layout) {
  const { W, H, dpr } = layout;
  const { canvas, ctx } = makeCanvas(W, H, dpr);
  const radius = Math.hypot(W, H) * 0.62;
  const dark = ctx.createRadialGradient(W / 2, H / 2, radius * 0.45, W / 2, H / 2, radius);
  dark.addColorStop(0, 'rgba(3,30,56,0)');
  dark.addColorStop(1, 'rgba(3,30,56,0.38)');
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, W, H);

  const sun = ctx.createRadialGradient(W * 0.98, -H * 0.04, 0, W * 0.98, -H * 0.04, Math.max(W, H) * 0.85);
  sun.addColorStop(0, 'rgba(255,224,150,0.34)');
  sun.addColorStop(1, 'rgba(255,224,150,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);

  const top = ctx.createLinearGradient(0, 0, 0, layout.trackTop);
  top.addColorStop(0, 'rgba(3,30,56,0.32)');
  top.addColorStop(1, 'rgba(3,30,56,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, layout.trackTop);

  const bottom = ctx.createLinearGradient(0, layout.trackBottom, 0, H);
  bottom.addColorStop(0, 'rgba(3,30,56,0)');
  bottom.addColorStop(1, 'rgba(3,30,56,0.34)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, layout.trackBottom, W, H - layout.trackBottom);
  return canvas;
}

function makeGlints(layout) {
  const rnd = mulberry(31);
  const glints = [];
  for (let i = 0; i < 26; i += 1) {
    glints.push({
      x: rnd() * layout.W * 2.2,
      y: rnd(),
      size: 3 + rnd() * 4.5,
      phase: rnd() * TAU,
      speed: 1.4 + rnd() * 1.8,
    });
  }
  return glints;
}

// --- La scène --------------------------------------------------------------------------------------

export function createScene() {
  let L = null;                 // mise en page courante
  let art = null;               // décor préparé
  let sprites = null;           // sprites des 5 canards
  let hero = null;              // grand canard du menu { index, size, sprites }
  const camera = { x: 0, anchor: 0 };
  const scratch = document.createElement('canvas').getContext('2d');

  function computeLayout(W, H, dpr, safe) {
    const compact = H < COMPACT_HEIGHT;
    const top = safe.top + (compact ? HUD_SPACE.compactTop : HUD_SPACE.top);
    const bottom = safe.bottom + (compact ? HUD_SPACE.compactBottom : HUD_SPACE.bottom);
    const trackH = Math.max(H * 0.5, H - top - bottom);
    const laneH = trackH / 5;
    const size = Math.min(laneH * 0.78, W * 0.26);         // longueur d'un canard
    const trackLen = WORLD.lengthScreens * W;
    const startLine = WORLD.startLine * W;
    const startX = startLine - size * 0.55;                // le bec touche la ligne de départ
    return {
      W, H, dpr, safe, compact,
      trackTop: top, trackH, trackBottom: top + trackH, laneH,
      size, u: size / DUCK_LENGTH,
      trackLen, startLine, startX,
      finishLine: startX + trackLen + size * 0.42,         // le bec touche la ligne d'arrivée
    };
  }

  function resize(W, H, dpr, safe) {
    const next = computeLayout(W, H, dpr, safe);
    const sameShape = L && next.W === L.W && next.H === L.H && next.dpr === L.dpr
      && next.trackTop === L.trackTop && next.trackBottom === L.trackBottom;
    const sameSize = L && Math.abs(next.size - L.size) < 0.5 && next.dpr === L.dpr;
    L = next;
    if (!sameShape || !art) {
      art = {
        waveTile: makeWaveTile(dpr),
        waveA: null,
        farBank: makeBank(L, 'far'),
        nearBank: makeBank(L, 'near'),
        ropeTile: makeRopeTile(dpr),
        checkerTile: makeChecker(dpr),
        vignette: makeVignette(L),
        glints: makeGlints(L),
      };
      art.waves = scratch.createPattern(art.waveTile, 'repeat');
      art.rope = scratch.createPattern(art.ropeTile, 'repeat');
      art.checker = scratch.createPattern(art.checkerTile, 'repeat');
      art.water = scratch.createLinearGradient(0, 0, 0, H);
      WATER_STOPS.forEach((color, i) => art.water.addColorStop(i / (WATER_STOPS.length - 1), color));
    }
    if (!sameSize || !sprites) {
      sprites = DUCKS.map((_, i) => buildDuckSprites(i, L.size, L.dpr));
    }
    hero = null;
    camera.anchor = WORLD.playerAnchor * W;
  }

  const worldX = (progress) => L.startX + progress * L.trackLen;

  /** Position d'un canard dans le monde (x) et sa ligne de flottaison (y) : sert à placer les effets. */
  function anchorOf(racer) {
    const laneY = L.trackTop + L.laneH * (racer.index + 0.5);
    return { x: worldX(racer.progress + racer.glide), y: laneY + 0.1 * L.size + WATERLINE_OFFSET * L.u };
  }

  /** La caméra suit le joueur, en gardant si possible le premier à l'écran. */
  function follow(race, dt, flying) {
    const player = race.racers[race.playerIndex];
    const playerX = worldX(player.progress + player.glide);
    const wantedAnchor = (flying ? WORLD.flightAnchor : WORLD.playerAnchor) * L.W;
    camera.anchor += (wantedAnchor - camera.anchor) * (1 - Math.exp(-4 * dt));

    let leaderX = -Infinity;
    for (const racer of race.racers) leaderX = Math.max(leaderX, worldX(racer.progress + racer.glide));

    let target = playerX - camera.anchor;
    target = Math.max(target, leaderX - WORLD.leaderLimit * L.W);   // le premier reste visible…
    target = Math.min(target, playerX - 0.15 * L.W);                // …mais jamais au détriment du joueur
    target = Math.min(target, L.finishLine - WORLD.finishAnchor * L.W);
    target = Math.max(target, 0);
    camera.x += (target - camera.x) * (1 - Math.exp(-6.5 * dt));
  }

  function resetCamera() {
    camera.x = 0;
    camera.anchor = WORLD.playerAnchor * L.W;
  }

  // --- Dessin des couches ---

  function fillPattern(ctx, pattern, tx, ty, scale, alpha, x, y, w, h) {
    pattern.setTransform({ a: scale / L.dpr, b: 0, c: 0, d: scale / L.dpr, e: tx, f: ty });
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pattern;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }

  function drawWater(ctx, v) {
    const { W, H } = L;
    ctx.fillStyle = art.water;
    ctx.fillRect(0, 0, W, H);
    // Deux couches de vaguelettes qui défilent à des vitesses différentes (effet de profondeur)
    fillPattern(ctx, art.waves, -(camera.x * 0.92) - v.time * 9, Math.sin(v.time * 0.7) * 3, 1, 0.95, 0, 0, W, H);
    fillPattern(ctx, art.waves, -(camera.x * 0.7) - v.time * 5 + 140, 90 + Math.sin(v.time * 0.5) * 4, 1.7, 0.45, 0, 0, W, H);

    // Éclats de soleil qui scintillent
    ctx.fillStyle = '#fff';
    const period = W * 2.2;
    for (const glint of art.glints) {
      const x = (((glint.x - camera.x * 0.95) % period) + period) % period - 20;
      if (x > W + 20) continue;
      const y = L.trackTop + glint.y * L.trackH;
      const flicker = Math.max(0, Math.sin(v.time * glint.speed + glint.phase));
      if (flicker < 0.05) continue;
      ctx.globalAlpha = 0.85 * flicker;
      const s = glint.size * (0.6 + 0.4 * flicker);
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * 0.16, 0, 0, TAU);
      ctx.ellipse(x, y, s * 0.16, s, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBankLayer(ctx, bank, parallax, atTop, v) {
    const offset = (camera.x * parallax) % bank.w;
    const y = atTop ? 0 : L.H - bank.h;
    const h = bank.h;
    for (let x = -offset; x < L.W; x += bank.w) {
      ctx.drawImage(bank.canvas, x, y, bank.w, h);
    }
    // Écume le long de la rive (une ligne qui ondule)
    const edge = atTop ? L.trackTop : L.trackBottom;
    ctx.strokeStyle = 'rgba(246,251,251,0.55)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let x = 0; x <= L.W + 12; x += 12) {
      const wobble = Math.sin(x * 0.045 + v.time * 1.6 + (atTop ? 0 : 2)) * 1.6;
      if (x === 0) ctx.moveTo(x, edge + wobble); else ctx.lineTo(x, edge + wobble);
    }
    ctx.stroke();
  }

  function drawRopes(ctx, v) {
    const period = ROPE_PERIOD;
    // Les couloirs s'arrêtent un peu après la ligne d'arrivée : derrière, c'est de l'eau libre
    const width = Math.min(L.W, L.finishLine - camera.x + 12);
    if (width <= 0) return;
    for (let i = 1; i <= 4; i += 1) {          // 4 cordes entre les 5 couloirs (les rives font les bords)
      const y = L.trackTop + i * L.laneH;
      const bob = Math.sin(v.time * 2.1 + i * 1.3) * 1.2;
      fillPattern(ctx, art.rope, -(camera.x % period), y - 12 + bob, 1, 1, 0, y - 12 + bob, width, 24);
    }
  }

  /** Le couloir du joueur est éclairé : une bande claire, plus lumineuse au centre, qu'on repère même du coin de l'œil. */
  function drawPlayerLane(ctx, v) {
    const player = v.race.racers.find((racer) => racer.isPlayer);
    const width = Math.min(L.W, L.finishLine - camera.x + 12);     // comme les cordes : elle s'arrête après l'arrivée
    if (!player || width <= 0) return;
    const y = L.trackTop + player.index * L.laneH;
    const glow = ctx.createLinearGradient(0, y, 0, y + L.laneH);
    glow.addColorStop(0, 'rgba(255,255,255,0)');
    glow.addColorStop(0.5, 'rgba(255,255,255,0.32)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, y, width, L.laneH);
  }

  function drawPole(ctx, x, atTop, color, label, v) {
    // Le mât du haut est plus long : sa bannière se pose au-dessus des étiquettes des canards
    const poleH = L.compact ? 26 : atTop ? 54 : 40;
    const baseY = atTop ? L.trackTop - 2 : L.trackBottom + 2;
    const dir = atTop ? -1 : 1;
    const topY = baseY + dir * poleH;
    ctx.fillStyle = '#5B3B22';
    ctx.fillRect(x - 2, Math.min(baseY, topY), 4, poleH);
    // Fanion ou bannière qui se balance un peu
    ctx.save();
    ctx.translate(x + 2, topY + (atTop ? 0 : -2));
    ctx.rotate(Math.sin(v.time * 2.2 + x * 0.01) * 0.04);
    if (label && atTop && !L.compact) {
      roundedRect(ctx, 0, 0, 74, 24, 6);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `600 14px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 37, 13);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, atTop ? 0 : -14);
      ctx.lineTo(26, atTop ? 8 : -7);
      ctx.lineTo(0, atTop ? 16 : 0);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawStartAndFinish(ctx, v) {
    // Ligne de départ : traits blancs en pointillés
    const sx = L.startLine - camera.x;
    if (sx > -40 && sx < L.W + 40) {
      ctx.fillStyle = 'rgba(246,251,251,0.9)';
      for (let y = L.trackTop; y < L.trackBottom; y += 18) ctx.fillRect(sx - 2, y, 4, 10);
      drawPole(ctx, sx, true, '#0E9AA7', 'Start', v);
      drawPole(ctx, sx, false, '#0E9AA7', null, v);
    }
    // Ligne d'arrivée : bande à damier
    const fx = L.finishLine - camera.x;
    if (fx > -60 && fx < L.W + 60) {
      fillPattern(ctx, art.checker, fx - 12, L.trackTop, 1, 1, fx - 12, L.trackTop, 24, L.trackH);
      drawPole(ctx, fx, true, COLORS.buoy, 'Finish', v);
      drawPole(ctx, fx, false, COLORS.buoy, null, v);
    }
  }

  function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
  }

  /** Dessine un canard avec son ombre, son sillage et l'anneau d'eau autour de lui. */
  function drawRacer(ctx, racer, v) {
    const { size, u } = L;
    const x = worldX(racer.progress + racer.glide) - camera.x;
    if (x < -size * 1.7 || x > L.W + size * 1.7) return null;

    const t = v.time;
    const laneY = L.trackTop + L.laneH * (racer.index + 0.5);
    const bob = Math.sin(t * 4.2 + racer.index * 1.7) * 0.014 * size;
    const baseY = laneY + 0.1 * size + bob;               // repère du canard (le centre de son corps)
    const waterY = baseY + WATERLINE_OFFSET * u;          // ligne de flottaison

    let lift = 0;
    let wing = 0.08 + 0.03 * Math.sin(t * 3 + racer.index);
    let tilt = Math.sin(t * 3.1 + racer.index) * 0.022 - clamp((racer.speed - 0.066) * 1.4, -0.05, 0.1);
    let airborne = false;

    if (racer.flightT >= 0) {
      // Envol : le canard monte, bat des ailes, puis se pose
      const phase = racer.flightT / FLIGHT.duration;
      lift = Math.pow(Math.sin(Math.PI * phase), 0.85) * L.laneH * 0.5;
      wing = 0.55 + 0.8 * Math.sin(phase * TAU * 4.2 + 0.7);
      tilt = mix(-0.32, 0.2, phase);
      airborne = true;
    } else if (racer.hopT >= 0) {
      // Petit bond d'un adversaire qui sprinte
      const phase = racer.hopT / HOP.duration;
      lift = Math.sin(Math.PI * phase) * L.laneH * 0.14;
      wing = 0.3 + 0.35 * Math.sin(phase * TAU * 3);
      tilt = mix(-0.12, 0.08, phase);
      airborne = lift > size * 0.05;
    }
    const height01 = clamp(lift / (L.laneH * 0.5), 0, 1);

    // Ombre sur l'eau : elle reste au sol et rétrécit quand le canard monte
    ctx.fillStyle = `rgba(2,44,70,${0.3 * (1 - 0.55 * height01)})`;
    ellipse(ctx, x, waterY + 3, size * 0.42 * (1 - 0.3 * height01), size * 0.075 * (1 - 0.2 * height01));
    ctx.fill();

    // Sillage : deux traits qui s'écartent derrière le canard
    const water = 1 - clamp(lift / (size * 0.12), 0, 1);
    const pace = clamp(racer.speed / 0.075, 0, 1.8);
    if (water > 0.05 && pace > 0.05) {
      const len = size * (0.5 + 0.9 * pace);
      const sternX = x - size * 0.34;
      const gradient = ctx.createLinearGradient(sternX, 0, sternX - len, 0);
      gradient.addColorStop(0, `rgba(246,251,251,${0.6 * water})`);
      gradient.addColorStop(1, 'rgba(246,251,251,0)');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = Math.max(1.6, size * 0.035);
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sternX, waterY + side * size * 0.02);
        ctx.quadraticCurveTo(sternX - len * 0.5, waterY + side * size * 0.1, sternX - len, waterY + side * size * (0.17 + 0.05 * pace));
        ctx.stroke();
      }
    }

    // Anneau d'eau : la moitié arrière passe derrière le canard, la moitié avant devant.
    // Celui du joueur est jaune et plus épais : on le retrouve d'un coup d'œil dans le peloton.
    const isYou = racer.isPlayer && v.showMarker;
    const ringRx = size * (isYou ? 0.47 : 0.43);
    const ringRy = size * (isYou ? 0.095 : 0.085);
    const ringWidth = Math.max(isYou ? 2.4 : 1.5, size * (isYou ? 0.05 : 0.03));
    const ringAlpha = isYou ? Math.max(water, 0.6) : water;   // en vol, l'anneau du joueur marque l'endroit où il se posera
    if (ringAlpha > 0.02) {
      ctx.globalAlpha = ringAlpha;
      ctx.fillStyle = isYou ? 'rgba(255,203,31,0.26)' : 'rgba(246,251,251,0.14)';
      ellipse(ctx, x, waterY - 1, ringRx, ringRy);
      ctx.fill();
      ctx.strokeStyle = isYou ? 'rgba(255,214,64,0.95)' : 'rgba(246,251,251,0.55)';
      ctx.lineWidth = ringWidth;
      ctx.beginPath();
      ctx.ellipse(x, waterY - 1, ringRx, ringRy, 0, Math.PI, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    drawDuck(ctx, sprites[racer.index], x, baseY - lift, { angle: tilt, wing, air: airborne });

    if (ringAlpha > 0.02) {
      ctx.globalAlpha = ringAlpha;
      ctx.strokeStyle = isYou ? 'rgb(255,214,64)' : 'rgba(246,251,251,0.7)';
      ctx.lineWidth = ringWidth;
      ctx.beginPath();
      ctx.ellipse(x, waterY - 1, ringRx, ringRy, 0, 0, Math.PI);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    return { x, topY: baseY - lift - size * 0.62, ringBottom: waterY - 1 + ringRy + ringWidth / 2, airborne, height01 };
  }

  function drawTag(ctx, text, x, y, fill, alpha) {
    const k = L.compact ? 0.82 : 1;          // en paysage les couloirs sont minces : étiquettes plus petites
    ctx.globalAlpha = alpha;
    ctx.font = `700 ${12 * k}px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 16 * k;
    const h = 22 * k;
    roundedRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(text, x, y + 0.5);
    ctx.globalAlpha = 1;
  }

  /** Contour d'une pastille : rectangle arrondi + pointe de `tailH` de haut, en bas (ou en haut si `up`). */
  function tagPath(ctx, x, top, w, h, tail, tailH, up) {
    const r = h / 2;
    const bottom = top + h;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + r, top);
    if (up) {
      ctx.lineTo(x - tail, top);
      ctx.lineTo(x, top - tailH);
      ctx.lineTo(x + tail, top);
    }
    ctx.lineTo(x + w / 2 - r, top);
    ctx.arc(x + w / 2 - r, top + r, r, -Math.PI / 2, Math.PI / 2);
    if (!up) {
      ctx.lineTo(x + tail, bottom);
      ctx.lineTo(x, bottom + tailH);
      ctx.lineTo(x - tail, bottom);
    }
    ctx.lineTo(x - w / 2 + r, bottom);
    ctx.arc(x - w / 2 + r, top + r, r, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
  }

  /**
   * Pastille « You » qui suit le canard du joueur pendant toute la course, même en vol.
   * Elle est au-dessus du canard, pointe vers le bas. Quand le canard du couloir du haut s'envole, il n'y a plus
   * de place sous la barre du haut : la pastille passe alors en fondu sous son anneau d'eau, pointe vers le haut.
   */
  function drawYouTag(ctx, spot, t) {
    const k = L.compact ? 0.82 : 1;          // en paysage les couloirs sont minces : pastille plus petite
    const bounce = Math.sin(t * 5) * 2 * k;
    ctx.font = `700 ${15 * k}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText('You').width + 24 * k;
    const h = 26 * k;
    const tail = 7 * k;                       // demi-largeur de la pointe
    const tailH = 8 * k;                      // hauteur de la pointe

    const minTop = L.safe.top + (L.compact ? 34 : 52);          // la pastille ne passe pas sous la barre du haut (rang, chrono)
    const topAbove = spot.topY - 4 - tailH - h + bounce;
    const above = clamp((topAbove - minTop) / (18 * k) + 1, 0, 1);

    const pill = (top, up, alpha) => {
      ctx.globalAlpha = alpha;
      tagPath(ctx, spot.x, top, w, h, tail, tailH, up);
      ctx.fillStyle = COLORS.sun;
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = 2.6 * k;
      ctx.lineJoin = 'round';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COLORS.ink;
      ctx.fillText('You', spot.x, top + h / 2 + k);
      ctx.globalAlpha = 1;
    };
    if (above > 0.02) pill(topAbove, false, above);
    if (above < 0.98) pill(spot.ringBottom + 3 * k + tailH + bounce, true, 1 - above);
  }

  const MEDAL = ['#FFC83D', '#C9D3DC', '#D9915B', '#F6FBFB', '#F6FBFB'];

  function drawBadge(ctx, x, y, place, age) {
    const pop = age < 0.35 ? 1 + 0.35 * Math.sin((age / 0.35) * Math.PI) : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, TAU);
    ctx.fillStyle = MEDAL[place - 1] ?? COLORS.foam;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = COLORS.ink;
    ctx.stroke();
    ctx.fillStyle = COLORS.ink;
    ctx.font = `700 15px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(place), 0, 1);
    ctx.restore();
  }

  function drawRacers(ctx, v) {
    const { race } = v;
    // Les canards en vol sont dessinés en dernier : ils passent devant les autres
    const order = [...race.racers].sort((a, b) => {
      const flyA = a.flightT >= 0 ? 1 : 0;
      const flyB = b.flightT >= 0 ? 1 : 0;
      return flyA - flyB || a.index - b.index;
    });
    const spots = new Map();
    for (const racer of order) spots.set(racer, drawRacer(ctx, racer, v));

    for (const racer of order) {
      const spot = spots.get(racer);
      if (!spot) continue;
      if (racer.finished) {
        drawBadge(ctx, spot.x, spot.topY - 8, racer.place, race.time - racer.finishTime);
      } else if (v.showMarker && racer.isPlayer) {
        drawYouTag(ctx, spot, v.time);
      } else if (v.tagsAlpha > 0.01) {
        // Le nom d'un adversaire s'efface quand son canard s'envole haut (il ne monterait pas sous la barre du haut)
        drawTag(ctx, racer.name, spot.x, spot.topY - 14, 'rgba(246,251,251,0.92)', v.tagsAlpha * (1 - spot.height01));
      }
    }
  }

  function drawSpeedLines(ctx, v) {
    if (!v.speedLines || v.speedLines < 0.02) return;
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i += 1) {
      const lane = (i * 0.618) % 1;
      const y = L.trackTop + lane * L.trackH;
      const speed = 1100 + (i % 3) * 260;
      const x = L.W + 120 - (((v.time * speed) + i * 211) % (L.W + 400));
      ctx.globalAlpha = 0.45 * v.speedLines;
      ctx.lineWidth = 1.5 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 70 + (i % 4) * 30, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Grand canard du menu, qui se balance sur l'eau. */
  function drawHero(ctx, v) {
    const rect = v.heroRect;
    if (!rect || rect.h < 90) return;
    const size = Math.min(rect.h * 1.05, L.W * 0.56, 250);
    if (!hero || hero.index !== v.heroIndex || Math.abs(hero.size - size) > 4) {
      hero = { index: v.heroIndex, size, sprites: buildDuckSprites(v.heroIndex, size, L.dpr) };
    }
    const u = size / DUCK_LENGTH;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h * 0.52;
    const t = v.time;
    const bob = Math.sin(t * 2.2) * size * 0.018;
    const waterY = cy + bob + WATERLINE_OFFSET * u;

    // Rides qui s'élargissent autour du canard
    for (let i = 0; i < 3; i += 1) {
      const phase = (t * 0.45 + i / 3) % 1;
      ctx.globalAlpha = (1 - phase) * 0.5;
      ctx.strokeStyle = COLORS.foam;
      ctx.lineWidth = 2.4;
      ellipse(ctx, cx, waterY, size * (0.38 + phase * 0.5), size * (0.075 + phase * 0.12));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(2,44,70,0.22)';
    ellipse(ctx, cx, waterY + 4, size * 0.4, size * 0.07);
    ctx.fill();

    const bounce = v.heroBounce || 0;
    ctx.save();
    ctx.translate(cx, waterY);
    ctx.scale(1 + 0.09 * bounce, 1 - 0.07 * bounce);
    ctx.translate(-cx, -waterY);
    drawDuck(ctx, hero.sprites, cx, cy + bob - size * 0.02 * bounce, {
      angle: Math.sin(t * 1.6) * 0.035,
      wing: 0.1 + 0.05 * Math.sin(t * 2.4),
      air: false,
    });
    ctx.restore();
    ctx.strokeStyle = 'rgba(246,251,251,0.7)';
    ctx.lineWidth = Math.max(2, size * 0.022);
    ctx.beginPath();
    ctx.ellipse(cx, waterY - 1, size * 0.43, size * 0.085, 0, 0, Math.PI);
    ctx.stroke();
  }

  /**
   * Dessine une image complète.
   * @param {object} v  { time, mode, race, fx, tagsAlpha, speedLines, showMarker, heroRect, heroIndex, heroBounce }
   */
  function draw(ctx, v) {
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    drawWater(ctx, v);
    drawSpeedLines(ctx, v);
    drawBankLayer(ctx, art.farBank, 0.5, true, v);
    if (v.mode === 'menu') {
      drawHero(ctx, v);
    } else {
      drawPlayerLane(ctx, v);
      drawRopes(ctx, v);
      drawStartAndFinish(ctx, v);
      drawRacers(ctx, v);
    }
    drawBankLayer(ctx, art.nearBank, 1.25, false, v);
    v.fx?.draw(ctx, camera.x);
    ctx.drawImage(art.vignette, 0, 0, L.W, L.H);
  }

  return {
    resize,
    draw,
    follow,
    resetCamera,
    anchorOf,
    camera,
    get layout() { return L; },
  };
}
