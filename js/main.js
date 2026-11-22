/*
 * Duck Race — point d'entrée.
 *
 * Ce fichier relie les morceaux du jeu :
 *   race.js   les règles de la course (sans affichage)
 *   input.js  les gestes du joueur (taps, glissade)
 *   scene.js  le décor et les canards dessinés sur le canevas
 *   fx.js     éclaboussures et confettis
 *   ui.js     le menu, l'affichage pendant la course et les résultats
 *
 * Il tient aussi la boucle d'animation : environ 60 fois par seconde, on fait avancer la course,
 * on met l'interface à jour, puis on redessine.
 */
import { TUNING, FLIGHT, COUNTDOWN, PLACE_LABELS, RESULT_DELAY, WORLD } from './config.js';
import { loadStore, saveStore } from './store.js';
import { createInput } from './input.js';
import { createRace, step, tap, takeOff, playerOf, rankOf, allFinished, flightEnvelope } from './race.js';
import { createScene } from './scene.js';
import { createFx } from './fx.js';
import { createUI, formatTime } from './ui.js';
import { icon } from './icons.js';

const store = loadStore();
const canvas = document.getElementById('track');
const ctx = canvas.getContext('2d', { alpha: false });     // le décor couvre tout l'écran : pas besoin de transparence
const scene = createScene();
const fx = createFx();

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
fx.setReducedMotion(reducedMotion.matches);
reducedMotion.addEventListener?.('change', (event) => fx.setReducedMotion(event.matches));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// --- État du jeu ---------------------------------------------------------------------------------

let mode = 'menu';                 // 'menu' | 'countdown' | 'race' | 'results'
let race = newRace();              // au menu, une course « à l'arrêt » : les canards attendent au départ
let time = 0;                      // horloge d'animation (s), pour tout ce qui bouge sans raison de jeu
let countdownTime = 0;
let countdownStep = -1;
let goTimer = 0;                   // durée restante d'affichage du « Go! »
let resultWait = 0;                // pause entre la dernière arrivée et l'écran des résultats
let heroBounce = 0;                // petit rebond du grand canard quand on en choisit un autre
let heroRect = null;
let speedGlow = 0;                 // intensité (lissée) des traits de vitesse pendant l'envol
let hintOverride = null;           // message temporaire après un geste raté : { html, until }

const GESTURE_HINT = `Tap, tap, swipe ${icon('swipe', 18)}`;

function newRace() {
  return createRace({ playerIndex: store.playerIndex, difficulty: store.difficulty });
}

function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch (err) {
    // Pas de vibration sur cet appareil : sans importance
  }
}

// --- Interface -----------------------------------------------------------------------------------

const ui = createUI({
  onStart: () => startRace(),
  onAgain: () => startRace(),
  onMenu: () => showMenu(),
  onPickDuck(index) {
    store.playerIndex = index;
    saveStore(store);
    heroBounce = 1;
  },
  onPickDifficulty(key) {
    store.difficulty = key;
    saveStore(store);
  },
});

// --- Gestes --------------------------------------------------------------------------------------

const input = createInput({
  isActive: () => mode === 'race' && !playerOf(race).finished,
  onTap(x, y) {
    if (!tap(race)) return;
    if (x != null) fx.tap(x, y);
    vibrate(8);
  },
  onSwipe({ combo }) {
    if (!combo) {
      // Une glissade sans les deux taps avant : on rappelle le geste aux débutants
      ui.nudge();
      if (store.takeoffs < 6) hintOverride = { html: 'Two taps, then swipe', until: race.time + 1.8 };
      return;
    }
    if (!takeOff(race)) ui.nudge();       // l'envol se recharge encore
  },
});

// --- Cycle d'une course --------------------------------------------------------------------------

function showMenu() {
  mode = 'menu';
  race = newRace();
  fx.clear();
  scene.resetCamera();
  ui.hint(null);
  ui.setCountdown(null);
  ui.showScreen('menu');
  ui.syncChoices(store);
  ui.renderStats(store);
  requestAnimationFrame(() => { heroRect = ui.heroRect(); });
}

