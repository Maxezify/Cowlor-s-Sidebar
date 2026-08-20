# Cowlor's Sidebar for Twitch

Version 3.28.0 · Extension Chrome (Manifest V3) · 🇬🇧 [English version](README.en.md)

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

**Nouveau en 3.21.0** : l'extension **prend les devants sur Twitch**. Mesure à
l'appui, Twitch met 2 à 4 minutes à afficher une chaîne suivie qui passe en
direct ; l'extension la pose désormais elle-même en 30 secondes. Voir
« Prendre les devants sur Twitch » plus bas.

**Nouveau en 3.18.0** : l'extension ne se contente plus d'afficher les données
de Twitch, elle les **rafraîchit elle-même toutes les 30 secondes** — nombre de
viewers, catégorie, langue, durée de stream, et surtout masquage des chaînes qui
viennent de couper (30 à 60 s au lieu de 5 à 10 min). Voir la section
« Rafraîchissement en quasi-direct » plus bas.

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

## Rafraîchissement en quasi-direct (v3.18+)

Twitch met sa sidebar à jour rarement : une chaîne qui vient de couper y reste
souvent plusieurs minutes, et les nombres de viewers affichés sont figés
d'autant. **L'extension ne se contente plus de lire ces données : elle les
rafraîchit elle-même, toutes les 30 secondes.**

Concrètement, sur les cartes de la sidebar :

| Donnée | Avant | Maintenant |
| --- | --- | --- |
| Nombre de viewers | jamais rafraîchi (valeur de Twitch) | **30 s** |
| Catégorie | jamais rafraîchie (valeur de Twitch) | **30 s** |
| Chaîne qui coupe → masquée | 5 à 10 min | **30 à 60 s** |
| Chaîne qui passe en direct → affichée | 2 à 4 min (Twitch) | **30 s** |
| Chaîne qui reprend → réaffichée | jusqu'à 5 min | **30 s** |
| Langue (tags) | 5 min | **30 s** |
| Durée de stream | 5 min | **30 s** |

Le masquage d'une chaîne hors ligne demande **deux réponses successives**
confirmant l'arrêt : un incident ponctuel côté Twitch ne fait donc pas
disparaître une chaîne à tort. Survoler une carte force par ailleurs une
vérification immédiate.

Et depuis la 3.21, l'extension ne se contente plus d'attendre que Twitch pose
ses cartes : elle **pose les siennes** quand il tarde (cf. « Prendre les devants
sur Twitch » ci-dessous).

### Le cas des co-streams « Streamer ensemble » (v3.23)

Sur une carte de co-stream, Twitch n'affiche pas l'audience propre du streamer
mais **l'audience combinée de la session**. L'écart n'est pas cosmétique : pour
un invité, 1 166 spectateurs à lui contre 11 821 pour la session — un facteur
dix. Rafraîchir naïvement le compteur avec l'audience propre revenait donc à
afficher `1,2 k` là où Twitch affiche `11,8 k`.

L'extension récupère désormais le compteur combiné et affiche celui-là, en
accord avec Twitch. Il vient de la **réponse Guest Star déjà demandée** pour
regrouper les co-streams : aucune requête supplémentaire.

C'est ce compteur combiné qui sert aussi au **tri** (v3.24.1). Trier sur un
nombre différent de celui qu'on affiche produit une liste que l'œil juge
cassée : deux co-streamers marqués « 11,5 k » se retrouvaient l'un en tête du
classement et l'autre au milieu des « 1,7 k », chacun rangé selon son audience
propre. Le tri suit donc ce que vous lisez, comme le fait Twitch.

Corollaire pour le tri « co-streams d'abord » : l'audience d'un groupe est le
**plus grand** compteur de ses membres, non leur somme. Chaque membre affichant
déjà le combiné de la session, les additionner compterait N fois le même public
et propulserait mécaniquement les groupes nombreux.

