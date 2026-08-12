# Cowlor's Sidebar for Twitch

Version 3.17.1 · Extension Chrome (Manifest V3) · 🇬🇧 [English version](README.en.md)

Extension qui enrichit la sidebar des chaînes suivies de Twitch : durée de
stream en direct, badge collaboration, masquage des Hype Trains et des bandeaux
de réduction d'abonnement, masquage des chaînes déconnectées et des sections
vides, auto-expansion de la liste suivie, mise en évidence des streams démarrés
récemment, détection et coloration des co-streams (avec rôle hôte/participant
extrait du DOM Twitch), détection du système « En live avec » (squad /
multistream), normalisation visuelle des cartes sponsorisées, filtres par
catégorie et par langue (avec drapeaux), cinq modes de tri au choix, historique de visites stocké localement,
et aperçu vidéo en direct au survol d'une chaîne (toutes sections confondues)
avec titre, badges contextuels et gestion des Content Classification Labels.

**Nouveau en 3.0.0+** : l'aperçu vidéo au survol est désormais débarrassé des
publicités préroll grâce à un module anti-pub intégré (cf. section dédiée
plus bas). Le stream principal n'est **pas** impacté — seul l'iframe
d'aperçu bénéficie du blocage.

L'extension fonctionne **quelle que soit la langue de l'interface Twitch** : elle
repère la section des chaînes suivies via des marqueurs structurels indépendants
de la langue (repli sur l'aria-label localisé en
français/anglais/allemand/espagnol/portugais). Ses propres libellés sont en
français, anglais, allemand, espagnol ou portugais (Brésil et Portugal),
détectés automatiquement.

---

## Installation

