/*
 * Duck Race — la course, sans aucun affichage.
 *
 * Ce fichier ne touche ni au DOM ni au canvas : il décrit seulement comment avancent les canards.
 * C'est ce qui permet de le tester et de le simuler (équilibrage) en dehors du navigateur.
 *
 * Principe :
 *  - Chaque tap ajoute de l'énergie à la jauge du joueur ; elle s'évapore ensuite
 *    (décroissance exponentielle). Plus l'énergie est haute, plus le canard va vite (jusqu'à +50 %).
 *  - L'envol (deux taps puis une glissade vers la droite, voir input.js) ajoute un bonus de vitesse
 *    pendant environ une seconde, puis demande une recharge.
 *  - Les autres canards ont une vitesse de base aléatoire et des sprints ; la difficulté règle leur allure.
 *
 * Les événements (décollage, atterrissage, arrivée…) sont empilés dans `race.events` ;
 * c'est à l'appelant de les consommer (effets visuels, interface).
 */
import { DUCKS, TUNING, FLIGHT, HOP, DIFFICULTIES } from './config.js';

const TWO_PI = Math.PI * 2;
const smooth = (x) => x * x * (3 - 2 * x);

/** Bonus de vitesse pendant l'envol : montée rapide, plateau, descente douce (0 → 1 → 0). */
export function flightEnvelope(phase) {
  if (phase <= 0 || phase >= 1) return 0;
  const up = smooth(Math.min(1, phase / 0.15));
  const down = smooth(Math.min(1, (1 - phase) / 0.25));
  return Math.min(up, down);
}

/** Avancement du vol ou du bond d'un canard, de 0 à 1 ; -1 s'il est sur l'eau. */
export function airPhase(racer) {
  if (racer.flightT >= 0) return racer.flightT / FLIGHT.duration;
  if (racer.hopT >= 0) return racer.hopT / HOP.duration;
  return -1;
}

export function createRace({ playerIndex, difficulty, rng = Math.random }) {
  const level = DIFFICULTIES[difficulty];
  const rand = (min, max) => min + rng() * (max - min);
  // Le joueur a toujours l'allure moyenne : son résultat dépend de ses taps, pas de la chance.
  const playerBase = (TUNING.speedMin + TUNING.speedMax) / 2;

  const racers = DUCKS.map((duck, index) => {
    const isPlayer = index === playerIndex;
    return {
      index,
      name: duck.name,
      isPlayer,
      progress: 0,            // 0 = départ, 1 = arrivée
      glide: 0,               // distance parcourue après la ligne (effet visuel), en fraction de piste
      speed: 0,               // vitesse instantanée, en fraction de piste par seconde
      base: isPlayer ? playerBase : rand(TUNING.speedMin, TUNING.speedMax) * level.aiPace,
      wobbleFreq: rand(1.5, 3.5),
      wobblePhase: rand(0, TWO_PI),
      energy: 0,              // joueur uniquement
      sprintMul: 1,           // IA uniquement
      sprintTimer: rand(0.5, 1.5),
      flightT: -1,            // joueur : temps écoulé depuis le décollage (-1 = au sol)
      hopT: -1,               // IA : temps écoulé depuis le début du bond (-1 = au sol)
      recharge: 0,            // joueur : temps restant avant de pouvoir redécoller
      finished: false,
      finishTime: null,
      place: null,
      taps: 0,
      flights: 0,
    };
  });

  return { racers, playerIndex, time: 0, finishedCount: 0, events: [], rand };
}

export const playerOf = (race) => race.racers[race.playerIndex];

/** Un tap ajoute de l'énergie à la jauge du joueur. */
export function tap(race) {
  const player = playerOf(race);
  if (player.finished) return false;
  player.energy = Math.min(TUNING.maxEnergy, player.energy + TUNING.tapEnergy);
  player.taps += 1;
  return true;
}

export function canTakeOff(race) {
  const player = playerOf(race);
  return !player.finished && player.flightT < 0 && player.recharge <= 0;
}

