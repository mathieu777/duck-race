/*
 * Duck Race — effets visuels : éclaboussures, rides sur l'eau, confettis.
 *
 * Des particules très simples, dessinées directement sur le canevas. Deux repères existent :
 *  - « monde » : accrochées à la piste, elles défilent avec la caméra (éclaboussures, rides) ;
 *  - « écran » : fixes à l'écran (rides sous le doigt, confettis).
 *
 * Quand le joueur a demandé moins d'animations (prefers-reduced-motion), il n'y a presque plus de
 * particules : seulement une ride discrète pour confirmer les gestes.
 */
import { COLORS, DUCKS } from './config.js';

const MAX_PARTICLES = 320;
const TAU = Math.PI * 2;

export function createFx() {
  let items = [];
  let reduced = false;
  const rand = (min, max) => min + Math.random() * (max - min);

  function add(particle) {
    if (items.length >= MAX_PARTICLES) items.shift();
    items.push(particle);
  }

  return {
    setReducedMotion(value) {
      reduced = value;
    },

    clear() {
      items = [];
    },

    /** Ride qui s'élargit sur l'eau (repère monde ou écran). */
    ring(x, y, { radius = 40, life = 0.7, screen = false, alpha = 0.7, width = 2.5 } = {}) {
      add({ type: 'ring', x, y, r0: radius * 0.25, r1: radius, age: 0, life, screen, alpha, width });
    },

    /** Éclaboussure : des gouttes qui jaillissent et retombent. `power` va de 0 (petite) à 1 (grosse). */
    splash(x, y, size, power = 0.6) {
      this.ring(x, y, { radius: size * (0.6 + power * 0.5), life: 0.8, alpha: 0.75 });
      if (reduced) return;
      const count = Math.round(7 + power * 9);
      for (let i = 0; i < count; i += 1) {
        const angle = -Math.PI / 2 + rand(-1.05, 1.05);
        const speed = size * rand(2.2, 4.4) * (0.55 + power * 0.7);
        add({
          type: 'drop', x: x + rand(-0.12, 0.12) * size, y,
          vx: Math.cos(angle) * speed * 0.8 - size * 0.9,   // un peu emportées vers l'arrière
          vy: Math.sin(angle) * speed,
          g: size * 11, r: rand(0.035, 0.075) * size,
          age: 0, life: rand(0.5, 0.85), screen: false,
        });
      }
    },

    /** Ride sous le doigt à chaque tap. */
    tap(sx, sy) {
      this.ring(sx, sy, { radius: 30, life: 0.5, screen: true, alpha: 0.55, width: 2 });
    },

    /** Pluie de confettis pour une victoire. */
    confetti(width, height) {
      if (reduced) return;
      const palette = [COLORS.sun, COLORS.beak, COLORS.buoy, '#4EE3C1', '#FFFFFF', ...DUCKS.map((d) => d.color)];
      for (let i = 0; i < 90; i += 1) {
        add({
          type: 'confetti',
          x: rand(-0.05, 1.05) * width, y: rand(-0.35, 0) * height,
          vx: rand(-40, 40), vy: rand(90, 220),
          w: rand(5, 10), h: rand(3, 6),
          rot: rand(0, TAU), spin: rand(-7, 7),
          color: palette[Math.floor(Math.random() * palette.length)],
          age: 0, life: rand(2.6, 4), screen: true, sway: rand(0, TAU),
        });
      }
    },

    update(dt) {
      for (const p of items) {
        p.age += dt;
        if (p.type === 'drop') {
          p.vy += p.g * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        } else if (p.type === 'confetti') {
          p.sway += dt * 3;
          p.x += (p.vx + Math.sin(p.sway) * 30) * dt;
          p.y += p.vy * dt;
          p.rot += p.spin * dt;
        }
      }
      items = items.filter((p) => p.age < p.life);
    },

    /** @param {number} cameraX  abscisse du bord gauche de l'écran dans le monde */
    draw(ctx, cameraX) {
      for (const p of items) {
        const t = p.age / p.life;
        const x = p.screen ? p.x : p.x - cameraX;
        if (p.type === 'ring') {
          const eased = 1 - (1 - t) * (1 - t);
          const r = p.r0 + (p.r1 - p.r0) * eased;
          ctx.globalAlpha = p.alpha * (1 - t);
          ctx.strokeStyle = COLORS.foam;
          ctx.lineWidth = p.width * (1 - t * 0.5);
          ctx.beginPath();
          ctx.ellipse(x, p.y, r, r * (p.screen ? 0.6 : 0.3), 0, 0, TAU);
          ctx.stroke();
        } else if (p.type === 'drop') {
          ctx.globalAlpha = Math.min(1, (1 - t) * 1.6);
          ctx.fillStyle = '#EAFBFF';
          ctx.beginPath();
          ctx.arc(x, p.y, p.r, 0, TAU);
          ctx.fill();
        } else if (p.type === 'confetti') {
          ctx.globalAlpha = Math.min(1, (1 - t) * 3);
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}