### Le noir d'une seconde entre la vignette et la vidéo (v3.27)

L'aperçu montre d'abord une **miniature JPEG**, puis bascule sur le lecteur
Twitch. Entre les deux, il y avait environ une seconde de noir.

Le fondu existait pourtant déjà. Le problème était le **moment** : la bascule se
déclenchait sur l'événement `load` de l'iframe, qui signale la fin du chargement
du *document* du lecteur — pas l'arrivée d'une image. On faisait donc apparaître
en fondu un lecteur encore noir par-dessus la miniature, puis on attendait la
vidéo. Allonger le fondu n'aurait fait qu'adoucir l'arrivée du noir.

L'iframe étant sur une autre origine, la page ne peut rien observer de son
contenu. C'est donc l'iframe qui parle : un module minuscule y guette la
**première image réellement présentée** (`requestVideoFrameCallback`, avec repli
sur l'événement `playing`) et poste un message au parent, qui enchaîne alors son
fondu — allongé à 0,35 s, puisqu'il a désormais deux images à enchaîner plutôt
qu'une image et du noir.

Si ce signal n'arrive jamais — lecteur remanié par Twitch, vidéo refusée — un
filet dévoile quand même l'iframe 1,5 s après le `load`. Au pire on retrouve
l'ancien comportement ; jamais un aperçu bloqué sur sa miniature.

### Le noir AVANT la miniature (v3.28)

Le correctif précédent réglait le passage miniature → vidéo. Restait un noir en
amont : sur certaines chaînes, l'aperçu s'ouvrait sur un rectangle noir, la
miniature arrivait une à deux secondes plus tard, puis la vidéo.

En cause, l'URL de la miniature. Elle se terminait par un paramètre horodaté **à
la milliseconde**, destiné à contourner le cache du navigateur — Twitch régénère
ces images toutes les quelques minutes, et sans ce paramètre on resservirait
indéfiniment la même. Sauf qu'à cette précision, **chaque survol produisait une
URL unique** : le cache ne pouvait jamais rien resservir, pas même en revenant
sur la chaîne deux secondes plus tard. Chaque survol était un téléchargement.
Ce qui explique aussi le « parfois oui, parfois non » : seul l'état du cache
côté CDN départageait.

Le paramètre est désormais arrondi à une **tranche d'une minute**. L'URL reste
stable pendant toute la tranche, donc un re-survol s'affiche instantanément. La
miniature peut être vieille d'une minute — sans importance pour une image
montrée une seconde avant de céder la place au direct.

Le premier affichage d'une chaîne reste tributaire du réseau. Deux détails le
rendent moins abrupt : la miniature **apparaît en fondu** elle aussi, et le fond
d'attente n'est plus noir mais de la teinte du panneau — un rectangle noir se lit
comme une panne, la couleur du panneau se lit comme un chargement.

### Coût réseau

Une **seule** opération GraphQL (`TseChannels`) couvre toute la sidebar d'un
coup : elle prend une liste de chaînes et rapporte pour chacune la durée de
stream, les viewers, la catégorie et les langues. Là où il fallait auparavant
trois opérations *par chaîne*, une sidebar entière tient désormais dans une.

Résultat : **rafraîchir dix fois plus souvent coûte trois fois moins de
requêtes qu'avant**.

| Version | Opérations par minute (sidebar de ~30 chaînes) |
| --- | --- |
| 3.17.1 — rafraîchissement toutes les 5 min | ~14 |
| 3.18 — 30 s, une opération par chaîne | ~62 |
| 3.20 — 30 s, une opération par lot | **~4** |

Les listes sont découpées en tranches d'au plus 50 chaînes, envoyées en
parallèle : une tranche rejetée n'affecte que les chaînes qu'elle portait.

En cas de coupure réseau, l'extension **conserve le dernier état connu** — elle
n'affiche jamais de faux « Terminé » — et met ses requêtes en pause 30 secondes
plutôt que de marteler l'API.

### Si l'API de Twitch répond de travers

Il arrive que l'API réponde sans erreur apparente tout en annonçant hors ligne
des chaînes qui ne le sont pas. Prise au mot, l'extension viderait votre sidebar
d'un coup — ce qui est arrivé une fois avant la 3.22.2.

L'extension **refuse désormais de croire une extinction de masse** : si une part
importante des chaînes qu'elle savait en direct est annoncée hors ligne dans le
même cycle, elle conserve l'affichage en l'état, le signale dans la console
(`console.warn`) et réessaie 30 secondes plus tard. Mieux vaut un affichage
périmé d'une minute qu'une sidebar vide.

Ce refus est **borné** : si l'anomalie persiste sur plusieurs cycles, c'est
qu'elle est réelle (panne Twitch, fin d'un gros événement) et l'extension finit
par l'accepter. Le garde-fou retarde, il ne censure pas. Une chaîne isolée qui
coupe, elle, est traitée normalement.