L'extension est publiée sur le **Chrome Web Store** : ouvrez sa fiche
(recherchez « Cowlor's Sidebar for Twitch »), cliquez sur **Ajouter à
Chrome**, puis rechargez un onglet `https://www.twitch.tv/` — la sidebar est
enrichie automatiquement. Les mises à jour sont alors gérées par le navigateur.

### Installation manuelle (mode développeur)

Vous pouvez aussi l'installer à la main, à partir du dossier
`cowlors-sidebar-for-twitch` (ou du `.zip` décompressé) — utile pour tester une
version de développement :

1. Ouvrez votre navigateur sur la page des extensions :
   - Chrome : `chrome://extensions`
   - Edge : `edge://extensions`
   - Brave : `brave://extensions`
   - (équivalent pour Opera, Vivaldi, Arc…)
2. Activez le **Mode développeur** (interrupteur en haut à droite).
3. Cliquez sur **Charger l'extension non empaquetée**.
4. Sélectionnez le dossier `cowlors-sidebar-for-twitch` (celui qui contient
   `manifest.json`). Si vous êtes parti du `.zip`, décompressez-le d'abord et
   pointez vers le dossier décompressé, **pas** vers le `.zip` lui-même.
5. Ouvrez (ou rechargez) un onglet `https://www.twitch.tv/`. La sidebar est
   enrichie automatiquement.

Aucune permission supplémentaire n'est demandée : l'extension n'agit que sur les
pages `twitch.tv` et `player.twitch.tv`, et ne communique avec aucun serveur
tiers en dehors des appels que Twitch fait déjà lui-même (API GraphQL publique
de Twitch, miniatures, lecteur `player.twitch.tv` pour l'aperçu).

---

## Compatibilité

- **Chrome 111 ou supérieur** (et tout navigateur Chromium récent : Edge, Brave,
  Opera, Vivaldi, Arc). La version 111 est le minimum car le content script
  utilise `"world": "MAIN"`, introduit à cette version.
- **Firefox** : le MV3 de Firefox prend en charge `"world": "MAIN"` sur les
  versions récentes, mais quelques différences de timing d'injection peuvent
  exister. Le portage cible Chromium ; sous Firefox, la version userscript
  d'origine (via Violentmonkey) reste l'option la plus sûre.

---

## Module anti-pub intégré (v3.0+)

L'extension intègre un module de blocage de publicités basé sur
**[vaft v37.0.0](https://github.com/pixeltris/TwitchAdSolutions)** par
**pixeltris** (projet TwitchAdSolutions). Son rôle est uniquement d'éviter
qu'une publicité préroll s'affiche dans l'iframe d'aperçu au survol d'une
chaîne, ce qui rendait l'aperçu inutilisable sur les chaînes monétisées.

### Portée d'exécution

Le module est volontairement limité aux **iframes** (concrètement, l'iframe
`player.twitch.tv` que l'extension monte au survol). Il **ne touche pas**
le stream principal que vous regardez sur `twitch.tv`. Si vous voulez un
blocage global pour le stream principal, installez vaft séparément
(extension ou userscript dédié) ; le module intégré détecte la présence
d'une version externe via `window.twitchAdSolutionsVersion` et se met
automatiquement en retrait.

### Désactivation

Tout en haut de `content.js`, la première ligne hors commentaire est :

```js
const TSE_ADBLOCK_ENABLED = true;
```

Passez la valeur à `false`, rechargez l'extension (`chrome://extensions` →
icône ↻ sur la carte) et l'iframe d'aperçu redeviendra un simple iframe
Twitch sans interception. Le reste de l'extension (durée de stream, tri,
filtre, popup d'aperçu…) reste pleinement fonctionnel.

### Crédit et licence

Le code de vaft est sous licence **The Unlicense** (domaine public).
La seule modification appliquée par rapport à l'amont est cosmétique :
préfixe `[TSE-AdBlock]` ajouté aux logs console pour les distinguer
dans la DevTools, et masquage de la petite bannière « Blocking ads »
qui s'affichait dans l'aperçu. La logique vaft est intacte, et le
fichier explicite chaque modification dans son commentaire d'intro.

Les drapeaux SVG du filtre par langue proviennent du jeu **OpenMoji** (licence CC BY-SA 4.0). Les bi-drapeaux **EN** (USA + Royaume-Uni) et **PT** (Portugal + Brésil), coupés à la verticale centrale, en sont dérivés pour représenter d'un seul drapeau les deux variantes d'une même langue.

---

## Localisation

L'extension détecte la langue de votre interface Twitch via l'attribut `lang`
posé par Twitch sur le `<html>` :

- Langue commençant par `fr` (par exemple `fr-fr`) → interface française.
- Langue commençant par `de` (par exemple `de-de`) → interface allemande.
- Langue commençant par `es` (par exemple `es-es` ou `es-mx`) → interface espagnole (Espagne et Amérique latine).
- Langue commençant par `pt` (par exemple `pt-br` ou `pt-pt`) → interface portugaise (Brésil et Portugal).
- Toute autre langue → interface anglaise (fallback).

Toutes les chaînes de l'extension (badges du popup d'aperçu, libellés du
filtre et des boutons de tri, messages console) sont traduites en conséquence.
Les libellés natifs Twitch que l'extension recherche dans le DOM (section
« Chaînes suivies » / « Followed Channels » / « Kanäle, denen du folgst » /
« Canales que sigues » / « Canais seguidos » (pt-BR) / « Canais que segues »
(pt-PT), bouton « Afficher plus » /
« Show More » / « Mehr anzeigen » / « Mostrar más » / « Mostrar mais », phrase
d'accessibilité « X et N invités » / « X and N guests » / « X und N Gäste » /
« X y N invitados » / « X e N convidados », etc.) sont également pris en charge
dans les cinq langues, avec repli structurel pour toute autre locale.

Le compteur de viewers est interprété indépendamment de la locale : abréviation
décimale + suffixe (`67,3 k` en fr, `67.3K` en en, `4.1 k` en es, `3,7 mil` /
`1,2 mi` en pt, identique au Brésil et au Portugal) ou nombre plein à
séparateur de milliers (`29.339` en de) —
le tri par viewers reste correct partout.

Si vous changez la langue dans les paramètres Twitch, la page recharge et
l'extension applique la nouvelle langue automatiquement.

---

## API console

L'extension expose un objet `tse` dans la console DevTools de la page Twitch
(onglet **Console**, `F12`). Il permet d'inspecter l'historique de visites qui
sert au tri « Mes plus visités » :

- `tse.scores()` — affiche le classement des chaînes les plus visitées (top 10
  par défaut).
- `tse.scores(20)` — même chose, sur les 20 premières.
- `tse.scores.raw()` — renvoie les données brutes (objet) plutôt qu'un tableau
  formaté, utile pour un traitement manuel.
- `tse.reset()` — efface tout l'historique de visites.
- `tse.diagnose()` — affiche un rapport de santé des sélecteurs DOM dont dépend
  l'extension (OK / cassé / non applicable) et renvoie le rapport brut. Un
  auto-diagnostic tourne aussi en arrière-plan et avertit dans la console
  (`console.warn`) si Twitch change son markup et qu'un sélecteur critique ne
  correspond plus — utile pour diagnostiquer une éventuelle panne.

Les libellés des colonnes affichées par `tse.scores()` (login, score, visites,
dernière visite) sont localisés.

---

## Vie privée

L'historique de visites est **100 % local**. Il est stocké dans le
`localStorage` de votre navigateur, sous la clé `tse:visits`, et n'est **jamais**
envoyé nulle part. Il sert uniquement au calcul du tri « Mes plus visités ».
Utilisez `tse.reset()` pour l'effacer à tout moment, ou videz les données de
site de `twitch.tv` depuis les réglages du navigateur.

Le module anti-pub vaft, lui aussi, ne communique avec aucun serveur tiers :
il intercepte les requêtes Twitch dans l'iframe d'aperçu et les redirige
vers d'autres endpoints Twitch (player popout, embed) pour récupérer un
flux sans publicité. Aucune donnée n'est envoyée hors du circuit Twitch.

---

## Mise à jour / modification

Si vous modifiez les fichiers de l'extension (par exemple pour ajuster une
constante de configuration en haut de `content.js`, ou désactiver l'antipub
via `TSE_ADBLOCK_ENABLED`) :

