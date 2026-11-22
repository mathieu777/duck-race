/*
 * Duck Race — icônes SVG, dessinées à la main sur une grille de 24 × 24.
 * Elles prennent la couleur du texte qui les entoure (currentColor).
 */
const SHAPES = {
  // Un doigt qui touche l'écran : un point et deux ondes
  tap: '<circle cx="12" cy="12" r="2.8" fill="currentColor" stroke="none"/>'
    + '<circle cx="12" cy="12" r="6.6" opacity=".6"/><circle cx="12" cy="12" r="10.2" opacity=".28"/>',
  // Un doigt qui glisse vers la droite
  swipe: '<circle cx="4.6" cy="12" r="2.8" fill="currentColor" stroke="none"/>'
    + '<path d="M10 12h10.5" opacity=".6"/><path d="m16.5 7 5 5-5 5"/>',
  // Un oiseau en plein vol, ailes levées (le symbole le plus lisible, même à petite taille)
  wing: '<path d="M1.8 9.4c3.9-3.6 7.9-2.3 10.2 4.8 2.3-7.1 6.3-8.4 10.2-4.8"/>',
  bolt: '<path d="M13.2 2.5 5 13.6h6L10.2 21.5 19 10.2h-6.1z" fill="currentColor"/>',
  flag: '<path d="M5.5 21.5v-19"/><path d="M5.5 3.5h13l-2.8 4.3 2.8 4.2h-13" fill="currentColor"/>',
  check: '<path d="m5 12.6 4.6 4.6L19 7.6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
};

/** Renvoie le code SVG d'une icône. `size` est en pixels CSS. */
export function icon(name, size = 24) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" `
    + `stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">`
    + `${SHAPES[name]}</svg>`;
}