Rien ne change côté vie privée ni permissions : ces appels restent **anonymes**
(aucun jeton de session, `credentials: 'omit'`), sur des données publiques, vers
la même API GraphQL que Twitch interroge déjà lui-même.

### Prendre les devants sur Twitch (v3.21+)

Mesure faite sur usage réel (`tse.lag()`) : **Twitch met 2 à 4 minutes** à faire
apparaître la carte d'une chaîne suivie qui vient de passer en direct. Comme
l'extension connaît la liste de vos chaînes suivies (cf. « Roster ») et que leur
statut est une donnée publique, elle le sait avant lui — et pose la carte
elle-même, en 30 secondes.

**La carte est un clone.** Elle n'est pas écrite à la main : l'extension duplique
une carte existante de votre sidebar et en réécrit le contenu (pseudo, avatar,
catégorie, viewers, durée). Elle est donc visuellement indiscernable d'une carte
Twitch, et tout le reste fonctionne dessus sans exception : tri, filtres, aperçu
au survol, coloration des co-streams, mise en avant « stream frais ».

Dès que Twitch pose enfin sa propre carte, la nôtre disparaît — il n'y a jamais
de doublon. Elle disparaît aussi si la chaîne coupe.

**Deux limites, assumées :**

- L'extension ne clone qu'une carte **neutre** : ni sponsorisée, ni en
  co-stream, ni porteuse d'un badge de collaboration ou d'un bandeau. Tout ce
  que porte la carte modèle serait recopié sur la chaîne fabriquée. S'il n'y a
  dans votre sidebar aucune carte neutre en direct, l'extension ne fabrique
  rien — mieux vaut ne rien afficher qu'une carte portant les marques d'une
  autre chaîne.
- Une chaîne doit avoir été **vue au moins une fois** dans votre sidebar pour
  entrer au roster. Un streamer que vous venez de suivre n'est donc devancé qu'à
  partir de son deuxième passage en direct.

Sur les cartes fabriquées, le nombre de viewers n'est pas annoncé par les
lecteurs d'écran : la formulation exacte de Twitch varie selon la langue et ne
peut pas être reproduite fidèlement — ne rien annoncer vaut mieux qu'annoncer un
chiffre erroné. Le pseudo et la catégorie, eux, sont lus normalement.

**Désactivation.** Une constante en haut de `content.js` :

```js
AHEAD_ENABLED:        true,   // false → l'extension n'affiche que les cartes de Twitch
```

À `false`, l'extension continue d'apprendre le roster et de mesurer le retard de
Twitch, mais n'affiche plus que ce que Twitch pose.

### Onglet en arrière-plan

Le rafraîchissement est **suspendu** quand l'onglet n'est pas visible : les
navigateurs y ralentissent fortement minuteurs et requêtes, et les réponses
tronquées produiraient de faux « Terminé ». Au retour sur l'onglet, la sidebar
est intégralement repeuplée sous le voile de chargement.

