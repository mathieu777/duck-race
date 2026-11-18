# Course de canards — PWA

Un jeu de course de canards jouable dans le navigateur, installable sur téléphone, et utilisable hors ligne.

## Règles du jeu

1. Choisis ton canard sur l'écran d'accueil.
2. Lance la course : le compte à rebours 3-2-1-GO donne le départ.
3. **Tapote l'écran** (ou appuie sur Espace / Entrée sur ordinateur) pour booster ton canard.
4. Chaque tap remplit la jauge d'énergie. Plus elle est haute, plus ton canard va vite (jusqu'à +50 %). Sans taps, elle se vide.
5. Le classement s'affiche à l'arrivée. Tes statistiques et ton meilleur temps de victoire sont sauvegardés sur l'appareil.

## Structure

```
course-canards/
├── index.html            Page unique : menu, course, résultats
├── manifest.webmanifest  Métadonnées PWA (nom, icône, affichage)
├── sw.js                 Service worker (cache hors ligne)
├── css/style.css         Styles mobile-first
├── js/game.js            Logique, rendu canvas et interface
└── icons/icon.svg        Icône de l'application
```

Les réglages de difficulté sont regroupés dans l'objet `TUNING` au début de `js/game.js` :
vitesse de base, énergie par tap, vitesse de décroissance, bonus maximal, etc.

## Lancer en local

Une PWA a besoin d'un serveur HTTP (le simple clic sur `index.html` ne suffit pas pour le service worker).

```bash
cd course-canards
python3 -m http.server 8000
```

Puis ouvre `http://localhost:8000` sur l'ordinateur.

Pour tester sur téléphone, il faut un déploiement en **HTTPS** (voir plus bas) ou une URL locale accessible sur le même réseau Wi-Fi, mais le service worker ne fonctionne qu'en HTTPS (ou sur `localhost`).

## Installer sur téléphone

- **Android (Chrome)** : menu ⋮ → « Installer l'application » ou « Ajouter à l'écran d'accueil ».
- **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil ».

## Publier en ligne

Le dossier est statique, il suffit de l'héberger tel quel :

- **GitHub Pages** : pousse le dossier sur un dépôt, puis active Pages dans les paramètres.
- **Netlify** ou **Vercel** : glisse le dossier dans le tableau de bord.

## Points à savoir

- **Icônes PNG** : l'icône est en SVG, ce qui fonctionne sur les navigateurs récents. Pour une compatibilité maximale (notamment l'installation sur certains Android), exporte aussi des PNG 192×192 et 512×512 et ajoute-les au manifeste.
- **Mise à jour du cache** : après chaque modification des fichiers, incrémente `CACHE_VERSION` dans `sw.js` pour forcer les appareils à récupérer la nouvelle version.
- **Son et vibrations** : les vibrations sont prises en charge sur Android (`navigator.vibrate`), pas sur iOS. Le son n'est pas encore implémenté et pourrait être ajouté avec l'API Web Audio.