1. Enregistrez vos changements.
2. Retournez sur `chrome://extensions`.
3. Cliquez sur l'icône de rechargement (↻) sur la carte de l'extension.
4. Rechargez l'onglet Twitch.

---

## Structure des fichiers

```
cowlors-sidebar-for-twitch/
├── manifest.json          déclaration MV3 (content script MAIN world, all_frames true)
├── content.js             toute la logique : module anti-pub vaft + module sidebar
├── _locales/
│   ├── en/messages.json     nom + description en anglais (default_locale)
│   ├── fr/messages.json     nom + description en français
│   ├── de/messages.json     nom + description en allemand
│   ├── es/messages.json       nom + description en espagnol (Espagne)
│   ├── es_419/messages.json   nom + description en espagnol (Amérique latine)
│   ├── pt_BR/messages.json    nom + description en portugais (Brésil)
│   └── pt_PT/messages.json    nom + description en portugais (Portugal)
├── icons/                 icônes 16 / 48 / 128 px
├── README.md              ce fichier
└── README.en.md           version anglaise
```

---

## Notes de portage (technique)

Le code applicatif est aligné sur le userscript Violentmonkey « Twitch Sidebar
Enhancer ADBLOCK 4 » v2.22.3. Trois adaptations sont imposées par le contexte
extension, et une quatrième transformation ajoute la localisation.