### Régler la cadence

Tout est piloté par une constante unique en haut de `content.js` :

```js
LIVE_TTL:       30_000,   // ms — fraîcheur des données de stream
REFRESH_TICK:    5_000,   // ms — réveil de rafraîchissement
```

`LIVE_TTL` est la seule à régler : augmentez-la pour alléger le trafic,
diminuez-la pour coller encore plus au direct.

**Ne montez pas `REFRESH_TICK` au niveau de `LIVE_TTL`** — c'est contre-intuitif,
mais ça *double* la période réelle. Une donnée n'est écrite qu'après le réveil
qui l'a demandée (le temps du réseau) ; elle périme donc juste après le réveil
suivant, qui la juge encore fraîche, et il faut attendre celui d'après. Mesuré
en navigateur : période réelle de **2,00 ×** `LIVE_TTL` avec un réveil aligné,
contre **1,17 ×** avec le réglage actuel. Un réveil qui ne trouve rien de périmé
ne déclenche aucune requête : le raffiner ne coûte rien.

**Descendre `LIVE_TTL` sous 30 s n'apporte rien au compteur de viewers.** Mesure
faite sur l'API publique (sondage toutes les 5 s pendant 5 min, grosses chaînes
françaises) : `viewersCount` ne change qu'environ **toutes les 60 secondes**,
avec un cache propre à chaque chaîne — les compteurs ne bougent pas ensemble.
À 30 s, l'extension n'est donc jamais en retard de plus d'une demi-période sur
la valeur que Twitch expose : le plancher n'est pas dans l'extension, il est
chez Twitch. Le délai de détection des passages en direct et des déconnexions,
lui, dépend bien de cette constante.

Rechargez ensuite l'extension (`chrome://extensions` → ↻) et l'onglet Twitch.

---

## Module anti-pub intégré (v3.0+, remplacé en v3.25)

L'extension intègre un module de blocage de publicités. Son rôle est uniquement
d'éviter qu'une publicité préroll s'affiche dans l'iframe d'aperçu au survol
d'une chaîne, ce qui rendait l'aperçu inutilisable sur les chaînes monétisées.

Depuis la **v3.25**, ce module est **[vaft v2.0.4](https://github.com/scamorza/TwitchAdBlock)**,
qui remplace le vaft v37.0.0 de **pixeltris** utilisé jusque-là. Ce n'est pas une
mise à jour mais une **réécriture** : partie du même projet, elle n'en garde plus
guère que l'idée. Ce qui change concrètement :

- la publicité serveur est contournée en demandant le flux sous un autre
  `playerType`. L'ancienne chaîne commençait par `embed` puis `popout` ; la
  nouvelle mène avec `mobile_feed` demandé en `android`, seule combinaison à la
  fois sans pub et non bridée. Elle porte le codec source, donc une coupure ne
  coûte aucun changement de rendition — c'est précisément là-dessus que le
  lecteur se bloquait ;
- les publicités **décidées côté navigateur** (encart au-dessus du chat,
  bandeau, pub de pause) sont refusées en amont, via le propre chemin de refus
  de Twitch. L'ancien module ne les voyait tout simplement pas ;
- quand aucun flux propre n'existe, le lecteur est descendu sur le meilleur
  palier d'un autre codec au lieu de rester bloqué.

### Portée d'exécution

Inchangée : le module est volontairement limité aux **iframes** (concrètement,
l'iframe `player.twitch.tv` que l'extension monte au survol). Il **ne touche
pas** le stream principal que vous regardez sur `twitch.tv` — qui regarde
vraiment un stream accepte le modèle économique de Twitch. Pour un blocage
global, installez vaft séparément ; les deux se reconnaissent via
`window.twitchAdSolutionsVersion` et exactement un des deux tourne.

### Un fichier à part

Le module vit désormais dans **`adblock.js`**, et non plus au début de
`content.js`. C'est du code tiers qui se met à jour en amont : l'isoler rend la
prochaine mise à jour mécanique — remplacer le fichier, rejouer les cinq
adaptations listées dans son en-tête — au lieu d'une fusion à la main. Le
manifeste charge `adblock.js` **avant** `content.js`, ce qui reproduit
exactement l'ordre qu'avaient les deux modules quand ils partageaient un
fichier. Ne pas l'inverser.

### Désactivation

Tout en haut d'`adblock.js`, la première ligne hors commentaire est :

```js
const TSE_ADBLOCK_ENABLED = true;
```

Passez la valeur à `false`, rechargez l'extension (`chrome://extensions` →
icône ↻ sur la carte) et l'iframe d'aperçu redeviendra un simple iframe
Twitch sans interception. Le reste de l'extension (durée de stream, tri,
filtre, popup d'aperçu…) reste pleinement fonctionnel.

