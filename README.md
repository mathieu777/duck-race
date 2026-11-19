# Duck Race — PWA

[English](#english) · [Français](#francais)

## English

A duck-racing game playable in the browser, installable on a phone and usable offline. The in-game text is currently in French (difficulty levels: *Facile* = Easy, *Normal*, *Difficile* = Hard).

### How to play

1. Pick your duck and a difficulty level (Easy, Normal or Hard) on the home screen. The difficulty only sets the pace of the opponents.
2. Start the race: a 3-2-1-GO countdown gives the start.
3. **Tap the screen** (or press Space / Enter on a computer) to boost your duck.
4. Each tap adds energy to the gauge, which gradually drains away. The faster you tap, the higher it stays and the faster your duck goes (up to +50%, with a full gauge at about 8 taps per second). Without taps, it empties.
5. The ranking is shown at the finish. Your stats and your best winning time are saved on the device.

### Project structure

```
duck-race/
├── index.html            Single page: menu, race, results
├── manifest.webmanifest  PWA metadata (name, icon, display mode)
├── sw.js                 Service worker (offline cache)
├── css/style.css         Mobile-first styles
├── js/game.js            Game logic, canvas rendering and interface
└── icons/icon.svg        App icon
```

The game settings are grouped at the top of `js/game.js`:

- `TUNING`: base speed, energy per tap, energy decay, maximum boost, opponents' sprints.
- `DIFFICULTIES`: one pace (`aiPace`) per level, a multiplier applied to the opponents' speed. With steady tapping, you win about one race in two at ~3 taps/s on Easy, ~4.5 taps/s on Normal and ~6.5 taps/s on Hard.
- `HUD_SPACE`: height reserved at the top and bottom of the screen for the interface (gauge, timer), so that it doesn't hide the ducks.

### Run locally

A PWA needs an HTTP server (just opening `index.html` is not enough for the service worker).

```bash
cd duck-race
python3 -m http.server 8000
```

Then open `http://localhost:8000` on your computer.

To test on a phone, you need an **HTTPS** deployment (see below) or a local URL reachable on the same Wi-Fi network, but the service worker only works over HTTPS (or on `localhost`).

### Install on a phone

- **Android (Chrome)**: ⋮ menu → “Install app” or “Add to Home screen”.
- **iPhone (Safari)**: Share button → “Add to Home Screen”.

### Publish online

The folder is static, so you can host it as is:

- **GitHub Pages**: push the folder to a repository, then enable Pages in the settings.
- **Netlify** or **Vercel**: drag and drop the folder into the dashboard.

### Good to know

- **PNG icons**: the icon is an SVG, which works in recent browsers. For maximum compatibility (notably installing on some Android devices), also export 192×192 and 512×512 PNGs and add them to the manifest.
- **Cache updates**: after each change to the files, increment `CACHE_VERSION` in `sw.js` to force devices to fetch the new version.
- **Sound and vibration**: vibration is supported on Android (`navigator.vibrate`) but not on iOS. Sound is not implemented yet and could be added with the Web Audio API.

---

## <a name="francais"></a>Français

Un jeu de course de canards jouable dans le navigateur, installable sur téléphone, et utilisable hors ligne.

### Règles du jeu

1. Choisis ton canard et ta difficulté (Facile, Normal ou Difficile) sur l'écran d'accueil. La difficulté règle uniquement l'allure des adversaires.
2. Lance la course : le compte à rebours 3-2-1-GO donne le départ.
3. **Tapote l'écran** (ou appuie sur Espace / Entrée sur ordinateur) pour booster ton canard.
4. Chaque tap ajoute de l'énergie à la jauge, qui s'évapore peu à peu. Plus tu tapotes vite, plus elle reste haute et plus ton canard va vite (jusqu'à +50 %, jauge pleine vers 8 taps par seconde). Sans taps, elle se vide.
5. Le classement s'affiche à l'arrivée. Tes statistiques et ton meilleur temps de victoire sont sauvegardés sur l'appareil.

### Structure

```
duck-race/
├── index.html            Page unique : menu, course, résultats
├── manifest.webmanifest  Métadonnées PWA (nom, icône, affichage)
├── sw.js                 Service worker (cache hors ligne)
├── css/style.css         Styles mobile-first
├── js/game.js            Logique, rendu canvas et interface
└── icons/icon.svg        Icône de l'application
```

Les réglages sont regroupés au début de `js/game.js` :

- `TUNING` : vitesse de base, énergie par tap, évaporation de l'énergie, bonus maximal, sprints des adversaires.
- `DIFFICULTIES` : une allure (`aiPace`) par niveau, multiplicateur de la vitesse des adversaires. Avec des taps réguliers, on gagne environ une course sur deux à ~3 taps/s en Facile, ~4,5 taps/s en Normal et ~6,5 taps/s en Difficile.
- `HUD_SPACE` : hauteur réservée en haut et en bas de l'écran pour l'interface (jauge, chrono), afin qu'elle ne masque pas les canards.

### Lancer en local

Une PWA a besoin d'un serveur HTTP (le simple clic sur `index.html` ne suffit pas pour le service worker).

```bash
cd duck-race
python3 -m http.server 8000
```

Puis ouvre `http://localhost:8000` sur l'ordinateur.

Pour tester sur téléphone, il faut un déploiement en **HTTPS** (voir plus bas) ou une URL locale accessible sur le même réseau Wi-Fi, mais le service worker ne fonctionne qu'en HTTPS (ou sur `localhost`).

### Installer sur téléphone

- **Android (Chrome)** : menu ⋮ → « Installer l'application » ou « Ajouter à l'écran d'accueil ».
- **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil ».

### Publier en ligne

Le dossier est statique, il suffit de l'héberger tel quel :

- **GitHub Pages** : pousse le dossier sur un dépôt, puis active Pages dans les paramètres.
- **Netlify** ou **Vercel** : glisse le dossier dans le tableau de bord.

### Points à savoir

- **Icônes PNG** : l'icône est en SVG, ce qui fonctionne sur les navigateurs récents. Pour une compatibilité maximale (notamment l'installation sur certains Android), exporte aussi des PNG 192×192 et 512×512 et ajoute-les au manifeste.
- **Mise à jour du cache** : après chaque modification des fichiers, incrémente `CACHE_VERSION` dans `sw.js` pour forcer les appareils à récupérer la nouvelle version.
- **Son et vibrations** : les vibrations sont prises en charge sur Android (`navigator.vibrate`), pas sur iOS. Le son n'est pas encore implémenté et pourrait être ajouté avec l'API Web Audio.
