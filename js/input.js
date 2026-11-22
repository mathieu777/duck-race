/*
 * Duck Race — les gestes du joueur : taps, glissade vers la droite (l'envol) et clavier.
 *
 * Le geste de l'envol : au moins deux taps, puis une glissade vers la droite.
 *  - Les taps se comptent sur une fenêtre glissante (FLIGHT.comboWindow).
 *  - Le doigt qui glisse a lui aussi posé un tap en touchant l'écran, mais celui-ci ne compte pas
 *    dans le combo : on regarde seulement les taps faits AVANT que ce doigt se pose.
 *  - La glissade est reconnue dès que le doigt a parcouru assez de distance (pas besoin de le lever).
 *
 * Ce module ne connaît ni le canvas ni l'interface : il prévient le jeu par des fonctions de rappel.
 */
import { FLIGHT } from './config.js';

/**
 * @param {object} options
 * @param {() => boolean} options.isActive  vrai quand la course est en cours (sinon les gestes sont ignorés)
 * @param {(x: number, y: number) => void} options.onTap  un tap (x, y en pixels écran ; null au clavier)
 * @param {(info: { combo: boolean }) => void} options.onSwipe  une glissade vers la droite a été reconnue ;
 *        `combo` indique si les deux taps précédents ont bien eu lieu
 */
export function createInput({ isActive, onTap, onSwipe }) {
  const pointers = new Map();   // doigts (ou souris) actuellement posés : id -> { x0, y0, t0, combo, done }
  const tapTimes = [];          // instants (ms) des derniers taps, du plus ancien au plus récent

  const now = () => performance.now();

  /** Nombre de taps encore dans la fenêtre du combo (les plus anciens sont oubliés). */
  function recentTaps(t) {
    const limit = t - FLIGHT.comboWindow * 1000;
    while (tapTimes.length > 0 && tapTimes[0] < limit) tapTimes.shift();
    return tapTimes.length;
  }

  function onPointerDown(e) {
    if (!isActive()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const t = now();
    // Les taps précédents comptent pour le combo ; celui-ci (le début de la glissade) non
    const combo = recentTaps(t) >= FLIGHT.comboTaps;
    pointers.set(e.pointerId, { x0: e.clientX, y0: e.clientY, t0: t, combo, done: false });
    tapTimes.push(t);
    onTap(e.clientX, e.clientY);
  }

  function onPointerMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p || p.done || !isActive()) return;
    if (now() - p.t0 > FLIGHT.swipeTime * 1000) {
      p.done = true;                      // trop lent : c'est un appui prolongé, pas une glissade
      return;
    }
    const dx = e.clientX - p.x0;
    const dy = e.clientY - p.y0;
    // Assez longue, et plutôt horizontale (le trait ne doit pas être trop penché)
    if (dx >= FLIGHT.swipeDistance && dx > Math.abs(dy) * 1.4) {
      p.done = true;
      onSwipe({ combo: p.combo });
    }
  }

  function onPointerEnd(e) {
    pointers.delete(e.pointerId);
  }

  // Clavier : Espace ou Entrée = tap, flèche droite = glissade vers la droite
  function onKeyDown(e) {
    if (!isActive() || e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      tapTimes.push(now());
      onTap(null, null);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      onSwipe({ combo: recentTaps(now()) >= FLIGHT.comboTaps });
    }
  }

  function clearPointers() {
    pointers.clear();
  }

  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerEnd);
  window.addEventListener('pointercancel', onPointerEnd);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('blur', clearPointers);

  return {
    /** Nombre de taps du combo déjà faits (de 0 à FLIGHT.comboTaps), pour l'interface. */
    comboCount() {
      return Math.min(FLIGHT.comboTaps, recentTaps(now()));
    },
    /** Remet les gestes à zéro (au début d'une course). */
    reset() {
      tapTimes.length = 0;
      pointers.clear();
    },
    destroy() {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', clearPointers);
    },
  };
}