### Crédit et licence

Le code est sous licence **MIT** — Copyright (c) 2020-present TwitchAdSolutions
Contributors. Sept adaptations seulement le séparent de l'amont, toutes marquées
« ADAPTATION » dans le fichier et récapitulées dans son en-tête : préfixe de log
`[TSE-AdBlock]`, interrupteur, garde iframe-only, version en dur à la place de
`GM_info` (une API de gestionnaire de userscripts, absente dans une extension),
retrait de la bannière de démarrage — en amont elle s'affiche une fois par page,
ici l'iframe renaît à chaque survol et la console serait noyée — et deux réglages
inadaptés à une vignette (cf. « Qualité de l'aperçu » ci-dessous).

### Qualité de l'aperçu (v3.26)

La popup d'aperçu fait **480 × 270**. La sidebar demande donc `360p30` à
`player.twitch.tv` : 640 × 360, soit juste ce qu'il faut pour remplir la boîte
sans la sur-échantillonner. Descendre plus bas (`160p30` = 284 × 160) passerait
sous la taille d'affichage et se verrait.

Le module anti-pub arrivait cependant avec `PinHighestQuality: true`, qui écrit
« meilleure qualité disponible » dans le stockage local de `player.twitch.tv` et
travaille donc **contre** ce choix. En amont le réglage est juste — il sert une
session de visionnage plein écran ; il ne l'est plus pour une vignette de survol.
Il est passé à `false` (adaptation f), de même que `ShowBanner` (adaptation g),
dont l'encart de diagnostic mangeait le coin de l'image.

### Couleurs de co-stream

Chaque collaboration simultanée reçoit une couleur de la palette. La contrainte
est simple : deux couleurs doivent rester distinguables au premier coup d'œil sur
des cartes qui peuvent se toucher — ce que garantit un écart de **teinte**, la
saturation et la luminosité étant voisines dans toute la palette.

Jusqu'à la 3.25, trois tons chauds s'y empilaient dans un arc de 16° : orange
31°, jaune doux 42°, jaune 47°. Les deux jaunes étaient à **5°** l'un de l'autre,
soit la même couleur à l'œil nu. L'orange **et** le jaune doux ont été retirés, un
violet prend leur place, et le vert comme le bleu ont été écartés l'un de l'autre :

| Couleur | Teinte |
| --- | --- |
| jaune `#f5c518` | 47° |
| vert `#7ee081` | 122° |
| turquoise `#26d4c8` | 176° |
| bleu `#4d8cff` | 219° |
| violet `#c77dff` | 274° |
| rose `#ff7a8a` | 353° |

Écart minimum : **43°**, contre 5° auparavant. Le harnais de test refuse toute
paire sous 40° et vérifie au passage que chaque `rgba` correspond bien à son
hex — une coquille y donnerait un liseré d'une couleur et un halo d'une autre.

**Ce qui n'a pas pu être vérifié.** Le blocage publicitaire lui-même demande un
vrai stream servant de vraies publicités : il n'est pas testable depuis
l'environnement de développement. Ce qui EST vérifié automatiquement : que le
module se charge, qu'il reste **strictement inerte hors iframe** (ni `fetch` ni
`Worker` accrochés, aucun marqueur revendiqué, aucune API posée) et qu'il ne
perturbe en rien la sidebar.

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