function startRace() {
  race = newRace();
  fx.clear();
  scene.resetCamera();
  input.reset();
  hintOverride = null;
  speedGlow = 0;
  resultWait = 0;
  countdownTime = 0;
  countdownStep = -1;
  mode = 'countdown';
  ui.setPlayer(store.playerIndex);
  ui.hint(null);
  ui.showScreen('countdown');
  ui.updateHud(hudState());
}

function updateCountdown(dt) {
  countdownTime += dt;
  const stepIndex = Math.min(COUNTDOWN.length - 1, Math.floor(countdownTime / TUNING.countdownStep));
  if (stepIndex === countdownStep) return;
  countdownStep = stepIndex;
  ui.setCountdown(COUNTDOWN[stepIndex]);
  if (stepIndex === 0) ui.announce('Ready?');
  if (stepIndex === COUNTDOWN.length - 1) {
    // « Go! » : la course démarre à cet instant
    mode = 'race';
    goTimer = TUNING.countdownStep;
    ui.showScreen('race');
    ui.announce('Go!');
    vibrate(20);
  }
}

function endRace() {
  mode = 'results';
  const player = playerOf(race);
  const ranking = [...race.racers].sort((a, b) => a.place - b.place);

  const previousBest = store.bestTime;
  store.races += 1;
  let record = false;
  if (player.place === 1) {
    store.wins += 1;
    if (previousBest == null || player.finishTime < previousBest) {
      store.bestTime = player.finishTime;
      record = true;
    }
  }
  saveStore(store);

  const title = player.place === 1 ? 'Victory!' : player.place <= 3 ? 'Podium!' : 'Race finished';
  ui.hint(null);
  ui.setCountdown(null);
  ui.renderStats(store);
  ui.showResults({ title, place: player.place, ranking, flights: player.flights, record });
  ui.announce(`${title}${/[.!?]$/.test(title) ? '' : '.'} You finished ${PLACE_LABELS[player.place - 1]}.`);
}

/** Ce que l'interface doit afficher à cet instant. */
function hudState() {
  const player = playerOf(race);
  const rank = rankOf(race, player);
  let envol;
  if (player.flightT >= 0) envol = { state: 'flying', fraction: 1 - player.flightT / FLIGHT.duration };
  else if (player.recharge > 0) envol = { state: 'charging', fraction: 1 - player.recharge / FLIGHT.recharge };
  else envol = { state: 'ready', fraction: 1 };
  return {
    rankLabel: race.time < 0.3 && !player.finished ? '–' : (PLACE_LABELS[rank - 1] ?? `${rank}th`),
    timeText: formatTime(player.finished ? player.finishTime : race.time),
    energy: player.energy / TUNING.maxEnergy,
    progress: race.racers.map((racer) => racer.progress),
    envol,
    combo: input.comboCount(),
  };
}

/** Le message du bas de l'écran : consigne au départ, puis rappel du geste tant qu'il n'est pas appris. */
function currentHint() {
  const player = playerOf(race);
  if (player.finished) return null;
  if (hintOverride && race.time < hintOverride.until) return hintOverride.html;
  if (race.time < 2.5) return 'Tap as fast as you can!';
  const ready = player.flightT < 0 && player.recharge <= 0;
  if (store.takeoffs < 3 && ready) return GESTURE_HINT;
  return null;
}

/** Réagit à ce qui vient de se passer dans la course : effets, vibrations, annonces. */
function handleEvents() {
  const size = scene.layout.size;
  for (const event of race.events) {
    const racer = event.racer;
    const spot = scene.anchorOf(racer);
    if (event.type === 'takeoff') {
      fx.splash(spot.x, spot.y, size, 0.9);
      store.takeoffs += 1;
      ui.toast('Take-off!');
      ui.announce('Take-off!');
      vibrate([14, 40, 14]);
    } else if (event.type === 'land' && racer.isPlayer) {
      fx.splash(spot.x, spot.y, size, 1);
    } else if (event.type === 'hop') {
      fx.ring(spot.x, spot.y, { radius: size * 0.55, life: 0.6, alpha: 0.5 });
    } else if (event.type === 'finish' && racer.isPlayer) {
      vibrate(racer.place === 1 ? [30, 50, 30, 50, 90] : 40);
      ui.announce(`Finished: ${PLACE_LABELS[racer.place - 1]}`);
      if (racer.place === 1) fx.confetti(scene.layout.W, scene.layout.H);
    }
  }
  race.events.length = 0;
}

