# Duck Race — PWA

[English](#english) · [Français](#francais)

## English

A duck-racing game for phones: playable in the browser, installable on the home screen and usable offline. The in-game text is in French (difficulty levels: *Facile* = Easy, *Normal*, *Difficile* = Hard; *Envol* = take-off).

### How to play

1. Pick your duck and a difficulty level (Easy, Normal or Hard) on the home screen. The difficulty only sets the pace of the opponents.
2. Start the race: a 3-2-1-GO countdown gives the start.
3. **Tap the screen** (or press Space / Enter on a computer) to boost your duck. Each tap adds energy to the gauge, which gradually drains away. The faster you tap, the faster your duck goes (up to +50%, with a full gauge at about 8 taps per second).
4. **Take off: tap twice, then swipe to the right** (on a computer: Space, Space, then the right arrow). Your duck lifts off for about a second, leaves its shadow on the water and speeds up (up to +25% at the peak of the flight). The take-off button at the bottom right then recharges for 4 seconds and lights up again when you can take off again.
   - The swipe must be at least 44 px long, quick (under half a second) and mostly horizontal. The two taps count if they happen during the second before the swipe starts. Frantic tapping is fine: the swipe can come at any moment.
   - Start the swipe away from the very edge of the screen: on some phones, a swipe from the edge is the system's "back" gesture.
5. The ranking is shown at the finish. Your stats and your best winning time are saved on the device.

### Project structure

```
duck-race/
├── index.html            Single page: menu, race interface, results
├── manifest.webmanifest  PWA metadata (name, icons, colours)
├── sw.js                 Service worker (offline cache)
├── css/style.css         Mobile-first styles (menu, race interface, results, landscape)
├── js/
│   ├── main.js           Entry point: game states (menu, countdown, race, results) and animation loop
│   ├── config.js         Every number you may want to change (speeds, take-off, difficulty, camera)
│   ├── race.js           The race rules, without any drawing: speeds, energy, take-off
│   ├── input.js          The gestures: taps, swipe to the right, keyboard
│   ├── scene.js          Drawing the lake, banks, lane ropes and ducks on the canvas
│   ├── sprites.js        The five glossy ducks, drawn with code
│   ├── fx.js             Splashes, water rings, confetti
│   ├── ui.js             Menu, race interface and results (HTML elements)
│   ├── icons.js          The interface icons (SVG)
│   └── store.js          Saved stats and settings (localStorage)
├── fonts/                DynaPuff and Figtree (SIL Open Font License, see fonts/LICENSE.txt)
└── icons/                App icons: SVG, PNG 180 (iPhone), 192 and 512, maskable 512 (Android)
```

The game settings are grouped in `js/config.js`:

- `TUNING`: base speed, energy per tap, energy decay, maximum boost, opponents' sprints.
- `FLIGHT`: the take-off (duration, speed bonus, recharge time) and the gesture (number of taps, time window, minimum swipe length, maximum swipe duration).
- `DIFFICULTIES`: one pace (`aiPace`) per level, a multiplier applied to the opponents' speed. Estimates from simulations of the game rules, at 3 taps/s on Easy, 4.5 taps/s on Normal and 6.5 taps/s on Hard: a player who never takes off wins about one race in five (and reaches the podium about nine times out of ten); a player who takes off each time the button is ready wins about three races in four.
- `HUD_SPACE` and `WORLD`: height reserved at the top and bottom of the screen for the interface (so that it never hides the ducks), track length and camera behaviour.

### Run locally

A PWA needs an HTTP server (just opening `index.html` is not enough for the service worker and the JavaScript modules).

```bash
cd duck-race
python3 -m http.server 8000
```

Then open `http://localhost:8000` on your computer. Adding `?debug` to the address exposes the game state as `window.__duck` in the browser console, which is handy for testing.

To test on a phone, you need an **HTTPS** deployment (see below) or a local URL reachable on the same Wi-Fi network, but the service worker only works over HTTPS (or on `localhost`).

### Install on a phone

- **Android (Chrome)**: ⋮ menu → “Install app” or “Add to Home screen”.
- **iPhone (Safari)**: Share button → “Add to Home Screen”.

### Publish online

The folder is static, so you can host it as is:

- **GitHub Pages**: push the folder to a repository, then enable Pages in the settings.
- **Netlify** or **Vercel**: drag and drop the folder into the dashboard.

### Good to know

- **Updates**: the service worker is "network first": when the phone is online, players always get the latest files, and the cache is only the offline fallback. After each change, increment `CACHE_VERSION` in `sw.js`, and add any new file (script, font, image) to its `ASSETS` list, otherwise it will be missing offline. The app asks for the new service worker each time it opens; Chrome may apply it about a minute later.
- **Several games on the same site**: the cache names and the saved data are prefixed with `duck-race`, so they never clash with another project hosted on the same `github.io` account. Stats saved under the old name (`course-canards`) are picked up automatically.
- **Fonts**: DynaPuff (titles) and Figtree (text) are bundled in `fonts/`, so no request goes to an external server.
- **Comfort**: the game respects the "reduce motion" setting (no confetti, speed lines or water droplets), works in landscape and around notches (safe areas), and everything in the menu can be used with a keyboard.
- **Sound and vibration**: vibration is supported on Android (`navigator.vibrate`) for taps, take-off and finish, but not on iOS. Sound is not implemented yet and could be added with the Web Audio API.

---

## <a name="francais"></a>Français

Un jeu de course de canards pour téléphone : jouable dans le navigateur, installable sur l'écran d'accueil et utilisable hors ligne. Les textes du jeu sont en français (niveaux : *Facile*, *Normal*, *Difficile*).

### Règles du jeu

1. Choisis ton canard et ta difficulté (Facile, Normal ou Difficile) sur l'écran d'accueil. La difficulté règle uniquement l'allure des adversaires.
2. Lance la course : le compte à rebours 3-2-1-GO donne le départ.
3. **Tapote l'écran** (ou appuie sur Espace / Entrée sur ordinateur) pour booster ton canard. Chaque tap ajoute de l'énergie à la jauge, qui s'évapore peu à peu. Plus tu tapotes vite, plus ton canard va vite (jusqu'à +50 %, jauge pleine vers 8 taps par seconde).
4. **Envol : tape deux fois, puis glisse vers la droite** (sur ordinateur : Espace, Espace, puis la flèche droite). Ton canard décolle pendant environ une seconde, laisse son ombre sur l'eau et accélère (jusqu'à +25 % au sommet du vol). Le bouton d'envol, en bas à droite, se recharge ensuite pendant 4 secondes et se rallume quand tu peux t'envoler de nouveau.
   - La glissade doit mesurer au moins 44 px, être rapide (moins d'une demi-seconde) et plutôt horizontale. Les deux taps comptent s'ils ont eu lieu dans la seconde qui précède le début de la glissade. Tu peux tapoter sans arrêt : la glissade peut venir à n'importe quel moment.
   - Commence la glissade loin du bord de l'écran : sur certains téléphones, une glissade depuis le bord est le geste « retour » du système.
5. Le classement s'affiche à l'arrivée. Tes statistiques et ton meilleur temps de victoire sont sauvegardés sur l'appareil.

### Structure

```
duck-race/
├── index.html            Page unique : menu, interface de course, résultats
├── manifest.webmanifest  Métadonnées PWA (nom, icônes, couleurs)
├── sw.js                 Service worker (cache hors ligne)
├── css/style.css         Styles mobile-first (menu, interface de course, résultats, paysage)
├── js/
│   ├── main.js           Point d'entrée : états du jeu (menu, compte à rebours, course, résultats) et boucle d'animation
│   ├── config.js         Tous les nombres que tu voudras modifier (vitesses, envol, difficulté, caméra)
│   ├── race.js           Les règles de la course, sans aucun dessin : vitesses, énergie, envol
│   ├── input.js          Les gestes : taps, glissade vers la droite, clavier
│   ├── scene.js          Dessin du lac, des rives, des cordes de couloir et des canards sur le canevas
│   ├── sprites.js        Les cinq canards brillants, dessinés avec du code
│   ├── fx.js             Éclaboussures, ronds dans l'eau, confettis
│   ├── ui.js             Menu, interface de course et résultats (éléments HTML)
│   ├── icons.js          Les icônes de l'interface (SVG)
│   └── store.js          Statistiques et réglages sauvegardés (localStorage)
├── fonts/                DynaPuff et Figtree (licence SIL Open Font License, voir fonts/LICENSE.txt)
└── icons/                Icônes de l'appli : SVG, PNG 180 (iPhone), 192 et 512, maskable 512 (Android)
```

Les réglages sont regroupés dans `js/config.js` :

- `TUNING` : vitesse de base, énergie par tap, évaporation de l'énergie, bonus maximal, sprints des adversaires.
- `FLIGHT` : l'envol (durée, bonus de vitesse, temps de recharge) et le geste (nombre de taps, fenêtre de temps, longueur minimale et durée maximale de la glissade).
- `DIFFICULTIES` : une allure (`aiPace`) par niveau, multiplicateur de la vitesse des adversaires. Estimations tirées de simulations des règles du jeu, à 3 taps/s en Facile, 4,5 taps/s en Normal et 6,5 taps/s en Difficile : un joueur qui ne s'envole jamais gagne environ une course sur cinq (et monte sur le podium environ neuf fois sur dix) ; un joueur qui s'envole chaque fois que le bouton est prêt en gagne environ trois sur quatre.
- `HUD_SPACE` et `WORLD` : hauteur réservée en haut et en bas de l'écran pour l'interface (afin qu'elle ne masque jamais les canards), longueur de la piste et comportement de la caméra.

### Lancer en local

Une PWA a besoin d'un serveur HTTP (le simple clic sur `index.html` ne suffit pas pour le service worker et les modules JavaScript).

```bash
cd duck-race
python3 -m http.server 8000
```

Puis ouvre `http://localhost:8000` sur l'ordinateur. Ajouter `?debug` à l'adresse expose l'état du jeu sous le nom `window.__duck` dans la console du navigateur, pratique pour tester.

Pour tester sur téléphone, il faut un déploiement en **HTTPS** (voir plus bas) ou une URL locale accessible sur le même réseau Wi-Fi, mais le service worker ne fonctionne qu'en HTTPS (ou sur `localhost`).

### Installer sur téléphone

- **Android (Chrome)** : menu ⋮ → « Installer l'application » ou « Ajouter à l'écran d'accueil ».
- **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil ».

### Publier en ligne

Le dossier est statique, il suffit de l'héberger tel quel :

- **GitHub Pages** : pousse le dossier sur un dépôt, puis active Pages dans les paramètres.
- **Netlify** ou **Vercel** : glisse le dossier dans le tableau de bord.

### Points à savoir

- **Mises à jour** : le service worker est « réseau d'abord » : quand le téléphone est en ligne, les joueurs reçoivent toujours les derniers fichiers, et le cache ne sert que de secours hors ligne. Après chaque modification, incrémente `CACHE_VERSION` dans `sw.js`, et ajoute tout nouveau fichier (script, police, image) à sa liste `ASSETS`, sinon il manquera hors ligne. L'appli demande le nouveau service worker à chaque ouverture ; Chrome peut l'appliquer environ une minute plus tard.
- **Plusieurs jeux sur le même site** : les noms de cache et les données sauvegardées sont préfixés par `duck-race`, ils n'entrent donc jamais en conflit avec un autre projet hébergé sur le même compte `github.io`. Les statistiques enregistrées sous l'ancien nom (`course-canards`) sont reprises automatiquement.
- **Polices** : DynaPuff (titres) et Figtree (textes) sont embarquées dans `fonts/`, aucune requête ne part vers un serveur extérieur.
- **Confort** : le jeu respecte le réglage « réduire les animations » (pas de confettis, de traits de vitesse ni de gouttes d'eau), fonctionne en paysage et autour des encoches (zones sûres), et tout le menu s'utilise au clavier.
- **Son et vibrations** : les vibrations sont prises en charge sur Android (`navigator.vibrate`) pour les taps, l'envol et l'arrivée, pas sur iOS. Le son n'est pas encore implémenté et pourrait être ajouté avec l'API Web Audio.