Le compteur de viewers que l'extension affiche (cf. « Rafraîchissement en
quasi-direct ») est **rendu dans le format de votre locale**, identique à celui
de Twitch : abréviation décimale + suffixe (`67,3 k` en fr, `67.3K` en en,
`4.1 k` en es, `3,7 mil` / `1,2 mi` en pt, identique au Brésil et au Portugal),
ou nombre plein à séparateur de milliers (`29.339` en de). Le compteur natif de
Twitch reste par ailleurs interprété indépendamment de la locale, ce qui sert de
repli tant qu'une chaîne n'a pas encore été résolue.

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
- `tse.reset()` — efface l'historique de visites, le roster et les mesures de
  retard.
- `tse.diagnose()` — affiche un rapport de santé des sélecteurs DOM dont dépend
  l'extension (OK / cassé / non applicable) et renvoie le rapport brut. Un
  auto-diagnostic tourne aussi en arrière-plan et avertit dans la console
  (`console.warn`) si Twitch change son markup et qu'un sélecteur critique ne
  correspond plus — utile pour diagnostiquer une éventuelle panne.
- `tse.lag()` — **mesure le retard de Twitch** sur les passages en direct :
  combien de temps s'écoule entre le démarrage d'un stream et l'apparition de
  sa carte dans la sidebar (cf. section suivante).
- `tse.roster()` — liste les chaînes suivies que l'extension a mémorisées en
  observant la sidebar (cf. section suivante).

Les libellés des colonnes affichées par ces commandes sont localisés.

### Mesure du retard de Twitch (v3.19+)

L'extension sait à quel instant un stream a démarré (`createdAt`) et à quel
instant **une carte de Twitch** l'a affiché comme étant en direct. L'écart entre
les deux est le retard de Twitch, et `tse.lag()` l'affiche : médiane, 90ᵉ
centile, et le détail des dernières mesures.

Depuis la 3.22, la colonne **« gagné par l'extension »** indique en plus, pour
chaque direct, l'avance que l'extension a réellement prise en posant sa carte
avant Twitch. C'est le chiffre qui dit si la fonctionnalité sert.

Une mesure n'est retenue que si le stream a démarré **pendant que vous
regardiez** — après une minute d'installation depuis l'ouverture de la page, et
après votre dernier retour sur l'onglet. Un stream démarré avant que l'extension
n'observe est écarté : sa carte était peut-être déjà là, on ne peut rien en
conclure. Les mesures s'accumulent donc lentement, au fil de l'usage normal.

Deux précisions sur ce qui est compté. Seules les cartes **de Twitch** font foi :
celles que l'extension fabrique sont exclues, sans quoi elle mesurerait sa
propre rapidité. Et la mesure porte sur **un direct**, identifié par son stream,
et non sur une chaîne : un streamer qui coupe et reprend dans la même session
est mesuré à chaque fois.

C'est cette mesure qui a justifié la fonctionnalité « Prendre les devants sur
Twitch » : les premiers relevés donnaient 2 à 4,5 minutes de retard, sans un
seul échantillon sous les deux minutes. Elle continue de tourner, et vous permet
de vérifier vous-même ce que l'extension vous fait gagner.

### Roster des chaînes suivies (v3.19+)