1. **`"world": "MAIN"`, `"run_at": "document_start"`, `"all_frames": true`**
   (manifeste). Les trois directives sont nécessaires :

   - **`MAIN`** : pour exposer `window.tse` à la console de la page, intercepter
     `history.pushState`/`replaceState` du routeur React de Twitch et hooker
     `window.fetch`/`window.Worker` (indispensable au module anti-pub). Sans le
     MAIN world, le script tournerait dans le monde isolé de l'extension et
     ces mécanismes seraient invisibles à la page.
   - **`document_start`** : pour intercepter avant tout autre script Twitch
     (hooks vaft, CSS sidebar, capture de l'ordre initial).
   - **`all_frames: true`** : pour permettre au module anti-pub de s'injecter
     dans l'iframe `player.twitch.tv` (équivalent MV3 de la directive
     `@allFrames true` du userscript Violentmonkey). Le module sidebar (TSE)
     a une garde top-level qui le neutralise dans les iframes — donc dans
     chaque frame, **exactement un** des deux modules est actif.

   Les matches incluent désormais `https://player.twitch.tv/*` en plus de
   `www.twitch.tv` et `twitch.tv` pour autoriser l'injection dans l'iframe
   d'aperçu.

2. **`onerror` inline → `addEventListener('error', …)`** (`renderPopup` du module
   d'aperçu, `content.js`). La CSP de Twitch (`script-src` sans `'unsafe-inline'`)
   bloque silencieusement les gestionnaires d'événements inline parsés depuis
   `innerHTML` quand le script provient d'une extension. Le userscript y
   échappait grâce au privilège d'injection de Violentmonkey. La sémantique du
   fallback miniature est strictement identique.

3. **Module anti-pub vaft intégré** (cf. section dédiée plus haut). Le code est
   importé tel quel depuis [pixeltris/TwitchAdSolutions](https://github.com/pixeltris/TwitchAdSolutions),
   wrappé dans une IIFE conditionnelle (`if (TSE_ADBLOCK_ENABLED) (...)()`) avec
   une garde iframe-only et un préfixe `[TSE-AdBlock]` sur les logs.

4. **Internationalisation multilingue (FR / EN / DE / ES / PT)**. L'architecture i18n est
   conçue pour découpler les fonctionnalités de la langue détectée :

   - **DOM matchers multi-langues** (objet `DOM` en haut du module sidebar) :
     sélecteurs CSS, regex et listes de libellés reconnaissent FR, EN, DE, ES
     et PT simultanément, avec repli structurel (ancres indépendantes de la langue)
     pour toute autre locale. C'est ce que l'extension utilise pour matcher la
     sidebar Twitch — les fonctionnalités tournent donc indépendamment de la
     langue détectée, et restent robustes même si la détection se trompe ou
     arrive en retard.

   - **Libellés UI par langue** (objet `S`, alias mutable de `STRINGS[LANG]`) :
     uniquement utilisés pour ce que l'extension *affiche* à l'utilisateur
     (filtre, badges du popup, tooltips de tri, console).

   - **Détection de langue robuste** (`detectLanguage`) qui essaie dans
     l'ordre : 1) un libellé natif Twitch présent dans le DOM (vérité
     terrain) ; 2) `document.documentElement.lang` ; 3) `navigator.language`
     (fr / de / es / pt reconnus) ; 4) défaut anglais.

   - **Auto-correction** via `refreshLanguage()` appelé en début de chaque
     scan de la sidebar. Si la première détection (à `document_start`,
     avant que Twitch ait peuplé le DOM) est erronée, elle est corrigée
     dès le premier scan ; le titre racine et le filtre se re-traduisent
     automatiquement.

Aucun autre changement de comportement n'a été introduit par rapport au
userscript v2.22.3.

Les identifiants internes (préfixe CSS `.tse-`, attributs `data-tse-*`, clé
localStorage `tse:visits`) sont conservés tels quels malgré le renommage de
l'extension pour ne pas invalider l'historique de visites des utilisateurs
existants qui mettent à jour depuis une version précédente.
