/*
 * Duck Race — réglages du jeu.
 *
 * Tout ce qui se règle (vitesses, difficulté, envol, zones de l'interface, couleurs partagées)
 * est regroupé ici. Aucun autre fichier ne contient de « chiffre magique » de gameplay.
 */

/**
 * Les cinq canards. `accessory` choisit le détail dessiné sur la tête (voir sprites.js) :
 * il distingue les canards même sans les couleurs (daltonisme, petits écrans).
 */
export const DUCKS = [
  { name: 'Goldie',   color: '#FFCB1F', light: '#FFE680', dark: '#EE9B00', accessory: 'bow' },
  { name: 'Splash',   color: '#6FB8FF', light: '#B9DCFF', dark: '#3A86DB', accessory: 'goggles' },
  { name: 'Peaches',  color: '#FF8FB5', light: '#FFC4D8', dark: '#E0568A', accessory: 'shades' },
  { name: 'Gaston',   color: '#9BDD5B', light: '#CBF39C', dark: '#62B032', accessory: 'beret' },
  { name: 'Feather',  color: '#B79BFF', light: '#DDCEFF', dark: '#8661EA', accessory: 'feather' },
];

/** Couleurs partagées entre le canvas et les icônes (le CSS a ses propres variables, aux mêmes valeurs). */
export const COLORS = {
  ink: '#0F2A44',       // contours et textes sur fond clair
  foam: '#F6FBFB',      // blanc de l'écume
  beak: '#FF8A1F',      // bec, boutons principaux
  buoy: '#EE4B3A',      // rouge des bouées
  sun: '#FFCB1F',       // jaune du canard en plastique
};

export const TUNING = {
  speedMin: 0.060,       // vitesse de base d'un canard, en fraction de piste par seconde
  speedMax: 0.072,       // (1 = ligne d'arrivée, soit 14 à 17 s de course sans aide)
  wobble: 0.12,          // variation sinusoïdale de vitesse (±12 %)
  tapEnergy: 6,          // énergie gagnée à chaque tap
  maxEnergy: 100,
  // Évaporation de l'énergie (décroissance exponentielle).
  // À rythme régulier, la jauge se stabilise à tapEnergy × taps/s ÷ energyDecay,
  // soit 12 × taps/s : elle est pleine à partir d'environ 8 taps par seconde.
  energyDecay: 0.5,
  maxBoost: 0.5,         // bonus de vitesse à énergie maximale (+50 %)
  aiSprintChance: 0.5,   // probabilité qu'une IA sprinte à chaque changement de rythme
  aiSprintMin: 1.05,     // multiplicateur de vitesse pendant un sprint (de x1,05 à x1,25)
  aiSprintMax: 1.25,
  countdownStep: 0.8,    // durée de chaque étape du compte à rebours (s)
};

/**
 * L'envol : deux taps puis une glissade vers la droite font décoller le canard du joueur.
 * Pendant le vol il va plus vite ; il doit ensuite attendre la recharge avant de décoller à nouveau.
 */
export const FLIGHT = {
  duration: 1.1,         // durée du vol (s)
  boost: 0.25,           // bonus de vitesse au plus fort du vol (+25 %)
  recharge: 4.0,         // délai entre deux décollages, vol compris (s)
  // Geste à réaliser
  comboTaps: 2,          // nombre de taps avant la glissade
  comboWindow: 1.0,      // les taps doivent avoir eu lieu moins d'une seconde avant la glissade
  swipeDistance: 44,     // longueur minimale de la glissade vers la droite (px)
  swipeTime: 0.5,        // durée maximale de la glissade (s)
};

/** Les adversaires font un petit bond visible quand ils lancent un sprint assez fort. */
export const HOP = {
  minSprint: 1.12,       // multiplicateur de sprint à partir duquel l'IA bondit
  duration: 0.85,        // durée du bond (s)
};

/**
 * La difficulté ne change que l'allure des adversaires (multiplicateur de leur vitesse de base).
 * Réglé par simulation (voir README), à rythme de taps constant :
 *  - sans jamais s'envoler, on gagne environ une course sur quatre à ~3 taps/s (facile),
 *    ~4,5 taps/s (normal) et ~6,5 taps/s (difficile) ;
 *  - avec trois envols bien placés par course, environ trois courses sur quatre.
 */
export const DIFFICULTIES = {
  easy:   { label: 'Easy',      aiPace: 1.04 },
  normal: { label: 'Normal',    aiPace: 1.11 },
  hard:   { label: 'Hard',      aiPace: 1.20 },
};
export const DEFAULT_DIFFICULTY = 'normal';

/**
 * Zones réservées à l'interface (px CSS), en plus des marges de sécurité de l'écran.
 * Sur un écran bas (téléphone en paysage), l'interface est plus compacte : le seuil
 * COMPACT_HEIGHT est le même que celui de la media query du fichier css/style.css.
 */
export const COMPACT_HEIGHT = 480;
export const HUD_SPACE = { top: 100, bottom: 84, compactTop: 62, compactBottom: 62 };

/** Le monde est une longue piste qui défile : la caméra suit le canard du joueur. */
export const WORLD = {
  lengthScreens: 4.6,    // longueur de la piste, en largeurs d'écran
  startLine: 0.30,       // position de la ligne de départ à l'écran (fraction de la largeur)
  playerAnchor: 0.34,    // où la caméra tient le canard du joueur (fraction de la largeur)
  flightAnchor: 0.26,    // pendant l'envol, la caméra le laisse un peu plus en arrière : ça file
  finishAnchor: 0.80,    // la ligne d'arrivée ne dépasse jamais cette position à l'écran
  leaderLimit: 0.80,     // la caméra essaie de garder le premier à gauche de cette position
  tagSeconds: 3,         // durée d'affichage des étiquettes de noms après le départ (s)
};

export const COUNTDOWN = ['3', '2', '1', 'Go!'];
export const PLACE_LABELS = ['1st', '2nd', '3rd', '4th', '5th'];
export const RESULT_DELAY = 0.9;   // pause entre la dernière arrivée et l'écran des résultats (s)

export const STORAGE_KEY = 'duck-race:v1';
// Ancien nom du projet : on reprend les statistiques déjà enregistrées sous cette clé
export const LEGACY_STORAGE_KEY = 'course-canards:v1';