Twitch rend dans la sidebar les chaînes suivies **hors ligne** autant que celles
en direct (l'extension les masque ensuite). L'extension mémorise donc, au fil
des chargements, la liste des chaînes que vous suivez — sans jamais
s'authentifier ni toucher à un jeton de session.

C'est cette liste qui permet à l'extension de sonder au-delà de ce que Twitch
affiche, et donc de poser une carte avant lui (cf. « Prendre les devants sur
Twitch »). Une chaîne qui n'a plus été vue dans la sidebar depuis 60 jours est
oubliée — c'est ce qui évite de retenir indéfiniment une chaîne à laquelle vous
vous êtes désabonné.

---

## Vie privée

Tout ce que l'extension mémorise est **100 % local**, stocké dans le
`localStorage` de votre navigateur et **jamais** envoyé nulle part :

| Clé | Contenu | Usage |
| --- | --- | --- |
| `tse:visits` | dates de vos visites par chaîne | tri « Mes plus visités » |
| `tse:roster` | chaînes suivies aperçues dans la sidebar | poser une carte avant Twitch |
| `tse:livelag` | retards mesurés de Twitch | `tse.lag()` |

`tse.reset()` efface les trois à tout moment ; vider les données de site de
`twitch.tv` depuis les réglages du navigateur fait de même.

Le module anti-pub, lui aussi, ne communique avec aucun serveur tiers : il
intercepte les requêtes Twitch dans l'iframe d'aperçu et redemande le flux à
Twitch sous un autre `playerType` pour en obtenir une version sans publicité.
Aucune donnée n'est envoyée hors du circuit Twitch.

---

## Mise à jour / modification

Si vous modifiez les fichiers de l'extension (par exemple pour ajuster une
constante de configuration en haut de `content.js`, ou désactiver l'antipub
via `TSE_ADBLOCK_ENABLED` en haut d'`adblock.js`) :

1. Enregistrez vos changements.
2. Retournez sur `chrome://extensions`.
3. Cliquez sur l'icône de rechargement (↻) sur la carte de l'extension.
4. Rechargez l'onglet Twitch.

---

## Structure des fichiers

```
cowlors-sidebar-for-twitch/
├── manifest.json          déclaration MV3 (content script MAIN world, all_frames true)
├── adblock.js             module anti-pub (code tiers vendorisé, cf. son en-tête)
├── content.js             toute la logique de la sidebar
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

3. **Module anti-pub intégré** (cf. section dédiée plus haut). Depuis la v3.25 le
   code est vendorisé tel quel depuis [scamorza/TwitchAdBlock](https://github.com/scamorza/TwitchAdBlock)
   dans son propre fichier, `adblock.js`, avec sept adaptations marquées —
   interrupteur, garde iframe-only, préfixe `[TSE-AdBlock]` sur les logs, version
   en dur à la place de `GM_info`, et pas de bannière au démarrage.

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

5. **Rafraîchissement autonome des données (v3.18.0)**. Seul écart fonctionnel
   assumé vis-à-vis du userscript. Le userscript, comme les versions 3.x
   précédentes, se contentait des données que Twitch plaçait dans le DOM et ne
   revérifiait le statut live que toutes les 5 minutes. L'extension interroge
   désormais elle-même l'API GraphQL publique toutes les 30 secondes, via une
   opération unique (`TseChannels`) qui a remplacé les trois opérations
   précédentes (`UseLive`, `TseLang`, et la partie recouvrante de
   `TsePreview`) :

   - la persisted query `UseLive` et son hash ont été **supprimés** — les champs
     nécessaires (`viewersCount`, `game`, `freeformTags`) dépassent ce qu'elle
     renvoie. Une dépendance à un hash susceptible d'être tourné par Twitch
     disparaît donc, avec le repli inline qu'il fallait maintenir ;
   - le compteur de viewers est **rendu par l'extension** dans un élément à
     elle, inséré à côté du compteur natif, ce dernier étant masqué par CSS
     uniquement sur les cartes déjà résolues ;
   - `TseChannels` prend une **liste** de logins (`users(logins:)`) : une
     sidebar entière tient dans une opération, au lieu d'une par chaîne. Les
     listes sont découpées en tranches de 50 chaînes, évaluées indépendamment.
     Corollaire : la réponse ne garantissant ni l'ordre ni la complétude du
     tableau, elle est indexée **par login** et jamais par position, et un
     login absent de la réponse est traité comme « inconnu » — surtout pas
     comme « hors ligne ».

   Cf. la section « Rafraîchissement en quasi-direct » pour le détail
   fonctionnel et les constantes de réglage.

6. **Cartes fabriquées (v3.21.0)**. Second écart fonctionnel assumé vis-à-vis
   du userscript, et le seul qui fasse apparaître dans la sidebar autre chose
   que ce que Twitch y a mis. Trois pièces :

   - un **roster** des chaînes suivies, appris en observant la sidebar — Twitch
     y rend les chaînes hors ligne autant que celles en direct, ce qui rend la
     liste récupérable sans jamais s'authentifier ;
   - un **sondage** de ce roster à la même cadence que le reste, rendu abordable
     par `users(logins:)` ;
   - une **fabrication par clonage** d'une carte native, plutôt qu'un markup
     écrit à la main : c'est ce qui garantit le rendu et la compatibilité avec
     le tri, les filtres et l'aperçu. Le clone est nettoyé de tout ce qui
     appartenait à la carte source — nos injections, les lignes annexes, les
     `id` (qui feraient doublon dans le document) et les libellés ARIA (qui
     feraient annoncer le mauvais streamer).

   Les cartes fabriquées sont exclues des compteurs internes qui mesurent
   l'activité de Twitch (auto-expansion « Afficher plus », stabilité du voile
   de chargement, ordre Twitch d'origine, auto-diagnostic) : les y inclure
   reviendrait à prendre notre propre travail pour celui de Twitch.

   Désactivable par `AHEAD_ENABLED: false`.

7. **Plus aucune persisted query** (v3.24). Après la suppression de `UseLive`,
   la requête Guest Star restait la seule opération identifiée par un **hash** —
   c'est-à-dire la seule chose que Twitch pouvait périmer unilatéralement. Elle
   en avait d'autant moins le droit qu'elle est la source fiable du regroupement
   des co-streams : sans elle, la coloration retombait sur une heuristique que le
   code lui-même décrit comme clignotante, et **sans que rien ne le signale**.

   Elle est désormais posée **inline**, comme `TseChannels` : la requête porte
   son propre texte, il n'y a plus de hash à tenir à jour. Le module sidebar ne
   dépend donc plus d'aucune persisted query. (Le module anti-pub, lui, en
   conserve une — `PlaybackAccessToken` — mais c'est du code tiers repris tel
   quel, hors du périmètre de la sidebar.)

   Le choix a été **vérifié sur l'API réelle**, en anonyme, avant d'être fait :
   la requête est acceptée telle quelle et répond même **plus vite** que la
   persistée (24 ms contre 43-49), parce qu'elle sélectionne quatre champs
   au lieu de la charge complète (`canJoinStatus`, descriptions, couleurs de
   profil, et un second champ racine qui duplique le premier).

   Un repli conditionnel avait d'abord été écrit (hash d'abord, inline en
   secours). Il a été retiré : **un chemin de secours qui ne tourne jamais est
   un chemin auquel on ne peut pas se fier**, et il n'aurait servi qu'au moment
   précis où tout en aurait dépendu. L'inline en primaire est exercé à chaque
   cycle — s'il cassait, cela se verrait tout de suite.

   Si l'API refuse malgré tout, rien ne casse : cooldown de 30 s, affichage
   conservé, et la coloration retombe sur l'heuristique le temps que ça passe.

Aucun autre changement de comportement n'a été introduit par rapport au
userscript v2.22.3.

Les identifiants internes (préfixe CSS `.tse-`, attributs `data-tse-*`, clé
localStorage `tse:visits`) sont conservés tels quels malgré le renommage de
l'extension pour ne pas invalider l'historique de visites des utilisateurs
existants qui mettent à jour depuis une version précédente.
