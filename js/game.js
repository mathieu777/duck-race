/*
 * Duck Race — logique de jeu, rendu canvas et interface.
 *
 * Principe :
 *  - Le joueur choisit un canard et une difficulté, puis tapote l'écran pour le booster.
 *  - Chaque tap ajoute de l'énergie ; l'énergie s'évapore ensuite progressivement
 *    (décroissance exponentielle) : plus on tapote vite, plus la jauge se stabilise haut.
 *  - Plus l'énergie est haute, plus le canard va vite (jusqu'à +50 %).
 *  - Les autres canards ont une vitesse de base aléatoire et des "sprints" ;
 *    la difficulté règle leur allure.
 */
(() => {
  'use strict';

  /* ==========================================================================
     1. Configuration
     ========================================================================== */

  const DUCKS = [
    { name: 'Cocotte',  color: '#FFD23F', accent: '#F59E0B' },
    { name: 'Plouf',    color: '#9AD8F5', accent: '#1D8FC4' },
    { name: 'Bouboule', color: '#FFB8CC', accent: '#E0527A' },
    { name: 'Gaston',   color: '#BDEBA0', accent: '#3E9E6A' },
    { name: 'Plume',    color: '#D8C2EE', accent: '#7B3FBF' },
  ];

  const TUNING = {
    speedMin: 0.060,       // vitesse de base d'un canard, en fraction de piste par seconde
    speedMax: 0.072,       // (1 = ligne d'arrivée, soit 14 à 17 s de course sans aide)
    wobble: 0.12,          // variation sinusoïdale de vitesse (±12 %)
    tapEnergy: 6,          // énergie gagnée à chaque tap
    maxEnergy: 100,
    // Évaporation de l'énergie (décroissance exponentielle, ~40 % de la jauge perdus par seconde).
    // À rythme régulier, la jauge se stabilise à tapEnergy × taps/s ÷ energyDecay,
    // soit 12 × taps/s : elle est pleine à partir d'environ 8 taps par seconde.
    energyDecay: 0.5,
    maxBoost: 0.5,         // bonus de vitesse à énergie maximale (+50 %)
    aiSprintChance: 0.5,   // probabilité qu'une IA sprinte à chaque changement de rythme
    aiSprintMin: 1.05,     // multiplicateur de vitesse pendant un sprint (de x1,05 à x1,25)
    aiSprintMax: 1.25,
    countdownStep: 0.8,    // durée de chaque étape du compte à rebours (s)
  };

  // La difficulté ne change que l'allure des adversaires (multiplicateur de leur vitesse de base).
  // Avec des taps réguliers, on gagne environ une course sur deux à ~3 taps/s (facile),
  // ~4,5 taps/s (normal) et ~6,5 taps/s (difficile).
  const DIFFICULTIES = {
    easy:   { label: 'Facile',    aiPace: 1.00 },
    normal: { label: 'Normal',    aiPace: 1.08 },
    hard:   { label: 'Difficile', aiPace: 1.17 },
  };
  const DEFAULT_DIFFICULTY = 'normal';

  // Zones réservées à l'interface (px CSS), en plus des marges de sécurité de l'écran :
  // les couloirs de course sont dessinés entre les deux pour que rien ne soit masqué.
  const HUD_SPACE = { top: 80, bottom: 60 };

  const WATER_COLORS = ['#2BB6DB', '#20A3CB'];   // couleurs alternées des couloirs

  const COUNTDOWN = ['3', '2', '1', 'GO !'];
  const PLACE_LABELS = ['1er', '2e', '3e', '4e', '5e'];
  const STORAGE_KEY = 'duck-race:v1';
  // Ancien nom du projet : on reprend les statistiques déjà enregistrées sous cette clé
  const LEGACY_STORAGE_KEY = 'course-canards:v1';

  /* ==========================================================================
     2. Utilitaires et persistance
     ========================================================================== */

  const $ = (selector) => document.querySelector(selector);
  const rand = (min, max) => min + Math.random() * (max - min);
  const formatTime = (seconds) => `${seconds.toFixed(1).replace('.', ',')} s`;

  function loadStore() {
    const fallback = { races: 0, wins: 0, bestTime: null, playerIndex: 0, difficulty: DEFAULT_DIFFICULTY };
    try {
      // La nouvelle clé d'abord ; sinon l'ancienne (première ouverture après le renommage)
      const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      const data = JSON.parse(saved);
      const merged = { ...fallback, ...data };
      // Garde des valeurs valides même si le stockage a été altéré
      merged.playerIndex = Math.min(Math.max(0, Number(merged.playerIndex) || 0), DUCKS.length - 1);
      if (!Object.prototype.hasOwnProperty.call(DIFFICULTIES, merged.difficulty)) {
        merged.difficulty = DEFAULT_DIFFICULTY;
      }
      return merged;
    } catch (err) {
      return fallback;
    }
  }

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (err) {
      // Stockage indisponible (mode privé, quota) : le jeu continue sans sauvegarde
    }
  }

  const store = loadStore();

  /* ==========================================================================
     3. Éléments du DOM et état
     ========================================================================== */

  const canvas = $('#track');
  const ctx = canvas.getContext('2d');

  const el = {
    menu: $('#screen-menu'),
    hud: $('#screen-hud'),
    results: $('#screen-results'),
    choices: $('#duck-choices'),
    difficulty: $('#difficulty-choices'),
    start: $('#btn-start'),
    stats: $('#stats'),
    rank: $('#hud-rank'),
    time: $('#hud-time'),
    energy: $('#energy-bar'),
    hint: $('#hud-hint'),
    countdown: $('#countdown'),
    podium: $('#podium'),
    resultTitle: $('#result-title'),
    resultMsg: $('#result-msg'),
    again: $('#btn-again'),
    backToMenu: $('#btn-menu'),
  };

  const state = {
    phase: 'menu',        // 'menu' | 'countdown' | 'racing' | 'results'
    racers: [],           // un objet par canard, index = index dans DUCKS
    time: 0,              // horloge d'animation (sert au balancement visuel)
    raceTime: 0,          // chrono de la course
    stepIndex: 0,         // étape courante du compte à rebours
    stepTimer: 0,
    finishedCount: 0,
    particles: [],
    width: 0,
    height: 0,
    safeTop: 0,           // marges de sécurité de l'écran (encoche, barre d'accueil), en px
    safeBottom: 0,
    lastFrame: 0,
  };

  /* ==========================================================================
     4. Création des canards et mise en page
     ========================================================================== */

  function createRacers() {
    const level = DIFFICULTIES[store.difficulty];
    // Le joueur a toujours l'allure moyenne : son résultat dépend de ses taps, pas de la chance.
    const playerBase = (TUNING.speedMin + TUNING.speedMax) / 2;

    return DUCKS.map((duck, index) => {
      const isPlayer = index === store.playerIndex;
      return {
        ...duck,
        index,
        isPlayer,
        progress: 0,                       // 0 = départ, 1 = arrivée
        base: isPlayer ? playerBase : rand(TUNING.speedMin, TUNING.speedMax) * level.aiPace,
        wobbleFreq: rand(1.5, 3.5),
        wobblePhase: rand(0, Math.PI * 2),
        energy: 0,                         // utilisé uniquement pour le joueur
        sprintMul: 1,                      // utilisé uniquement pour les IA
        sprintTimer: rand(0.5, 1.5),
        finished: false,
        finishTime: null,
        place: null,
      };
    });
  }

  function getLayout() {
    const { width: W, height: H } = state;
    const top = state.safeTop + HUD_SPACE.top;
    const bottom = state.safeBottom + HUD_SPACE.bottom;
    // Sur un écran très bas, les couloirs gardent au moins la moitié de la hauteur
    const trackH = Math.max(H * 0.5, H - top - bottom);
    const laneH = trackH / DUCKS.length;
    const size = Math.min(laneH * 0.42, W * 0.13);   // taille du canard
    const startX = W * 0.07;
    const finishX = W * 0.9;
    return {
      W,
      H,
      top,                                           // haut du premier couloir
      trackBottom: top + trackH,                     // bas du dernier couloir
      laneH,
      size,
      startX,
      finishX,
      travel: finishX - startX - size,               // distance que parcourt le centre du canard
    };
  }

  const laneCenterY = (L, laneIndex) => L.top + (laneIndex + 0.5) * L.laneH;
  const duckX = (L, progress) => L.startX + L.size / 2 + progress * L.travel;

  /* ==========================================================================
     5. Rendu
     ========================================================================== */

  function render() {
    const L = getLayout();
    ctx.clearRect(0, 0, L.W, L.H);
    drawWater(L);
    drawLines(L);
    drawRacers(L);
    drawParticles();
  }

  function drawWater(L) {
    // Bandes au-dessus et au-dessous des couloirs (zones réservées à l'interface)
    ctx.fillStyle = WATER_COLORS[0];
    ctx.fillRect(0, 0, L.W, L.top + 1);
    ctx.fillStyle = WATER_COLORS[(DUCKS.length - 1) % 2];
    ctx.fillRect(0, L.trackBottom - 1, L.W, L.H - L.trackBottom + 1);

    for (let i = 0; i < DUCKS.length; i++) {
      const top = L.top + i * L.laneH;

      // Couleur alternée pour distinguer les couloirs
      ctx.fillStyle = WATER_COLORS[i % 2];
      ctx.fillRect(0, top, L.W, L.laneH);

      // Ondulation animée en bas de chaque couloir
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= L.W; x += 8) {
        const y = top + L.laneH * 0.82 + Math.sin(x * 0.04 + state.time * 2 + i) * 3;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // Surlignage du couloir du joueur
    ctx.fillStyle = 'rgba(255, 210, 63, 0.18)';
    ctx.fillRect(0, L.top + store.playerIndex * L.laneH, L.W, L.laneH);

    // Séparateurs pointillés entre les couloirs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 8]);
    for (let i = 1; i < DUCKS.length; i++) {
      const y = L.top + i * L.laneH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(L.W, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawLines(L) {
    const trackH = L.trackBottom - L.top;

    // Ligne de départ
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(L.startX - 6, L.top, 4, trackH);

    // Ligne d'arrivée en damier (uniquement sur la hauteur des couloirs)
    const square = 10;
    for (let y = L.top, row = 0; y < L.trackBottom; y += square, row++) {
      const h = Math.min(square, L.trackBottom - y);
      for (let col = 0; col < 2; col++) {
        ctx.fillStyle = (row + col) % 2 ? '#FFFFFF' : '#0B3D55';
        ctx.fillRect(L.finishX + col * square, y, square, h);
      }
    }
  }

  function drawRacers(L) {
    const moving = state.phase === 'racing';

    state.racers.forEach((racer, laneIndex) => {
      const x = duckX(L, racer.progress);
      const y = laneCenterY(L, laneIndex);
      const isMoving = moving && !racer.finished;

      drawDuck(x, y, L.size, racer, isMoving);
      drawLabel(racer, x, y, L);
    });
  }

  /**
   * Dessine un canard de profil, orienté vers la droite.
   * Toutes les formes sont exprimées en fraction de `s` (taille du canard).
   */
  function drawDuck(x, y, s, duck, moving) {
    const t = state.time;
    const frequency = moving ? 14 : 3;
    const swing = Math.sin(t * frequency + duck.wobblePhase);
    const bob = swing * s * (moving ? 0.06 : 0.03);
    const tilt = moving ? swing * 0.06 : 0;

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(tilt);

    // Reflet sur l'eau
    ctx.fillStyle = 'rgba(0, 40, 60, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.42, s * 0.5, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Queue
    ctx.fillStyle = duck.accent;
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, -s * 0.06);
    ctx.lineTo(-s * 0.66, -s * 0.24);
    ctx.lineTo(-s * 0.56, s * 0.06);
    ctx.closePath();
    ctx.fill();

    // Corps
    ctx.fillStyle = duck.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.5, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Aile
    ctx.fillStyle = duck.accent;
    ctx.beginPath();
    ctx.ellipse(-s * 0.1, -s * 0.02, s * 0.24, s * 0.13, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Tête
    ctx.fillStyle = duck.color;
    ctx.beginPath();
    ctx.arc(s * 0.34, -s * 0.3, s * 0.22, 0, Math.PI * 2);
    ctx.fill();

    // Bec
    ctx.fillStyle = '#FF7A00';
    ctx.beginPath();
    ctx.moveTo(s * 0.5, -s * 0.36);
    ctx.lineTo(s * 0.8, -s * 0.28);
    ctx.lineTo(s * 0.5, -s * 0.22);
    ctx.closePath();
    ctx.fill();

    // Œil
    ctx.fillStyle = '#1B1B1B';
    ctx.beginPath();
    ctx.arc(s * 0.36, -s * 0.34, s * 0.045, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Étiquette au-dessus du canard : nom, mention « toi » et place à l'arrivée. */
  function drawLabel(racer, x, y, L) {
    const suffix = racer.isPlayer ? ' (toi)' : '';
    const place = racer.finished ? ` · ${PLACE_LABELS[racer.place - 1]}` : '';
    const label = `${racer.name}${suffix}${place}`;
    const labelY = y - L.size * 0.55;

    ctx.font = `700 ${Math.max(12, L.size * 0.32)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Empêche le texte de sortir de l'écran sur les bords
    const half = ctx.measureText(label).width / 2 + 6;
    const labelX = Math.min(Math.max(x, half), L.W - half);

    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0, 40, 60, 0.45)';
    ctx.strokeText(label, labelX, labelY);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, labelX, labelY);
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ==========================================================================
     6. Boucle de jeu et logique
     ========================================================================== */

  function loop(now) {
    // dt plafonné : évite un saut brutal après un changement d'onglet
    const dt = Math.min((now - state.lastFrame) / 1000, 0.05);
    state.lastFrame = now;

    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    state.time += dt;
    updateParticles(dt);

    if (state.phase === 'countdown') {
      updateCountdown(dt);
    } else if (state.phase === 'racing') {
      updateRace(dt);
    }
  }

  function updateCountdown(dt) {
    state.stepTimer -= dt;
    if (state.stepTimer > 0) return;

    state.stepIndex += 1;
    if (state.stepIndex >= COUNTDOWN.length) {
      state.phase = 'racing';
      el.countdown.textContent = '';
      return;
    }

    showCountdown(COUNTDOWN[state.stepIndex]);
    state.stepTimer = TUNING.countdownStep;
  }

  function updateRace(dt) {
    state.raceTime += dt;

    for (const racer of state.racers) {
      if (racer.finished) continue;

      if (racer.isPlayer) {
        // Évaporation exponentielle : plus la jauge est haute, plus elle se vide vite
        racer.energy *= Math.exp(-TUNING.energyDecay * dt);
      } else {
        racer.sprintTimer -= dt;
        if (racer.sprintTimer <= 0) {
          // Parfois l'IA sprinte pendant un court instant, sinon elle reprend son allure normale
          racer.sprintMul = Math.random() < TUNING.aiSprintChance
            ? rand(TUNING.aiSprintMin, TUNING.aiSprintMax)
            : 1;
          racer.sprintTimer = rand(0.8, 2);
        }
      }

      const wobble = 1 + TUNING.wobble * Math.sin(state.raceTime * racer.wobbleFreq + racer.wobblePhase);
      const boost = racer.isPlayer
        ? 1 + (racer.energy / TUNING.maxEnergy) * TUNING.maxBoost
        : racer.sprintMul;

      racer.progress += racer.base * wobble * boost * dt;

      if (racer.progress >= 1) {
        finishRacer(racer);
      }
    }

    updateHud();

    if (state.racers.every((racer) => racer.finished)) {
      endRace();
    }
  }

  function finishRacer(racer) {
    racer.progress = 1;
    racer.finished = true;
    state.finishedCount += 1;
    racer.place = state.finishedCount;
    racer.finishTime = state.raceTime;
  }

  function playerRacer() {
    return state.racers[store.playerIndex];
  }

  /** Position actuelle du joueur (1 = en tête). */
  function currentRank(player) {
    if (player.finished) return player.place;
    const aheadCount = state.racers.filter((r) => r !== player && r.progress > player.progress).length;
    return aheadCount + 1;
  }

  function updateHud() {
    const player = playerRacer();
    const rank = currentRank(player);

    el.rank.textContent = `Position : ${PLACE_LABELS[rank - 1]} / ${DUCKS.length}`;
    el.time.textContent = `⏱ ${formatTime(state.raceTime)}`;
    el.energy.style.width = `${(player.energy / TUNING.maxEnergy) * 100}%`;
    el.hint.textContent = player.finished ? 'Arrivé ! En attente des autres…' : 'Tapote, tapote !';
  }

  function endRace() {
    const player = playerRacer();

    store.races += 1;
    if (player.place === 1) {
      store.wins += 1;
      if (store.bestTime === null || player.finishTime < store.bestTime) {
        store.bestTime = player.finishTime;
      }
    }
    saveStore();

    showResults(player);
  }

  /* ==========================================================================
     7. Actions du joueur
     ========================================================================== */

  /** Un tap booste le canard du joueur et déclenche un petit effet visuel. */
  function onTap() {
    if (state.phase !== 'racing') return;

    const player = playerRacer();
    if (player.finished) return;

    player.energy = Math.min(TUNING.maxEnergy, player.energy + TUNING.tapEnergy);

    const L = getLayout();
    spawnSparkles(
      duckX(L, player.progress) - L.size * 0.45,
      laneCenterY(L, store.playerIndex) + L.size * 0.1
    );

    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }

  function onKey(event) {
    // Barre d'espace ou Entrée pour les claviers, en ignorant la répétition automatique
    if (!event.repeat && (event.code === 'Space' || event.code === 'Enter') && state.phase === 'racing') {
      event.preventDefault();
      onTap();
    }
  }

  function spawnSparkles(x, y) {
    for (let i = 0; i < 6; i++) {
      const maxLife = 0.5;
      state.particles.push({
        x,
        y,
        vx: rand(-70, 20),
        vy: rand(-180, -60),
        life: maxLife,
        maxLife,
      });
    }
  }

  function updateParticles(dt) {
    state.particles = state.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt; // gravité
      return p.life > 0;
    });
  }

  /* ==========================================================================
     8. Navigation entre les écrans
     ========================================================================== */

  function setScreen(name) {
    el.menu.classList.toggle('hidden', name !== 'menu');
    el.hud.classList.toggle('hidden', name !== 'hud');
    el.results.classList.toggle('hidden', name !== 'results');
  }

  function showCountdown(text) {
    el.countdown.textContent = text;
    // Relance l'animation CSS à chaque étape
    el.countdown.classList.remove('pop');
    void el.countdown.offsetWidth;
    el.countdown.classList.add('pop');
  }

  function startRace() {
    state.racers = createRacers();
    state.raceTime = 0;
    state.finishedCount = 0;
    state.particles = [];
    state.stepIndex = 0;
    state.stepTimer = TUNING.countdownStep;
    state.phase = 'countdown';

    setScreen('hud');
    showCountdown(COUNTDOWN[0]);
    updateHud();
  }

  function showMenu() {
    state.phase = 'menu';
    state.racers = createRacers();
    state.particles = [];
    el.countdown.textContent = '';

    renderChoices();
    renderDifficulty();
    renderStats();
    setScreen('menu');
  }

  function showResults(player) {
    state.phase = 'results';

    const ranking = [...state.racers].sort((a, b) => a.place - b.place);
    el.podium.replaceChildren(...ranking.map(buildPodiumRow));

    if (player.place === 1) {
      el.resultTitle.textContent = 'Victoire !';
      el.resultMsg.textContent = 'Ton canard franchit la ligne en premier. 🏆';
    } else if (player.place <= 3) {
      el.resultTitle.textContent = 'Podium !';
      el.resultMsg.textContent = `Bien joué, ${PLACE_LABELS[player.place - 1]} place. Tapote encore plus régulièrement pour la première marche.`;
    } else {
      el.resultTitle.textContent = 'Course terminée';
      el.resultMsg.textContent = `Ton canard finit ${PLACE_LABELS[player.place - 1]}. Garde le rythme des taps pour remonter.`;
    }

    setScreen('results');
  }

  function buildPodiumRow(racer) {
    const li = document.createElement('li');
    li.className = racer.isPlayer ? 'podium-row is-player' : 'podium-row';

    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = PLACE_LABELS[racer.place - 1];

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = racer.color;

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = racer.isPlayer ? `${racer.name} (toi)` : racer.name;

    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = formatTime(racer.finishTime);

    li.append(rank, dot, name, time);
    return li;
  }

  /* ==========================================================================
     9. Écran d'accueil : choix du canard, de la difficulté et statistiques
     ========================================================================== */

  /** Petit canard SVG utilisé dans les cartes de choix. */
  function duckSvg(duck) {
    return `
      <svg viewBox="0 0 100 80" aria-hidden="true" focusable="false">
        <path d="M10 40 L0 28 L4 46 Z" fill="${duck.accent}"/>
        <ellipse cx="46" cy="50" rx="36" ry="22" fill="${duck.color}"/>
        <ellipse cx="42" cy="46" rx="16" ry="9" fill="${duck.accent}" opacity=".6"/>
        <circle cx="74" cy="28" r="15" fill="${duck.color}"/>
        <path d="M86 24 L100 29 L86 34 Z" fill="#FF7A00"/>
        <circle cx="78" cy="24" r="2.8" fill="#1B1B1B"/>
      </svg>`;
  }

  function renderChoices() {
    el.choices.replaceChildren(...DUCKS.map((duck, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'duck-card';
      button.setAttribute('aria-pressed', String(index === store.playerIndex));
      button.innerHTML = `${duckSvg(duck)}<span>${duck.name}</span>`;
      button.addEventListener('click', () => selectDuck(index));
      return button;
    }));
  }

  function selectDuck(index) {
    store.playerIndex = index;
    saveStore();
    state.racers = createRacers();   // recrée les canards pour mettre à jour le joueur
    renderChoices();
  }

  /** Boutons radio natifs (clavier et lecteurs d'écran gérés par le navigateur), présentés en segments. */
  function renderDifficulty() {
    el.difficulty.replaceChildren(...Object.entries(DIFFICULTIES).map(([key, level]) => {
      const label = document.createElement('label');

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'difficulty';
      input.value = key;
      input.checked = key === store.difficulty;
      input.addEventListener('change', () => selectDifficulty(key));

      const text = document.createElement('span');
      text.textContent = level.label;

      label.append(input, text);
      return label;
    }));
  }

  function selectDifficulty(key) {
    store.difficulty = key;   // les adversaires sont recréés au lancement de la course
    saveStore();
  }

  function renderStats() {
    const best = store.bestTime === null ? '—' : formatTime(store.bestTime);
    el.stats.textContent = `Courses : ${store.races} · Victoires : ${store.wins} · Meilleur temps : ${best}`;
  }

  /* ==========================================================================
     10. Initialisation, resize et service worker
     ========================================================================== */

  /** Lit les marges de sécurité de l'écran (encoche, barre d'accueil) exprimées en CSS par env(). */
  function measureSafeAreas() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;'
      + 'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);';
    document.body.appendChild(probe);
    const styles = getComputedStyle(probe);
    state.safeTop = parseFloat(styles.paddingTop) || 0;
    state.safeBottom = parseFloat(styles.paddingBottom) || 0;
    probe.remove();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = Math.round(state.width * dpr);
    canvas.height = Math.round(state.height * dpr);
    // Toutes les coordonnées du rendu sont en pixels CSS
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measureSafeAreas();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('Enregistrement du service worker impossible :', err);
      });
    });
  }

  function init() {
    resize();
    window.addEventListener('resize', resize);

    // Le pointerdown couvre souris, tactile et stylet
    window.addEventListener('pointerdown', onTap);
    window.addEventListener('keydown', onKey);

    el.start.addEventListener('click', startRace);
    el.again.addEventListener('click', startRace);
    el.backToMenu.addEventListener('click', showMenu);

    showMenu();
    state.lastFrame = performance.now();
    requestAnimationFrame(loop);

    registerServiceWorker();
  }

  init();
})();
