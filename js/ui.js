/*
 * Duck Race — l'interface : menu, affichage pendant la course, résultats.
 *
 * Ce module construit et met à jour les éléments HTML. Il ne connaît pas les règles du jeu :
 * main.js lui donne des valeurs prêtes à afficher (texte du rang, jauge de 0 à 1, etc.) et il
 * prévient main.js par des fonctions de rappel quand le joueur appuie sur un bouton.
 */
import { DUCKS, DIFFICULTIES, FLIGHT } from './config.js';
import { paintPortrait } from './sprites.js';
import { icon } from './icons.js';

/** « 12,4 s » : la virgule décimale, comme en français. */
export const formatTime = (seconds) => `${seconds.toFixed(1).replace('.', ',')} s`;

/** Relance une animation CSS en retirant puis remettant sa classe. */
function restartAnimation(node, className) {
  node.classList.remove(className);
  void node.offsetWidth;            // force le navigateur à constater le retrait
  node.classList.add(className);
}

export function createUI(handlers) {
  const $ = (id) => document.getElementById(id);
  const el = {
    body: document.body,
    live: $('live'),
    menu: $('screen-menu'),
    hud: $('screen-hud'),
    results: $('screen-results'),
    heroSlot: $('hero-slot'),
    duckChoices: $('duck-choices'),
    difficultyChoices: $('difficulty-choices'),
    gesture: $('gesture'),
    howtoText: $('howto-text'),
    start: $('btn-start'),
    stats: $('stats'),
    rank: $('hud-rank'),
    time: $('hud-time'),
    rail: $('rail'),
    hint: $('hud-hint'),
    toast: $('toast'),
    toastText: $('toast-text'),
    energy: $('energy-bar'),
    gaugeIcon: $('gauge-icon'),
    envol: $('envol'),
    arc: $('envol-arc'),
    envolIcon: $('envol-icon'),
    combo: $('combo'),
    countdown: $('countdown'),
    countdownText: $('countdown-text'),
    medal: $('result-medal'),
    resultTitle: $('result-title'),
    podium: $('podium'),
    resultChips: $('result-chips'),
    again: $('btn-again'),
    backToMenu: $('btn-menu'),
  };

  const comboDots = [...el.combo.querySelectorAll('.combo-dot')];
  const comboGo = el.combo.querySelector('.combo-go');
  let railDots = [];
  let railLength = 0;
  let toastTimer = 0;
  let liveTimer = 0;
  const last = {};            // dernières valeurs écrites : on ne touche au HTML que si quelque chose change

  // --- Construction des éléments fixes ---

  function buildDuckCards(store) {
    el.duckChoices.textContent = '';
    DUCKS.forEach((duck, index) => {
      const label = document.createElement('label');
      label.className = 'duck-card';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'duck';
      input.value = String(index);
      input.checked = index === store.playerIndex;
      input.addEventListener('change', () => handlers.onPickDuck(index));

      const tile = document.createElement('span');
      tile.className = 'tile';
      const portrait = document.createElement('canvas');
      portrait.setAttribute('aria-hidden', 'true');
      paintPortrait(portrait, index, 62);
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = duck.name;
      const check = document.createElement('span');
      check.className = 'check';
      check.innerHTML = icon('check', 14);
      tile.append(portrait, name, check);

      label.append(input, tile);
      el.duckChoices.append(label);
    });
  }

  function buildDifficulty(store) {
    el.difficultyChoices.textContent = '';
    Object.entries(DIFFICULTIES).forEach(([key, level]) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'difficulty';
      input.value = key;
      input.checked = key === store.difficulty;
      input.addEventListener('change', () => handlers.onPickDifficulty(key));
      const text = document.createElement('span');
      text.textContent = level.label;
      label.append(input, text);
      el.difficultyChoices.append(label);
    });
  }

  function buildStaticParts() {
    el.gesture.innerHTML = `
      <li>${icon('tap', 30)}<span>Tap</span></li>
      <li>${icon('tap', 30)}<span>Tap</span></li>
      <li class="is-go">${icon('swipe', 30)}<span>Glisse vers la droite</span></li>`;
    el.howtoText.textContent = `Ton canard décolle et file plus vite un instant. Il faut attendre ${Math.round(FLIGHT.recharge)} secondes avant le prochain envol.`;

    el.gaugeIcon.innerHTML = icon('bolt', 22);
    el.envolIcon.innerHTML = icon('wing', 32);
    comboGo.innerHTML = icon('chevron', 18);

    el.rail.innerHTML = `<span class="rail-flag">${icon('flag', 22)}</span>`;
    railDots = DUCKS.map((duck) => {
      const dot = document.createElement('span');
      dot.className = 'rail-dot';
      dot.style.setProperty('--dot', duck.color);
      el.rail.append(dot);
      return dot;
    });
  }

  // --- Écrans ---

  function showScreen(name) {
    el.body.dataset.screen = name;
    el.menu.classList.toggle('hidden', name !== 'menu');
    el.hud.classList.toggle('hidden', name !== 'countdown' && name !== 'race');
    el.results.classList.toggle('hidden', name !== 'results');
    if (name === 'countdown') measure();
  }

  /** Mesure ce qui dépend de la mise en page (longueur de la piste miniature). */
  function measure() {
    railLength = Math.max(0, el.rail.clientWidth - 16);
  }

  /** Rectangle (en px écran) réservé au grand canard du menu. */
  function heroRect() {
    const r = el.heroSlot.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  function renderStats(store) {
    const items = [['Courses', String(store.races)], ['Victoires', String(store.wins)]];
    if (store.bestTime != null) items.push(['Record', formatTime(store.bestTime)]);
    el.stats.innerHTML = items.map(([label, value]) => `<li><span>${label}</span><b>${value}</b></li>`).join('');
  }

  function syncChoices(store) {
    el.duckChoices.querySelectorAll('input').forEach((input, i) => { input.checked = i === store.playerIndex; });
    el.difficultyChoices.querySelectorAll('input').forEach((input) => { input.checked = input.value === store.difficulty; });
    // La carte choisie est ramenée au centre de la rangée. On compare des positions à l'écran plutôt que
    // offsetLeft, qui se mesure depuis un autre élément que la rangée (et donne un mauvais résultat en paysage).
    const card = el.duckChoices.children[store.playerIndex];
    if (card) {
      const row = el.duckChoices.getBoundingClientRect();
      const box = card.getBoundingClientRect();
      el.duckChoices.scrollLeft += (box.left + box.width / 2) - (row.left + row.width / 2);
    }
  }

  // --- Pendant la course ---

  function setPlayer(index) {
    railDots.forEach((dot, i) => dot.classList.toggle('is-player', i === index));
  }

  function setText(node, key, value) {
    if (last[key] === value) return;
    last[key] = value;
    node.textContent = value;
  }

  /**
   * @param {object} h
   * @param {string} h.rankLabel  « 2e »
   * @param {string} h.timeText   « 12,4 s »
   * @param {number} h.energy     de 0 à 1
   * @param {number[]} h.progress  progression de chaque canard, de 0 à 1
   * @param {{state: string, fraction: number}} h.envol  état de la bague : ready, charging ou flying
   * @param {number} h.combo      nombre de taps du combo déjà faits
   */
  function updateHud(h) {
    setText(el.rank, 'rank', h.rankLabel);
    setText(el.time, 'time', h.timeText);
    el.energy.style.transform = `scaleX(${h.energy.toFixed(3)})`;
    h.progress.forEach((p, i) => {
      railDots[i].style.transform = `translateX(${(p * railLength).toFixed(1)}px)`;
    });
    if (last.envolState !== h.envol.state) {
      last.envolState = h.envol.state;
      el.envol.dataset.state = h.envol.state;
    }
    el.arc.style.strokeDasharray = `${(h.envol.fraction * 100).toFixed(1)} 100`;
    comboDots.forEach((dot, i) => dot.classList.toggle('on', h.combo > i));
    comboGo.classList.toggle('on', h.combo >= FLIGHT.comboTaps);
  }

  /** Message court en bas de l'écran (null pour le retirer). `html` vient toujours de ce fichier ou de main.js. */
  function hint(html) {
    if (html == null) {
      if (last.hint != null) { last.hint = null; el.hint.classList.remove('show'); }
      return;
    }
    if (last.hint !== html) {
      last.hint = html;
      el.hint.innerHTML = html;
    }
    el.hint.classList.add('show');
  }

  /** Grande annonce au centre (« Envol ! »). */
  function toast(text) {
    el.toastText.textContent = text;
    el.toastText.dataset.text = text;
    restartAnimation(el.toast, 'show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1000);
  }

  /** Un geste refusé : la bague secoue la tête. */
  function nudge() {
    restartAnimation(el.envol, 'is-nudged');
  }

  function setCountdown(text) {
    if (text == null) {
      el.countdownText.textContent = '';
      el.countdownText.dataset.text = '';
      return;
    }
    el.countdownText.textContent = text;
    el.countdownText.dataset.text = text;
    restartAnimation(el.countdownText, 'pop');
  }

  /** Annonce pour les lecteurs d'écran. */
  function announce(text) {
    clearTimeout(liveTimer);
    el.live.textContent = '';
    liveTimer = setTimeout(() => { el.live.textContent = text; }, 40);
  }

  // --- Résultats ---

  /**
   * @param {object} r
   * @param {string} r.title
   * @param {number} r.place  place du joueur
   * @param {object[]} r.ranking  classement complet (racers de race.js, dans l'ordre d'arrivée)
   * @param {number} r.flights  nombre d'envols du joueur
   * @param {boolean} r.record
   */
  function showResults(r) {
    el.resultTitle.textContent = r.title;
    el.medal.dataset.place = String(r.place);
    el.medal.textContent = String(r.place);

    el.podium.textContent = '';
    r.ranking.forEach((racer) => {
      const row = document.createElement('li');
      row.className = racer.isPlayer ? 'podium-row is-player' : 'podium-row';
      const place = document.createElement('span');
      place.className = 'place';
      place.textContent = String(racer.place);
      const portrait = document.createElement('canvas');
      portrait.className = 'portrait';
      portrait.setAttribute('aria-hidden', 'true');
      paintPortrait(portrait, racer.index, 40);
      const name = document.createElement('span');
      name.textContent = racer.isPlayer ? `${racer.name} (toi)` : racer.name;
      const time = document.createElement('span');
      time.className = 'time';
      time.textContent = formatTime(racer.finishTime);
      row.append(place, portrait, name, time);
      el.podium.append(row);
    });

    const chips = [
      ['Temps', formatTime(r.ranking.find((racer) => racer.isPlayer).finishTime)],
      [r.flights > 1 ? 'Envols' : 'Envol', String(r.flights)],
    ];
    el.resultChips.innerHTML = chips.map(([label, value]) => `<li><span>${label}</span><b>${value}</b></li>`).join('')
      + (r.record ? '<li class="is-highlight"><b>Nouveau record</b></li>' : '');

    showScreen('results');
    el.again.focus({ preventScroll: true });
  }

  // --- Branchements ---

  el.start.addEventListener('click', () => handlers.onStart());
  el.again.addEventListener('click', () => handlers.onAgain());
  el.backToMenu.addEventListener('click', () => handlers.onMenu());

  return {
    init(store) {
      buildStaticParts();
      buildDuckCards(store);
      buildDifficulty(store);
      renderStats(store);
      syncChoices(store);
    },
    showScreen,
    measure,
    heroRect,
    renderStats,
    syncChoices,
    setPlayer,
    updateHud,
    hint,
    toast,
    nudge,
    setCountdown,
    announce,
    showResults,
    focusStart() { el.start.focus({ preventScroll: true }); },
  };
}
