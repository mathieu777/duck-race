/*
 * Sauvegarde locale : statistiques, canard et difficulté choisis.
 * Les données restent sur l'appareil (localStorage) ; si le stockage est indisponible
 * (mode privé, quota), le jeu continue simplement sans sauvegarde.
 */
import { DUCKS, DIFFICULTIES, DEFAULT_DIFFICULTY, STORAGE_KEY, LEGACY_STORAGE_KEY } from './config.js';

const FALLBACK = {
  races: 0,
  wins: 0,
  bestTime: null,
  playerIndex: 0,
  difficulty: DEFAULT_DIFFICULTY,
  takeoffs: 0,           // nombre total d'envols réussis (sert à masquer l'aide une fois le geste appris)
};

export function loadStore() {
  try {
    // La clé actuelle d'abord ; sinon l'ancienne (première ouverture après le renommage du projet)
    const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    const merged = { ...FALLBACK, ...JSON.parse(saved) };

    // Garde des valeurs valides même si le stockage a été altéré
    merged.playerIndex = Math.min(Math.max(0, Number(merged.playerIndex) || 0), DUCKS.length - 1);
    if (!Object.prototype.hasOwnProperty.call(DIFFICULTIES, merged.difficulty)) {
      merged.difficulty = DEFAULT_DIFFICULTY;
    }
    merged.takeoffs = Math.max(0, Math.floor(Number(merged.takeoffs) || 0));
    return merged;
  } catch (err) {
    return { ...FALLBACK };
  }
}

export function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    // Stockage indisponible : on ignore
  }
}