function updateRace(dt) {
  step(race, dt);
  handleEvents();
  const player = playerOf(race);

  scene.follow(race, dt, player.flightT >= 0);
  const target = reducedMotion.matches || player.flightT < 0 ? 0 : flightEnvelope(player.flightT / FLIGHT.duration);
  speedGlow += (target - speedGlow) * (1 - Math.exp(-12 * dt));

  if (goTimer > 0) {
    goTimer -= dt;
    if (goTimer <= 0) ui.setCountdown(null);
  }

  ui.updateHud(hudState());
  ui.hint(currentHint());

  if (allFinished(race)) {
    resultWait += dt;
    if (resultWait >= RESULT_DELAY) endRace();
  }
}

// --- Dessin et boucle ----------------------------------------------------------------------------

function measureSafeAreas() {
  // Un élément invisible dont les marges valent les zones sûres (encoche, barre d'accueil) : on les lit
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;'
    + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) '
    + 'env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);';
  document.body.appendChild(probe);
  const styles = getComputedStyle(probe);
  const safe = {
    top: parseFloat(styles.paddingTop) || 0,
    right: parseFloat(styles.paddingRight) || 0,
    bottom: parseFloat(styles.paddingBottom) || 0,
    left: parseFloat(styles.paddingLeft) || 0,
  };
  probe.remove();
  return safe;
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);     // au-delà de 2, on dessine des pixels invisibles
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  scene.resize(width, height, dpr, measureSafeAreas());
  ui.measure();
  heroRect = ui.heroRect();
}

function render() {
  let tagsAlpha = 0;
  if (mode === 'countdown') tagsAlpha = 1;
  else if (mode === 'race') tagsAlpha = clamp(1 - (race.time - WORLD.tagSeconds), 0, 1);

  scene.draw(ctx, {
    time,
    mode: mode === 'menu' ? 'menu' : 'race',
    race,
    fx,
    tagsAlpha,
    speedLines: speedGlow,
    showMarker: mode !== 'menu',
    heroRect,
    heroIndex: store.playerIndex,
    heroBounce,
  });
}

let lastFrame = performance.now();

function frame(now) {
  // On plafonne le pas de temps : après un retour sur l'onglet, la course reprend sans saut
  const dt = clamp((now - lastFrame) / 1000, 0, 0.05);
  lastFrame = now;
  time += dt;
  heroBounce = Math.max(0, heroBounce - dt * 2.6);

  if (mode === 'countdown') updateCountdown(dt);
  else if (mode === 'race') updateRace(dt);
  fx.update(dt);

  render();
  requestAnimationFrame(frame);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((registration) => {
      // Le navigateur ne cherche pas toujours une nouvelle version tout seul (parfois une fois par jour
      // seulement) : on la demande à chaque ouverture. Hors ligne, la demande échoue, sans conséquence.
      if (registration && registration.update) registration.update().catch(() => {});
    }, (err) => {
      console.warn('Enregistrement du service worker impossible :', err);
    });
  });
}

function init() {
  ui.init(store);
  resize();
  window.addEventListener('resize', resize);

  // Quand la police du titre arrive, la zone du grand canard peut bouger : on la remesure
  const heroSlot = document.getElementById('hero-slot');
  if (window.ResizeObserver) new ResizeObserver(() => { heroRect = ui.heroRect(); }).observe(heroSlot);
  document.fonts?.ready.then(() => { heroRect = ui.heroRect(); });

  showMenu();
  lastFrame = performance.now();
  requestAnimationFrame(frame);
  registerServiceWorker();

  // Accès pour les tests automatiques (uniquement avec ?debug dans l'adresse)
  if (new URLSearchParams(window.location.search).has('debug')) {
    window.__duck = { store, scene, fx, input, get race() { return race; }, get mode() { return mode; } };
  }
}

init();