/** Fait décoller le canard du joueur. Renvoie false si l'envol n'est pas possible (recharge en cours). */
export function takeOff(race) {
  if (!canTakeOff(race)) return false;
  const player = playerOf(race);
  player.flightT = 0;
  player.recharge = FLIGHT.recharge;
  player.flights += 1;
  race.events.push({ type: 'takeoff', racer: player });
  return true;
}

/** Position actuelle d'un canard (1 = en tête). */
export function rankOf(race, racer) {
  if (racer.finished) return racer.place;
  const ahead = race.racers.filter((r) => !r.finished && r !== racer && r.progress > racer.progress).length;
  return race.finishedCount + ahead + 1;
}

export const allFinished = (race) => race.racers.every((racer) => racer.finished);

/** Fait avancer la course de `dt` secondes. */
export function step(race, dt) {
  race.time += dt;
  const finishers = [];

  for (const racer of race.racers) {
    updateAir(race, racer, dt);

    if (racer.finished) {
      // Le canard glisse un peu après la ligne, en ralentissant
      racer.glide += racer.speed * dt;
      racer.speed *= Math.exp(-3.2 * dt);
      continue;
    }

    if (racer.isPlayer) {
      // Évaporation exponentielle : plus la jauge est haute, plus elle se vide vite
      racer.energy *= Math.exp(-TUNING.energyDecay * dt);
    } else {
      racer.sprintTimer -= dt;
      if (racer.sprintTimer <= 0) {
        // Parfois l'IA sprinte pendant un court instant, sinon elle reprend son allure normale
        racer.sprintMul = race.rand(0, 1) < TUNING.aiSprintChance
          ? race.rand(TUNING.aiSprintMin, TUNING.aiSprintMax)
          : 1;
        racer.sprintTimer = race.rand(0.8, 2);
        if (racer.sprintMul >= HOP.minSprint && racer.hopT < 0) {
          racer.hopT = 0;
          race.events.push({ type: 'hop', racer });
        }
      }
    }

    const wobble = 1 + TUNING.wobble * Math.sin(race.time * racer.wobbleFreq + racer.wobblePhase);
    const energyBoost = racer.isPlayer
      ? 1 + (racer.energy / TUNING.maxEnergy) * TUNING.maxBoost
      : racer.sprintMul;
    const flightBoost = racer.flightT >= 0
      ? 1 + FLIGHT.boost * flightEnvelope(racer.flightT / FLIGHT.duration)
      : 1;

    racer.speed = racer.base * wobble * energyBoost * flightBoost;
    racer.progress += racer.speed * dt;

    if (racer.progress >= 1) {
      // Instant exact du passage de la ligne, à l'intérieur de ce pas de temps
      const overshoot = (racer.progress - 1) / racer.speed;
      finishers.push({ racer, time: race.time - overshoot });
    }
  }

  // Plusieurs canards peuvent franchir la ligne dans le même pas : on les classe à l'instant exact
  finishers.sort((a, b) => a.time - b.time);
  for (const { racer, time } of finishers) {
    racer.progress = 1;
    racer.finished = true;
    race.finishedCount += 1;
    racer.place = race.finishedCount;
    racer.finishTime = time;
    race.events.push({ type: 'finish', racer });
  }
}

function updateAir(race, racer, dt) {
  if (racer.flightT >= 0) {
    racer.flightT += dt;
    if (racer.flightT >= FLIGHT.duration) {
      racer.flightT = -1;
      race.events.push({ type: 'land', racer });
    }
  }
  if (racer.hopT >= 0) {
    racer.hopT += dt;
    if (racer.hopT >= HOP.duration) {
      racer.hopT = -1;
      race.events.push({ type: 'land', racer });
    }
  }
  if (racer.recharge > 0) {
    racer.recharge -= dt;
    if (racer.recharge <= 0) {
      racer.recharge = 0;
      race.events.push({ type: 'ready', racer });
    }
  }
}
