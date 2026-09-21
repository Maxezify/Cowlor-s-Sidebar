# Cowlor's Sidebar for Twitch

Version 3.57.0 · Extension Chrome (Manifest V3) · 🇬🇧 [English version](README.en.md)

Extension qui enrichit la sidebar des chaînes suivies de Twitch : durée de
stream en direct, badge collaboration, masquage des Hype Trains et des bandeaux
de réduction d'abonnement, masquage des chaînes déconnectées et des sections
vides, auto-expansion de la liste suivie, mise en évidence des streams démarrés
récemment, détection et coloration des co-streams (avec rôle hôte/participant
extrait du DOM Twitch), détection du système « En live avec » (squad /
multistream), normalisation visuelle des cartes sponsorisées, filtres par
catégorie et par langue (avec drapeaux), six modes de tri au choix, historique de visites stocké localement,
et aperçu vidéo en direct au survol d'une chaîne (toutes sections confondues)
avec titre, badges contextuels, et levage de l'interstitielle de classification
de contenu qui bloquait la vidéo des chaînes étiquetées.

**Nouveau en 3.32.0** : un second mode, **« Top Chaînes »**, affiche les chaînes
les plus regardées de Twitch — au global, ou dans une catégorie, ou dans une
langue. Twitch ne rend pas ce classement : son API le prétend trié et ne l'est
pas. L'extension le **reconstruit**, et sait dire quand elle n'en a pas la
preuve. Voir « Top Chaînes » plus bas.

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

## Le basculement de catégorie (v3.57)

Twitch n'annonce nulle part qu'une chaîne vient de changer de catégorie.
L'information **n'est pas dans son API** : elle naît de la comparaison de deux
relevés — et le pipeline en fait un toutes les 30 secondes, pour toutes vos
chaînes suivies, depuis la 3.18. Elle était jetée à chaque tour.

C'est pourtant le moment où un streamer « variété » devient intéressant pour
qui suit un jeu précis. L'aperçu au survol porte donc un badge citron vert,
**« Vient de passer sur X »**, qui vit dix minutes et s'efface tout seul.

### Ce que le registre ne fait pas

**Il ne signale pas un début de stream.** Passer de « hors ligne » à « en ligne
sur X » n'est pas un basculement : c'est une chaîne qui commence, ce que la
carte dit déjà. La distinction se lit sur `stream.id`, qui change à chaque
nouvelle session — un champ que la requête `TseChannels` rapportait déjà et
que rien n'utilisait. Même identifiant **et** catégorie différente : alors
seulement il s'est passé quelque chose.

**Il ne survit pas à un rechargement**, et ce n'est pas une limite qu'on subit.
Après un rechargement, l'extension n'a rien observé ; sortir un badge à ce
moment-là reviendrait à l'inventer. Elle ne rapporte que ce qu'elle a vu — la
même règle que pour le badge d'abonnement, qui se tait quand l'ancienneté est
inconnue.

### Le badge périme, et c'est la moitié de son comportement

Dix minutes. Passé ce délai, la catégorie affichée sur la carte suffit, et le
badge mentirait par omission en laissant croire que le basculement vient
d'avoir lieu. Le banc éprouve la péremption avec le même mécanisme que les
autres durées de production : `tests/build.mjs` ramène `CATEGORY_SWITCH_TTL` à
2,5 s, donc c'est le vrai code et la vraie horloge qui périment l'entrée.

### La couleur, par le calcul

Les huit teintes déjà prises ne laissaient qu'un créneau large. L'optimum est à
**93°**, à 54° du voisin le plus proche ; turquoise ou cyan n'auraient offert
que 26 à 27° du sponsor et du co-stream. On se pose à 91° — 52° de l'ancien
abonné, 54° de l'abonné — pour 7,15:1 de contraste, dans la fourchette de la
famille (6,38 à 7,67).

### Une garde qui faisait deux métiers

La première écriture faisait porter à la garde de session la protection de
l'accès à la catégorie précédente. La retirer pour la mettre à l'épreuve ne
faisait alors pas échouer un test : elle **plantait la page**. Une garde qui
fait deux métiers se casse en silence dès qu'on la retouche. Elles sont
maintenant séparées, une par question, et la mutation de la seule garde de
session produit exactement l'erreur qu'on veut voir — « Vient de passer sur
Minecraft » sur une chaîne qui vient simplement de commencer.

---

## Dix langues (v3.57)

L'interface parle italien, polonais, russe, japonais et chinois simplifié, en
plus des cinq langues d'origine. Soit **630 libellés** répartis sur dix tables,
que `npm run parity` maintient rigoureusement alignées : une clé oubliée dans
une seule langue faisait planter `tse.lag()` pour ses utilisateurs sans que
rien ne le signale — c'est arrivé au portugais.

### Le pluriel slave

Le français et l'anglais ont deux formes ; **le polonais et le russe en ont
trois**, et la troisième reprend la main sur 11 à 14 malgré leur chiffre des
unités :

| n | polonais | russe |
| --- | --- | --- |
| 1, 21, 31… | miesiąc | месяц |
| 2-4, 22-24… | miesiące | месяца |
| 5-20, 25-30, **11-14** | miesięcy | месяцев |

La règle est écrite **une fois** (`plurielSlave`) plutôt que recopiée dans six
fonctions, où une seule branche fausse serait passée inaperçue pour tout
lecteur non slavophone. Le scénario 64 la vérifie sur un tableau de valeurs
écrit à la main d'après la grammaire — jamais recopié de la sortie du code, qui
n'aurait fait que confirmer son propre bug. La mutation qui oublie l'exception
des 11-14 le fait tomber en nommant les deux valeurs fautives.

### Ce que ces cinq langues n'ont pas, et pourquoi

Les cinq nouvelles langues **n'ont pas de libellé natif Twitch** dans la table
de détection. Ce point compare des chaînes exactes relevées dans le DOM de
Twitch (« Chaînes suivies », « Followed Channels »…) ; en inventer une
reviendrait à écrire du code qui ne matchera jamais tout en ayant l'air de
couvrir la langue.

Elles sont donc détectées par `html.lang` puis `navigator.language`, qui
n'exigent aucune connaissance de l'interface de Twitch, et la sidebar tient sur
ses **ancres structurelles** (`followed-side-nav-header`) — exactement le repli
prévu depuis l'origine pour toute langue non listée. Le scénario 64 retire le
libellé français du harnais pour reproduire cette situation : les deux
mécanismes de repli sont éprouvés ensemble.

`zh-TW` retombe sur la table `zh` par le préfixe à deux lettres plutôt que sur
l'anglais — mieux vaut du chinois simplifié que de l'anglais pour un lecteur de
Taïwan.

### Deux libellés qui ne suivaient pas la langue

Le travail a mis au jour un défaut ancien. `refreshLanguage()` est appelé à
chaque scan et l'en-tête du module annonce l'auto-correction, mais les onglets
de mode et les boutons de tri posaient leur libellé **à la création** et n'en
bougeaient plus. Une bascule de langue après le démarrage — Twitch est une SPA,
on peut changer de langue sans recharger — laissait donc des onglets figés dans
l'ancienne langue alors que leur `aria-label`, lui, suivait : l'interface
disait deux choses à la fois. Les deux sont désormais rafraîchis, par écriture
conditionnelle comme partout ailleurs dans ce module.

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
**première image réellement présentée** (`requestVideoFrameCallback`, avec replis
sur l'événement `playing` et sur `readyState`) et poste un message au parent, qui
enchaîne alors son
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

Le paramètre est désormais arrondi à une **tranche de 2 min 30**, calée sur le
rythme auquel Twitch régénère ces images plutôt que plus fine qu'elle — ce qui ne
rapporterait que des téléchargements en plus. L'URL reste stable pendant toute la
tranche, donc un re-survol s'affiche instantanément. La miniature peut avoir
quelques minutes — sans importance pour une image montrée une seconde avant de
céder la place au direct.

Le premier affichage d'une chaîne reste tributaire du réseau. Deux détails le
rendent moins abrupt : la miniature **apparaît en fondu** elle aussi, et le fond
d'attente n'est plus noir mais de la teinte du panneau — un rectangle noir se lit
comme une panne, la couleur du panneau se lit comme un chargement.

### Réchauffer les miniatures à l'avance (v3.30)

Mesure faite : la miniature d'une chaîne jamais survolée met de **89 ms à
1,8 s** à arriver — un facteur 20, propriété du CDN de Twitch pour cette chaîne
à cet instant, sur lequel l'extension n'a aucun levier. Une fois en cache
navigateur, le même survol coûte **~40 ms**.

L'extension les réchauffe donc à l'avance, et la règle est l'inverse de
l'intuition : **elle ne précharge pas quand le pointeur entre dans la sidebar**.
Y entrer, c'est atterrir sur une carte, donc ouvrir un aperçu — le moment où le
réseau est le plus sollicité. Elle précharge quand le pointeur est **ailleurs**,
et la passe est terminée bien avant votre retour.

La cadence suit la **tranche de cache**, pas une période : l'URL vaut
`floor(maintenant / 2 min 30)`, donc un minuteur libre tomberait à un décalage
arbitraire de la frontière et jetterait en moyenne la moitié de son travail. Le
réveil de rafraîchissement, plus fin, voit la bascule à 5 secondes près.

**Ce que ça coûte.** Environ 25 à 40 requêtes par tranche pour une
sidebar ordinaire, soit ~15 Mo/heure — 5 % d'un stream en 360p, 1,4 % en 1080p. Trois
requêtes en vol au maximum, en priorité réseau basse : cent chaînes se
réchauffent en une douzaine de secondes sur une tranche de 150. Rien ne part si
l'onglet est en arrière-plan, ni en mode économie de données. Réglable par
`PREVIEW_PRELOAD_ENABLED`.

**Un survol n'est jamais plus lent qu'avant.** Soit la miniature est déjà là,
soit sa requête est en vol et l'image du popup s'y raccroche — même URL, le
navigateur ne la double pas — soit elle n'a jamais été demandée et c'est le
chemin d'avant, à priorité normale donc devant tout résidu de passe.
Interrompre veut dire *cesser d'émettre*, jamais annuler : couper une requête
en vol pourrait couper précisément celle qu'on vient de survoler.

**Mémoire.** Une miniature pèse ~25 Ko encodée mais **~506 Ko décodée**. Aucune
référence n'est conservée sur les images préchargées : le navigateur garde les
octets encodés dans son cache — ce qu'on veut — et libère le décodé. Sans cette
précaution, cent chaînes épingleraient ~50 Mo de bitmaps invisibles.

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

### Onglet en arrière-plan (revu en v3.61)

Le rafraîchissement est **suspendu** quand l'onglet n'est pas visible : les
navigateurs y ralentissent fortement minuteurs et requêtes, et les réponses
tronquées produiraient de faux « Terminé ».

Cette phrase était vraie du **réveil périodique**, et de lui seul. Twitch, lui,
continue de muter son DOM dans un onglet caché — le chat surtout, mais aussi la
sidebar quand un stream s'arrête — et chacune de ces mutations déclenchait un
balayage complet, donc des requêtes, dans un onglet que personne ne regarde.
La porte manquait sur ce chemin-là. Elle y est.

**Ce qui s'arrête maintenant, onglet caché :**

| | Avant | Après |
| --- | --- | --- |
| Réveil de rafraîchissement (5 s) | déjà à l'arrêt | à l'arrêt |
| Balayage déclenché par une mutation | **à chaque mutation** | noté, pas fait |
| Requêtes GraphQL | **oui** | aucune |
| Rafraîchissement de l'affichage (60 s) | tournait pour rien | à l'arrêt |
| Coût de l'observateur, par lot de mutations | **149 µs** | **0,35 µs** |

**Ce qui repart, et comment.** Le retour distingue deux cas. Une absence d'au
moins une minute vaut un redémarrage : voile, purge du cache, repeuplement
complet — l'état est devenu trop incertain pour être rafistolé. Une absence
plus courte rejoue simplement le **balayage retenu** : tout ce que Twitch a
changé pendant l'absence est rattrapé en une passe, sans voile. Et l'affichage
local — durées de stream, « stream frais » — est rafraîchi dans la foulée,
puisque son réveil s'était arrêté lui aussi.

Un cas manquait, et il n'était couvert par rien : **l'onglet qui naît caché**
— un lien ouvert en arrière-plan, une session restaurée au démarrage du
navigateur. Le code testait « ai-je vu cet onglet se cacher ? » ; la réponse
était non, et le retour ne faisait donc rien du tout. Le rattrapage s'applique
désormais aussi à ce premier regard.

Le scénario 67 du banc éprouve les cinq cas, et le dernier ne simule rien :
il **gèle réellement la page** par le protocole DevTools — minuteurs suspendus,
rien ne tourne — puis la réveille, et vérifie que la sidebar repart entière.

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

## Mes abonnements en tête (v3.43+)

Un sixième mode de tri, entre « spectateurs » et « popularité perso » : les
chaînes auxquelles vous êtes abonné remontent en haut de la liste.

### Pourquoi ce n'est pas une requête

« À quelles chaînes suis-je abonné » est une donnée **privée**, et le schéma
GraphQL de Twitch le dit noir sur blanc :

> `UserSelfConnection.subscriptionBenefit` — *The subscription benefit
> relationship between **the authenticated user** and another user. Null if the
> authenticated user is not subscribed to the other user.*

Mesuré, pas supposé : une requête anonyme sur ce champ renvoie `self: null`.
L'obtenir imposerait donc d'envoyer votre jeton de session — c'est-à-dire de
renoncer à ce que cette extension promet partout ailleurs.

### Ce qu'elle fait à la place

Elle **lit ce que la page montre déjà**. Sur la page d'une chaîne, le bouton
d'abonnement change de `data-a-target` selon votre état — et non pas seulement
de libellé, ce qui aurait rendu la lecture dépendante de la langue :

| | `data-a-target` |
| --- | --- |
| abonné | `manage-sub-button` |
| non abonné | `subscribe-button` |

Relevé sur deux chaînes réelles, une dans chaque état. C'est le même genre de
repère structurel que l'extension utilise pour trouver la section suivie ou les
cartes : indépendant de la langue, et stable tant que Twitch ne refond pas son
markup.

**Aucune requête, aucun jeton, aucune permission de plus.** Le statut est noté
au passage, quand vous ouvrez une chaîne, et mémorisé dans `tse:subs`.

### La liste complète, sans jamais toucher à votre jeton (v3.44)

Lire au fil des visites ne connaît que les chaînes ouvertes. Twitch, lui,
publie la liste complète sur `/subscriptions` — une page de **votre** compte,
que votre navigateur sait déjà afficher.

L'extension la charge donc dans une **iframe cachée**, la lit, et la retire.
Trois faits mesurés avant d'écrire une ligne :

- `www.twitch.tv` accepte d'être encadré par lui-même. Beaucoup de sites
  l'interdisent (`X-Frame-Options`) ; pas celui-ci ;
- l'iframe étant de **même origine**, son document est lisible ;
- chaque abonnement y est un `[data-a-target="subscription-card"]` contenant
  le lien de la chaîne. Relevé : 3 cartes dans l'onglet « payants », 1 dans
  « offerts » — exactement ce que la page affiche.

**L'extension n'a pas accès à votre jeton et n'en envoie aucun.** Elle demande
une page ; le navigateur l'authentifie avec ses cookies, exactement comme si
vous aviez cliqué sur le lien. Rien ne quitte votre machine.

Le prix, lui, est réel : c'est une application React entière qui démarre en
arrière-plan. D'où un relevé **rare** — une fois toutes les 6 heures —, une
seule fois par page, et jamais deux à la fois. `tse.subs.refresh()` le force à
la demande.

Un onglet **vide** — pas d'abonnement offert, pas d'abonnement mobile — ne rend
aucune carte, et rien ne le distingue d'une page lente. Il coûtait donc les 25
secondes entières du garde-fou, deux fois, pour un compte n'ayant que des
abonnements payants. La page `/subscriptions` rend aussi la **barre latérale**
de Twitch : dès qu'elle apparaît, l'application est debout, et si aucune carte
ne suit dans les 5 secondes, l'onglet est vide et non lent (v3.47). Mesuré sur
le banc : 12,7 s pour deux onglets vides sans ce raccourci, moins de 7 s avec.

### Pendant le chargement, pas après (v3.45)

Jusqu'à la 3.44 le relevé partait 25 secondes après le démarrage. La sidebar
était donc déjà là, visible et triée, quand les abonnements arrivaient : la
décoration des chaînes abonnées apparaissait après coup.

Le déclencheur n'est plus un minuteur mais un **fait** : le premier scan qui
voit une carte suivie. C'est l'instant précis où Twitch a fini de peupler la
barre — le voile de chargement la couvre encore, et le relevé a donc le temps
de rentrer avant que vous ne voyiez quoi que ce soit.

Ce déclencheur porte une seconde propriété, gratuite : **une session
déconnectée n'a pas de chaînes suivies.** Elle ne demande donc jamais la page
authentifiée. Le seul cas où le relevé n'aurait rien à trouver est aussi le seul
où il ne coûte rien.

Et au tout premier démarrage — extension fraîchement installée, rien en mémoire
— le voile **attend** le relevé, au plus 4 secondes. Aux démarrages suivants il
n'attend rien : les abonnements connus sont relus du disque avant le premier
scan, la décoration est posée dès la première carte, et le relevé ne fait que
rafraîchir en arrière-plan.

### « Abonné 4 mois » dans l'aperçu (v3.48)

L'aperçu au survol porte un badge de plus, à côté de « En live avec » et des
trains de hype : **Abonné N mois**, ou **Anciennement abonné N mois** pour une
chaîne que vous avez quittée. L'onglet `?tab=expired` est lu pour ça — mais
lui seul alimente l'ancienneté et le passé d'abonné : il ne touche **jamais**
à l'état d'abonnement. Une chaîne peut figurer dans les expirés pour une
période révolue tout en étant réabonnée aujourd'hui ; en déduire un « non
abonné » dépendrait de l'ordre de lecture des onglets.

#### Lire un nombre sans lire la langue

Le nombre de mois est sur la page, mais **aucun `data-*` ne le désigne**. Et
une carte payante en porte quatre qui se ressemblent :

| étiquette | valeur |
| --- | --- |
| Prochain anniversaire d'abonnement dans : | 9 **jours** |
| Nombre **total** de mois abonné : | 4 mois |
| Nombre de mois **à la suite** : | 3 mois |
| Vos avantages arrivent à expiration le | 9 sept. 2026 |

Prendre « le premier nombre » donne **9**. Prendre « le dernier N mois » donne
**3**. Lire l'étiquette donne 4 — mais en français seulement, et l'extension
sert six langues.

Une carte **expirée**, elle, n'en porte qu'une seule fois écartés les blocs à
accroche connue (`.sub-badge-progress`, `.expired-sub-message`, le nom de la
chaîne, les boutons). Sa structure la désigne donc sans ambiguïté.

D'où le détour : l'extension **apprend** l'étiquette là où la structure la
désigne seule, puis la retrouve telle quelle sur les cartes payantes, où le
texte est identique. **Aucune chaîne de caractères n'est codée en dur.** Si
Twitch change ce libellé, la correspondance échoue et le badge disparaît — il
ne ment pas. C'est aussi pour cela que l'onglet des expirés est lu **en
premier**.

Le badge n'apparaît que si l'ancienneté est **connue** : « Abonné » sans durée
n'apprendrait rien de plus que le filet doré déjà posé sur la carte.

#### Sous le voile, et non après lui (v3.49)

Corriger l'attente ci-dessous avait un effet de bord : le relevé passait d'environ
5 à 20 secondes, alors que le voile de chargement ne le retient que quelques
secondes. Le voile ne couvrait donc plus ce qu'il était censé couvrir, et les
abonnements apparaissaient après lui.

Deux changements le remettent d'aplomb :

- **les onglets sont visités ensemble**, plus l'un après l'autre. La durée du
  relevé n'est plus leur somme mais celle du plus lent. Mesuré sur le banc :
  **5,2 s au lieu de 8,3 s**, et le rapport est bien plus favorable en
  production, où les onglets vides coûtent 5 secondes chacun. Leurs départs
  sont **décalés de 400 ms** : quatre applications React qui démarrent à la
  même milliseconde font un pic de calcul assez net pour retarder la sidebar
  elle-même — constaté au banc, où le voile n'arrivait plus à se stabiliser.
  Chacune durant plusieurs secondes, ce décalage ne coûte presque rien sur la
  durée totale ;
- **un onglet vide ne retient jamais le voile.** Il n'apporte rien à voir, et
  son délai d'apaisement est le plus long de tous. Le voile se lève dès que le
  premier onglet a rendu des chaînes, plus un court répit pour laisser ses
  voisins arriver — et la sidebar se décore au fil de l'eau, onglet par
  onglet, au lieu d'attendre la fin de la volée ;
- **l'étiquette apprise est mémorisée** (`tse:submois`). C'est elle qui
  imposait de lire l'onglet des expirés en premier ; une fois connue, l'ordre
  n'a plus d'importance et tout part d'un bloc. Seule la toute première
  installation garde une passe préalable.

La retenue du voile passe à 7 secondes, et surtout elle ne tient plus à
l'absence d'**abonnements** mais à l'absence de **relevé abouti**. C'était le
cas signalé : des abonnements déjà connus — donc pas de retenue — mais une
ancienneté encore absente, qui arrivait quelques secondes après le voile.

Un rafraîchissement de routine, lui, ne retient toujours rien : ce qu'il
rafraîchit est déjà à l'écran.

#### Attendre que la page ait fini de s'écrire (v3.48.1)

Une liste React ne s'écrit pas d'un bloc : le lien d'une carte est rendu
**avant** son ancienneté. Le relevé concluait au premier passage où il voyait
une carte — il relevait donc les chaînes et perdait les mois, n'apprenait
jamais l'étiquette sur l'onglet des expirés, et n'affichait aucun badge nulle
part. Le symptôme était trompeur : le tri, la pastille et le filet doré
fonctionnaient parfaitement, seul le badge manquait.

Le relevé attend désormais que le contenu **cesse de bouger** pendant 1,5 s.
La stabilité se mesure en durée et non en nombre de passages : l'écart entre
le squelette d'une carte et son corps dépasse largement une période de
scrutation, et deux passages identiques d'affilée ne prouveraient rien.

L'horodatage `tse:substs` porte maintenant le **numéro du lecteur** qui l'a
produit (`2:<date>`). Sans cela cette correction n'aurait atteint personne
avant six heures : l'horodatage tout frais laissé par la 3.48.0 interdisait
précisément le relevé qui aurait réparé la donnée. Et `tse.reset()` emporte
désormais cet horodatage — effacer les abonnements puis s'interdire d'aller
les rechercher n'était pas une remise à zéro.

### Le style d'une chaîne abonnée (v3.45, refondu en v3.51)

Le **nom de la chaîne passe à l'or**, et un reflet plus clair le traverse en
boucle — la couleur est celle d'un dégradé découpé à la forme des lettres. La
**catégorie** reçoit le même traitement en plus sourd : un champagne, un reflet
presque deux fois plus lent, et pas de halo. Les deux rangs doivent le rester —
leur donner le même éclat aurait aplati la hiérarchie que Twitch installe par
la taille et la couleur.

Dans le **fond de la carte**, une lueur circule : trois nappes colorées qui
dérivent chacune à sa vitesse, et un voile lumineux qui balaie la carte en
diagonale de loin en loin.

L'avatar porte un **anneau d'or tournant**, dont le halo respire. L'élément à
décorer est **désigné en JS** par `avatarOf()`, la fonction qui fait déjà
autorité ailleurs dans le code : Twitch rend cinq formes d'avatar différentes,
et la feuille de style n'en recopiait que trois — d'où un anneau présent sur
une carte et absent sur sa voisine, sans raison visible. Recopier une cascade,
c'est se condamner à ce qu'elle dérive.

La **catégorie** est désignée de la même façon, par `cardCategoryEl()` (v3.54).
Le défaut y dormait à l'identique et n'avait été signalé nulle part : la
fonction couvre cinq emplacements, dont deux où le `<p>` ne porte **pas**
d'attribut `title` — que les sélecteurs de la feuille de style exigeaient.

C'est le seul élément qui subsiste en mode réduit, où il n'y a ni fond ni texte
à colorer —
et il est **doré pour tout abonnement**, quel que soit l'onglet d'où il vient.
Une teinte par origine (or, or rose, platine) a été essayée puis retirée : le
signal « abonné » est binaire, et le décliner en trois couleurs demandait de
retenir un code pour une distinction dont on n'a que faire à cet endroit.

L'onglet d'origine reste néanmoins **en mémoire**, lisible par `tse.subs()` :
il est relevé sans requête supplémentaire et répond à une question qu'on se
pose — « celui-là, je l'ai payé ou on me l'a offert ? ».

**Comment cela cohabite** avec le violet de « stream frais » et la couleur d'un
co-stream, qui occupent déjà le fond : la couche animée est posée en `z-index`
**négatif** dans le contexte d'empilement de la carte. Elle se peint donc après
le fond de la carte — dont elle laisse passer la teinte, étant très
transparente — mais avant le contenu, et sous la barre de gauche. Les trois
signaux restent lisibles ensemble : le fond dit « frais » ou « co-stream », la
lueur et l'or disent « abonné », la barre dit le groupe.

Le coût est mesuré, pas affirmé : sur trente cartes décorées — le double de ce
qu'un compte ordinaire affiche —, **16,75 ms d'intervalle moyen entre images
contre 16,76 ms** sans la décoration.

Ce style **ne touche pas au fond de la carte**, volontairement. Le fond
appartient déjà à « stream frais » (violet) et au co-stream (couleur du
groupe), et la barre de gauche leur appartient aussi. En n'occupant que le
contour, la décoration d'abonné se superpose aux deux sans les effacer : une
carte peut être fraîche, en co-stream **et** abonnée, les trois signaux restent
lisibles, sans une seule règle de départage.

La phase de l'animation est dérivée du **login**, pas du rang. La lumière ne
fait donc pas le tour de toutes les cartes au même instant — elle les parcourt
en cascade — et elle ne repart pas de zéro quand un changement de tri
réordonne la liste. `prefers-reduced-motion` arrête la comète et garde le
filet : le mouvement disparaît, l'information reste.

> **Retiré en 4.14.0.** Le bloc « mouvement réduit » n'existe plus : voir
> *Moins de règles, une boucle qui se referme, un mode d'emploi refait*.

Trois onglets sont lus (v3.46) : `?tab=paid`, `?tab=gifts` et `?tab=mobile`.
Ce sont les trois qui listent des abonnements **à des chaînes**. Turbo et
« autres abonnements » n'en parlent pas. Les abonnements **expirés** sont
écartés pour une raison plus forte : un abonnement expiré n'en est pas un, et
le relevé étant additif, le lire marquerait « abonné » pour 120 jours quelqu'un
dont on ne l'est plus.

Car le relevé est **additif** : on marque abonné ce qu'on trouve, jamais
« non abonné » sur une absence. Conclure d'une absence retirerait à tort le
style d'un abonnement bien réel. La correction d'un désabonnement reste au
relevé de visite, qui observe la chaîne elle-même.

### Les conséquences pratiques

- le bouton est **grisé** tant qu'aucune chaîne abonnée n'est **à l'antenne**
  (v3.46). Ce qui compte n'est pas ce qu'on sait mais ce qu'on peut trier :
  être abonné à quinze chaînes dont aucune n'émet ne donne rien à remonter.
  Le survol donne la bonne raison des deux — « aucun abonnement repéré » quand
  la mémoire est vide, « aucun de vos abonnements n'est en direct » quand elle
  ne l'est pas. Envoyer ouvrir une chaîne quelqu'un dont le relevé est déjà
  complet serait un contresens ;
- le **survol** du bouton annonce le total en toutes lettres (« Mes
  abonnements en tête — 12 abonnements au total ») : la pastille tronque
  au-delà de 99 et ne dit pas ce qu'elle compte ;
- une **pastille** au coin bas-droit du bouton donne le **total** de vos
  abonnements, qu'ils émettent ou non (v3.47). Les deux nombres répondent à
  deux questions différentes : le grisé dit « rien à trier maintenant », la
  pastille dit « vous avez N abonnements ». Elle reste donc **lisible sur un
  bouton grisé** — l'opacité du grisé porte sur l'icône, pas sur le bouton
  entier, sinon elle emporterait la pastille avec elle. Elle s'inverse en blanc
  sur le bouton actif ;
- le mode de tri **choisi revient** quand il redevient possible (v3.47). Un
  repli est subi, pas voulu : si le dernier abonné à l'antenne s'éteint, le tri
  retombe sur « spectateurs », mais votre choix est mémorisé et reprend dès
  qu'un abonné rallume. Même chose pour les co-streams ;
- les cartes masquées par un **filtre** comptent quand même : un filtre est un
  choix d'affichage passager, et faire clignoter la disponibilité du tri à
  chaque changement de catégorie rendrait le contrôle instable ;
- le **non**-abonnement est mémorisé lui aussi : une visite ultérieure corrige
  donc une entrée devenue fausse, y compris après un désabonnement ;
- au-delà de 120 jours, une observation n'est plus crue — sans quoi un
  abonnement mensuel non reconduit resterait vrai pour toujours ;
- quand la mémoire déborde sa borne, un **abonnement en cours passe avant un
  abonnement révolu** (v3.54) ; la date ne départage qu'à égalité. Depuis que
  l'onglet des expirés est lu, des dizaines d'entrées arrivent dans la même
  milliseconde que les abonnements actifs, et trier sur la seule date les
  perdait : sur le banc, **aucun des cinq abonnements actifs ne survivait**.
  Or les deux ne valent pas la même chose — un abonnement en cours porte le
  tri, la pastille et le style de la carte, un révolu ne nourrit qu'un badge
  au survol.

`tse.subs()` liste ce qui a été repéré, `tse.reset()` l'efface avec le reste.
`tse.rescan()` force un balayage complet — purge du cache de chaînes puis
re-scan, exactement le chemin qu'emprunte déjà un retour d'onglet après une
longue absence.

#### Comment les intermittences du banc sont traquées (v3.54.2)

Une assertion qui échoue une fois sur dix est pire qu'une assertion absente :
on finit par l'ignorer le jour où elle a raison. Le détecteur est simple —
**faire tourner plusieurs suites de front** pour ralentir les pages à dessein,
et lire le récapitulatif d'échecs que le banc imprime désormais à la fin.

À trois suites simultanées, tout passait. À six, une assertion tombait ; à
huit, quatre autres. Toutes de la même famille : **un état transitoire prélevé
à date fixe**. Sous charge, ce n'est pas la page qui va plus vite, c'est le
prélèvement qui arrive en retard. La correction n'est jamais de desserrer le
seuil, mais d'attendre la condition, de constater un ordre d'événements, ou de
remettre la mise en scène dans le bon ordre.

L'une d'elles a révélé un défaut de PRODUCTION, pas de test : une page
seulement lente était déclarée vide par le relevé d'abonnements, parce que le
compte à rebours d'apaisement courait pendant qu'elle se construisait encore.
Il exige désormais un document qui a cessé de grossir.

---

## Top Chaînes (v3.32+)

Le bouton de tri natif de Twitch — les flèches ↕ à droite de « Chaînes suivies »
— est masqué, et un contrôle segmenté le remplace en tête du bloc de filtres :

    ┌─────────────────┬─────────────┐
    │ Chaînes suivies │ Top Chaînes │
    └─────────────────┴─────────────┘

La rangée des six boutons de tri, elle, est **alignée bord à bord sur celle des
filtres** (v3.53) : les boutons s'étirent pour occuper toute la largeur, le
premier touchant le bord gauche et le dernier le bord droit, exactement comme
les listes déroulantes au-dessus. Centrée avec des boutons de largeur fixe, la
rangée laissait de part et d'autre une marge qui ne correspondait à rien.

Une piste unique, aux mêmes surfaces que les listes déroulantes juste en dessous
et exactement à la même hauteur, dans laquelle un curseur violet se déplace d'un
segment à l'autre. Le mode est un choix **exclusif** : deux pastilles détachées,
comme jusqu'à la 3.41, le donnaient à lire comme deux actions indépendantes. Le
libellé n'est jamais tronqué — dans une langue plus longue que le français, le
second segment passe sous le premier plutôt que de s'abréger en « Chaînes su… »,
qui n'informerait plus de rien.

En **Top Chaînes**, la sidebar n'affiche plus vos abonnements mais les 30 chaînes
les plus regardées de Twitch. Les cartes héritent de tout le reste : durée de
stream, aperçu au survol, préchargement des miniatures, filtres. L'extension les
fabrique par clonage — **sauf** pour une chaîne que vous suivez déjà, dont elle
emprunte la carte que Twitch a posée (cf. « Le mode ne laisse rien derrière
lui »).

### Pourquoi il faut le reconstruire

Le schéma de Twitch annonce :

> *Fetch live streams, ordered by the number of viewers descending.*

Mesuré : **c'est faux**. La liste arrive en désordre — y compris sur la requête
de Twitch lui-même, porteuse de son `Authorization` et de son `Client-Integrity` :

    189916, 142955, 1164, 61117, 9893, 9073, 32517, 42340, …

Le classement se fait donc dans le navigateur, chez Twitch comme chez nous.
Mais trier les 30 reçus ne suffirait pas : cet ensemble n'est pas le top 30 (on
y trouve des chaînes à 1 164 spectateurs). Il faut le construire autrement.

### Comment : une inégalité, pas une estimation

L'audience d'une catégorie est la **somme** de ses streams. Donc pour tout
stream S de la catégorie C :

    viewers(S) ≤ viewers(C)

Or `games(first: 100, options: {sort: VIEWER_COUNT})` rend, lui, une liste
**réellement classée** (vérifié : 100 valeurs décroissantes). Il suffit donc de
descendre les catégories tant que leur audience dépasse **T**, le 30ᵉ score déjà
trouvé : en dessous de T, aucune catégorie ne *peut* plus contenir un membre du
top 30. La marche s'arrête en le sachant.

Mesuré en production : **64 opérations, 1,6 seconde**, un pool d'environ 1 600
chaînes récoltées sur une cinquantaine de catégories.

### Ce qui est prouvé, et ce qui ne l'est pas

L'extension ne revendique pas plus qu'elle ne sait :

| | prouvé ? |
| --- | --- |
| La descente entre catégories | **oui** — c'est l'inégalité ci-dessus |
| La profondeur de la fenêtre (100 catégories) | **vérifié à chaque marche** — si la 100ᵉ catégorie pèse encore plus que T, le classement n'est pas déclaré complet |
| Le sommet d'une catégorie | **hypothèse mesurée** — voir ci-dessous |

Sur ce dernier point : `game(name:){ streams(first: 30) }` rend bien le sommet
de la catégorie — la couverture mesurée va de 44 % à 96 % de son audience pour
30 streams choisis parmi des milliers. Mais la sélection **n'est pas
strictement ordonnée**, et elle omet par intermittence des chaînes qui
devraient y figurer. Six appels identiques à Fortnite, même catégorie, même
compteur :

    rubius 23608 ●○●○●●

Reconstruire le classement à vide à chaque passe le ferait donc clignoter une
fois sur trois. L'extension ne croit plus une absence isolée : il en faut
**trois d'affilée** pour retirer une chaîne — le même raisonnement que pour les
chaînes déconnectées. Le clignotement tombe sous 4 %, sans une requête de plus.

Quand le classement n'est pas prouvé complet, un bandeau le dit. Il n'est
jamais masqué.

### Catégorie : ce n'est pas un filtre

Filtrer le top 30 mondial par « VALORANT » n'en laisserait qu'une ou deux
chaînes — et sûrement pas les plus regardées de VALORANT. Choisir une catégorie
change donc ce qu'on **demande** : une seule opération, rafraîchie toutes les
30 secondes.

La liste propose les **100 premières catégories avec leur audience réelle**
(« 122 k | VALORANT »), classée. Le libellé est le nom canonique — celui que
Twitch écrit lui-même sur ses cartes, y compris en français (« Just Chatting »,
pas « Discussions ») — de sorte que la liste, la requête et les cartes parlent
la même langue.

Revenir à « toutes les catégories » est **instantané** : le classement mondial
n'est pas purgé.

### Langue : une descente, pas un filtre (v3.41)

Choisir une langue ne restreint pas l'affichage — **cela change ce qu'on
demande**, exactement comme une catégorie.

| situation | ce qui se passe | exact ? |
| --- | --- | --- |
| **Catégorie + langue** | requête dédiée `broadcasterLanguages` → les 30 plus grosses de cette langue **dans cette catégorie** | **oui** |
| **Monde + langue** | la descente entière est menée EN LANGUE : chaque catégorie visitée est interrogée avec le filtre | **oui** |
| Langue dont le code est refusé par l'API | repli sur le filtrage par tags du pool déjà récolté | **non**, et le bandeau le dit |

La garantie survit telle quelle : l'inégalité `viewers(stream) ≤ viewers(catégorie)`
reste vraie langue par langue, puisque le total d'une catégorie majore aussi
bien ses chaînes françaises que les autres.

Ce que ça change concrètement : le plafond de 30 par catégorie masquait toutes
les chaînes d'une langue minoritaire dès qu'une catégorie était dominée par une
autre langue. Une chaîne française à 800 spectateurs en Just Chatting était
invisible — le top 30 toutes langues de cette catégorie s'arrête bien plus
haut. Elle apparaît désormais.

Mesuré sur quatre catégories, les deux requêtes au même instant : la requête
filtrée ne perd **aucune** chaîne française du top 30 brut, et en révèle 23 à 29
que ce top ne contenait pas.

La descente en langue **remplace** la descente toutes langues, elle ne s'y
ajoute pas : ~101 opérations au lieu de ~64, soit deux requêtes HTTP groupées
de plus par marche, et seulement tant qu'une langue est sélectionnée. Le
dernier classement toutes langues est conservé, si bien que revenir à « toutes
les langues » est **instantané**.

Une précaution qui compte : le code attendu par l'API est l'ISO 639-1
(`JA`, `KO`, `CS`, `EL`…) et **non** le code du drapeau (`JP`, `KR`, `CZ`,
`GR`…) — onze des vingt-six diffèrent. Si Twitch venait à en refuser un,
l'extension l'apprend au premier essai, retombe sur le filtrage par tags et
cesse d'annoncer l'exactitude. Une coupure réseau, elle, ne condamne rien :
elle n'apprend rien sur la validité du code.

**Mesuré le 21/08/2026** : les vingt-six codes d'alors sont acceptés par
l'API. Une requête, vingt-six opérations, une par langue — aucune erreur, et
vingt-trois ont ramené un stream d'exemple. Les **cinq ajoutés en 3.80**
(`BG`, `SK`, `TL`, `MS`, `CA`) n'ont pas été mesurés : ils suivent la même
convention, et s'ils étaient refusés le repli décrit ci-dessus s'en
chargerait — sans compter que la voie du tag, elle, n'a besoin d'aucun code.

Ce qui ne veut **pas** dire que le repli est devenu inutile, et il n'est pas
question de le retirer. Deux raisons. La mesure dit ce qui était vrai ce
jour-là, pas ce que Twitch acceptera demain — c'est une API privée, sans
engagement de compatibilité. Et surtout : le champ `broadcasterLanguages`
**ne figure pas** dans le schéma GraphQL public que Twitch publie, où
`GameStreamOptions` ne déclare qu'un `languages: [String!]` marqué déprécié.
L'API vivante l'accepte, le schéma l'ignore : la seule autorité sur ce champ
est donc l'API elle-même, interrogée à l'exécution. C'est exactement ce que
fait le repli.

### Le plafond de 30 vient de l'API

`streams(first:)` est plafonné à 30, et Twitch le dit sans ambiguïté :

    argument 'first' value must be between 1 and 30.

Cela vaut pour **toute** catégorie. Il n'y a pas d'exception possible, ZEVENT
compris.

### Coût et cadence

| | fréquence | coût |
| --- | --- | --- |
| Compteurs des chaînes affichées | 30 s | **aucune requête** — ils voyagent dans le lot `TseChannels` qui part déjà |
| Passe structurelle légère | 30 s | ~11 opérations, **une** requête groupée |
| Marche complète (filet contre la dérive) | 2 min 30 | ~64 opérations |
| Catégorie sélectionnée | 30 s | **1** opération |
| Langue sélectionnée (sans catégorie) | 2 min 30 | ~101 opérations au lieu de ~64 |

Le module a son **propre** cooldown, distinct de celui de la sidebar : si Twitch
bride le mode global, « Chaînes suivies » ne s'éteint pas avec lui. Au-delà de
trois échecs consécutifs, la cadence se replie d'elle-même et l'annonce en
console, dans les cinq langues.

### Le mode ne laisse rien derrière lui (v3.42)

Deux garanties, apprises en corrigeant deux défauts réels.

**Une carte par chaîne.** Si vous suivez une chaîne qui figure au classement,
il y en avait deux : celle de Twitch, masquée, et une contrefaçon posée à côté.
L'extension **emprunte** désormais la carte native — plus fidèle qu'un clone, et
sans le doublon que la détection de co-stream prenait pour deux participants
distincts. En quittant le mode, une carte fabriquée se retire et une carte
empruntée **se rend** : la retirer effacerait de la barre latérale une chaîne
que vous suivez réellement.

**Le classement n'écrit pas dans le cache de la liste suivie.** Pour qu'une
carte fraîchement posée n'affiche pas une seconde durant les chiffres de la
chaîne qui a servi de modèle, le mode l'amorce avec ce que la marche
structurelle sait déjà. Cette amorce vivait dans le cache **partagé** — celui
que lisent le filtre de langue, les cartes en avance et le garde-fou
d'extinction de masse — et elle y survivait à la sortie du mode. Le symptôme
était visible : une chaîne suivie figurant au classement français en repartait
avec un tag « Français » que la descente avait posé elle-même, et le filtre de
langue de la liste suivie proposait alors cette langue pour une chaîne qui ne
l'a jamais déclarée. L'amorce a maintenant sa propre mémoire, lue par les seules
cartes du classement et vidée en sortant.

Elle ne porte pas non plus d'identifiant de stream. L'ancienne en fabriquait un
(`g:login`), qui pouvait finir dans les statistiques d'avance sur Twitch. Un
classement n'est pas l'observation d'un stream ; il n'a pas à s'en donner
l'identifiant.

### Ce que le mode ne fait pas

- La rangée « Ouvrir les stories » est masquée, ainsi que les sections
  « Chaînes live » et « Les spectateurs de… » : elles n'ont plus de rapport
  avec ce qui est affiché.
- Les modes de tri sont masqués : le classement **est** le tri.
- Le mode n'est pas mémorisé entre deux chargements de page.
- Tout passe par les **mêmes appels anonymes** que le reste de l'extension —
  `credentials: 'omit'`, Client-ID public, aucun jeton, aucune permission
  supplémentaire.

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
Contributors. Huit adaptations seulement le séparent de l'amont, toutes marquées
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

Cela ne suffisait pourtant pas : la qualité **montait** encore d'elle-même après
quelques secondes. Le `quality=360p30` de l'URL n'est qu'une préférence, que le
lecteur reste libre de dépasser par adaptation de débit. Le vrai levier est
ailleurs — dans le **type de lecteur porté par la requête de jeton d'accès**,
qui décide de l'échelle de qualité que Twitch renvoie. Le module le réécrivait
en `popout`, dont l'échelle monte jusqu'à la source.

Il est désormais réécrit en **`autoplay`**, dont Twitch plafonne l'échelle à
640 × 360 (adaptation h). C'est un plafond **serveur** : l'adaptation de débit
ne peut pas le franchir, et 640 × 360 est exactement le bon calibre pour une
vignette de 480 × 270. `autoplay` est sans publicité de l'aveu même du fork, et
le retrait de `parent_domains` ne dépend pas de cette valeur.


### L'interstitielle de classification (v3.55)

Depuis les Content Classification Labels, un stream étiqueté fait afficher au
lecteur un écran d'acquittement — « Le contenu de X est destiné à certains
publics », avec un bouton **Commencer à regarder**. Dans un aperçu au survol,
ce bouton ne sera jamais cliqué : personne ne clique dans une vignette qu'on
effleure. Jusqu'à la 3.54, l'extension en tirait la conclusion inverse de la
bonne : elle **n'injectait pas l'iframe** dès que `hasCCL` était vrai, et
l'aperçu restait figé sur son JPEG.

Rien dans l'URL d'embed ne permet de l'éviter ; Twitch le dit lui-même sur son
forum développeurs — un embed non interactif ne peut pas lire un stream
étiqueté. Le seul chemin est de cliquer, et cliquer demande d'être **dans** la
frame du lecteur. Ce que le manifeste nous donne : `player.twitch.tv` y est
déclaré, avec `all_frames: true`.

C'est exactement ce que fait FrankerFaceZ, sous le réglage
`player.disable-content-warnings` :

```js
const btn = cont.querySelector('button[data-a-target=' +
    '"content-classification-gate-overlay-start-watching-button"]');
if (btn) btn.click();
```
<sub>FrankerFaceZ, `src/sites/shared/player.jsx`, `skipContentWarnings()`</sub>

Le pont d'aperçu fait de même, avec trois différences :

- **Pas de React.** FFZ remonte à l'instance pour trouver le nœud hôte ; ici
  l'iframe *est* le lecteur, un `querySelector` sur le document suffit.
- **Un clic par bouton, cinq au total.** Un clic qui ne ferme pas
  l'interstitielle provoque des mutations, que l'observateur relit, qui
  recliquent : sans borne, c'est une boucle entretenue par elle-même.
- **Le repli est étroit.** Si Twitch renomme le bouton, on cherche n'importe
  quel `button`, mais **uniquement** dans le sous-arbre
  `[data-a-target^="content-classification-gate"]`. Cliquer un bouton
  quelconque du lecteur couperait le son ou ouvrirait les réglages.

#### La veille s'arrêtait avant ce qu'elle attendait (v3.55.1)

La 3.55 est sortie avec un défaut que le banc ne pouvait pas voir. Son
observateur se retirait dès que **deux** conditions étaient réunies — une
`<video>` sous surveillance, aucune modale à l'écran — et ce « aucune modale »
était fondé sur une idée fausse, écrite noir sur blanc dans le code : *« sur un
stream étiqueté, la `<video>` n'existe qu'une fois l'écran acquitté »*.

Twitch pose son élément `<video>` **avec le lecteur**, avant que l'écran
d'acquittement ne se rende. La veille voyait donc une vidéo, pas encore de
modale, concluait qu'il n'y avait plus rien à faire, et se retirait. La modale
apparaissait ensuite dans une frame que plus personne ne regardait : ni cliquée,
ni signalée. Le filet ordinaire du parent la dévoilait alors en travers de
l'aperçu — le pire des trois résultats possibles.

Le harnais ne pouvait pas l'attraper : il rendait sa modale d'emblée, donc
**avant** la vidéo. L'ordre inverse de la production. Un scénario le reproduit
désormais — `<video>` sans flux dès le départ, modale 400 ms plus tard — et la
mutation qui remet la condition de la 3.55 le fait tomber, avec exactement le
journal observé en production : `iframe, pont, devoilee`, sans `modale`.

L'observateur ne se retire plus que sur la **première image annoncée**. Et le
signal de première image est retenu tant qu'une modale est visible : sans cette
retenue, un `readyState` complaisant sur une vidéo vide suffirait à faire
dévoiler l'écran d'acquittement.

Le bouton, lui, doit être **visible** pour compter — largeur et hauteur non
nulles. Un sur-cadre laissé dans le DOM après coup ferait sinon croire à une
modale éternelle, et l'aperçu ne se dévoilerait plus jamais : on aurait remplacé
un défaut par son symétrique.

#### Le nœud `<video>` n'est pas toujours le même (v3.55.2)

Le pont surveillait « une vidéo, la première trouvée », et retenait ce fait dans
un **booléen**. Il supposait donc qu'un lecteur garde son élément vidéo du début
à la fin. Twitch le remplace — notamment quand la source repart, ce qui est
précisément l'effet de l'acquittement. Le pont restait alors accroché à un nœud
détaché, où `playing` n'arrive jamais : aucune première image annoncée, et le
filet d'interstitielle rendait la main à la vignette **au moment même** où la
vidéo jouait, dans l'autre nœud.

Le booléen est devenu le nœud lui-même : on re-surveille dès que
`querySelector('video')` rend autre chose que ce qu'on regardait. Trouvé à la
relecture, pas en production — le défaut demandait un remplacement de nœud que
rien au banc ne provoquait. Un scénario le force désormais au clic, et la
mutation qui remet le booléen le fait tomber avec le symptôme complet : plus
d'iframe du tout, vignette pour toujours.

La même relecture a resserré `lever()`, qui refaisait deux `querySelector` à
chaque lot de mutations du lecteur — nombreux — alors que la modale était déjà
signalée et le quota de clics épuisé. Elle sort maintenant avant.

#### Deux filets, et pourquoi il en fallait un second

L'aperçu se dévoile à sa première image. Quand ce signal n'arrive pas, un filet
dévoile quand même au bout de 1,5 s : mieux vaut un lecteur noir un instant
qu'une vignette figée pour toujours. Ce raisonnement **s'inverse** en présence
d'une interstitielle — ce qu'on dévoilerait n'est pas un cadre noir, c'est une
modale en travers de l'aperçu.

Le pont signale donc au parent, par `postMessage`, qu'il a vu une
interstitielle. Le parent désarme alors le filet ordinaire et en arme un autre :
si la vidéo n'est pas partie après `PREVIEW_GATE_TIMEOUT_MS`, l'iframe est
retirée et **la vignette reprend la main**. Le pire cas retombe exactement sur
le comportement de la 3.54.

#### Le drapeau, et le piège qu'il a d'abord été

`TSE_GATE_ENABLED` coupe le levage. Il a d'abord coupé le **signalement** avec
lui — et « revenir au comportement d'avant » donnait alors pire qu'avant : le
parent ne savait rien de l'interstitielle, son filet ordinaire jouait, et
l'aperçu dévoilait la modale. Le banc l'a dit en mutation ; la relecture ne
l'avait pas vu. Le signalement est désormais inconditionnel, le clic seul
dépend du drapeau.

#### Les étiquettes changent de rôle

Elles ne décident plus, elles s'affichent. La requête ne rend plus un booléen
mais les identifiants (`MatureGame`, `Gambling`…), et l'aperçu en fait un badge
ambre posé **en tête** des autres : un avertissement se lit avant le contexte.
C'est ce badge qui fait que le levage ne retire rien à personne — ce que
l'interstitielle disait, l'aperçu le dit, et plus tôt.

Le libellé traduit vit dans la table des locales, pas dans la requête : demander
`localizedName` à GraphQL ferait échouer la requête **entière** si le champ
n'existe pas sous ce nom, et le titre de l'aperçu partirait avec. Sept
étiquettes, cinq langues, plus un libellé générique — « Contenu classifié » —
pour l'identifiant que Twitch ajouterait demain :
`DebatedSocialIssuesAndPolitics` affiché brut dans une interface française
serait pire que rien.

Les clés sont **plates** (`uiCclMatureGame`, `uiCclGambling`…) et non
regroupées dans une table imbriquée : `tests/parity.mjs` ne compte que le
premier niveau, et une langue aurait pu perdre une étiquette sans que rien ne le
dise.

#### La palette des badges (v3.55.3)

Le badge d'étiquettes est né **ambre**, sur un raisonnement juste — une teinte
d'avertissement, distincte de l'or des abonnements — et un chiffre jamais
calculé. Une fois mesuré : son texte tombait à **2° de teinte** de celui du hype
train, 26° contre 24°. La même couleur à l'œil, sur deux badges qui peuvent
parfaitement coexister — une chaîne étiquetée lançant un hype train n'a rien
d'exotique. C'est le défaut que la 3.25 avait déjà corrigé sur les couleurs de
co-stream, refait ailleurs.

Il est passé au **rouge**. Le créneau est étroit — coincé entre l'orange du hype
à 24° et le rose de la réduction à 311°, l'optimum théorique est 348° — et on se
pose à 357°, franchement rouge plutôt que cramoisi, soit 27° du hype sur le
texte et 31° sur le fond.

Le contraste a dicté le reste. Le rouge est la teinte la plus sombre à luminance
égale : son canal ne pèse que 0,2126 dans la formule, et les premiers essais
tombaient à 4,9:1 quand toute la famille tient entre 6,4 et 7,7. D'où un fond
délibérément sombre — le rouge vif est dans le texte, pas dans la pastille.

Les fonds sont translucides ; la colonne « composé » est ce qu'ils donnent sur
le `#18181b` du popup, et le contraste est mesuré texte contre ce composé.

| Type | Fond déclaré | Composé | Texte | Teinte | Contraste |
| --- | --- | --- | --- | --- | --- |
| `--ccl` | `rgba(200, 25, 42, .26)` | `#46181f` | `#ff868c` | 357° | 6,41:1 |
| `--hype` | `rgba(255, 105, 5, .25)` | `#522c16` | `#ffb380` | 24° | 6,94:1 |
| `--sub` | `rgba(255, 201, 102, .22)` | `#4b3f2c` | `#ffd591` | 37° | 7,43:1 |
| `--exsub` | `rgba(255, 201, 102, .10)` | `#2f2a23` | `#c9b48c` | 39° | 7,06:1 |
| `--sponsor` | `rgba(0, 184, 90, .22)` | `#133b29` | `#6bdb9d` | 147° | 7,25:1 |
| `--costream` | `rgba(31, 105, 255, .25)` | `#1a2c54` | `#7fb3ff` | 216° | 6,38:1 |
| `--squad` | `rgba(145, 71, 255, .25)` | `#362454` | `#d1b3ff` | 264° | 7,56:1 |
| `--discount` | `rgba(255, 56, 219, .20)` | `#461e41` | `#ffa3ee` | 311° | 7,67:1 |
| *(sans modificateur)* | `rgba(255, 255, 255, .08)` | `#2a2a2d` | `#efeff1` | — | 12,38:1 |

La dernière ligne n'est pas un oubli : une ligne annexe que `markExtraRows` ne
sait classer ni en hype train ni en réduction sort avec `type: 'other'` et tombe
sur le gris de base. C'est sa couleur, définie, et le scénario 60 la traite comme
telle.

Trois paires restent sous les 20° et **le sont volontairement**. `sub` et `exsub`
sont le même or à dessein — même signal, l'un désaturé. `hype` ↔ `sub` (13°) et
`hype` ↔ `exsub` (15°) sont le prix de deux ancrages hors palette : l'orange du
hype est celui de Twitch, l'or du badge d'abonnement est celui du filet des
cartes abonnées (`--tse-sub-or`, 38°), qui existe précisément pour qu'on
reconnaisse le signal d'une surface à l'autre. Les écarter demanderait de rompre
l'un des deux — un arbitrage de produit, pas une correction.

C'est là toute la différence avec l'ambre : elle n'était ancrée à rien. Elle
était libre, et elle s'était posée à 2° du hype train.

Un pictogramme ⚠️ encadre le texte **des deux côtés** (v3.55.2). À gauche
seulement, il se lirait comme une puce de liste ; de part et d'autre, il fait un
panneau. Les deux sont `aria-hidden` : une synthèse vocale doit lire « Jeux
matures », pas « avertissement Jeux matures avertissement ». Leur
`line-height: 1` empêche l'emoji — qui déborde sa boîte em — de rehausser la
pastille d'un pixel par rapport aux badges voisins. Et parce que sept étiquettes
cumulées font 456 px dans un aperçu large de 482, la pastille se **replie** sur
deux lignes au lieu d'être coupée net (`max-width: 100%`), les pictogrammes
restant centrés de part et d'autre du bloc.


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

#### Une carte masquée n'est pas un membre (v3.41.1)

Les barres de deux membres voisins se **rejoignent**, et l'extension mesure pour
cela l'interstice réel entre les deux cartes — la jointure est ainsi exacte quel
que soit l'espacement, notamment en mode réduit où les avatars sont plus écartés.

Encore faut-il que les deux cartes existent à l'écran. Il y a **trois** façons
d'en masquer une : l'attribut hors-ligne, un `display` en ligne posé par un
filtre, et — depuis « Top Chaînes » — une règle CSS de **classe**. La troisième
ne pose ni attribut ni style en ligne : une carte suivie y gardait toutes ses
marques alors qu'elle n'avait plus de boîte. Mesurer un interstice contre elle
revenait à le mesurer contre un rectangle nul, c'est-à-dire à étendre la barre de
son partenaire de la moitié de la page. Le symptôme était un trait vertical
continu en travers d'une dizaine de chaînes sans rapport, mesuré à **653 px sur
une carte de 148**.

Deux corrections, volontairement indépendantes. Un prédicat unique énumère les
trois masquages et sert aussi bien au regroupement qu'au calcul de voisinage —
un groupe est une information visuelle, et colorer une carte dont on ne montre
pas l'autre moitié n'en est pas une. S'y ajoute un garde-fou purement
géométrique, qui ne croit que la mise en page : pas de jointure entre deux
boîtes dont l'une n'a pas de hauteur, ni au-delà d'un interstice plus grand que
les cartes elles-mêmes.

**Ce qui n'a pas pu être vérifié.** Le blocage publicitaire lui-même demande un
vrai stream servant de vraies publicités : il n'est pas testable depuis
l'environnement de développement. Ce qui EST vérifié automatiquement : que le
module se charge, qu'il reste **strictement inerte hors iframe** (ni `fetch` ni
`Worker` accrochés, aucun marqueur revendiqué, aucune API posée) et qu'il ne
perturbe en rien la sidebar.

Les drapeaux SVG du filtre par langue proviennent du jeu **OpenMoji** (licence CC BY-SA 4.0). Les bi-drapeaux **EN** (USA + Royaume-Uni) et **PT** (Portugal + Brésil), coupés à la verticale centrale, en sont dérivés pour représenter d'un seul drapeau les deux variantes d'une même langue.

---

## Localisation

L'extension détecte la langue de votre interface Twitch : d'abord par les
libellés natifs qu'elle reconnaît dans le DOM, puis par l'attribut `lang` que
Twitch pose sur le `<html>`, puis par `navigator.language`. Dix interfaces sont
servies — `fr`, `en`, `de`, `es` (Espagne et Amérique latine), `pt` (Brésil et
Portugal), `it`, `pl`, `ru`, `ja`, `zh` — et toute autre langue retombe sur
l'anglais.

Toutes les chaînes de l'extension (badges du popup d'aperçu, libellés du
filtre et des boutons de tri, messages console) sont traduites en conséquence.
Les libellés natifs Twitch que l'extension recherche dans le DOM (section
« Chaînes suivies » / « Followed Channels » / « Kanäle, denen du folgst » /
« Canales que sigues » / « Canais seguidos » (pt-BR) / « Canais que segues »
(pt-PT), bouton « Afficher plus » /
« Show More » / « Mehr anzeigen » / « Mostrar más » / « Mostrar mais », phrase
d'accessibilité « X et N invités » / « X and N guests » / « X und N Gäste » /
« X y N invitados » / « X e N convidados », etc.) ne sont connus que dans ces
**six** langues-là : ce sont des chaînes relevées mot pour mot dans le DOM de
Twitch, et en inventer pour les quatre autres reviendrait à écrire une
comparaison qui n'aboutirait jamais. L'italien, le polonais, le russe, le
japonais et le chinois se détectent donc par `lang`, et toute la sidebar tient
sur ses ancres structurelles — ce qu'elle fait de toute façon pour n'importe
quelle autre locale.

Le compteur de viewers que l'extension affiche (cf. « Rafraîchissement en
quasi-direct ») est **rendu dans le format de votre locale**, identique à celui
de Twitch : abréviation décimale + suffixe (`67,3 k` en fr, `67.3K` en en,
`4.1 k` en es, `3,7 mil` / `1,2 mi` en pt, identique au Brésil et au Portugal),
ou nombre plein à séparateur de milliers (`29.339` en de). Le compteur natif de
Twitch reste par ailleurs interprété indépendamment de la locale, ce qui sert de
repli tant qu'une chaîne n'a pas encore été résolue.

Si vous changez la langue dans les paramètres Twitch, la page recharge et
l'extension applique la nouvelle langue automatiquement.

### Le nom des catégories (v3.58)

Sous une interface française, la sidebar affichait **« Just Chatting »** là où
Twitch écrit **« Discussions »**. Ce n'était pas un oubli de traduction : c'est
l'extension qui écrasait le libellé français que Twitch avait déjà posé.

Une catégorie a **deux noms** chez Twitch, et ils ne font pas le même métier :

| Champ | Ce que c'est | À quoi il sert |
| --- | --- | --- |
| `game.name` | le nom **canonique**, en anglais — celui des URL `/directory/game/…` | l'**identité** : clé du filtre catégorie, clé de regroupement des co-streams, terme de comparaison du basculement de catégorie, et seule valeur que `game(name:)` accepte |
| `game.displayName` | le même nom **traduit** | l'**affichage**, et rien d'autre |

L'extension ne demandait que le premier, et l'écrivait sur les cartes. Elle
demande désormais les deux et ne les confond plus : ce qui s'affiche — la carte,
son infobulle, le menu déroulant, le badge « Vient de passer sur … » — porte le
nom traduit ; ce qui compare ou filtre continue de travailler sur le nom
canonique. Le menu déroulant montre donc « Discussions » tout en filtrant sur
« Just Chatting », et un clic donne le même résultat qu'avant.

Cette séparation n'est pas cosmétique. Si le registre des basculements comparait
les libellés, **changer la langue de Twitch annoncerait un changement de
catégorie sur toutes les chaînes à la fois** — « Discussions » deviendrait
« Nur Chatten » sans que personne n'ait rien fait. Le scénario 65 du banc mute
précisément cette ligne pour le vérifier.

C'est enfin l'en-tête **`Accept-Language`** qui décide de la langue rendue par
`displayName`, et l'extension y met la langue de l'**interface qu'elle
décore**, non celle du navigateur. Sans cela, un navigateur en anglais devant un
Twitch en français rendait des catégories anglaises sous une interface
française. L'en-tête est « CORS-safelisted » — il ne s'ajoute pas au contrôle
préalable — et n'apprend rien de plus sur vous que ce que le navigateur envoyait
déjà de lui-même : la requête reste anonyme, sans jeton, sans cookie.

Une catégorie que Twitch ne traduit pas — la plupart des titres de jeux —
renvoie un `displayName` égal au nom canonique, et s'affiche donc exactement
comme avant.


#### Vérifier ce que Twitch rend, langue par langue

Le banc éprouve **notre** moitié du chemin dans les dix langues : chacune
demande bien sa locale, et affiche bien ce que le serveur lui rend (scénario
65). Il ne peut pas éprouver la moitié de Twitch — il ne l'appelle pas. Pour
voir les vraies traductions, coller ceci dans la console d'un onglet Twitch
(`F12`) :

```js
(async () => {
  const LOCALES = ['fr-FR','en-US','de-DE','es-MX','pt-BR',
                   'it-IT','pl-PL','ru-RU','ja-JP','zh-CN'];
  const lignes = [];
  for (const l of LOCALES) {
    const r = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST', credentials: 'omit',
      headers: { 'Content-Type': 'application/json',
                 'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
                 'Accept-Language': l },
      body: JSON.stringify([{ operationName: 'T', variables: {},
        query: 'query T { game(name: "Just Chatting") { name displayName } }' }]),
    });
    const g = (await r.json())[0]?.data?.game;
    lignes.push({ locale: l, canonique: g?.name, affiché: g?.displayName });
  }
  console.table(lignes);
})();
```

C'est exactement la requête que l'extension émet — même Client-ID public, même
`credentials: 'omit'`, même en-tête — à ceci près qu'elle boucle sur les dix
locales au lieu d'envoyer celle de l'interface. La colonne « affiché » est ce
que la sidebar écrira dans chacune de ces langues. Une locale qui rendrait le
nom canonique signifie que **Twitch** ne traduit pas cette catégorie-là, pas
que l'extension a manqué quelque chose.

---

## Le panneau de la barre d'outils (v3.62)

Tout ce que cette API console rend est désormais lisible **sans console** : un
clic sur l'icône de l'extension, en haut à droite du navigateur, ouvre un
panneau qui affiche les dix mêmes relevés en tableaux, avec leurs cartouches de
résumé et les cinq actions (relever les abonnements, rebalayer, activer ou
couper Top Chaînes, effacer l'historique). Il est traduit dans les **douze
locales** du Store.

### Trois fichiers, et l'un d'eux n'est pas facultatif

`content.js` tourne en monde **`MAIN`**. C'est ce qui lui permet d'exposer
`window.tse` et de lire le JavaScript de Twitch — et c'est aussi ce qui lui
interdit toute API `chrome.*` : le monde `MAIN` est le contexte de la **page**,
où l'extension n'a aucune existence. Le panneau, lui, est une page d'extension :
il a `chrome.*` et n'a pas la page. **Les deux ne peuvent pas se voir.**

D'où le découpage, et il n'est pas décoratif :

| Fichier | Monde | Ce qu'il fait |
| --- | --- | --- |
| `panneau.html` / `.css` / `.js` | page d'extension | dessine, traduit, n'appelle rien directement |
| `bridge.js` | `ISOLATED` | le seul contexte qui ait `chrome.*` **et** le DOM de la page |
| `background.js` | service worker | garde le port, aiguille, ne comprend rien à ce qu'il transporte |

### Pourquoi c'est l'onglet qui appelle, et non le panneau

Le chemin naturel serait que le panneau appelle `chrome.tabs.sendMessage`. Il
**exige une permission d'hôte** sur l'onglet visé — exactement ce que la fiche
promet de ne pas demander, et ce que `npm run addon` vérifie (aucune clé
`permissions`). On inverse donc le sens : c'est `bridge.js` qui ouvre le port
par `chrome.runtime.connect()`, ce qu'un content script fait **sans rien
réclamer**, et le service worker s'en sert pour répondre. Cette inversion est
tout ce qui sépare « zéro permission » de « permission d'hôte sur twitch.tv ».

Le port ne vit que pendant que **l'onglet est visible**. Un port ouvert
maintient le service worker éveillé ; le garder branché en permanence tiendrait
un worker en vie tant qu'un onglet Twitch est ouvert, c'est-à-dire l'exact
contraire de ce que fait le reste du produit depuis la 3.61. Or l'icône ne peut
être cliquée que sur l'onglet actif.

**Le compromis, en entier.** La première rédaction de ce paragraphe affirmait
que cela « ne retire rien ». C'était faux, et un rapport d'utilisateur l'a
montré : Chrome termine le worker après une trentaine de secondes d'inactivité
**même sous un port ouvert**, et la reconnexion qui suit ouvre une fenêtre
aveugle. Elle était d'une seconde ; le panneau ne réessayait qu'une fois à
500 ms — donc entièrement à l'intérieur. La reprise est passée à 200 ms et le
panneau réessaie à 250, 750 puis 1 800 ms.

### Le contrat de transport, et le rapport vide qui l'a révélé (v3.66)

Un utilisateur a demandé un rapport de diagnostic et reçu **quinze lignes** :
l'environnement, le transport, `résultat : expiration`, puis « la page n'a pas
répondu ». Sur un rapport qui en fait deux cents.

La cause n'était pas une panne de sa machine. **Le rapport ne pouvait pas
fonctionner, jamais** : le panneau envoyait `{ rapport: true }`,
`background.js` recopiait la demande **champ par champ** — `section`, `action`,
`arg` — et jetait `rapport` en silence ; `bridge.js` exigeait ensuite `section`
ou `action` et rendait la main sans répondre. La demande partait, n'arrivait
nulle part, et le panneau attendait les 35 secondes de son garde-fou pour
n'afficher que son propre bloc.

Le banc était vert. Ses 25 assertions sur le panneau branchaient une page
d'extension sur un `chrome` de substitution qui répond directement — donc
sautaient exactement les deux fichiers qui se contredisaient. Ce n'était pas un
trou de couverture au sens des lignes exécutées : la ligne fautive était
couverte ailleurs. C'était un trou de **contrat** — trois fichiers énuméraient
chacun la même liste de champs, et il suffisait qu'un seul en oublie un.

Aucun des trois n'a besoin de cette liste : le contenu d'une demande ne regarde
que le panneau et `content.js`. Les deux sauts intermédiaires transportent donc
désormais la demande **entière**, moins ce qui n'appartient qu'à eux. Le
scénario 73 charge les **vrais** `background.js` et `bridge.js` dans un contexte
`vm`, autour d'un couple de ports factices, et éprouve qu'un champ **que
personne n'a écrit nulle part** traverse quand même. En l'écrivant, il a pris
une **troisième** occurrence du même défaut, sur le chemin du retour.

### Ce qu'un rapport doit dire quand la page ne dit rien

C'est son seul moment utile, et c'était celui où il se taisait. Trois sources
répondaient pourtant à cet instant précis, et aucune n'était consignée :

- **le service worker**, qui sait quels ponts il connaît et depuis quand il
  tourne. Un worker né il y a 200 ms explique un port pas encore rebranché ; un
  worker qui tourne depuis dix minutes sans avoir jamais vu de pont dit
  l'inverse. Deux réparations opposées, aucun moyen de choisir jusqu'ici. Le
  panneau le lui demande **sans passer par le pont** — c'est tout l'intérêt ;
- **le pont**, qui partage le DOM de la page sans partager son contexte ;
- **le panneau lui-même**, qui garde maintenant la trace de ses quatre essais.

`content.js` pose donc un **jalon** sur `<html>` (`data-tse-boot`), mis à jour à
six étapes de son démarrage. C'est le seul signe que le monde `ISOLATED` puisse
lire sans nous, et il sépare deux pannes qui se ressemblaient : jalon absent,
`content.js` n'est **jamais entré** dans cet onglet — il faut recharger ; jalon
présent et bloqué à `i18n`, il est entré et **tombé en route** — c'est un bogue
de notre côté. Le pont répond alors **immédiatement** au lieu d'attendre
30 secondes une page qui n'écoute pas.

Enfin, **l'écouteur du panneau est désormais la première chose que fait
`content.js`**, et non plus une déclaration à la ligne 6 000. N'importe quelle
exception levée avant elle emportait le pont avec elle. Il répond maintenant
même quand il n'a rien à servir — avec l'étape atteinte et le journal d'erreurs
déjà rempli, qui est alors le seul contenu du rapport qui explique quoi que ce
soit.

Les trois silences ont aussi cessé de porter le même nom : `page-absente`
(recharger), `expiration-page` (bogue de notre côté), `expiration-pont` (port
mort en route). Ils rendaient tous le mot « expiration », et le panneau n'en
donnait donc qu'un seul message — celui qui invite à patienter, y compris quand
attendre ne servait à rien.

### Ce que le journal d'erreurs consigne vraiment (v3.67)

« Le rapport porte les erreurs » était vrai depuis la 3.65 et ne voulait presque
rien dire : le journal existait, ce qui le remplissait beaucoup moins. Sur les
**cinquante-deux `catch`** du fichier, sept étaient instrumentés — et pas ceux
qui comptent.

**Le réseau, qui était l'angle mort le plus large.** `post()` est l'unique point
de passage de tout ce que l'extension demande à Twitch, et il repliait **cinq
échecs très différents** sur une même sentinelle muette. Chacun a maintenant son
nom, parce qu'aucun ne se répare comme les autres :

| Ce qui arrive | Ce que le rapport écrit | Ce que ça veut dire |
| --- | --- | --- |
| statut ≥ 400 | `HTTP 429`, `HTTP 503`… | trop vite / refus / Twitch en panne |
| dépassement de `GQL_TIMEOUT` | `abandon après … ms` | réseau lent, pas cassé |
| `fetch` qui rejette | `échec de fetch` | hors ligne, bloqueur, extension tierce |
| corps illisible | `corps illisible (JSON)` | réponse tronquée ou interceptée |
| **200 avec un corps d'erreurs** | `réponse 200 avec erreurs GraphQL` | requête persistée retirée, champ renommé |

Le dernier est le plus sournois : transport parfait, aucun signe côté HTTP, et
un cache qui reste vide. Le rapport donne en plus le nombre d'appels, le nombre
d'échecs et l'âge du dernier succès — trois appels sur trois échoués et zéro
appel passé se ressemblaient jusqu'ici.

**Les lectures de stockage**, dont aucune n'était consignée alors que les quatre
écritures l'étaient. C'est pourtant la lecture qui explique « mon historique a
disparu » : un JSON corrompu par une écriture interrompue se lit comme une
mémoire vide, et l'extension repartait de zéro sans un mot. Les six
**effacements** aussi — « j'ai effacé et ça revient » ne pouvait pas s'instruire.

**Le relevé d'abonnements**, et en particulier sa panne n°1 : la page
`/subscriptions` exige d'être connecté, et une session expirée y fait renvoyer
ailleurs. L'extension rendait alors une liste vide, **rigoureusement
indiscernable** de « vous n'avez aucun abonnement ». Le chemin de redirection est
maintenant recopié, l'onglet fautif nommé, et le délai de 25 secondes écoulé
pour rien ne passe plus inaperçu.

**Les sondes cassées**, enfin : Twitch qui change son markup est la panne la plus
probable de ce produit — c'est la raison d'être des sondes — et elle n'entrait
pas dans le bloc ERREURS. Elle ne se lisait que dans le tableau des sondes, qui
donne l'état de **maintenant** : un rapport pris après un rechargement réussi ne
gardait aucune trace d'un incident survenu dix minutes plus tôt.

#### Deux défauts du journal lui-même

Le dédoublonnage ne comparait qu'à la **dernière** entrée. Deux problèmes qui
alternent — un échec réseau et le repli qui le suit — se réinsèrent alors l'un
l'autre indéfiniment et vident la fenêtre en quelques secondes. Mesuré au banc :
soixante messages alternés laissaient **quarante entrées de compte 1 et zéro
survivant**. La comparaison porte désormais sur toute la liste, qui tient donc
quarante *problèmes distincts* et non quarante *événements*.

Et parce qu'une fenêtre bornée ment par omission, des **compteurs par famille**
l'accompagnent, jamais évincés, avec la première et la dernière apparition. Un
rapport pouvait montrer quatre erreurs de stockage et taire les trois cents
appels réseau échoués juste avant.

#### Ce que le premier rapport reçu a corrigé dans le journal lui-même

Il portait une ligne, et elle ne disait rien : `onglet « mobile » : stabilisé
sans carte`. L'onglet mobile de `/subscriptions` est vide pour presque tout le
monde — les abonnements achetés dans une application le sont rarement — donc
chaque rapport arborait un défaut qui n'en était pas un. **Un journal d'erreurs
qu'on apprend à ignorer ne sert plus à rien.**

Le verdict ne se rend donc plus par onglet mais à la fin du relevé, et seulement
quand les deux chiffres se contredisent : *« relevé complet sans résultat, 7
abonnement(s) déjà connu(s) »* est une panne, `0 trouvé / 0 connu` est le compte
de quelqu'un sans abonnement. Un onglet vide, lui, ne dit rien et ne s'écrit
plus.

### L'aperçu qui restait affiché (v3.68)

Rapport d'utilisateur, avec un **second écran à gauche** : l'aperçu d'une chaîne
restait à l'écran après que la souris eut quitté la fenêtre, et plus rien ne le
refermait jamais.

La cause est le garde-fou censé le protéger. Le `mouseleave` d'une carte relit
`elementFromPoint(lastMouseX, lastMouseY)` pour distinguer un vrai départ d'une
**réconciliation React** — Twitch déplace ses cartes par `appendChild`, ce qui
émet un `mouseleave` parasite alors que la souris n'a pas bougé. Or `lastMouse*`
ne bouge qu'au rythme des `mousemove` reçus, et il n'en arrive plus une fois le
pointeur hors de la fenêtre : **la dernière position connue est celle du bord**.
La barre latérale touchant le bord gauche, cette position est encore sur la
carte. Le garde-fou concluait « toujours dessus » et gardait l'aperçu ouvert.

Sortir par le bas ou par la droite ne le faisait pas — la dernière position y
tombe hors de la carte. C'est la seule direction où le garde-fou se trompe, et
c'est celle qui mène au second écran.

Le signal juste est le `mouseleave` de `<html>`, qui ne se produit que lorsque le
pointeur quitte réellement la page. Mesuré dans les trois situations qui
comptent :

| Situation | `<html>` mouseleave | Ce qu'on veut |
| --- | --- | --- |
| la souris quitte la fenêtre | **oui** | fermer |
| une carte est détachée puis rattachée, souris immobile | non | ne pas fermer |
| la souris entre dans une iframe de la page | non | ne pas fermer |

Les deux derniers comptent autant que le premier : un correctif qui fermerait
aussi sur une réconciliation aurait rendu l'aperçu inutilisable pendant que
Twitch trie sa barre, c'est-à-dire tout le temps. Le scénario 76 éprouve les
deux sens.


### Deux tables de traduction, et elles ne se croisent jamais

La barre latérale et la console sont servies par les **dix blocs `STRINGS`** de
`content.js` ; le panneau est servi par les **douze `_locales/`**, via
`chrome.i18n`. La couche de données ne transporte donc que des **noms de
champs**, jamais des libellés : c'est le panneau qui traduit. Faire transiter un
intitulé de l'une vers l'autre aurait créé une troisième table, désynchronisée
le jour de sa première modification.

`chrome.i18n.getMessage()` d'une clé inconnue **ne lève pas** : elle rend la
chaîne vide. Un libellé oublié donne donc un bouton vide, sans erreur, sans
console — et seulement dans la langue oubliée, que l'auteur ne parle pas.
`npm run parity` relève donc les clés que le panneau demande et refuse celles
qui manquent, celles qui ne servent plus, et les messages vides.

### Ce que l'audit Chrome/Firefox a trouvé (v3.69)

Le banc n'avait jamais tourné que sur Chromium, alors que le produit est publié
pour **deux** navigateurs. Tout ce qui distingue Gecko de Blink n'était donc
éprouvé nulle part, et deux dépendances à un comportement **non vérifié** s'y
étaient installées. Elles ne se réparent pas en pariant sur la bonne réponse,
mais en cessant d'avoir besoin d'une réponse.

**1. Le panneau appelait un namespace qui n'a pas les mêmes promesses.**
`chrome.runtime.sendMessage(…).catch(…)` et `chrome.tabs.query(…).then(…)`.
Chrome rend des promesses depuis MV3 ; Firefox expose `browser.*` (promesses)
**et** `chrome.*` (façade de compatibilité, à rappels). Si cette façade ne rend
rien, `.catch` s'applique à `undefined`, la fonction lève, et le panneau
n'affiche **rien** — ni section, ni rapport, ni même un message d'erreur,
puisque c'est le transport qui casse avant tout affichage. Le code emploie
désormais `browser` quand il existe : les deux chemins ont des promesses
garanties.

**2. Le service worker ne parlait qu'un seul dialecte de réponse.** Une réponse
asynchrone à `runtime.onMessage` se signale de deux façons qui s'excluent :
Chrome veut `return true` plus `sendResponse`, Firefox veut une **promesse**.
Le travail est maintenant écrit une fois, sous forme de promesse, et seul le
geste final change selon la cible.

Le scénario 77 charge le panneau sous une façade `chrome.*` **qui ne rend
rien** — l'hypothèse la pire — et exige qu'il s'affiche quand même. Le
scénario 73 exige les deux dialectes du worker. Aucun des deux ne prétend dire
ce que Firefox *fait* : ils suppriment la question.

**Ce que je n'ai pas pu faire.** Il n'y a pas de Firefox sur la machine où ceci
a été écrit, et la politique de sortie y bloque le domaine de téléchargement de
Playwright. Le verdict Gecko appartient donc à la première machine qui aura le
binaire :

```
npx playwright install firefox
npm run test-firefox        # les mêmes 1207 assertions, sous Gecko
```

Le banc choisit son moteur par `TSE_MOTEUR` (`chromium` par défaut), annonce
lequel en tête de sortie et le rappelle dans son verdict — un journal qui ne le
dit pas ne se compare à rien. Rien n'est adapté ni contourné : un échec là-bas
est un renseignement, soit sur le produit, soit sur ce que le harnais tenait
pour acquis. **Deux provocations sont les plus susceptibles de demander un
ajustement à la première passe** : la redirection servie par le harnais au
scénario 75, qui donne une origine opaque sous Blink, et la sortie de fenêtre du
scénario 76, dont l'ordre des événements de souris n'est pas garanti identique.

### Le délai d'intention du survol (v3.95)

`mouseenter` appelait `open()` sans détour. Descendre la liste pour aller
ailleurs ouvrait donc un aperçu **par carte franchie**, et chacun coûtait un
rendu, une requête `TsePreview` et un journal écrasé. Sur une barre dépliée — et
elle l'est toujours, l'extension déplie « Voir plus » à chaque chargement — un
geste ordinaire en allumait une dizaine. Le banc le chiffre : cinq cartes
traversées, **cinq requêtes**.

`PREVIEW_IFRAME_DELAY` ne couvrait rien de tout cela, contrairement à ce qu'un
commentaire égaré laissait croire : il ne retient que l'iframe, et il ne s'arme
qu'une fois le panneau ouvert et la requête partie.

#### Deux cents millisecondes, et le nombre se déduit

Une rangée de la barre mesure **42 px** — mesuré sur la géométrie de Twitch,
celle que `CSS_TWITCH` reconstruit pour les captures du Store. Un pointeur qui
descend à la vitesse *v* passe 42/*v* sur chaque carte : l'aperçu est donc filtré
pour toute traversée plus rapide que 42 / 0,2 s = **210 px/s**. Deux cent dix
pixels par seconde, c'est cinq rangées par seconde — un geste déjà lent, et tout
déplacement qui *va* quelque part est bien au-delà.

Et pas plus, parce que le coût se paie dans l'autre sens : au-delà d'un quart de
seconde environ, une réponse d'interface cesse d'être perçue comme immédiate.
150 ms laisserait passer les traversées lentes, 300 se sentirait.

#### La petite fenêtre grise (v3.95.1)

Un rapport d'usage, le jour de la sortie : **une toute petite fenêtre apparaît
juste avant l'aperçu**. C'est la `.tw-dialog-layer` de Twitch — le conteneur
React de son propre tooltip d'aperçu de carte. L'extension la masque depuis
longtemps par `body.tse-preview-active`, mais ce drapeau était posé par
`open()`.

Tant que le survol ouvrait dans l'instant, « le pointeur est entré » et
« l'aperçu est ouvert » étaient le même moment. Le délai d'intention a ouvert
entre les deux **deux dixièmes de seconde** pendant lesquels plus rien ne
masquait la modale de Twitch : elle avait tout le temps d'apparaître, seule.

Le voile suit donc désormais **l'attente** et non l'ouverture : posé à l'entrée
du pointeur, levé — avec le même retard de 500 ms qu'avant, pour laisser Twitch
refermer la sienne — dès que l'attente est abandonnée. Cette seconde moitié
n'est pas une politesse : sans elle, une simple traversée de la liste laisserait
`tse-preview-active` posé pour toujours, et le menu utilisateur comme les
paramètres cesseraient de s'afficher — ils passent par la même couche.

Trois assertions de plus au scénario 94, et elles mesurent **l'effet** plutôt
que le drapeau : une vraie `.tw-dialog-layer` est injectée, et c'est le `display`
que le navigateur lui calcule qui est lu. Vérifier la présence de la classe
aurait dit que l'intention est là, pas que la règle mord.

Ce masquage n'avait **jamais été éprouvé** — aucun décor du banc ne portait de
`.tw-dialog-layer`. C'est exactement pourquoi la régression est passée.

#### Quatre façons d'abandonner l'attente, et elles se cassent séparément

Une carte est « en attente » entre l'entrée du pointeur et l'ouverture. Ce
nouvel état a exigé de reprendre **tous** les chemins d'annulation, parce que
chacun se gardait par `card !== currentCard` — une carte encore en attente n'y
était reconnue par personne :

| Chemin | Ce qui serait arrivé sans la reprise |
| --- | --- |
| le pointeur quitte la carte | le minuteur courait, l'aperçu s'ouvrait **après** le départ |
| le pointeur quitte la fenêtre | idem, et plus aucun événement ne serait venu le refermer |
| l'onglet passe en arrière-plan | un aperçu, et une requête, sur un écran que personne ne regarde |
| la carte quitte le DOM | un minuteur tenant une carte morte |

Le premier est le pire des quatre : il ouvrait l'aperçu **plus tard** que le
défaut qu'on répare, et sur une carte que l'utilisateur ne désigne plus.

#### Ce que le rapport en dit

Le bloc `SURVOL — DÉLAI D'INTENTION` du panneau porte `armes` (les entrées du
pointeur) et `ouverts` (celles qui ont tenu les 200 ms). Leur écart est le
nombre d'aperçus — et de requêtes — que le filtre a épargnés, et leur rapport
est le seul moyen de savoir, sur de vraies machines, si le nombre est juste :
`ouverts` à zéro dirait qu'il est trop long, `ouverts == armes` qu'il ne sert à
rien.

#### Le scénario 94, et ce qu'il ne prouve pas

Il survole avec un **vrai pointeur** (`page.mouse.move`) et non des `MouseEvent`
fabriqués : c'est le navigateur qui doit décider quelles cartes sont entrées et
quittées. Le prix s'est payé tout de suite — le voile de chargement couvre la
barre, un vrai pointeur ne le traverse pas, et les cinq premières assertions
passaient sans avoir rien survolé. Il faut attendre que le voile se lève.

Deux gardes restent en revanche **hors de portée du banc**, et c'est écrit dans
le scénario plutôt que masqué par une assertion complaisante. L'attente est
protégée contre la réconciliation React par le test anti-fantôme du `mouseleave`
et par un `card === pendingCard` à l'entrée. Or, mesuré sur ce moteur, pointeur
immobile au centre d'une carte :

| Remaniement du DOM | Événements émis |
| --- | --- |
| `parentElement.appendChild(carte)` | *aucun* |
| `remove()` puis `append()`, même tâche | *aucun* |
| `remove()`, deux images, `append()` | `enter` seul |
| `display:none` puis retour | `leave` puis `enter` |

C'est la **première** forme que produisent Twitch et `applySorting`, et elle
n'émet rien : il n'y a pas de fantôme à absorber. Les deux gardes restent — ils
coûtent une ligne chacun et la quatrième forme, elle, existe — mais aucune
assertion ne prétendra les éprouver. Le même relevé montre que l'assertion « une
carte détachée puis rattachée ne referme pas l'aperçu » du scénario 76 ne touche
rien non plus.

## Le mode d'emploi (v3.98)

L'extension n'a aucun réglage. Pas d'options, pas d'interrupteurs, pas de
compte : elle travaille dès le premier rechargement de Twitch, et c'est un parti
pris qui tient depuis la première version. Ce qui lui manquait n'était donc pas
un écran de préférences — c'était **la liste de ce qui existe**.

Une bonne moitié de ce que le produit ajoute ne se découvre qu'en posant le
pointeur au bon endroit : les douze badges de l'aperçu, la frise des catégories,
la pastille de jour d'un subathon, le tri qui regroupe les co-streams. Rien,
nulle part, ne disait de le faire. La fiche du magasin le dit — mais on la lit
une fois, avant d'installer, et jamais après.

### Pourquoi c'est la première page

`courante` est amorcée sur `SECTIONS[0]` : mettre ce chapitre en tête de la
table suffit à en faire la page d'accueil, sans cas particulier au démarrage.

C'est la seconde propriété qui compte vraiment : **cette vue ne demande rien à
la page**. Les onze autres sections passent par le pont, donc par un onglet
Twitch au premier plan ; et quelqu'un qui vient d'installer l'extension, puis
clique sur son icône, n'en a pas forcément un. La première phrase qu'il aurait
lue était « ouvrez un onglet twitch.tv et revenez au premier plan » — un panneau
qui commence par un reproche, pour un produit qu'on vient d'installer.

D'où le drapeau `statique`, seul de cette table, et le court-circuit qui va avec :

```js
if (section.statique) { montrerGuide(); return; }
```

Il est posé **avant** `montrerMessage('stateLoading')`. Et le rangement du guide
l'est **à l'entrée** de `charger`, pas à chacune de ses sorties : une section de
données peut finir en tableau, en dessin, en « rien à afficher » ou en échec de
transport — quatre sorties, qu'il aurait fallu penser à couvrir une par une.

### Treize chapitres, et des exemples dessinés

Une pastille dorée, un ruban de catégories, une barre violette qui respire : ces
choses-là se reconnaissent à l'œil et se racontent mal. Chaque chapitre porte
donc une **maquette** — la géométrie et la palette de la barre latérale, à
l'échelle du panneau — et le texte dit la même chose en toutes lettres juste en
dessous. Les maquettes sont `aria-hidden`, comme la frise et la grille du
rythme : la forme pour l'œil, le texte pour l'information.

La carte de la barre latérale est une seule maquette paramétrée, que six
chapitres se partagent en n'en changeant qu'un détail — la durée, la pastille de
jour, le compteur de collab, la barre violette, l'or de l'abonnement. Six copies
auraient fini par ne plus se ressembler.

Deux règles de décor, et aucune n'est décorative :

- **les noms de chaînes sont inventés.** Citer de vrais streamers dans une
  maquette les ferait paraître partenaires de l'extension, ce qu'ils ne sont
  pas. C'est déjà la règle des captures de la fiche ;
- **les catégories sont prises parmi celles que Twitch ne traduit pas.** « Just
  Chatting » devient « Discussions » en français, et une maquette qui
  l'afficherait en anglais au milieu d'un texte français se lirait comme un
  oubli de traduction. Les noms de jeux, eux, sont les mêmes dans les douze
  langues.

La palette des badges est **recopiée** dans la feuille du panneau, teinte
pour teinte. C'est la même frontière que pour les libellés : cette page n'a pas
le CSS de `content.js`, qui vit dans la barre latérale de Twitch. Les rapprocher
les rendrait indistincts justement là où on les explique.

### Un message par chapitre, retours à la ligne compris

Le corps d'un chapitre est **une seule clé de traduction** ; ses lignes qui
commencent par « • » deviennent des puces, les autres des paragraphes. Découper
chaque puce en sa propre clé aurait donné cent soixante entrées de plus dans
douze fichiers — et surtout aurait figé le NOMBRE de puces, alors qu'une langue
a parfois besoin de deux phrases là où le français en met une.

Quarante-cinq clés nouvelles, douze fiches : cinq cent quarante messages. Quinze
d'entre elles sont des libellés que le produit affiche déjà — les douze badges, le
compteur « Terminé », la pastille de jour, le nom de l'onglet — et elles ont été
**recopiées de `STRINGS`**, mot pour mot, langue par langue. Le panneau ne peut
pas lire `STRINGS` (deux surfaces, deux tables, aucun libellé qui transite),
mais rien n'obligeait à réinventer la traduction : une maquette doit montrer ce
que l'utilisateur verra, pas une paraphrase.

`tests/parity.mjs` reconnaît ces clés parce que son expression de préfixes a
gagné `guide`. Une clé qui ne suit pas la convention n'est jamais relevée comme
« demandée » — elle passerait donc pour orpheline, et le contrôle la déclarerait
morte alors qu'elle s'affiche.

### Ce que le scénario 96 attrape

Le panneau n'était éprouvé que par son **contrat de données** : le scénario 69
vérifie que la page rend les colonnes que `panneau.js` sait peindre, le scénario
70 mesure la page rendue, et la parité vérifie que chaque clé demandée existe
dans les douze fiches. Aucun des trois ne regardait le texte affiché.

Or un mode d'emploi de treize chapitres est exactement le genre de chose qui se
casse en silence. `chrome.i18n.getMessage` d'une clé inconnue ne lève pas : elle
rend la chaîne vide, et `T()` retombe alors sur le **nom de la clé**, qui
s'affiche en clair au milieu d'un paragraphe — sans erreur, sans console, et
seulement dans la langue oubliée.

Le scénario ouvre donc `panneau.html` pour de vrai, avec un `chrome` de
substitution qui lit les **vraies** fiches de `_locales` et n'a **aucun onglet**
à offrir : le cas de figure exact que cette vue existe pour couvrir. Onze
assertions, chacune tuée par au moins un mutant.

| Mutant | Assertions qui tombent |
| --- | --- |
| le guide n'est plus `SECTIONS[0]` | 5 |
| pas de court-circuit : le guide passe par le pont | 5 |
| le guide ne se range pas en partant | 1 |
| une clé de chapitre mal orthographiée | 2 |
| les puces ne sont plus des puces | 2 |
| « reprise » gagne une couleur à lui | 1 |
| un badge perd sa teinte et garde celle par défaut | 1 |
| l'arc-en-ciel du subathon ne court plus | 1 |
| les maquettes se lisent à voix haute | 1 |
| le guide ne défile plus pour son compte | 1 |
| un chapitre disparaît de la table | 3 |
| un libellé japonais est vide | 1 |

Le compteur d'appels à `tabs.query` est le vrai sujet de la deuxième assertion :
il dit si cette vue a demandé quoi que ce soit au navigateur. C'est la première
chose que fait `demander`, avant même d'envoyer quoi que ce soit au service
worker — un court-circuit oublié se voit donc là, et nulle part ailleurs.

Deux mutants ont demandé une assertion plus forte que celle d'abord écrite.
« Dix badges, neuf couleurs » ne voyait pas qu'un badge avait perdu la sienne :
une teinte fausse reste une teinte, et le compte des teintes distinctes ne
bougeait pas. L'assertion mesure donc aussi la couleur d'un badge **sans
modificateur**, posée dans la page puis retirée — c'est la valeur que prend un
badge dont la règle n'a pas pris, et le seul défaut de palette qui arrive
vraiment.

**Ce que ce scénario ne prouve pas.** Il lit `panneau.js` tel qu'il est dans le
dépôt, commentaires compris : `tests/build.mjs` ne dégraisse que `content.js` et
`adblock.js`. La version livrée du panneau reste couverte par l'égalité des flux
de jetons vérifiée à l'assemblage — qui est une affirmation sur la grammaire, et
non sur le comportement.

### Deux scénarios voisins que le changement a déplacés

Le rail porte une section et un groupe de plus : le scénario 70 les compte, et
son attente en dit la raison. Il commençait aussi par attendre un tableau au
chargement, qui n'arrive plus — il va donc chercher une section de données avant
de mesurer la mise en page.

Le scénario 77, lui, éprouve le transport sous la façade `chrome.*` de Firefox.
Il lisait « la première section affiche ses lignes » ; la première section ne
traverse plus le pont. Il demande désormais une section de données par son nom,
ce qui rend l'assertion plus franche qu'avant : elle nomme ce qu'elle vérifie au
lieu de compter sur l'ordre du rail.

## La reprise après coupure (v3.97)

`createdAt` mesure la **session**, pas le direct. Un streamer qui perd sa
connexion et revient repart de zéro : la carte affiche « 2m », et la barre
violette « vient de démarrer » s'allume sur un live qui en est à sa sixième
heure.

Ce n'était pas une information approximative. C'était **la seule du produit qui
affirmait le contraire de la vérité** : « tu n'es pas en retard » à quelqu'un
qui l'est complètement. Le reste de l'extension avoue ce qu'elle ignore — la
frise fond ses couleurs, les durées portent un « ~ » ; ici elle affirmait, et
elle se trompait.

### Le complément exact du badge de basculement

Le registre des basculements exige `memeSession` : même identifiant de stream
des deux côtés. La reprise est son complément — l'identifiant a **changé**, et
pas parce que la chaîne vient d'ouvrir.

Il faut pour cela une mémoire à part, et c'est le seul point délicat : le cache
perd `stream` dès que la chaîne coupe, si bien qu'au moment où le nouveau direct
paraît, l'entrée précédente ne porte plus l'identifiant de l'ancien. On retient
donc hors du cache, par login, le dernier direct **vu en ligne** et l'instant de
cette vue. Cette mémoire-là survit à la coupure ; et elle ne se met à jour que
sur une observation en ligne, parce que c'est précisément pendant que la chaîne
est coupée qu'il faut se souvenir de ce qu'elle diffusait juste avant.

### Trois conditions, trois questions

| Condition | Ce qu'elle écarte |
| --- | --- |
| l'identifiant de stream a changé | un simple relevé de la même session |
| l'ancien était en ligne il y a moins de 10 min | un direct d'hier, ou une vraie nouvelle diffusion |
| le nouveau a moins de 10 min | un direct qui revient avec déjà des heures au compteur |

La troisième borne le dégât : **on ne marque jamais une reprise qu'on ne serait
pas en train de réparer**. Si le compteur n'est pas reparti de zéro, il n'y a
rien à corriger, donc rien à annoncer.

### Le badge, et pourquoi il n'a pas de couleur à lui

C'est la même espèce de nouvelle que « Vient de passer sur … » — *voilà ce qui
vient de se passer sur ce live* — et il porte donc la classe `--switch`, qui est
ce vert-là. Le scénario 60 exige qu'un **type** de badge ait une teinte
distincte ; en inventer une seconde pour la même famille de nouvelle irait
contre ce qu'il protège. La classe `--reprise` ne porte aucune couleur : elle
nomme la chose, pour le DOM et pour le banc.

Il passe en revanche **devant** le basculement : une reprise explique la carte
tout entière — le compteur reparti de zéro, la barre qui ne s'allume pas — là où
un changement de catégorie n'explique qu'une ligne.

### Le scénario 95, et son décor qui mentait

Quatre cas, et il faut les quatre : deux disent ce que la règle doit attraper,
deux ce qu'elle ne doit pas. Le sur-déclenchement coûterait le plus cher — un
badge « reprise » sur une chaîne qui vient réellement d'ouvrir serait pire que
pas de badge du tout.

La première rédaction du cas « coupure longue » ne coupait rien : elle attendait
au-delà du seuil **en laissant la chaîne en ligne**, puis changeait son
identifiant. Or la mémoire du dernier direct se rafraîchit à chaque relevé tant
que la chaîne émet — l'écart mesuré restait donc celui d'un relevé, et le test
annonçait une coupure longue sans en avoir produit aucune. C'est le décor qui
était faux, pas la règle : elle avait raison d'y voir une reprise.

Quatre mutants, quatre gardes, quatre assertions distinctes qui tombent —
et celui qui retire la correction de la barre reproduit exactement le défaut
d'origine : `frais: true` sur un direct de six heures.

### L'origine du direct, et où elle se lit (v3.98, déplacée en v3.99)

La 3.97 a empêché la barre violette de mentir. Elle laissait le compteur le
faire : « 2m » sur un direct qui en est à sa sixième heure, parce que
`createdAt` est celui du **tronçon** et non du direct.

La mémoire par login porte donc une troisième valeur, l'**origine** — le
`createdAt` du premier tronçon de la chaîne :

```js
const debutReel = (login, createdAt) => {
  const m = derniersDirects.get(login);
  return (m && m.origine) || createdAt;
};
```

L'origine se transmet de tronçon en tronçon tant que les reprises s'enchaînent ;
une coupure longue la remet à celle du nouveau direct. C'est la même borne que
le badge, et pour la même raison : au-delà de dix minutes, ce n'est plus le même
direct, et il n'y a plus rien à raccorder.

**Une sonde a trouvé le défaut que la relecture n'avait pas vu.** La première
écriture recalculait `origine` à chaque relevé : la valeur ne survivait qu'un
cycle, et le compteur retombait sur le tronçon trente secondes plus tard. Rien
ne le montrait à l'œil — il faut regarder deux relevés de suite pour s'en
apercevoir, et le premier est juste. Un champ temporaire ajouté au rapport a
rendu la chose lisible en une lecture ; la correction tient dans la distinction
entre « même session » et « session neuve » :

```js
const memeSession = memoire && memoire.id === neuf.id;
let origine = memeSession ? (memoire.origine || neuf.createdAt) : neuf.createdAt;
```

**OÙ CETTE ORIGINE SE LIT A CHANGÉ À LA VERSION SUIVANTE.** La 3.98 l'écrivait
dans `tseStartedAt`, c'est-à-dire sur la carte : le compteur y affichait alors la
durée du direct entier. La 3.99 l'a ramenée là où elle a de la place — en tête
de la frise, dans l'aperçu — et a rendu à la carte la durée de la SESSION, celle
que Twitch sert. La section suivante dit pourquoi, et ce que la frise en fait.
Le mécanisme décrit ici, lui, n'a pas bougé d'une ligne : c'est son point de
sortie qui a déménagé.

Un sous-test qui modélisait un cas impossible — un direct qui rajeunit sans
changer d'identifiant — a été remplacé au passage par le cas ordinaire qu'il
fallait vraiment garder : **une chaîne qui passe en direct pour la première fois
doit garder sa barre « vient de démarrer »**.

## Une session qui maigrit n'est pas une session qui finit (v4.14.2)

### Le rapport disait vrai, et il ne pouvait pas désigner le coupable

```
pool 707 · threshold 978 · evicted 0 · creux 0 · sansReserve 0 · misses 6
```

Aucun chemin de retrait n'avait servi. Et pourtant, d'une capture à l'autre à
une minute d'intervalle : un groupe de **cinq** co-streamers « Valheim, 4 k »
tombé à **deux**, un groupe de **quatre** « WARDOGS, 1,9 k » tombé à **un**.

**Ce sont les captures qui portent la preuve, pas le rapport.** La pastille d'un
survivant passe de « 4 » à « 2 ». Son compteur passe de 1,9 k à 1,7 k. La
session n'avait pas disparu — elle avait **maigri**, dans le cache.

### Le chemin, dans l'ordre

| | ce qui se passe |
| --- | --- |
| 1 | le lot Guest Star rend une **liste d'invités plus courte** |
| 2 | `flushGuestStar` l'écrivait telle quelle — et pour les chaînes dont la réponse ne portait plus rien, il écrivait « pas de session » : mates vidés, combiné à `null`, hôte à `null` |
| 3 | le lot de chaînes suivant lit `getCollabViewers` à `null` et `getHostId` à `null`, et écrit donc le compteur **propre** : trois cents spectateurs là où le combiné en affichait quatre mille |
| 4 | la carte sort du top 30 — **sans être évincée, sans creux, sans rien** |

L'intention d'origine était juste : écrire toutes les chaînes demandées « pour
ne pas les redemander en boucle pendant la durée du TTL ». L'effet de bord ne
l'était pas.

### Pourquoi la garde de signature ne pouvait pas l'arrêter

Elle protège les compteurs **partagés** par au moins deux entrées. Or le
combiné rétréci est écrit **avec autorité** — c'est le combiné, il fait foi —
donc il baisse le compteur d'un membre. Les autres cessent alors de partager sa
valeur, `combines` ne les reconnaît plus, et **la garde se relâche au moment
précis où elle servirait**.

C'est une cascade, et elle s'arrête d'elle-même quand il ne reste qu'un ou deux
membres à partager la valeur. C'est exactement ce que les deux captures
montrent : cinq → deux, quatre → un.

### Le correctif

**Même discipline que `OFFLINE_CONFIRM` et `GLOBAL_MISS_CONFIRM`**, pour la
troisième fois : une réponse qui ne porte pas la session ne prouve pas que la
session est finie. La liste d'invités ne **diminue** qu'après
`GUEST_STAR_DROP_CONFIRM` réponses concordantes. Elle **grandit** sans délai —
une arrivée est toujours crue sur parole, et ne peut rien faire disparaître.

Le `ts` est rafraîchi : l'entrée reste servie par le *stale-while-revalidate* de
`getHostId`, qui était jusqu'ici **défait par son propre écrivain**.

Et le combiné frais de la chaîne **interrogée** est pris quand même : c'est la
seule chose de cette réponse qui porte sur elle, et la refuser figerait le
compteur d'une session qui rétrécit pour de bon.

### Quatre compteurs de plus, parce qu'aucun ne pouvait montrer ce chemin

Un rapport complet ne désignait rien. C'est le défaut du rapport autant que du
code, et il est corrigé aussi :

| compteur | ce qu'il dit |
| --- | --- |
| `gardees` / `lachees` | une session a été **gardée** malgré une réponse vide ou plus courte / relâchée après trois réponses concordantes |
| `chutes` / `chuteMax` | le classement a reçu, pour une chaîne, un compteur **plus petit** que celui qu'elle portait — et de combien |
| `chutesHorsEcran` | la chute a fait passer la chaîne **de l'écran au néant** : c'est la seule qui se voie |
| `sousLaCoupe` | un membre de session est **dans le pool** mais sous le trentième rang |

Ce dernier corrige **mon propre instrument** : le bilan rangeait sous
`horsClassement` tout membre absent du top 30, ce qui confond une chaîne que la
marche ne connaît pas et une chaîne parfaitement connue, retombée au rang
cinquante parce qu'elle a perdu son combiné. Un rapport disait
« horsClassement 9 » et j'ai lu « neuf inconnues », alors que c'était le second
cas — **celui qui désignait le défaut**.

### Ce que le banc mesure

| mutant | résultat |
| --- | --- |
| la garde retirée | `pastilles: []` — **les deux sessions détruites**, `gardees 0` |
| le correctif en place | `pastilles: ["1","1"]`, `unbb:4000` tenu, `gardees 2` |

**Deux pièges du décor**, tous deux rencontrés :

- **les logins sont minusculés** par `loginFromHref` : un décor écrit `duoA`
  produit une carte `duoa`, et `getGuestStarMates` ne trouve plus la session.
  Le même piège avait déjà coûté trois assertions au scénario 129 ;
- **il faut attendre plus que `GUEST_STAR_TTL`**, sinon aucun lot ne repart et
  le décor ne joue rien. Le premier jet attendait six secondes et était vert
  pour rien.

## Un pool sans réserve évince ce que rien ne remplace (v4.14.1)

### Deux rapports à quatre-vingt-cinq secondes d'intervalle

Le premier, la liste entière en place :

```
pool 223 · threshold 959 · evicted 0
```

Le second, pris juste après un changement de langue, un groupe de co-stream de
trois chaînes disparu de l'affichage :

```
pool 29 · threshold 0 · evicted 7 · walks 6 · light 6
```

**Le pool est passé de 223 à 29**, et c'est cet écart-là qui nomme le défaut.

### La chaîne de causes, et elle est entièrement mécanique

| | ce qui se passe |
| --- | --- |
| 1 | un changement de langue emprunte **la voie du tag**, qui repart d'un pool **vide** — les chaînes portées ne sont pas celles de la nouvelle langue |
| 2 | cette voie le remplit avec la réponse du tag, **plafonnée par l'API à `GLOBAL_TAG_MAX` = 30**. Le pool a donc exactement la profondeur de ce qu'il affiche |
| 3 | `nthViewers` rend **zéro** quand le pool est plus court que le top : il n'y a pas de trentième rang. `threshold` vaut 0 |
| 4 | la passe légère ne s'élargit que `if (threshold > 0)` — elle ne s'élargit donc **jamais**, et ne visite plus que ses dix catégories d'amorce |
| 5 | dans ce pool, **le plancher de réponse ne protège plus personne** : il dit « sous ce compteur, la réponse s'était arrêtée », et il n'y a personne en dessous |

L'échantillonnage de Twitch — mesuré et documenté dans ce fichier depuis
longtemps, « rubius présent quatre fois sur six » — compte alors comme une
vraie absence. **Trois passes, et la chaîne est évincée, sans rien derrière
pour la remplacer.**

Le pool restait à plat **cent cinquante secondes**, jusqu'à la marche complète
suivante.

### Pourquoi ce sont les co-streams qui partent, et en groupe

Deux propriétés structurelles se combinent :

- leurs membres portent tous le compteur **combiné** — un nombre haut, donc
  **toujours au-dessus du plancher** ;
- le répertoire range volontiers la session **sous un seul participant**.

Les autres sont donc absents tout en ayant l'air d'avoir dû y être. Les trois
prennent leurs absences ensemble, et disparaissent ensemble. C'est exactement
ce que le terrain décrivait : « y'a encore des co-streams qui disparaissent
quand y'a une update de la liste ».

### Le correctif, en deux moitiés qui se mesurent séparément

**1. La couche structurelle ne rétrécit plus l'affichage.** Même raisonnement
que le plancher, un cran plus haut : le plancher suppose un pool **plus
profond** que la réponse, sans quoi il ne protège personne. Le retrait est donc
refusé tant que le pool ne dépasse pas `topN + GLOBAL_MISS_CONFIRM`.

**La marge se déduit, elle n'est pas choisie.** Une passe peut évincer autant
d'entrées qu'il y en a qui viennent d'atteindre leur troisième absence —
mesuré : **cinq d'un coup sur un pool de trente et un**, l'écran tombé à
vingt-six. Exiger que le pool dépasse l'affichage d'au moins ce que la
confirmation peut retirer en une fois, c'est refuser de décider quand la
profondeur est dans le bruit de l'échantillonnage.

**La garde est au RETRAIT, pas au constat** : les absences continuent d'être
comptées, et redeviennent décisives dès que le pool s'est recreusé. Et rien
n'est perdu pour autant — ce qui est affiché porte une carte, que la file
`TseChannels` rafraîchit toutes les trente secondes : une chaîne réellement
terminée disparaît par là, tout de suite. `GLOBAL_PRUNE_AGE` reste la seconde
soupape.

**2. La passe légère recreuse.** Le seuil à zéro était traité comme le cas
neutre ; c'est le cas **dangereux**. Sans réserve, la passe visite
`GLOBAL_WIDEN_CATEGORIES` catégories de plus — borné des deux côtés, pour
qu'une passe légère reste une passe légère.

Sans la seconde, la première se contenterait de **figer** un pool à plat.

### Et le refus se compte

`sansReserve` rejoint `sousPlancher` et `creux` au rapport. C'est le troisième
compteur de la même famille, et la même leçon pour la troisième fois : le
premier rapport disait « evicted 0 » pendant que des chaînes disparaissaient,
parce que **le nombre qui aurait tout dit n'existait pas**.

### Ce que le banc mesure

Le scénario 138 rejoue la séquence exacte : descente profonde, changement de
langue, puis des passes où le trio est absent du répertoire.

| mutant | ce qu'on mesure |
| --- | --- |
| l'éviction sans réserve remise | `pool 29 → 26`, **`evicted 3`, `misses 9`** — le groupe entier disparaît |
| le correctif en place | `pool 29 → 31`, `evicted 0`, `sansReserve 40`, **les trois tiennent** |

**Deux pièges du décor, et ils ont tous deux failli rendre le scénario vert
pour rien :**

- **vingt-neuf, pas trente.** À trente pile, `nthViewers` rend 2 100 et la garde
  ne se déclenche jamais. Le terrain avait 29 — une entrée écartée par
  `readStream`, un empileur de tags — et c'est ce 29 qui met le seuil à zéro.
  Le premier jet posait trente et ne reproduisait rien.
- **le menu de langue n'offre que ce que le pool contient.** Sans deux chaînes
  françaises dans la descente, l'option n'existe pas et le clic tombe dans le
  vide. Le scénario **constate** désormais que le clic a porté.

## Moins de règles, une boucle qui se referme, un mode d'emploi refait (v4.14.0)

Quatre demandes, arrivées ensemble. Elles ne se ressemblent pas, mais trois
d'entre elles ont la même forme : **du code en moins**, et une assertion qui
devait changer de sens plutôt que disparaître.

### 1. Le bloc « mouvement réduit » est retiré

**158 lignes, 12 règles, 73 sélecteurs, un seul bloc `@media
(prefers-reduced-motion: reduce)`.** Il arrêtait ou ralentissait chaque animation de l'extension quand le
système déclarait vouloir moins de mouvement.

Demandé ainsi, capture à l'appui :

> « J'aimerais que tu enlèves le CSS qui réduit les animations sur Chrome. Car
> sur Firefox, il n'y est pas et c'est parfait selon moi. »

Les deux moutures ne rendaient pas la même chose parce qu'**une seule portait ce
bloc**. Mises côte à côte, c'est celle qui n'en avait pas qui a été retenue.

**Ce que ça coûte, et il faut le dire :** qui demande moins de mouvement à son
système ne l'obtient plus ici. Le filet existe ailleurs, et il est plus précis —
les **dix-neuf réglages** du panneau éteignent chaque décoration une par une,
sans dépendre d'un réglage système que tous les navigateurs ne relaient pas.

Trois conséquences ont été attrapées par des contrats déjà en place :

| ce qui a bougé | pourquoi |
| --- | --- |
| les douze fiches perdent leur puce « le réglage “réduire les animations” est respecté » | `tests/store.mjs` lie chaque promesse de fiche à une ancre dans le code ; l'ancre part, la promesse part |
| le verdict du battement perd sa quatrième branche | elle nommait un régime qui n'existe plus |
| `mouvementReduit` reste au rapport | c'est une **lecture** de l'environnement, pas une promesse |

#### Les assertions ne sont pas effacées, elles sont retournées

Onze assertions du banc mesuraient l'arrêt ou le ralentissement. Les supprimer
aurait laissé le trou ouvert — et ce trou a déjà servi : en v4.9, deux
arcs-en-ciel passaient **à travers** ce réglage, l'un par spécificité, l'autre
par ordre de feuille, sans que rien ne le dise.

Elles mesurent donc maintenant l'**invariance** : deux relevés, l'un sous
`reduce`, l'autre sous `no-preference`, et l'exigence qu'ils soient identiques.
C'est strictement plus fort que l'ancienne forme, parce que l'égalité tombe dans
les **deux** sens.

| scénario | ce qui est comparé |
| --- | --- |
| 51 — carte abonnée | les neuf mesures du décor, fond, nom, catégorie, avatar et halo compris |
| 113 — battement du stream frais | la cadence à la milliseconde, l'amplitude en opacité **et en largeur** |
| 114 — arcs-en-ciel du subathon | les deux durées à l'identique, et la teinte qui dérive des deux côtés |
| 123 — battement de la roue | le nom, la durée, la transition au survol, et l'amplitude balayée sur un cycle |

Chacune se double d'une assertion de vivacité : l'égalité seule serait vraie
aussi si tout était éteint des deux côtés.

#### Le panneau en avait un deuxième, et il mentait

`content.js` n'était pas le seul porteur. `panneau.css` avait **deux** blocs
`prefers-reduced-motion`, et le second gardait deux exceptions annoncées en
toutes lettres :

> « DEUX EXCEPTIONS, ET CE SONT CELLES DU PRODUIT. […] Les valeurs sont celles
> de `content.js`, à l'identique. »

Elles ne l'étaient plus : le bloc de `content.js` venait de partir. Un battement
calme et un arc-en-ciel ralenti dans les **maquettes**, un battement plein et un
arc-en-ciel vif dans le **produit** qu'elles sont censées montrer.

C'est plus grave ici qu'ailleurs. Une maquette n'a qu'un métier : montrer ce que
le produit fait. Elle ne peut pas garder un régime que le produit a perdu — elle
n'explique plus, elle contredit. Les deux blocs sont donc partis aussi, et
l'assertion de la maquette est devenue une invariance comme les autres.

**Ce bloc avait déjà été pris en défaut une fois**, et pour une raison qui vaut
d'être retenue : il s'annonçait exhaustif avec `* { animation: none !important }`,
alors que le sélecteur universel désigne des **éléments** — `::before` et
`::after` n'en sont pas. La barre violette de la maquette, un `::before`,
continuait de battre. Le même audit avait trouvé le même trou dans le produit le
même jour.

**Un défaut de banc trouvé au passage.** Le scénario 114 attendait **1 500 ms**
entre ses deux échantillons de couleur — une valeur choisie du temps où le cycle
réduit durait huit secondes. À pleine cadence, le cycle dure **exactement
1,5 s** : les deux échantillons retombaient sur la même teinte, et l'assertion
tombait pour une raison qui n'avait rien à voir avec ce qu'elle mesure. Une
attente commensurable au cycle qu'elle mesure ne mesure rien. Ramenée à 500 ms,
un tiers de tour.

### 2. La lueur de fond boucle enfin

Signalé dans la même demande :

> « Sur Firefox, j'aimerais que les effets CSS soient parfaitement bouclés, ce
> qui n'est pas le cas sur le fond de ce type de carte. »

Le fond de la carte abonnée porte **quatre nappes** et tourne en quinze
secondes. Trois d'entre elles n'arrivaient pas là où elles partaient :

```
0%   → 0% 50%, 100% 50%, 40% 50%
100% → 100% 50%,  0% 50%, 62% 50%
```

Avec un fond qui ne se répète pas, `0 %` et `100 %` sont **deux points
différents de la carte**. Quinze secondes de dérive lente, puis un saut sec.

La quatrième nappe, elle, bouclait déjà — le remède était posé juste à côté du
défaut. Chaque nappe fait désormais un **aller-retour** : elle s'éloigne, puis
revient à son point de départ avant la fin du cycle.

Mesuré, entre la dernière image et la première : **0,0101 %** d'écart, contre
100 % avant. Ce résidu est de la virgule flottante, pas une couture.

#### Ce qui ne bouclait pas n'était tenu par rien

Le banc mesurait la couleur de ce décor, sa vitesse, son plan d'empilement — et
jamais sa **couture**, qui n'existe qu'à une image du cycle et qu'aucune capture
ne montre. Le scénario 137 la mesure, et il ne tient **aucune liste** : il
demande à chaque animation quelles propriétés elle touche, par `getKeyframes()`,
et compare le rendu à la première et à la dernière image. Une animation ajoutée
demain est couverte sans qu'on y pense.

Deux valeurs diffèrent pourtant aux deux bouts, et ce ne sont pas des coutures.
Elles ne sont pas inscrites sur une liste d'exemptions — elles sont **calculées**,
en pixels rendus :

| ce qui diffère | ce que le banc calcule pour l'admettre |
| --- | --- |
| le balayage, de 210 % à −110 % | à sa propre taille de fond et à la largeur de la boîte : l'image occupe `[2780, 6572]` px puis `[−5308, −1516]` px, et la boîte fait `[0, 1264]` — le retour se fait entièrement hors cadre |
| l'or du nom, de 0 % à 300 % | la tuile fait 300 %, le fond se répète, et les deux bords de la tuile portent la même couleur (`rgb(255, 200, 110)`) — le pas vaut exactement une tuile |

Le jour où l'un des deux cesse d'être vrai, il tombe du côté des coutures.

### 3. La croix des panneaux est retirée

> « J'aimerais que tu retires le X des panneaux. »

Restent les deux sorties d'une modale ordinaire, qui étaient déjà là : **Échap**,
et le **clic hors du cadre**. Le chapitre 1 du mode d'emploi les nomme
maintenant, ce qui n'était pas nécessaire tant que la croix était visible.

Les quatre assertions qui mesuraient la croix ne sont pas effacées : **l'absence
de croix est le contrat**, et le cadre ne doit porter que son iframe.

### 4. Le mode d'emploi, refait

> « Je veux le meilleur mode d'emploi possible. […] Apporte seulement les infos
> dont l'utilisateur sera confronté sur l'extension. »

**Il se contredisait.** Il affirmait « l'extension n'a aucun réglage », démenti
par la section **Réglages** du même panneau, deux boutons plus bas.

**L'ordre était celui d'un développeur, pas d'un utilisateur.** Il commençait par
l'aperçu au survol — c'est-à-dire par un **geste** — alors qu'on voit d'abord la
barre latérale sans rien faire.

Quinze chapitres, remis dans l'ordre de la rencontre : ce qui s'impose à l'œil,
puis ce qu'on déclenche, puis ce qu'on règle.

| | chapitre | |
| --- | --- | --- |
| 1 | La roue, et ce panneau | **nouveau** — par où l'on entre, et comment on referme |
| 2 | Plus rapide que Twitch, et plus propre | |
| 3 | Depuis combien de temps il diffuse | |
| 4 | Les débuts, et les reprises | |
| 5 | Vos abonnements, en or | |
| 6 | Les co-streams | |
| 7 | Les subathons | |
| 8 | L'aperçu au survol | ce qui ouvrait le guide |
| 9 | Les badges de l'aperçu | |
| 10 | Précédemment sur ce live | |
| 11 | Trier et filtrer | |
| 12 | Top Chaînes | |
| 13 | Tout se règle, et tout se coupe | **nouveau** — ce qui manquait, et qui commande le reste |
| 14 | Ce panneau | |
| 15 | Vie privée, en clair | |

Les deux chapitres neufs valent **quatre clés** de plus par langue, et deux clés
réécrites — l'introduction, et le chapitre du panneau. **Douze langues**, soit
240 clés par fiche.

#### Trois erreurs trouvées en relisant le guide, pas le code

Le remaniement de l'ordre en a produit deux, et la troisième dormait depuis
plus longtemps. Aucune n'était visible en relisant une traduction : il faut
avoir le texte et le produit sous les yeux **en même temps**.

**1. Un renvoi qui pointait deux chapitres trop haut.** Le chapitre des
co-streams renvoie aux tris par son numéro. Ce numéro était recopié en toutes
lettres dans les douze fiches — « chapitre 9 » — et l'ordre remanié l'a laissé
désigner « Les badges de l'aperçu », **dans les douze langues à la fois**. Une
traduction parfaitement juste peut porter un renvoi faux.

Il ne se recopie plus : c'est une substitution `$1`, et `construireGuide`
cherche le rang du chapitre visé dans la table au moment du rendu. Le prochain
remaniement le corrigera tout seul.

**2. Le chapitre du panneau énumérait les sections dans un ordre que le rail
n'a jamais eu** — « Top Chaînes » avant « Diagnostic », alors que le rail les
affiche dans l'autre sens. Et dans **sept fiches sur douze**, au moins un des
cinq groupes était nommé autrement que le bouton à cliquer :

| fiche | le guide disait | le rail affiche |
| --- | --- | --- |
| en | “Getting started” | “Get started” |
| it | «Top Canali» | «Canali di punta» |
| pl | „Na start”, „Top kanały” | „Na początek”, „Najpopularniejsze kanały” |
| pt-PT | «Configurações», «Seus dados» | «Definições», «Os teus dados» |
| ru | «Начало работы» | «С чего начать» |
| zh-CN | 「快速上手」 | 「从这里开始」 |
| pt-BR | «Seus dados» | «Os teus dados** ← l'intitulé était en portugais d'Europe |

Les six premières sont corrigées dans le guide ; la dernière l'est dans
**l'intitulé**, parce que c'est lui qui était fautif — treize autres chaînes du
même fichier disent « seus/sua ».

**3. Un réglage annoncé qui n'existe pas.** Le chapitre des réglages promettait
que le relevé des abonnements « peut être arrêté ». Il ne le peut pas :
`abosPeriode` vaut **3, 6, 12 ou 24 heures**, et rien d'autre. C'est la même
espèce d'erreur que le « l'extension n'a aucun réglage » qu'on venait de
retirer — une phrase que personne ne recoupe avec l'interface. Le chapitre donne
maintenant les quatre valeurs.

#### Et les trois sont désormais tenues par le banc

| ce qui est mesuré | ce qui tomberait sans |
| --- | --- |
| le chapitre du panneau nomme les cinq intitulés du rail, **dans l'ordre du rail** | une liste qui n'est plus celle qu'on a sous les yeux vaut moins que pas de liste |
| chaque renvoi désigne un chapitre qui existe, et pas lui-même | le renvoi de demain, cassé par le remaniement d'après-demain |
| le renvoi des co-streams tombe sur le chapitre des tris | un renvoi dans les bornes, mais vers le mauvais chapitre |

Le chapitre visé est trouvé **par son titre rendu**, pas par son rang : le
scénario n'a donc aucun numéro à tenir à jour, ce qui est exactement la dette
qu'il existe pour éviter.

#### Et le banc ne savait pas substituer

L'assertion du renvoi a d'abord été verte pour une mauvaise raison, puis rouge
pour une bonne : elle lisait **`(chapter $1)`**, littéralement.

Les bouchons `chrome.i18n` du harnais étaient écrits `(k) => table[k].message` —
ils rendaient le message **brut**. `chrome.i18n.getMessage(clé, sub)` remplace
`$1` … `$9` par ses arguments, et aucun des cinq bouchons ne le faisait. Le banc
n'avait donc **jamais** vu un message substitué : ni ce renvoi, ni le `$1 h` qui
affiche la période du relevé dans les réglages, depuis qu'il existe.

Un bouchon plus simple que la chose qu'il remplace rend vertes des assertions
que le produit ferait tomber. Les cinq substituent maintenant comme Chrome.

## La signature se lisait autrement que l'œil (v4.13.12)

### Deux défauts, et les deux sont les miens

Le rapport de terrain a mis en défaut **le correctif de la veille** et
**l'instrument posé le jour même**. Les deux sont dits ici, dans cet ordre.

### 1. La signature comparait ce que l'œil ne compare pas

La 4.13.9 protégeait une entrée du classement quand plusieurs chaînes d'une même
catégorie portaient **exactement** le même compteur — la signature d'un compteur
combiné.

Or trois co-streamers affichés « 1,1 k » **n'ont pas le même nombre exact** :
Twitch échantillonne le combiné une fois par participant, et les relevés
diffèrent de quelques unités.

**La leçon était déjà dans ce fichier**, dix mille lignes plus bas, au-dessus de
l'heuristique qui regroupe les cartes :

> « Comparaison sur le texte AFFICHÉ (donc arrondi, « 3,9 k ») et non sur le
> nombre exact […]. Deux valeurs exactes voisines (1 663 / 1 661) ne doivent pas
> faire échouer un regroupement que Twitch affiche comme identique. »

La signature du classement l'ignorait. Elle ne protégeait donc **que les sessions
qui n'en avaient pas besoin**.

Mesuré avant correctif, sur trois combinés voisins (1101, 1148, 1093) :

```
relevé 1 : milieu:900, modele:800, bb:300, aa:300, cc:300
relevé 2 : bb:1148, aa:1101, cc:1093, milieu:900, modele:800
```

Les trois tombent à leur compteur propre, la marche les remonte, et ainsi de
suite. L'oscillation, exactement — sur le décor où la 4.13.9 était censée la
supprimer.

Après : les trois tiennent leur rang sur deux cycles complets.

### 2. Le compteur était aveugle là où le bug vit

Le bilan de la 4.13.11 ne parcourait que les **groupes actifs**. Or un groupe
n'est actif qu'à partir de **deux** cartes visibles : une session réduite à un
seul membre à l'écran — **le cas même qu'on cherche** — n'était comptée nulle
part.

Le premier rapport l'a montré du premier coup :

```
CO-STREAM  groupes 0 · membres 0 · affichés 0 · horsClassement 0 · classesNonAffichees 0
LIGNES     pastilles 3        plus 0
```

Trois cartes portant une pastille — donc trois sessions connues de Guest Star,
`plus 0` excluant un « +N » de Twitch — et un bilan rigoureusement à zéro.

**On part donc des cartes, et non des groupes.** Toute carte affichée dont Guest
Star connaît la session compte, seule ou accompagnée. `groupes` reste à côté :
l'écart entre `sessions` et `groupes` **est** le nombre de sessions réduites à un
seul membre visible.

```
sessions 1 · groupes 0 · membres 4 · affichés 1 · horsClassement 3 · classesNonAffichees 0
```

### Ce que le banc ajoute

Le scénario 136 joue les deux : trois combinés voisins qui doivent tenir leur
rang sur deux cycles, puis une session dont un seul membre est classable.

| mutant | l'assertion qui tombe |
| --- | --- |
| la signature remise sur le nombre exact | « les trois co-streamers gardent le nombre du répertoire » |
| le bilan remis sur les groupes actifs | « une session réduite à un seul membre visible est vue quand même » |
| les absents comptés comme fuite | « ses membres absents sont rangés du côté de Twitch » |

## Le co-stream en Top Chaînes : ce que la session compte, ce que la liste montre (v4.13.11)

### La question posée

> « Le système de co-stream est-il bien implémenté sur la partie Top Chaînes,
> notamment lors d'update de la liste de carte ? »

### Ce que l'audit a vérifié, et qui tient

**L'ordre des passes est bon.** `syncGlobalCards` s'exécute *avant*
`detectCoStreams` dans le même scan : une carte créée dans une passe est groupée
dans cette passe, sans image de retard.

```
syncGlobalCards → recomputeFilters → detectCoStreams → applySorting → applyCostreamJoins
```

**Et ça ne clignote pas.** Trois co-streamers d'anciennetés différentes, échantillonnés
à chaque rafraîchissement d'écran pendant six secondes, avec une mise à jour du
classement injectée à mi-parcours :

```
361 images sur 361  →  groupée / groupée / groupée, même clé gs:
```

### Ce que l'audit a trouvé

**Deux nombres décrivent la même session, et rien ne les réconcilie.**

La pastille vient de la **session** (Guest Star connaît tous les participants).
Le groupe coloré vient des **cartes présentes** dans la liste. Quand un membre
n'est pas classé, la pastille annonce trois participants au-dessus de deux
lignes — c'est exactement ce qu'une capture de terrain montrait.

Et cette contradiction cachait la question que **cinq versions** n'ont pas pu
trancher :

| ce qui a pu se passer | qui est en cause | ce que ça vaut |
| --- | --- | --- |
| il a été **classé puis perdu** | **nous** | une fuite, et ça se répare |
| il n'a **jamais été classé** | le répertoire de Twitch, qui ne le range pas dans la langue demandée | rien à réparer |

Les deux se ressemblent à l'écran. Elles ne se réparent pas du tout pareil.

### Le chiffre qui manquait

`classesNonAffichees` compte les membres d'une session **qui sont au classement
et n'ont pourtant pas de carte**. C'est la fuite, et elle seule.
`horsClassement`, lui, est un fait sur Twitch — pas sur nous.

Mesuré sur un décor où un participant à quarante spectateurs ne peut pas entrer
dans un top 30 :

```
groupes 1 · membres 4 · affichés 2 · horsClassement 2 · classesNonAffichees 0
```

Quatre membres, deux à l'écran, **deux que Twitch n'a pas classés, aucune fuite
de notre côté**. Le prochain rapport de terrain dira lequel des deux nombres
bouge — et c'est la première fois que la question peut recevoir une réponse
plutôt qu'une hypothèse.

> **Ce correctif ne change rien à l'affichage.** Il mesure. Après cinq versions
> passées à corriger des causes réelles mais successives, poser le compteur qui
> arbitre vaut mieux qu'une sixième hypothèse.

### Ce que cet audit n'a pas pu mesurer

**La section suivie introuvable.** Tous les rapports de terrain comptent entre
26 et 35 passages où `followedSection()` ne rend rien — et ces passages sautent
à la fois le rendu du classement et la détection de co-stream. Le décor du banc
n'a pas su reproduire cet état : les deux ancres retirées, il retrouvait quand
même la section. Aucune conclusion n'en est tirée ici.

### Ce que le banc ajoute

Le scénario 135 pose une session de quatre dont deux seulement sont classables,
et vérifie d'abord que son décor joue bien la contradiction — pastille « 3 » sur
deux lignes — avant de lire le bilan.

| mutant | l'assertion qui tombe |
| --- | --- |
| les absents comptés comme fuite | « les membres que Twitch n'a pas classés comptent comme tels » |
| un membre oublié par le bilan | « chaque membre dans une seule case » |
| une carte classée non comptée | « aucun membre classé ne reste sans carte » |

## Une carte fabriquée est-elle une carte comme les autres ? (v4.13.10)

### L'audit demandé

> « Que les cartes clonées sur Top Chaînes soient identiques à une carte
> normale. »

La méthode : **deux chaînes aux données rigoureusement identiques** — même
compteur, même ancienneté, même catégorie, même langue, même abonnement. L'une a
une carte de Twitch, que le classement emprunte ; l'autre n'en a pas, et sa carte
est donc clonée. On les compare au même instant, dans le même mode.

### Ce que le code se réserve le droit de traiter à part

Sept endroits écartent les cartes fabriquées. **Tous les sept sont des chemins de
MESURE, aucun n'est un chemin de comportement :**

| ce qui les écarte | pourquoi |
| --- | --- |
| le retard de Twitch (`liveLag`) | on ne se mesure pas soi-même |
| l'auto-diagnostic des sélecteurs | un clone répondrait « ok » et masquerait une rupture réelle |
| le bouton « Afficher plus » | compter les nôtres simulerait une croissance |
| l'ordre natif (`tseTwitchOrder`) | elles ne font pas partie de l'ordre de Twitch |
| le garde-fou d'extinction de masse | ce que **Twitch** affiche fait référence |
| la stabilité du voile | idem |

Rien de ce qui touche à l'affichage, au survol, au tri ou aux filtres.

### Ce que la mesure a confirmé

| ce qui a été comparé | résultat |
| --- | --- |
| jeu de données complet | identique |
| classes, injections (`tse-*`) et leurs textes | identique |
| structure interrogée par le reste du code | identique |
| lien de la carte | identique |
| aperçu au survol : titre, badges, frise, total, iframe | **identique, champ par champ** |
| regroupement co-stream : classe, clé, couleur, pastille | identique |

### Ce que la mesure a trouvé

**La carte fabriquée n'annonçait rien aux lecteurs d'écran.**

Twitch double son compteur visuel d'un `<p class="sr-only">` qui le redit en
toutes lettres. `scrubClone` le retirait — et sa raison était bonne : cloné tel
quel, il aurait annoncé le nombre de spectateurs de la chaîne **source**.

Mais sa conclusion ne l'était plus :

> « On ne peut pas le réécrire — sa formulation exacte varie selon la locale. »

Cela supposait qu'il faille **fabriquer** la phrase. Il n'en est rien : la phrase
est déjà là, dans la langue de l'utilisateur, écrite par Twitch. **Seul le nombre
est faux.** On le remplace, et on garde tout le reste.

### Et le défaut symétrique, sur la carte native

Il n'avait jamais été signalé, et l'audit l'a mis au jour en passant : sur une
carte de Twitch, **l'œil lisait notre compteur et le lecteur d'écran annonçait
celui de Twitch**. Deux nombres différents pour la même ligne dès que les deux
divergent — c'est-à-dire précisément le cas d'un co-stream.

`renderViewers` recale désormais la phrase à chaque écriture, sur les deux sortes
de cartes. Sans nombre reconnaissable dedans, on n'y touche pas : une phrase
intacte vaut mieux qu'une phrase abîmée.

### Ce que cet audit ne couvre pas

**La barre latérale réduite.** Twitch n'y rend que l'avatar, et le décor du banc
ne reproduit pas ce balisage : la comparaison y mesurerait deux fois la même
chose. Le raisonnement dit que le clone hérite du mode de son modèle — il est
cloné dans le mode courant — mais c'est un raisonnement, pas une mesure, et il
est dit comme tel.

### Ce que le banc ajoute

Le scénario 134 **est** cet audit, figé. Il vérifie d'abord son propre décor —
sans quoi il comparerait deux clones — puis diffe cinq familles de propriétés et
les deux phrases annoncées.

| mutant | l'assertion qui tombe |
| --- | --- |
| la phrase retirée du clone | « la carte fabriquée annonce son compteur aux lecteurs d'écran » |
| le recalage supprimé | « la native annonce le nombre qu'elle AFFICHE » |
| une injection oubliée par le clonage | « leur "injections" est identique » |

## La signature de co-stream est dans le répertoire (v4.13.9)

### Le rapport, cinquième reprise — et le mot qui a tout donné

> « Ils ont été 5, puis pendant une demi-seconde ils sont passés à 3, puis
> revenus à 5. Puis là ils ne sont plus que 3. **Je n'ai pas quitté la
> fenêtre.** »

**Une oscillation.** Pas une disparition, pas une chute : un battement.

`LIVE_TTL` et `GLOBAL_STRUCT_TICK` valent **tous deux 30 s**. La marche remonte
les co-streamers au compteur du répertoire ; le lot de chaînes les fait retomber
à leur compteur propre ; la marche suivante les remonte. Deux sources qui
gagnent à tour de rôle, et le classement qui bat avec elles. Mesuré au banc :

```
classement : lyritvjamie:4900     ← restauré par la marche
carte      : lyritvjamie=300      ← dégradé par le lot de chaînes
```

### Aucun garde-fou Guest Star ne pouvait l'attraper

Pour ces participants-là, **Twitch répond `session: null`** alors que son propre
répertoire les affiche tous au même compteur.

Quatre correctifs — 4.13.1, 4.13.4, 4.13.6, 4.13.8 — ont cherché le signal chez
Guest Star. Il n'y est pas toujours. C'est la leçon de cette version, et elle
valait cinq tours : **une source qui peut se taire ne peut pas être le seul
discriminant.**

### Le répertoire, lui, le dit

Plusieurs chaînes d'une même catégorie portant **exactement** le même compteur,
c'est la signature d'un compteur combiné. Ce produit s'en sert déjà pour
regrouper les cartes — c'est la clé `vh:` de `detectCoStreams`, et ses conditions
cumulatives sont éprouvées depuis longtemps.

On la calcule donc une fois par publication, sur des données déjà en mémoire, et
elle sert à une seule chose : **empêcher qu'un compteur propre vienne écraser un
compteur combiné que la marche vient de récolter.**

| ce que porte l'entrée | ce que le lot de chaînes peut en faire |
| --- | --- |
| la signature d'un combiné | **rien** — sauf si le nombre vient de Guest Star, qui décrit la même chose |
| pas de jumeau | le compteur frais s'applique, comme avant |

> **Deux membres au moins**, comme pour le regroupement : un compteur unique
> n'est la signature de rien.

### La carte suit, au même endroit

Les deux signaux — « Guest Star dit en session » et « le répertoire porte la
signature » — sont lus côte à côte, et la carte applique la même règle que le
tri. Les laisser diverger est le défaut que la 4.13.6 a corrigé dans un sens et
la 4.13.8 dans l'autre ; ils sont désormais calculés ensemble.

### La fraîcheur ordinaire n'est pas sacrifiée

Une chaîne sans jumeau reçoit toujours son compteur frais entre deux marches —
c'est le contrat du scénario 34, et le scénario 133 le vérifie explicitement
plutôt que de le supposer.

### Ce que le banc ajoute

Le scénario 133 pose deux co-streamers au même compteur, dont **un seul** est
connu de Guest Star, et une chaîne ordinaire dont le compteur frais diffère du
répertoire. Cinq assertions, dont une qui relit tout après un cycle complet des
deux sources : **c'est l'oscillation elle-même qui est éprouvée.**

| mutant | l'assertion qui tombe |
| --- | --- |
| la signature ignorée par `setViewers` | « celle sur laquelle il se tait garde le nombre du répertoire » |
| la signature ignorée à l'affichage | « sa carte aussi, au lieu de son compteur propre » |
| la garde étendue aux chaînes sans jumeau | « une chaîne sans jumeau reçoit bien son compteur frais » |

## En session, le compteur propre n'est jamais le bon (v4.13.8)

### Le rapport, quatrième reprise

Six co-streamers « Aniimo » affichés à **4 k**, dont **trois** quittent la
liste. Et le rapport :

```
misses        0
sousPlancher  0
creux         0
evicted       0        ← littéralement rien n'a quitté le pool
```

### Le trou laissé ouvert par la 4.13.6

Celle-ci préférait le compteur **combiné** de la session quand elle le
connaissait ; sinon elle retombait sur le compteur **propre**.

Or sur une session à six participants, Twitch ne porte le
`collaborationViewersCount` que pour **certains** d'entre eux. Les autres
retombaient donc à quelques centaines et sortaient du top trente. Mesuré au
banc, avec un décor où un seul participant sur deux a son combiné :

```
naguura:4000, milieu:900, modele:800, tinkerleo:300
```

`naguura` garde 4 000, `tinkerleo` tombe à 300 — **et rien ne les distingue
sinon ce champ manquant.**

### La règle, complétée

**En session, le compteur propre n'est jamais le bon nombre.** Ce n'est pas
celui que Twitch affiche, donc pas celui que la carte montre, donc pas celui qui
doit trier.

| ce qu'on sait | ce qui entre au classement |
| --- | --- |
| en session, combiné connu | le **combiné** |
| en session, combiné inconnu | **rien** — la valeur du répertoire reste en place |
| hors session | le compteur **propre**, comme avant |
| session encore inconnue | le compteur **propre** — sinon tout gèlerait au démarrage |

**Ne rien écrire est ici la bonne écriture.**

> La dernière ligne n'est pas un détail. `getHostId` rend `undefined` tant que
> Guest Star n'a pas répondu, et refuser d'écrire dans ce cas gèlerait le
> compteur de **toutes** les chaînes ordinaires le temps de la première réponse.
> D'où `typeof hote === 'string'`, et non « pas null ».

### La carte suit la même règle

Ces deux endroits décrivent le même nombre, et les laisser diverger est
exactement le défaut que la 4.13.6 a corrigé dans l'autre sens. En session sans
combiné connu, la carte **garde ce qu'elle affiche** — le nombre du répertoire —
au lieu de retomber sur un compteur que Twitch ne montre nulle part.

### Ce que le banc ajoute

Le scénario 132 pose deux co-streamers rigoureusement identiques, **à un champ
près** : l'un a son combiné, l'autre non. Cinq assertions, dont celle qui tient
tout — sans elle, le second retombe à 300.

| mutant | l'assertion qui tombe |
| --- | --- |
| le repli sur `entry.viewers` rétabli en session | « celui dont elle n'en donne pas garde le nombre du répertoire » |
| l'affichage laissé au compteur propre | « sa carte l'affiche aussi, au lieu de son compteur propre » |
| la règle étendue hors session | « une chaîne hors session garde bien le sien » |

## Un retour d'onglet détruisait les cartes qu'on avait posées (v4.13.7)

### Le rapport

> « Je vois des cartes apparaître et disparaître dans les co-streams, notamment
> quand je change de fenêtre quelques secondes puis j'y reviens. »

Et le rapport de diagnostic, une fois de plus :

```
creux         0
evicted       0        ← rien n'a quitté le classement
```

**Ce n'était donc pas un retrait de plus.** Les cartes n'étaient pas retirées du
classement : elles étaient **détruites du DOM**, puis refabriquées.

### Le chemin du retour d'onglet

Après une absence dépassant `REVISIT_RELOAD_MS`, le retour invalide le cache de
chaînes et force une relecture complète :

```js
cache.clear();
document.querySelectorAll('.side-nav-card[data-tse-login]').forEach(card => {
  delete card.dataset.tseLogin;      // TOUTES les cartes
});
```

Or `syncGlobalCards` identifie ses cartes par ce pseudo, et retire celles qui
n'en ont plus :

```js
if (l) existing.set(l, c); else releaseGlobalCard(c);
```

— et pour une carte fabriquée, « retirer » veut dire `remove()`. **Un simple
retour d'onglet détruisait les trente cartes du classement.**

### Le pseudo n'est pas la même chose sur les deux

| sur une carte de… | ce que le pseudo est | ce que l'effacer fait |
| --- | --- | --- |
| **Twitch** | une **lecture** du DOM | force `processCard` à tout relire — c'est le but |
| **nous** | notre **seule** identité, Twitch n'en sait rien | ne relit rien : perd la carte |

La boucle traitait les deux de la même façon. Elle n'en traite plus qu'une.

### Ce que la mesure a montré

Au banc, avant le correctif, une carte native empruntée par le classement
ressortait **en double** — elle-même, plus le clone refabriqué à côté :

```
avant  : milieu/fab, modele/nat, shlorox/fab, tinkerleo/fab
retour : shlorox, tinkerleo, milieu, modele, modele      ← doublon
```

Après :

```
retour : milieu, modele, shlorox, tinkerleo
```

### Ce que le banc ajoute

Le scénario 131 joue l'absence puis le retour, au-delà du seuil. Il **marque les
cartes avant** de cacher l'onglet, et c'est ce qui distingue « conservée » de
« refabriquée à l'identique » : un simple relevé de pseudos ne le dirait pas,
puisque la reconstruction rend les mêmes noms sur d'autres nœuds.

| mutant | l'assertion qui tombe |
| --- | --- |
| l'effacement rendu inconditionnel | « aucune carte n'est dupliquée par le retour d'onglet » |
| les cartes refabriquées au lieu d'être gardées | « ce sont les mêmes nœuds, pas des cartes refaites à l'identique » |

## Le classement triait sur un nombre qu'il n'affichait pas (v4.13.6)

### Le rapport, troisième reprise — et cette fois rien n'était supprimé

Six co-streamers « Aniimo », tous affichés à **2,9 k**. Quelques secondes plus
tard, trois d'entre eux ont quitté leur place. Et le rapport :

```
creux         0
sousPlancher  0
evicted       2        ← pour trois lignes parties
```

**Les trois compteurs disaient vrai.** Les deux correctifs précédents (4.13.4,
4.13.1) visaient des *suppressions* ; celui-ci ne supprime rien du tout. Ce
qu'on voyait n'était pas une disparition mais une **chute** — et de l'autre côté
de l'écran, les deux ne se distinguent pas.

### La carte et le classement ne parlaient pas du même nombre

En co-stream, Twitch montre à chaque participant le compteur **combiné** de la
session — c'est exactement pourquoi les six affichaient le même 2,9 k. La marche
le récolte tel quel au répertoire, et c'est lui qui les plaçait en tête.

Puis la réponse de chaîne arrivait, avec le compteur **propre** — quelques
centaines — et c'est celui-là qui entrait au classement :

```js
globalChannels.setViewers(login, entry.viewers);   // le compteur PROPRE
```

tandis que la carte, elle, continuait d'afficher le combiné :

```js
renderViewers(card, data.viewers, getCollabViewers(data.id));   // le COMBINÉ
```

**Une ligne montrait 2,9 k en étant triée sur 400.** Elle passait sous des
lignes à trois cents, ou sortait du top trente.

### La règle existait déjà, ailleurs

Le banc la tenait pour les cartes suivies depuis longtemps :

> « Le nombre trié est CELUI QUI EST AFFICHÉ : sans ça, la liste paraît cassée. »

Elle vaut ici mot pour mot. Le classement reçoit désormais le nombre que la
carte montre, et le compteur propre reste la vérité pour toute chaîne hors
session.

### Les deux réponses n'arrivent pas dans l'ordre

La file des chaînes et celle de Guest Star ont leurs propres cadences. Quand la
seconde est en retard, le classement a déjà reçu le compteur propre — et rien ne
le reprendrait avant l'expiration du cache de chaîne, une demi-minute pendant
laquelle la liste se contredit à l'écran.

La correction part donc **dès qu'on apprend le combiné**, sans attendre le tour
suivant. La table inverse (identifiant → pseudo) n'est bâtie que si au moins une
session en porte un : sur le cas courant — aucun co-stream — cette boucle ne
coûte rien.

### Ce que le banc ajoute

Le scénario 130 pose l'écart exact du terrain : le répertoire rend 2 900, la
réponse de chaîne rend 400, et une chaîne hors session en rend 800. Le mutant —
remettre `entry.viewers` — rend ceci, mesuré :

```
classement : milieu:800, modele:700, tinkerleo:400, shlorox:400
affiché    : tinkerleo=2900, shlorox=2900, milieu=800, modele=700
```

Deux cartes qui affichent 2 900, triées sous des cartes à 800 et 700. C'est
l'écran du rapport, reproduit.

| mutant | l'assertion qui tombe |
| --- | --- |
| `entry.viewers` remis au classement | « le classement porte LE MÊME nombre, pas le compteur propre » |
| la reprise après Guest Star coupée | la même, quand la session arrive en second |
| le combiné imposé hors session | « une chaîne hors session garde son propre compteur » |

## La pastille n'avait qu'une source, et elle manquait souvent (v4.13.5)

### Le rapport

> « Pour ce streamer FrostyQc, il a le badge "En live avec…" et n'a pas la
> pastille sur son avatar, c'est normal ? On est sur le Top Chaînes langue FR. »

Deux marques, deux mécanismes, et un seul était fautif.

### Ce qui était normal : la barre de groupe

Un groupe Guest Star ne s'active qu'à partir de **deux cartes visibles** du même
direct :

```js
for (const [, members] of groups) {
  if (members.length >= 2) members.forEach(c => gsHandled.add(c));
}
```

C'est une barre qui **regroupe** : avec une seule ligne, elle n'a rien à relier.
Le co-streamer de FrostyQc n'étant pas au classement, il y est seul. Voulu, et
inchangé.

### Ce qui ne l'était pas : la pastille

Elle ne se lisait que dans le **« +N » que Twitch écrit sur sa propre carte** :

```js
if (!PLUS_RE_PRESENT.test(card.textContent || '')) { clearCollabBadge(card); return; }
```

Or en Top Chaînes les cartes sont des **clones fabriqués**, nettoyés par
`scrubClone`, et Twitch n'écrit jamais de « +N » pour une chaîne qu'on ne suit
pas. **La pastille y était structurellement impossible** — pas rare, pas
intermittente : impossible.

### Et pourtant l'extension savait

L'aperçu de la même carte affiche « En live avec DarthArcusal ». Il le lit dans
`getGuestStarMates`, dont le cache est rempli **par le scan, pour toutes les
cartes visibles** — pas seulement au survol. L'information était en mémoire au
moment où la carte était dessinée, et la carte ne s'en servait pas.

Deux surfaces de la même extension, la même seconde, la même chaîne : l'une
disait le co-stream, l'autre non.

### La seconde source, et elle ne coûte rien

| ce que la carte porte | ce qui décide |
| --- | --- |
| un « +N » de Twitch | **son** nombre, sur **sa** carte — prioritaire, inchangé |
| pas de « +N », une session Guest Star | le nombre de co-streamers, lu dans le cache déjà rempli |
| pas de « +N », pas de session | rien, comme avant |

Aucune requête de plus : `gsCache` est déjà là. Le repli rattrape au passage un
cas que personne n'avait signalé — une chaîne **suivie** dont Twitch tarde à
écrire son « +N ».

> Le réglage qui éteint la pastille (`collab`) continue de l'éteindre : la
> seconde source alimente le même badge, elle n'en crée pas un second.

### Ce que le banc ajoute

Le scénario 129 rejoue le rapport au mot près — Top Chaînes, carte fabriquée,
aucun « +N » possible — et vérifie d'abord que c'est bien ce décor-là qu'il
mesure.

| mutant | l'assertion qui tombe |
| --- | --- |
| le repli Guest Star retiré | « elle porte pourtant la pastille, comptée sur Guest Star » |
| la priorité inversée | « le "+N" de Twitch garde la main sur une carte qui en porte un » |
| la pastille posée sans session | « une chaîne hors session n'en reçoit toujours aucune » |

## Un retrait qui ne se comptait nulle part (v4.13.4)

### Le rapport, et le chiffre qui a tout désigné

> « KyriaTV a disparu de Top Chaînes alors qu'elle a 1 k abonnés. »
> Puis, deux versions plus tard : **« ça se produit quand je survole à la suite
> les cartes des streamers en co-stream. »**

Deux captures à quelques secondes d'écart. Avant : quatre chaînes
« Discussions » à **3,6 k et 41 m — chiffres strictement identiques**. C'est la
signature d'un seul stream affiché quatre fois : un co-stream. Après : le groupe
entier a disparu, deux des quatre VALORANT avec lui.

Et le rapport, lui, disait :

```
evicted     0        ← rien n'a été évincé
misses     14
pool      299
threshold 941        ← les disparues étaient à 3 000, très au-dessus
```

**`evicted 0` pendant que des chaînes disparaissent de l'écran.** C'est ce
chiffre qui a désigné le coupable : la voie d'éviction documentée — trois
confirmations, un compteur, et un plancher de réponse depuis la 4.13.1 —
n'était pas celle qui les retirait.

### La seconde voie

`setViewers`, cent lignes plus loin :

```js
const i = liste.findIndex(r => r.login === login);
if (i < 0) return false;
if (viewers === null) { liste.splice(i, 1); return true; }   // ← ici
```

Une seule réponse, suppression immédiate. **Pas de confirmation, pas de
compteur, pas une ligne de commentaire** — dans un fichier où chaque décision en
porte un paragraphe. Un retrait qui ne s'inscrit nulle part est un retrait
qu'aucun rapport ne peut désigner : c'est ce qui l'a rendu introuvable pendant
deux enquêtes.

### Pourquoi le co-stream, précisément

`viewers` vaut `null` quand `user(login).stream` est nul. Or ce module distingue
déjà, quelques centaines de lignes plus haut, deux choses très différentes :

> « Login absent de la réponse : on ne sait pas. **Surtout PAS "hors ligne"** —
> ce serait masquer une carte sur une absence de preuve. »

La suppression ne se déclenchait donc que sur une affirmation positive de
Twitch : *« ce login ne diffuse pas de stream à lui »*. Et c'est **exactement**
la réponse pour un invité en co-stream — le répertoire le liste, notre propre
marche l'y a vu avec les chiffres de l'hôte, et il n'a pourtant pas de stream
propre. Deux points de terminaison de Twitch se contredisent, et nous donnions
raison au second contre le premier.

### Et la suppression était redondante

Une chaîne réellement hors ligne voit **déjà** sa carte masquée par la voie des
cartes, qui exige `OFFLINE_CONFIRM` réponses consécutives :

> « Confirmation : il faut OFFLINE_CONFIRM réponses "stream=null" consécutives
> pour basculer en "Terminé". Évite les faux positifs ponctuels. »

Deux disciplines pour le même fait, à deux seuils différents — et **la plus
laxiste l'emportait**, puisqu'elle supprimait l'enregistrement au lieu de
masquer la carte.

### La règle, en une phrase

**L'appartenance au classement revient à la marche.** `setViewers` corrige le
nombre ; il ne retire plus personne.

| ce qui arrive | ce qui se passe maintenant |
| --- | --- |
| réponse sans stream, la marche voit toujours la chaîne | on retient un **creux** sur l'entrée, on le compte, on ne retire rien |
| la marche la revoit | le creux est effacé — c'est le répertoire qui a raison |
| la marche cesse de la voir, creux posé | les deux sources s'accordent : retrait **dès la première absence**, compté dans `evicted` |
| la marche cesse de la voir, sans creux | la règle d'avant : trois confirmations |

Plus prudent d'un côté, **plus prompt de l'autre** : une chaîne dont les deux
sources disent qu'elle est partie n'attend plus trois absences.

### Pourquoi le survol

Il ne causait pas le retrait, il l'**avançait**. Chaque aperçu fermé programme un
scan ; chaque scan redemande les entrées périmées. Survoler d'affilée les cartes
d'un groupe de co-stream, c'est déclencher les requêtes sur exactement ces
logins-là — d'où une corrélation très fiable, et pourtant indirecte.

### Ce que le banc ajoute

Le scénario 128 rejoue la disparition, puis son contraire. Six assertions, dont
celle qui suffit à elle seule : remettre le `splice` la fait tomber.

| mutant | l'assertion qui tombe |
| --- | --- |
| le `splice` restauré | « une réponse sans stream ne retire pas la chaîne du classement » |
| le creux non compté | « le désaccord est COMPTÉ, ce qu'aucun chiffre ne disait » |
| le creux ignoré par `reconcile` | « la marche cesse de la voir à son tour, et le creux tranche aussitôt » |

## Un relevé rendait « zéro » en silence, et il y avait deux causes (v4.13.3)

### Le rapport

> « Le système de récupération des abonnements ne fonctionne plus. Je fais le
> bouton "Relever maintenant" et rien ne se passe. »

Le rapport de diagnostic, lui, disait que **tout allait bien** :

```
horodatage    2026-09-16T14:48:15.008Z   ← relevé lancé deux minutes plus tôt
abonnements   0
en attente    false                      ← terminé, pas bloqué
ERREURS (0)
```

Le bouton marchait. Le relevé allait à son terme. Il ne ramenait rien — sur un
compte qui portait **87 chaînes et 12 abonnements** une heure plus tôt.

### Une fonctionnalité entière sur un seul sélecteur

Tout le relevé repose sur `[data-a-target="subscription-card"]`. S'il ne
correspond plus, chaque onglet est déclaré vide — et **un onglet vide n'est
délibérément pas une erreur** : l'onglet « mobile » l'est chez presque tout le
monde, et une version antérieure écrivait une ligne rouge à chaque relevé pour
rien.

### Le garde-fou existait, et il était aveugle

```js
if (!trouves.length) {
  const connus = subs.entries().filter(e => e.sub).length;
  if (connus) erreurs.noter('abonnements', `relevé complet sans résultat, …`);
}
```

Il jugeait sur la **mémoire**. « Zéro trouvé, zéro connu » étant le compte de
quelqu'un sans abonnement, il se taisait — et la mémoire venait justement d'être
effacée. **Deux pannes rendaient le même chiffre, et une seule était dite.**

### La page sait mieux que nous, et le témoin était déjà là

Un onglet qui s'est **affiché** et où le sélecteur n'accroche **rien** ne décrit
pas un compte vide. Reste à dire ce que « affiché » veut dire — et la réponse
n'avait pas à être inventée : la scrutation n'accepte déjà de déclarer un onglet
vide qu'une fois `#side-nav` rendu, **parce que sa présence dit que
l'application de Twitch est debout**. Le verdict juge sur le même témoin.

> **Une première rédaction ajoutait un second témoin : « le document dépasse
> 400 nœuds ».** Ce nombre ne venait d'aucune mesure — `twitch.tv` n'est pas
> joignable depuis la machine qui écrit ce code — et il ne tenait que parce
> qu'il était calibré sur le décor. Un seuil qu'aucune mesure ne soutient est
> un seuil qui trompera le jour où la page changera de taille. Il est parti.

### Puis un second rapport a montré qu'il y avait DEUX causes

La page des abonnements, ouverte à la main, affichait ceci :

> « Impossible d'afficher vos abonnements pour le moment. Veuillez réessayer
> ultérieurement. »

Et la console de Twitch, en dessous :

```
SubscriptionsManagement_ExpiredSubscriptions : failed integrity check
SubscriptionsManagement_SubscriptionBenefits : failed integrity check
```

**La requête de Twitch avait échoué.** Zéro carte, page parfaitement rendue,
sélecteur parfaitement valide. Un verdict tiré de notre seul côté aurait accusé
notre sélecteur d'une panne qui n'était pas la sienne — et envoyé la recherche
exactement du mauvais côté.

### D'où le témoin qui manquait : ce que Twitch ÉCRIT à la place des cartes

Quand la page écrit quelque chose là où les cartes auraient dû être, on
**recopie sa phrase** et l'énoncé s'arrête là. Aucune déduction de notre part ne
vaut la phrase de la page.

Quatre énoncés, et aucun ne prétend plus que ce qu'on sait :

| ce qu'on a vu | ce que le relevé dit |
| --- | --- |
| aucun onglet affiché | rien de plus — chaque onglet a déjà nommé sa cause |
| affichés, muets, **et la page écrit** | sa phrase, recopiée, point |
| affichés, muets, rien d'écrit, des abonnés en mémoire | le sélecteur ne correspond plus |
| affichés, muets, mémoire vide | compte sans abonnement **ou** sélecteur mort — on ne peut pas trancher, et on le dit |

**Le silence est interdit dès qu'un onglet s'est affiché** — et c'est exactement
là qu'il régnait.

> **Une rédaction intermédiaire parlait aussi quand AUCUN onglet ne s'affichait,
> et le banc l'a refusée.** Toutes les sorties qui précèdent l'affichage notent
> déjà leur propre cause : renvoi vers `/login`, origine illisible, document
> inaccessible, expiration. Une ligne de plus pour répéter « aucun n'a affiché
> Twitch » n'apprend rien — et le scénario 75 tient le contraire depuis
> longtemps : un journal qu'on apprend à ignorer ne sert plus à rien. Là, seule
> la mémoire ajoute encore quelque chose, quand elle contredit le résultat.

### La phrase vient de `main`, et il n'y a pas de repli sur `body`

La barre latérale est pleine de pseudonymes. Un repli sur le document entier les
verserait tous dans un journal d'erreurs que l'utilisateur nous enverra ensuite.
Pas de phrase vaut mieux qu'une phrase qu'il n'aurait pas voulu envoyer — les
nombres de la ligne d'onglet, eux, restent là. La longueur est bornée à **200
caractères** : on veut une phrase, pas une page.

### Ce que le relevé retient désormais

Par onglet, relevé **au plus haut atteint** pendant la scrutation — un instantané
pris trop tôt dirait une page vide là où elle était seulement lente :

| | ce que ça distingue |
| --- | --- |
| `charge` | le cadre a-t-il rendu un document ? |
| `noeuds` | la taille atteinte, pour lecture — plus aucun verdict n'en dépend |
| `barre` | l'application de Twitch est-elle debout ? |
| `cartes` | le sélecteur accroche-t-il quelque chose ? |
| `texte` | ce que Twitch a écrit à la place, quand il n'y a aucune carte |

Le rapport les rend, un onglet par ligne. **« affiché · barre oui · 0 carte · la
page dit : "Impossible d'afficher vos abonnements…" »** ne se confond ni avec
**« jamais chargé »**, ni avec un sélecteur mort.

### Ce que cette version ne corrige pas

**La cause de l'échec d'intégrité.** Elle est chez Twitch ou dans une extension
qui intercepte `fetch` — la console du rapport en montre plusieurs à l'œuvre sur
la même page. Aucune de ces deux hypothèses ne se tranche depuis ici :
`gql.twitch.tv` n'est pas joignable depuis la machine qui écrit ce code. Ce que
cette version garantit, c'est que la panne **se dira, du bon côté**.

### Ce que le banc ajoute

Le décor ne savait jouer ni l'un ni l'autre cas : sa page d'abonnements posait
l'attribut en dur, et n'avait pas de `<main>`. Elle a maintenant les deux
drapeaux, et les deux décors ne diffèrent **que** par là.

Le scénario 127 les rejoue tous les deux — six assertions, dont deux qui tiennent
tout : *« le relevé le DIT, alors même que la mémoire était vide »*, et *« le
verdict recopie la phrase au lieu d'accuser notre sélecteur »*.

## Le cache avant/arrière, et ce que l'audit a trouvé (v4.13.2)

Audit demandé : *« vérifier que lorsque la sidebar n'est pas visible, elle se
recharge bien, que le voile se met bien en place quand il faut »*.

### Ce qui tenait déjà

| situation | ce qui se passe |
| --- | --- |
| onglet en arrière-plan | rien n'est programmé — ni balayage, ni requêtes. L'observateur sort avant sa boucle, l'aperçu se ferme, le préchargement des miniatures est bloqué |
| retour après une **courte** absence | on rejoue le balayage retenu, et on rafraîchit l'affichage local |
| retour après **REVISIT_RELOAD_MS** | voile, purge du cache, repeuplement complet |
| entretien pendant l'absence | il tourne quand même, et libère en plus tout le cache de streams — reconstruit au retour, sous le voile |

Ces quatre chemins sont bons, et chacun porte déjà sa raison d'être en
commentaire. L'audit n'a rien trouvé à y reprendre.

### La lacune

**Rien n'écoutait `pageshow`.** On quitte Twitch, on revient par le bouton
**Précédent** : le navigateur restaure la page telle qu'elle était, DOM gelé
compris. Nos minuteurs étaient à l'arrêt, le cycle de re-fetch en pause, et
Twitch n'a rien pu muter puisqu'il n'y avait plus d'yeux pour l'observer. La
barre revenait avec les compteurs d'il y a une heure, et des chaînes terminées
présentées comme en direct.

> **Et `visibilitychange` ne le rattrape pas à coup sûr :** une page restaurée
> depuis ce cache peut revenir **sans que la visibilité ait changé de valeur**.

**LE DÉPÔT AVAIT DÉJÀ PAYÉ EXACTEMENT CETTE LEÇON.** `bridge.js` écoute
`pagehide` et `pageshow` depuis qu'un rapport d'utilisateur a montré un port mort
pour le reste de la vie de la page — « ponts : aucun » sur une barre latérale qui
fonctionnait sous ses yeux. La même porte manquait dans `content.js`, et
personne n'avait fait le rapprochement.

### Ce qui change

Une restauration est traitée **comme une longue absence**, sans la mesurer :
elle *est* longue par nature — le temps passé hors de la page n'est pas
observable depuis la page.

`persisted` distingue les deux `pageshow` : au chargement ordinaire il vaut
`false` et le démarrage a déjà tout fait. Sans cette garde, le voile retomberait
à **chaque ouverture de page**.

Les deux chemins de retour — la visibilité et la restauration — partagent
désormais une seule fonction. Deux copies auraient divergé au premier
ajustement.

### Ce que le banc ajoute

Trois assertions, un mutant, aucun survivant :

| | journal du voile |
| --- | --- |
| code sain | `démarrage` · `stabilité` · **`retour du cache avant/arrière`** · `stabilité` |
| mutant (porte retirée) | `démarrage` · `stabilité` — **rien ne se passe** |

Et deux gardes autour : un `pageshow` ordinaire ne déclenche rien, et le voile se
**lève** de lui-même une fois la barre stable — un voile posé et jamais levé est
pire que pas de voile.

> **CE QUE CE SCÉNARIO NE PROUVE PAS, et il le dit :** Playwright ne sait pas
> déclencher une vraie restauration depuis le cache. L'événement est rejoué à la
> main. Ce qu'on éprouve est la RÉACTION à cet événement, pas le fait que le
> navigateur l'émette — ce dernier point est une propriété de la plateforme, pas
> du produit.

## Une réponse tronquée ne juge que ce qu'elle contenait (v4.13.1)

### Le rapport

> « KyriaTV a disparu alors qu'elle était présente au tout début. »

Elle n'était pas terminée : son compteur affichait **895** dans la barre suivie,
au-dessus du seuil du classement (**571** au relevé). Elle avait été **évincée**.

### Toutes nos sources sont des « top N », et on s'en servait comme de listes complètes

| source | ce qu'elle demande | ce que le pool contient |
| --- | --- | --- |
| la voie du tag | les **30** premières du monde pour cette langue | **283** chaînes |
| la descente | les **30** premières de chaque catégorie | idem |

La réconciliation comptait une absence à **toute** chaîne du pool ne figurant
pas dans la réponse. Pour la voie du tag, avec le drapeau « tout regardé », cela
voulait dire : **deux cent cinquante absences par passe**, données à des chaînes
parfaitement vivantes, au seul motif qu'elles vivent sous le trentième rang.

Trois passes — `GLOBAL_MISS_CONFIRM` — et tout ce qui vit sous ce rang est
évincé. Relevé chez l'utilisateur : **308 absences, 17 évictions**.

> **« EN LICE » N'EST PAS « REGARDÉE ».** Le raisonnement d'origine était écrit
> noir sur blanc : « la requête est UNE, globale et ordonnée : tout ce qui porte
> le tag y était en lice, donc une absence est réelle ». Le trou est là — être en
> lice et **perdre** ne dit rien d'autre que « je suis sous le rang trente ». Ce
> n'est pas une disparition.

### Le plancher

Une réponse tronquée ne peut juger que les chaînes **qui auraient dû y figurer** :
celles dont le compteur connu atteint le plus petit compteur qu'elle rend. Sous
ce plancher, la réponse ne dit **rien** — exactement la règle que la descente
appliquait déjà aux catégories qu'elle n'avait pas visitées : *pas regardée, pas
jugée.*

```js
if (rec.viewers < plancherDe(rec)) { stats.sousPlancher += 1; continue; }
```

**Une réponse plus courte que la demande est exhaustive**, et là une absence est
réelle : le plancher ne s'applique donc qu'aux réponses **pleines**. C'est ce que
`plancherReponse(recs, demande)` tranche, et c'est pourquoi les deux petites
chaînes du scénario — seules dans leur catégorie — restent jugeables par la
descente tout en étant protégées du classement par tag.

Le plancher de la descente est **par catégorie**, et mesuré sur les arêtes
**rendues** et non sur celles qu'on retient : `readStream` écarte les empileurs
de tags, et compter sans eux ferait croire la réponse plus courte qu'elle
n'était — donc exhaustive alors qu'elle était pleine.

### Le compteur qui aurait montré tout ça sans attendre un rapport

`sousPlancher` compte les absences qu'on **refuse** de compter. Il entre au
rapport de diagnostic à côté de `misses` et `evicted` : deux cent cinquante par
passe contre trente chaînes rendues, et le défaut se lisait d'un coup d'œil.

### Ce que le banc ajoute

Trois assertions, un mutant, aucun survivant. Le décor pose un classement par tag
**plein** — trente entrées dont la plus basse à 1 000 — et deux chaînes
françaises à 100 et 90 entrées au pool par la descente.

| | `misses` | `sousPlancher` | les deux petites |
| --- | --- | --- | --- |
| code sain | **0** | **2** | au classement |
| mutant (plancher retiré) | **2** | 0 | jugées, évincées au bout de trois passes |

### Ce que cela ne prouve pas

**Le cas signalé n'est pas refermé par cette mesure seule.** Ce défaut évinçait
tout ce qui vit sous le trentième rang, et KyriaTV à 895 était près de ce rang —
mais je n'ai pas pu interroger le vrai Twitch pour établir qu'elle y figurait :
`gql.twitch.tv` est bloqué depuis cette machine. Reste une seconde piste, que
les captures suggèrent : en **Guest Star**, l'invité n'a pas d'entrée propre dans
l'annuaire — la session se range sous l'hôte, ce qui expliquerait que GoBGG
apparaisse et pas elle, et qu'elle ait été présente **au tout début**, avant de
rejoindre la session.

Si le cas se reproduit sur cette version, `sousPlancher` dans le rapport dira
lequel des deux mécanismes est en cause.

## Le panneau était dans la page et demandait son chemin (v4.13)

### Le rapport, et ce qu'il disait exactement

> « Ouvrez un onglet twitch.tv et mettez-le au premier plan, puis réessayez.
> (onglet 283882417 — ponts connus : aucun) »

Affiché **par-dessus la page Twitch qu'il décrivait**, avec la barre latérale
décorée par l'extension juste à côté.

### Trois sauts, et chacun peut manquer

Le détour n'avait de sens que pour la popup. Depuis la barre d'outils, le
panneau n'a **aucun accès** à l'onglet : il demande au service worker, qui
demande au pont (`bridge.js`), qui demande à la page.

Incrusté, le panneau **est** dans la page. Faire redescendre la question par le
worker pour revenir dans le document qui nous contient est non seulement
inutile — c'est fragile, de trois façons :

| ce qui casse | ce que ça donne |
| --- | --- |
| l'extension est rechargée pendant que la page vit | `content.js` survit (il n'appelle aucune API d'extension), mais `bridge.js` devient **orphelin** : son contexte n'existe plus, il ne peut plus se rebrancher. Le worker n'a **plus jamais** de port pour cet onglet, jusqu'au rechargement de la page |
| le worker s'endort | la reprise du pont laisse une fenêtre aveugle, et un clic tombe dedans |
| `tabs.query` désigne un onglet | pas forcément celui qui nous contient |

Le premier est celui du rapport, et c'est le seul qui ne se répare pas tout
seul : il dure jusqu'à ce que l'utilisateur recharge Twitch — ce que rien ne lui
dit de faire.

### Le chemin court

Incrusté, le panneau parle à son parent. Rien d'autre :

```
panneau (iframe)  ──postMessage──▶  content.js  ──postMessage──▶  panneau
```

Ni worker, ni port, ni identifiant d'onglet à deviner : **la page qui répond est
celle qui nous affiche**, par construction. Le même `servirPanneau` sert les deux
voies — il n'y a pas deux implémentations à faire diverger, seulement deux
transports.

> **Il ne se rabat PAS sur le chemin long.** Si la page qui nous affiche ne
> répond pas, repasser par le worker pour lui redemander la même chose ne peut
> rien donner de plus. Un repli qui ne répare rien ne fait que retarder le
> message qui dit ce qui ne va pas.

Deux gardes, des deux côtés, et le banc les éprouve toutes les deux :

- **côté page**, on ne sert que le cadre qu'on a posé — `event.source` est
  comparé à `frame.contentWindow`, pas à une origine qu'on ne connaît pas ;
- **côté panneau**, on n'écoute que `window.parent`, et on ne résout que sur un
  identifiant qu'on a soi-même émis.

Le scénario 124 rejoue la panne **exactement** : `tabs.query` ne rend aucun
onglet, `runtime.sendMessage` échoue. Avant cette version, ce décor donnait
« ouvrez un onglet twitch.tv ». Il rend maintenant des données.

## La roue tournait, et personne ne pouvait le voir (v4.13)

Un demi-tour au survol — et **une roue crantée est symétrique par rotation**.
Huit dents : identique à elle-même tous les quarante-cinq degrés. Un demi-tour
la ramène exactement sur elle-même.

La transformation avait bien lieu. Mesurée : `matrix(-1, 0, 0, -1, 0, 0)`. Elle
était simplement invisible, et le raisonnement qui l'avait choisie — « un tour
complet revient à sa position de départ et ne dit donc rien » — valait tout
autant pour le demi-tour, sur ce glyphe-là.

Une **rotation continue** n'a pas ce problème : ce qui se voit n'est plus une
position d'arrivée mais le mouvement lui-même, que la symétrie n'efface pas.
Elle tourne tant que le pointeur est là, comme un rouage qu'on entraîne — et
s'arrête entièrement sous `prefers-reduced-motion`, où elle n'a rien à conserver.

> **Retiré en 4.14.0.** Le bloc « mouvement réduit » n'existe plus : voir
> *Moins de règles, une boucle qui se referme, un mode d'emploi refait*.

## Deux nombres qui n'étaient plus les bons (v4.13)

**Le cadre passe à 1100 × 760.** La 4.12 lui donnait 760 × 580 au nom de
« la même taille par les deux chemins ». Le contrat était bon ; sa conséquence
ne l'était pas : ces deux nombres sont ceux d'une popup de barre d'outils,
**bornée par le navigateur** à 800 × 600 — pas par nous. Les imposer au cadre
revenait à montrer trois lignes de tableau sur un écran qui en offrait vingt.

La feuille du panneau relâche donc ses deux nombres quand elle se sait
incrustée : `width: 100%; height: 100%`. On relâche, on ne refait pas — le rail,
les vues, les réglages et le mode d'emploi continuent de s'appliquer tels quels.

**La bulle attend la levée du voile.** Posée dessous, elle se montrait à côté
d'une barre vide, désignant une roue qu'on ne voyait pas encore : la première
chose que voyait un nouvel utilisateur était une explication sans son objet.
`body.tse-loading` est l'unique source de vérité du voile ; on la lit, on n'en
invente pas une seconde.

## Trois finitions demandées, et deux mesures qui les ont corrigées (v4.12.2)

Trois retours, tous sur la même chose : ce que la roue et sa bulle **ont l'air
d'être**. Rien ici ne change ce qu'elles font.

### 1. La roue est un ⚙️, et elle tourne quand on l'approche

Un SVG dessiné à la main donnait une roue grise de plus dans une barre qui en
compte déjà six. L'emoji porte sa propre couleur : il se reconnaît **avant
d'être lu**, ce qui est exactement ce qu'on demande à ce bouton.

Au survol, elle fait un **demi-tour**. Pas un tour complet : une roue qui revient
exactement à sa position de départ ne dit pas qu'elle a tourné, elle scintille.
La courbe démarre vite et finit lentement, comme un cran qu'on pousse. **Le
clavier y a droit aussi** — une réaction réservée au pointeur est une réaction
que la moitié des gens ne verra jamais.

> **L'EMOJI VIT DANS UN `<span>`, ET CE N'EST PAS DÉCORATIF.** Le bouton porte le
> battement du premier lancement, qui anime `transform: scale`. La rotation anime
> `transform` elle aussi : sur le même élément, la seconde écraserait la première
> et **la roue cesserait de battre dès qu'on l'approche**. Deux éléments, deux
> transformations, aucune collision — et une assertion qui le dit, parce que rien
> d'autre ne le dirait.

La rotation est du mouvement, et elle part sous `prefers-reduced-motion`. Sans
rien à conserver, contrairement au battement : elle n'est pas un signal, elle
accuse réception du pointeur, et le fond au survol le dit déjà.

> **Retiré en 4.14.0.** Le bloc « mouvement réduit » n'existe plus : voir
> *Moins de règles, une boucle qui se referme, un mode d'emploi refait*.

### 2. Une croix qu'on trouve sans la chercher

**Deux rédactions ont échoué avant celle-ci, et pour la même raison.** La croix
était posée *au-dessus* du cadre, sur le voile, en gris translucide. Sur une page
sombre voilée de noir, un carré à 12 % de blanc ne se voit pas — et un bouton de
fermeture invisible sur une fenêtre modale est le pire des défauts, puisqu'il ne
reste que la touche Échap à quelqu'un qui ne sait pas qu'elle existe.

Elle **chevauche maintenant le coin**. À cheval sur l'angle, elle appartient
visiblement au cadre : c'est la forme conventionnelle d'une fermeture de modale,
et la seule qui se trouve sans la chercher. Ronde, opaque, cerclée de blanc pour
se détacher du panneau comme du voile.

> Le cadre a perdu son `overflow: hidden` au passage — il aurait rogné la croix
> de moitié. C'est l'iframe qui porte désormais le rayon, puisque c'est elle
> qu'il fallait couper.

**L'assertion a dû être réécrite, et l'erreur mérite d'être dite.** Elle exigeait
d'abord que le *centre* du bouton soit dehors. C'était une façon arbitraire de
dire « à cheval », et elle échouait sur un bouton parfaitement posé — plus dedans
que dehors, ce qui est le cas de toutes les fermetures de coin. Elle dit
maintenant ce qu'on veut vraiment : **elle coupe le bord droit, elle coupe le
bord haut.**

### 3. La bulle, refaite

« Un peu brouillon », et c'était juste. Enfermée dans la barre latérale, elle en
héritait la largeur — deux cent quarante pixels — et la phrase s'y empilait sur
**quatre lignes de même poids**, sans hiérarchie, sur un aplat violet saturé.

Quatre changements, et chacun répond à un défaut précis :

| ce qui change | pourquoi |
| --- | --- |
| **position fixe**, sur le corps du document | elle déborde sur le site au lieu d'hériter des 240 px de la barre et de tout ce qui la rogne |
| **330 px**, appuyée sur le bord gauche de la barre | elle se lit comme une couche posée par-dessus, ce qu'elle est |
| **carte sombre**, le violet réduit au filet, à la pastille et à la pointe | un aplat saturé sur quatre lignes ne hiérarchise rien ; ici le violet fait ce qu'il fait partout dans ce produit — il désigne |
| le texte **coupé en titre et corps** | ce sont les deux phrases écrites par l'auteur ; la bulle les rendait d'un bloc |

La pastille porte **la même roue que le bouton**, et c'est ce qui relie la phrase
à l'objet qu'elle désigne : la flèche dit **où**, la pastille dit **quoi**.

> **La pointe était un losange plein**, posé en travers du filet violet : sa
> moitié basse restait visible sur la carte, et l'ensemble se lisait comme une
> pastille égarée plutôt que comme une pointe. Son corps prend maintenant la
> couleur de la carte et ses deux bords hauts celle du filet — seule la partie
> qui dépasse se voit.

#### La position fixe a créé un cas, et il fallait le rattraper

Tant que la bulle vivait **dans** la barre, deux règles de feuille la masquaient
avec elle en colonne réduite. Posée sur le corps du document, elle n'a plus de
parent pour la cacher à notre place : une barre repliée aurait laissé une carte
flottant au milieu de l'écran, **pointant vers un bouton qui n'existe plus**.

C'est désormais la mesure qui tranche — une roue sans surface emporte la bulle —
et le scénario 123 le joue en retirant sa surface au titre.

### Deux nombres qui ne valaient pas ce qu'ils disaient

Mesurés, pas relus :

- la bulle déclarait `width: 330px` et en faisait **360** à l'écran, le
  rembourrage et les filets s'ajoutant par-dessus ;
- la croix déclarait `32px` et en faisait **36**, pour la même raison.

Les deux sont en `border-box`. Un nombre qui ne vaut pas ce qu'il dit finit
toujours par tromper le calcul d'à côté — et ici le calcul d'à côté est celui qui
place la pointe.

### Et une variable qui n'existait pas

La carte posait `background: var(--tse-fond-carte, #1f1f23)`. **`--tse-fond-carte`
n'existe nulle part** : le repli s'appliquait donc toujours, et la bulle serait
restée sombre en thème clair sans que rien ne le signale — sur un thème clair qui
a son propre scénario de banc depuis la 4.8. Les jetons réels sont
`--tse-surface-2`, `--tse-anneau` et `--tse-ombre-large`. Le cadre du panneau
avait la même faute, avec `--tse-fond`.

### Ce que le banc ajoute

Sept assertions neuves, quatre mutants, aucun survivant :

| mutant | l'assertion qui tombe |
| --- | --- |
| la bulle remise dans la barre latérale | « à la largeur réelle de la barre, elle déborde franchement sur le site » |
| une roue sans surface ne retire plus la bulle | « une roue sans surface emporte la bulle avec elle » |
| la rotation non coupée en mouvement réduit | « la rotation au survol part avec lui » |
| la croix rentrée dans le cadre | « sa croix est à cheval sur le coin haut-droit » |

> **UNE DE CES ASSERTIONS A DÛ ÊTRE REFAITE, et l'erreur est instructive.** La
> première exigeait que la bulle dépasse le bord droit de `#side-nav` — or le
> décor de test n'a pas la feuille de Twitch : sa barre prend TOUTE la page,
> donc une carte de 330 px ne dépassait rien. Relevé : `depasse: -934`. Elle ne
> mesurait pas le produit, elle mesurait le décor. Le scénario pose désormais
> la largeur réelle — deux cent quarante pixels — le temps de la mesure.

## Deux retours de terrain sur la roue, et ce que le décor de test taisait (v4.12.1)

### 1. La roue n'était pas collée au titre

Signalé par capture : la roue se posait à l'**extrême droite** de la barre
latérale, contre le chevron de repli de Twitch, au lieu d'être collée au titre.

**Deux causes, et elles s'additionnaient.** `appendChild` posait la roue en
**fin de bloc** — et sur le vrai Twitch ce bloc contient aussi le bouton de
repli, donc la roue passait après lui. Par-dessus, `margin-left: auto` la
poussait explicitement au bord droit, et `flex: 1 1 auto` sur le `<h3>` étirait
le titre sur toute la largeur.

La correction vise le `<h3>` et se pose **immédiatement après lui** :

```js
const h3 = titre.querySelector('h3');
if (h3) h3.insertAdjacentElement('afterend', roue);
else titre.appendChild(roue);
```

C'est la seule écriture qui donne « collée à droite du titre » **quoi que Twitch
range d'autre dans ce bloc**, aujourd'hui ou demain. Ce qui place la roue est
désormais l'ordre des nœuds, pas une marge.

> **LE DÉCOR DE TEST MENTAIT PAR OMISSION, et c'est la vraie leçon.** Sa
> `.side-nav__title` ne contenait qu'un `<h3>`. Avec un `<h3>` seul,
> `appendChild` et « juste après le titre » donnent **exactement le même
> résultat** — l'assertion `apresH3` passait donc sur un produit défaillant.
> Le décor porte maintenant le bouton de repli, comme le vrai.

L'assertion neuve mesure **deux choses qui tombent ensemble**, parce que
chacune seule se laisse tromper :

| ce qui est mesuré | ce qu'il rattrape seul | ce qu'il laisserait passer |
| --- | --- | --- |
| l'ordre des nœuds (`H3`, roue, repli) | la roue posée en fin de bloc | une marge qui la repousse à l'autre bout |
| l'écart en pixels entre la fin du titre et la roue (≤ 12 px) | la marge automatique | un titre qui se trouve court ce jour-là |

Deux mutants, deux morts : rétablir `appendChild` la fait tomber, rétablir
`margin-left: auto` aussi.

### 2. La bulle ne s'affichait jamais, et c'était par construction

Signalé aussi : « je ne vois pas la bulle après installation de l'extension ».
Ce n'était ni un problème d'affichage, ni un problème de calendrier.

La 4.12.0 reconnaissait une « installation neuve » à une **mémoire vide** — pas
de visites, pas de roster — parce que `content.js` ne peut pas savoir qu'une
installation vient d'avoir lieu : `onInstalled` vit dans le service worker, dont
deux mondes le séparent. C'était juste pour le bandeau de la 4.11, qui annonçait
une icône vieille de plusieurs versions.

**C'est faux pour la roue, qui n'existait pas la veille — et le raisonnement
avait un trou qu'une seule phrase referme :**

> **Réinstaller l'extension n'efface pas le `localStorage` de twitch.tv.**

Un utilisateur de longue date était donc classé « ancien » **à jamais**, et ne
voyait jamais la bulle, quel que soit le nombre de réinstallations. C'est-à-dire
exactement la personne à qui il fallait annoncer une roue qu'elle n'avait jamais
vue.

**On ne devine plus l'âge de l'utilisateur, on retient ce qu'il a vu.** La clé
porte le nom du **signal** — `tse:roue` — et non celui d'un état de
l'utilisateur : absente, le signal n'a jamais été montré, donc il se montre.

> **Le coût est connu, et il faut le dire.** Tout utilisateur existant verra la
> bulle une fois. C'est le prix d'un signal qui atteint effectivement les
> personnes concernées — et il est borné : une bulle, une fois, renvoyée d'un
> clic sur la roue ou sur sa croix.

La clé morte du bandeau de la 4.11, `tse:accueil`, est **retirée du stockage** au
passage. Ce produit compte ses propres clés dans son panneau, et une clé morte y
serait comptée.

L'assertion correspondante est **tournée**, pas retirée : elle exigeait l'inverse
(« une mémoire déjà remplie vaut ancienneté »), et elle exige maintenant qu'un
roster rempli **et** l'ancien bandeau déjà renvoyé n'empêchent plus le signal —
plus une seconde qui vérifie que la clé morte a bien disparu.

### 3. La bulle passait sous les couches de Twitch

Troisième correction, trouvée en relisant la première : la bulle était à
`z-index: 9`. La barre latérale de Twitch empile ses propres couches, et neuf ne
suffit à rien. Elle est à **5000** — dans la barre, pas au-dessus de la page :
les valeurs extrêmes sont réservées au voile du panneau, qui, lui, couvre tout.

## La roue crantée, ou le chemin qu'on ne peut pas manquer (v4.12)

### Deux versions à trouver l'icône, et le constat qui les annule

La 4.11 ouvrait un onglet à l'installation. La 4.11.1 a fait de cet onglet une
vraie page d'accueil : un merci, une maquette de barre d'outils, une grande
flèche vers le coin haut-droit. Les deux disaient **où chercher**.

**Une extension qui doit expliquer où elle se trouve a déjà perdu.** L'onglet
s'ouvre ailleurs et se referme ; le bandeau parle une fois puis s'efface ; et
dans les deux cas, ce qu'on demande à l'utilisateur est d'aller chercher un
bouton dans une barre qui n'est pas la nôtre, derrière une pièce de puzzle qui
n'est pas la nôtre non plus.

Cette version retire les deux et pose le panneau **à deux centimètres de là où
l'utilisateur regarde déjà** : une roue crantée à droite du titre de la barre
latérale, toujours visible, dans les deux modes.

| ce qui part | ce qui arrive |
| --- | --- |
| l'onglet ouvert à l'installation (`onInstalled`) | une roue dans le titre de la barre latérale |
| le bandeau d'accueil dans la liste suivie | une bulle qui **désigne cette roue**, une seule fois |
| la page d'accueil et son mode `?vue=onglet` | le panneau **par-dessus Twitch**, à la taille de la popup |

L'icône de la barre d'outils continue d'ouvrir le même panneau : on n'a pas
remplacé un chemin, on en a ajouté un que personne ne peut manquer.

### C'est la même page, dans un cadre

`panneau.html` est chargée **telle quelle** dans une iframe. Pas réécrite en DOM
de page : une seconde implémentation aurait divergé de la première à la première
section ajoutée, et c'est précisément ce panneau-là qu'on veut faire connaître,
pas une variante de lui.

Le cadre fait **760 × 580**, exactement la popup. Les deux chemins mènent au
même endroit, à la même taille — et les deux nombres vivent dans `CFG`, lus par
la feuille de style, pas recopiés à côté d'elle.

> **Aucune permission n'est ajoutée.** `web_accessible_resources` n'est ni
> `permissions`, ni `host_permissions`, ni `optional_permissions` — et
> `npm run addon` vérifie toujours qu'aucune des trois n'existe. Elle déclare
> qu'une page de l'extension peut être chargée par twitch.tv, et rien d'autre.

**L'adresse vient du pont, et c'est une contrainte, pas un détour.** `content.js`
tourne en monde `MAIN` : il n'a pas `chrome.runtime`, donc pas `getURL`. Seul
`bridge.js` — monde `ISOLATED`, même DOM — peut la dire. Il répond à **chaque**
demande plutôt qu'annoncer une fois au démarrage : les deux fichiers démarrent à
`document_start`, et celui qui parle en premier parle à personne.

> **Un message est quelque chose que n'importe quel script de la page peut
> émettre.** Sans filtre, une page hostile ferait charger SON adresse dans un
> cadre qui a l'air du nôtre — un hameçonnage avec notre décor autour. On
> n'accepte donc qu'un schéma d'extension, et le banc essaie les trois formes
> auxquelles on pense en premier : `https://`, `javascript:`, `//`.

### Quatre sorties, et elles échouent séparément

La croix, la touche Échap, le clic sur le voile, et le panneau lui-même. Ce
dernier n'est pas un doublon du deuxième : **Échap frappée dans le cadre ne
remonte pas jusqu'à la page** — deux origines — donc `panneau.js` l'écoute et
poste la fermeture au parent. Chacune a son assertion, plus les deux qui
comptent autant :

- **le clic DANS le cadre ne ferme pas** — un « fermer au clic sur le voile »
  écrit sans garde ferme aussi quand on clique le panneau ;
- **un message de fermeture venu de la page est ignoré** — on compare
  `event.source` à `frame.contentWindow`, pas à une origine qu'on ne connaît pas.

Et une septième, qui ne se voit qu'après coup : **quatre allers-retours ne
laissent aucun voile derrière eux.** Un écouteur de touche posé sur le document
et jamais retiré s'accumule à chaque ouverture, et le symptôme est alors attribué
à tout autre chose.

### Le premier lancement : la roue bat, la bulle explique

À la première installation seulement, la roue **grossit et bat**, et une bulle la
désigne d'une flèche :

> Merci d'avoir installé Cowlor's Sidebar ! Apprenez à utiliser l'extension,
> personnalisez et regardez toutes vos données stockées ici.

Une pastille ne se voit pas sur un bouton de vingt-six pixels au milieu d'une
interface chargée ; un changement de **taille**, lui, se voit du coin de l'œil —
c'est la seule chose qui bouge dans une barre latérale par ailleurs immobile. Le
halo est une **ombre** et non une bordure : une bordure qui grossit décalerait le
titre à côté à chaque battement.

La décision « installation neuve » vient du même mécanisme que le bandeau qu'elle
remplace, et pour la même raison : **elle se prend une fois et s'écrit.** Sans
ça, le roster se remplit en quelques secondes, l'ancienneté devient vraie au
chargement suivant, et la bulle n'aurait été montrée qu'à ceux qui regardaient
l'écran à la bonne seconde. Le scénario 123 recharge la page **après** que le
roster s'est rempli et exige que la bulle soit toujours là.

Elle se renvoie de deux façons — la croix, ou le clic sur la roue. Le second est
le plus important : **quelqu'un qui ouvre le panneau a trouvé la roue**, et
continuer à la faire battre serait insister après coup.

#### Le mouvement réduit, et le piège qui s'est déjà refermé une fois

Ce battement-là est du mouvement au sens strict — il change une **taille**,
c'est-à-dire exactement ce que la WCAG appelle l'illusion d'un déplacement. Pas
de version calme à négocier comme pour l'opacité de la barre du stream frais : il
s'arrête entièrement. Le fond violet et l'anneau restent, figés à leur point
haut, et la bulle à côté dit le reste.

> **`!important` est ici une correction, pas une facilité.** La règle qui déclare
> le battement vit PLUS BAS dans la feuille, à spécificité égale : sans ce mot,
> l'ordre l'emporte et le bloc ne s'applique pas — silencieusement, chez les
> seuls utilisateurs qui l'ont demandé. C'est **exactement** le piège qui a fait
> passer l'arc-en-ciel du subathon à travers ce réglage pendant deux versions.
> Le mutant a été joué : retirer les trois `!important` fait tomber l'assertion.

### La flèche est posée par mesure, et un décalage écrit en dur ne pouvait pas marcher

La bulle se positionne par rapport à la **barre latérale** ; la roue est placée
par le rembourrage que **Twitch** donne à son titre — une valeur que ce fichier ne
connaît pas, qui n'est pas la même en colonne réduite, et qui peut changer sans
prévenir.

Relevé avant correction : **flèche à 223 px, centre de la roue à 234,5**. Elle
désignait le bord du bouton, pas le bouton. On demande donc leur position aux
deux, et on pose la flèche entre les deux :

| situation | écart mesuré |
| --- | --- |
| avec le rembourrage de Twitch (approximé à 10 px) | **0,0 px** |
| roue collée au bord, sans rembourrage (page de test) | **3,0 px**, borne de la marge anti-coin |

C'est la seule écriture de style en ligne du fichier, et elle est bornée : elle
n'a lieu que tant que la bulle existe, c'est-à-dire une fois dans la vie d'une
installation.

### Ce que le banc ajoute

Trente-deux assertions, six mutants, aucun survivant :

| mutant | l'assertion qui tombe |
| --- | --- |
| `ensureRoue()` retiré de la passe | « la passe suivante la repose, une seule fois, dans le titre neuf » |
| le filtre de schéma d'adresse retiré | « une adresse qui n'est pas celle d'une extension est refusée » |
| la garde de cible du voile retirée | « le clic DANS le cadre ne ferme pas » |
| la garde de source du message retirée | « un message de fermeture venu de la page est ignoré » |
| les `!important` du mouvement réduit retirés | « le battement s'arrête entièrement » |
| `placerFleche` neutralisé | « la flèche vise le centre de la roue » |

Le scénario 121 mérite un mot de plus. Twitch est une application à page unique,
et son titre est **remonté à chaque navigation interne** : une roue posée une
seule fois disparaîtrait au premier clic sur une chaîne, sans erreur et sans
trace. Le banc rejoue exactement ce que fait React — le titre est **remplacé**
par un nœud neuf, pas vidé, ce qui est la seule façon d'éprouver la garde
`contains` — puis exige que la roue revienne, **une seule**, dans le titre neuf.

La roue est aussi posée **à côté** du `<h3>` et non dedans, parce que
`renameRootTitle()` écrit `textContent` sur ce `<h3>` à chaque passe : posée
dedans, elle serait effacée une fois par seconde, et le seul symptôme serait un
bouton qui clignote.

### Ce que `npm run addon` apprend au passage

Une entrée de `web_accessible_resources` qui nommerait un fichier absent du
paquet donnerait un cadre **vide** — sans erreur, sans message, sans rien à
déboguer : le navigateur refuse la navigation en silence. Ces entrées rejoignent
donc la liste de ce que le manifeste nomme et que le paquet doit contenir. Mutant
joué : renommer la ressource en `panneau-absent.html` fait tomber le contrôle.

## La page d'installation avait tout, sauf ce qu'elle devait dire (v4.11.1)

La 4.11 ouvre un onglet à l'installation. Elle y ouvrait **le panneau complet** :
le rail de quinze sections, l'en-tête de vue, et trois boutons de pied qui
proposent d'exporter un rapport et d'effacer un historique — à la minute où il
n'existe encore ni l'un ni l'autre. Le mode d'emploi était là, quelque part, et
la seule phrase qui comptait n'y était pas.

**Ce que cette page a à dire tient en deux propositions**, et le reste lui nuit :
merci, et *voici où est l'icône*. Tout ce qui ne sert pas ces deux-là est retiré.

### Ce qui part, et pourquoi chaque retrait se justifie seul

| bloc | pourquoi il part |
| --- | --- |
| le rail | aucune de ses sections ne peut répondre : elles interrogent toutes un onglet Twitch au premier plan, et il n'y en a pas |
| l'en-tête de vue | il titre « Mode d'emploi » au-dessus d'un mode d'emploi |
| les trois boutons du pied | exporter un rapport vide, relancer une sonde qui n'a rien à sonder, effacer une mémoire qui n'existe pas |

Trois retraits, un seul attribut : `?vue=onglet` pose `data-vue` sur `<html>`,
et la feuille fait le reste. **Ce n'est toujours pas une seconde page** — c'est
la même, avec deux blocs en moins et un en plus.

### Ce qui arrive : un merci, une phrase, un dessin, une flèche

Le **merci** est en 30 px parce que c'est la première phrase que quelqu'un lit
de ce produit, et qu'un merci qui chuchote n'est pas un merci. La **phrase**
dit où est l'icône, en 17 px, avant tout le reste.

Le **dessin** est une maquette de barre d'outils en SVG : la barre d'adresse
sans faux texte — un faux texte se lit comme une adresse à déchiffrer —, le
bouton en pièce de puzzle là où les navigateurs rangent les extensions, et
l'icône entourée d'un anneau violet.

> **La maquette porte la vraie icône**, `icons/icon48.png`, pas un dessin qui
> lui ressemble. Ce qu'on demande à l'utilisateur est de **reconnaître une
> image** dans sa barre d'outils ; un fac-similé approximatif lui ferait
> chercher autre chose. L'anneau est posé **avant** l'image dans le SVG, sinon
> il recouvrirait ce qu'il désigne.

La **flèche** est la seule chose de cette page qui ne pointe pas vers la page.
Sa cible est le coin haut-droit du **navigateur**, au-dessus du document : d'où
l'ancrage en haut à droite et le tracé qui monte vers le coin. Elle est
`aria-hidden` — elle n'a rien à dire à quelqu'un qui écoute la page, et tout à
cacher. Sous 720 px elle disparaît : elle n'a plus de coin à désigner sans
recouvrir le texte, et **une flèche qui pointe à côté est pire qu'une flèche
absente**.

> **Une infobulle avait été posée sur la flèche, et elle est repartie.** Son
> hôte porte `pointer-events: none` : le libellé existait dans les douze
> locales, et rien ne pouvait jamais l'afficher. La clé `panelWelcomeArrow` est
> partie avec — douze traductions d'une phrase que personne n'aurait lue.

Le titre s'arrête à `calc(100% - 200px)` : sans cette réserve, un titre long
passerait sous la flèche, et deux choses se liraient l'une sur l'autre. **La
phrase qui suit a la même réserve, et il a fallu une mesure pour le savoir** —
`min(62ch, calc(100% - 200px))`. À 1100 px tout tient ; à 780 le merci passe sur
deux lignes, la phrase descend d'autant, et elle entrait dans la flèche.

### Le bandeau nomme le produit

Il disait « l'icône de l'extension de la barre d'outils ». Quelqu'un qui a
quatre extensions épinglées ne sait pas de laquelle on parle. Il dit maintenant
**« l'icône Cowlor's Sidebar »**, dans les douze locales.

### Ce que le scénario 123 mesure

Il relève **les deux vues**, parce qu'un seul attribut les sépare : une règle
qui viserait `html` sans le qualifier abîmerait la popup sans que personne ne la
regarde. Neuf assertions, prises à **deux largeurs**, et une bonne part porte
sur ce qui **ne doit pas** changer.

| ce qui est mesuré | pourquoi ça échouerait sans |
| --- | --- |
| la popup n'a pas le bloc d'accueil, et garde rail et pied | expliquer où est l'icône à quelqu'un qui vient de cliquer dessus |
| le bloc est le **premier enfant** du guide | une phrase d'accueil sous treize chapitres n'est plus une phrase d'accueil |
| ses trois phrases ne sortent pas en clé brute | `panelWelcomeThanks` affiché tel quel, en première seconde d'usage |
| la maquette porte `icons/icon48.png` | un dessin approchant fait chercher autre chose |
| la flèche est là et `aria-hidden="true"` | un lecteur d'écran qui annonce une flèche décorative |
| elle ne recouvre **aucun texte**, à 780 px comme à 1100 | à 780 px le merci passe sur deux lignes, la phrase suivante descend et entre dans la colonne de la flèche — invisible à 1100 |
| rail, pied et en-tête de vue sont absents | les trois retraits, chacun vérifié |
| le mode d'emploi a **le même nombre de chapitres** dans les deux vues | la preuve que ce n'est pas une seconde page |
| la page reste haute comme la fenêtre | la régression des **2933 px** de la 4.11, qui faisait défiler le rail avec le guide |

## Se faire trouver, et l'or qui n'avait pas de version claire (v4.11)

### Le problème, dit en une phrase

**Un utilisateur ne trouve pas une icône qu'il ne voit pas.** Depuis Chrome 89,
une extension fraîchement installée n'est pas dans la barre d'outils : elle est
rangée derrière le bouton « pièce de puzzle », et n'en sort que si on l'épingle.
Les données, les dix-neuf réglages et le mode d'emploi de treize chapitres
vivaient donc derrière un clic que personne ne savait pouvoir donner.

Trois réponses, qui échouent séparément et se vérifient séparément.

### 1. Un onglet, à l'installation et une seule fois

`onInstalled` ouvre `panneau.html`. C'est le **seul moyen qui atteigne tout le
monde**, épinglé ou non : une pastille sur l'icône ne se voit pas quand l'icône
est cachée, et une infobulle demande qu'on survole ce qu'on n'a pas trouvé.

À l'installation, **pas aux mises à jour** — `reason` distingue les deux, et une
extension qui ouvre un onglet à chaque version se fait désinstaller.

**Aucune permission n'est demandée pour ça.** `chrome.tabs.create` vers une page
de l'extension n'en exige aucune ; seule la *lecture* des propriétés d'un onglet
réclamerait `tabs`, et on ne lit rien.

**C'est la même page, pas une seconde.** Une page d'accueil séparée aurait
divergé du panneau à la première section ajoutée — et c'est précisément le
panneau qu'on veut faire connaître. Elle se reconnaît à `?vue=onglet` et relâche
les deux nombres qui la contraignaient à une popup.

> Posée à `height: auto`, la page grandissait avec le mode d'emploi — **2933 px
> mesurés** — et le rail s'étirait d'autant, à défiler avec elle. Le panneau
> cessait d'être deux colonnes qui défilent chacune de son côté pour devenir une
> longue page. La hauteur reste donc celle de la fenêtre.

### 2. Un bandeau, là où l'utilisateur regarde déjà

L'onglet s'ouvre **ailleurs**, et se ferme parfois sans être lu. Le bandeau, lui,
parle dans la barre latérale — au moment précis où elle vient de changer sous les
yeux de son propriétaire, et où la question « qui a fait ça ? » est déjà posée.

**Sa difficulté n'est pas de s'afficher, c'est de ne s'afficher qu'aux
nouveaux.** `content.js` ne peut pas savoir qu'une installation vient d'avoir
lieu : `onInstalled` vit dans le service worker, dont deux mondes le séparent. Il
reconnaît l'inverse — une mémoire déjà remplie prouve une **ancienneté**.

Et c'est là qu'est le piège, parce que cette mémoire se remplit en quelques
secondes :

> **La décision se prend une fois et s'écrit.** Sans ça, le roster se remplit, la
> reconnaissance d'ancienneté devient vraie au chargement suivant, et le bandeau
> n'aurait été montré qu'à ceux qui regardaient l'écran à la bonne seconde.

Le scénario 121 éprouve exactement ce point : il recharge la page **après** que
le roster s'est rempli, et exige que le bandeau soit toujours là.

Il ne porte **aucun lien**. Nous ne pouvons pas ouvrir le panneau à la place de
l'utilisateur — `chrome.action.openPopup` exige un geste sur l'icône elle-même et
n'existe pas partout — donc on ne promet pas un clic qui ne se produirait pas. On
indique, on n'agit pas.

> **Un marqueur inventé a failli partir dans cette version.** La règle qui masque
> le bandeau en colonne réduite visait `body.tse-collapsed`, qui ne correspond à
> rien : le bandeau serait resté affiché dans une barre de cinquante pixels sans
> que personne ne s'en aperçoive avant une capture d'écran. Les deux sélecteurs
> qui masquent déjà la barre de filtre ont été recopiés à l'identique.

### 3. Une infobulle qui nomme ce qu'on trouve derrière

`default_title` disait le nom du produit, que celui qui survole connaît déjà. Il
dit maintenant ce qu'il y a derrière. Coût nul, portée faible — mais celui qui
trouve enfin l'icône mérite mieux qu'une redite.

Un `__MSG_…__` qui ne correspond à aucun message donne une infobulle **vide**,
silencieusement : `npm run addon` vérifie donc que la clé existe dans **les
douze** locales, pas seulement la locale par défaut. Une infobulle traduite dans
onze langues sur douze est exactement le genre de trou qu'on ne voit jamais
depuis sa propre machine.

---

## L'or n'avait pas de version claire, et aucune mesure ne pouvait l'attraper

Signalé par une capture : en clair, le pseudo d'une chaîne abonnée devenait un
**rectangle blanc**. Il n'était pas effacé — il était peint.

Le pseudo est rempli par un **dégradé découpé au texte**, avec un remplissage
transparent. Ses arrêts vont de `#ffc86e` à `#fff6dc` : **1,53:1 et 1,08:1 sur du
blanc**. Superbes sur du noir, invisibles sur du blanc.

**Et le scénario 115 passait.** Il relève le contraste de chaque texte dans les
deux thèmes — en lisant `color`, qui vaut ici `transparent`. Un texte peint par
un dégradé échappe à toute lecture de couleur : il faut mesurer ses **arrêts**.
Le contrôle passait en ne regardant rien.

La méthode existait déjà, quatre lignes plus haut : l'arc-en-ciel du subathon se
vérifie sur tout son tour, parce qu'aucun instantané ne suffit. Elle n'avait
simplement jamais été appliquée ici.

**Le défaut est dans les deux modes clairs**, pas seulement le forcé : la 4.8 a
repeint toute la feuille et a laissé l'or derrière, parce que l'or ne se déclare
pas comme une couleur. Le thème forcé n'a fait que le rendre visible plus tôt.

Les teintes claires sont **mesurées**, sur les deux fonds de carte du clair :

| arrêt | rôle | sur `#ffffff` | sur `#f7f7f8` |
| --- | --- | --- | --- |
| `#8a5900` | l'or — déjà celui du badge « abonné » | 5,98:1 | 5,59:1 |
| `#7a4e00` | l'éclat : en clair il **fonce**, il n'éclaire pas | 7,20:1 | 6,72:1 |
| `#9c4f6b` | le reflet rose, version lisible | 5,61:1 | 5,24:1 |
| `#7c5a1e` | la catégorie | 6,29:1 | 5,88:1 |

Le plancher d'un petit texte est à 4,5:1 ; le pire de ces arrêts est à 5,24. Le
halo part en clair — c'est un filtre de lueur pensé pour détacher des lettres
claires d'un fond noir, et sur du blanc il ne détache rien.

Quatre assertions neuves mesurent désormais **chaque arrêt** du dégradé, dans les
trois situations : sombre, clair donné par Twitch, clair forcé.

## Forcer ce que Twitch fait déjà, et deux fiches qui mentaient (v4.10.2)

### « Sombre forcé devient plus foncé que l'auto »

Le drapeau de forçage disait « un thème est choisi ». Il devait dire **« le thème
choisi DIFFÈRE de celui de la page »**. Forcé en sombre sur un Twitch déjà sombre,
nos repeintures s'ajoutaient aux siennes au lieu de les remplacer, et le fond
passait au `base` là où Twitch posait son `alt`.

Écrit ainsi, le cas **disparaît** : choisir le thème que la page porte déjà
retire l'attribut, et tout le bloc redevient inerte. C'est la seule façon de
garantir que « sombre forcé sur Twitch sombre » soit *identique* à « auto » —
pas approchant : identique, puisque pas une règle ne s'applique.

### Ce que Twitch peint sans passer par une variable

En clair forcé, le fond de la barre passait bien au clair, mais la carte
**survolée** restait sombre. Ces surfaces ne lisent pas `--color-background-*` :
Twitch les écrit en dur, et une variable redéfinie n'a rien à y rattraper. On ne
les devine pas, on les recouvre — sous thème forcé seulement, où l'attribut
n'existe que si les deux thèmes diffèrent réellement.

### Centrer était la première réponse, et elle était courte

Le filtre survivant se recentrait. Il **remplit** maintenant la ligne. Le menu
langue, qui tient d'ordinaire dans cinquante pixels parce qu'il ne montre qu'un
drapeau, gagne alors de quoi écrire le nom de la langue à côté : l'espace ne se
contente pas d'être occupé, il sert.

Le nom est **toujours** construit ; c'est la feuille qui décide de le montrer. Le
fabriquer conditionnellement aurait voulu dire reconstruire les deux menus à
chaque bascule du réglage, et se souvenir de le faire — un `display` n'a rien à
se rappeler. Le globe prend le libellé qu'il portait déjà en infobulle, plutôt
qu'un second mot à tenir d'accord avec le premier.

Le **tri**, lui, reste centré : ses six boutons ne s'étirent pas, et les étaler à
deux mettrait un bouton dans chaque coin. Les deux rangées n'ont pas la même
réponse parce qu'elles n'ont pas le même problème.

### L'audit, et ses deux vraies prises

**Les douze fiches promettaient deux réglages retirés la veille.** « Le relevé
des abonnements se coupe d'un clic », « l'apprentissage des visites aussi » —
faux dans les douze langues. C'est exactement la faute que le contrat `CITES`
empêche dans l'autre sens : là, la fiche promettait ce qui n'existait pas
*encore* ; ici, ce qui n'existait *plus*, et rien ne couvrait ce sens-là. Les
phrases sont réécrites sur ce que le produit fait, et **entrent au contrat** pour
que la prochaine suppression les emporte. Trois mutants, trois morts.

**Les README annonçaient « les trois `console.log` » ; il y en a onze.** La ligne
ne comptait que ceux dont le texte est écrit en clair et manquait les huit qui
passent par la table `S.console*` — huit appels tout aussi légitimes, invisibles
à une lecture qui cherche une chaîne. Stables depuis la 4.0.0 : c'est le chiffre
qui s'était périmé, pas le code.

### Un contrat de plus, pour un trou que l'audit a dû chercher à la main

Un réglage marqué `css: true` dont aucune règle ne porte le jeton est un
interrupteur qui ne fait **rien** : il s'affiche, il se coche, il s'écrit au
stockage, et rien ne bouge. Aucune assertion ne l'aurait attrapé — elles
éprouvent les réglages qu'elles nomment, pas ceux qu'on ajoutera. Le scénario 118
croise désormais la table `OPT_DEFS` avec les sélecteurs que le navigateur a
**réellement acceptés**, dans les deux sens.

## Ce que la mesure a dit, et ce que le raisonnement disait (v4.10.1)

Un retour de terrain, une liste de quinze points, et un symptôme qui revenait
sur presque tous les interrupteurs : **« le panneau bugue complètement »**.

### Le défaut était une case à cocher invisible

Mon premier diagnostic était le bon piège, mais pas le bon défaut. Le conteneur
des réglages n'avait pas de `min-height: 0` — l'erreur que le bloc du mode
d'emploi documente en toutes lettres deux versions plus tôt, et dans laquelle je
suis retombé. Je l'ai corrigée. **Le document mesurait toujours 2033 pixels.**

C'est la mesure qui a nommé le coupable :

```
DÉBORDENT : [ { quoi: "INPUT", h: 20, bas: 811,  pos: "absolute" },
              { quoi: "INPUT", h: 20, bas: 903,  pos: "absolute" },
              { quoi: "INPUT", h: 20, bas: 948,  pos: "absolute" }, … ]
```

Les cases sont posées **en absolu** par-dessus leur piste, pour rester dans
l'ordre de tabulation au lieu d'être retirées par un `display: none`. Leur
libellé ne portait pas `position: relative` : « absolu » se rapportait donc au
**bloc conteneur initial**, c'est-à-dire au document. Les dix-neuf cases
s'empilaient à des centaines de pixels du haut de la page, et une popup de barre
d'outils se dimensionne sur `documentElement.scrollHeight`. D'où une fenêtre de
sept cents pixels dont les cartouches et le pied partaient hors champ, à chaque
repeinture.

**Une case invisible qui déborde ne se voit pas ; elle se mesure.** Le scénario
120 mesure désormais le document, pas la règle : ce qui compte n'est pas qu'un
`position: relative` soit déclaré, c'est qu'aucun contrôle ne sorte de son
conteneur, quelle qu'en soit la cause.

### L'interrupteur de l'aperçu ramenait quelque chose

« Quand on décoche l'aperçu on a quand même une petite fenêtre horizontale au
survol. » Cette fenêtre n'était pas la nôtre : c'est `.tw-dialog-layer`, le
conteneur modal que **Twitch** pose sous son propre tooltip de carte, et que
l'extension masque pendant le survol via un drapeau posé sur `<body>`.

J'avais placé l'interrupteur avant ce drapeau. Le couper rendait donc à Twitch
un tooltip masqué depuis toujours : **un interrupteur qui ramène quelque chose
n'est pas un interrupteur.** Il descend d'un cran — le voile reste posé, et rien
ne s'arme pour autant : ni minuteur, ni préchargement, ni requête.

### « Vient de démarrer » était deux choses

Le réglage ne retirait que la barre violette. C'est le **lavis** sur le fond de
la carte qui la fait remarquer, et il restait. Le dégradé du co-stream frais est
d'ailleurs écrit séparément — `background-image` contre `background` — si bien
que neutraliser l'un laissait l'autre.

### Forcer n'est pas suivre

En « auto », nos surfaces se servent chez Twitch : `var(--color-background-alt,
…)`, dont la valeur de repli ne sert que si Twitch n'a pas défini la variable.
C'est le bon comportement — nos ajouts se peignent avec les couleurs de la page
qui les porte.

Forcé, cette délégation se retourne. Le clair demandé pendant que Twitch reste
sombre donnait des **textes noirs sur des fonds restés noirs** : ils lisaient nos
jetons, les fonds lisaient ceux de Twitch. La feuille cesse donc d'emprunter dès
que le thème est forcé, et reprend les variables de Twitch **sur la barre
latérale seulement** — les redéfinir sur la racine aurait repeint le site entier,
ce que personne n'a demandé : le réglage s'appelle « thème DANS Twitch ».

Et la seconde moitié du défaut, qui ne se voit qu'à la mesure : **une variable ne
rattrape pas une propriété déjà héritée.** Redéfinir `--color-text-base` sur la
barre ne change rien à un `color` calculé sur un ancêtre. Il faut le reposer.

### Trois réglages retirés

`Déplier « Voir plus »`, `Relever mes abonnements` et `Apprendre mes visites`
sont partis — jugés inutiles à l'usage. La périodicité du relevé reste, elle.

Le contrat de parité a fait exactement son travail : il a dénoncé les **sept
clés devenues orphelines** dans les douze langues, sans qu'on ait à les chercher.

### Ce qui reste à vérifier sur le terrain

**La pastille de collaboration** a été signalée comme disparue. Le scénario 17 la
couvre et passe, donc le chemin de code tient ; ce qui manque est la mesure sur
le vrai Twitch, que rien ici ne peut atteindre. Le rapport compte désormais deux
nombres qui répondront en une ligne : combien de cartes portent le « +N » de
Twitch, et combien portent notre pastille. Zéro et zéro veut dire qu'aucune
collaboration n'est à l'antenne ; du « +N » sans pastille veut dire que c'est
nous.

## Un onglet Options, et les trois règles qui le tiennent (v4.10)

Dix-neuf réglages, choisis dans un catalogue d'une soixantaine. Le code des
cases à cocher est la partie facile ; ce qui décide, c'est l'architecture.

### Où vivent les réglages, et pourquoi c'est imposé

Le manifeste ne demande **aucune permission** — `npm run addon` l'exige — donc
`chrome.storage` n'existe pas ici. Les réglages vivent dans le `localStorage` de
**twitch.tv**, à côté des visites, des abonnements et du roster.

Ça se paie, et il faut le dire : **pas de synchronisation entre machines**, et
« effacer les données du site twitch.tv » efface aussi les réglages. L'export en
JSON du panneau est le seul contournement, et il est volontairement manuel.

### 1. On n'écrit que les écarts

Le stockage ne contient que ce qui **diffère** du défaut, et la clé disparaît
quand tout y revient — `removeItem`, pas `{}`.

Sérialiser l'état complet aurait figé les défauts du jour de l'installation dans
le navigateur de chacun. Le jour où l'un d'eux change, il doit changer pour tout
le monde **sauf** pour ceux qui l'avaient explicitement touché. C'est la même
raison qui fait que les jeux — les onze badges, les six tris — stockent ce qu'on
**retire** et non ce qu'on garde : le douzième badge qui arrivera devra être
actif chez tout le monde sans que personne n'ait à rouvrir le panneau.

### 2. On ne lit jamais le stockage dans une boucle

`valeurs` est un instantané en mémoire, relu seulement quand quelque chose
change. C'est la leçon de la 4.5.3, où un `querySelectorAll` par carte et par
branche avait suffi à faire sentir le scan.

### 3. Ce qui est CSS reste CSS

Onze de ces réglages ne font que **masquer** quelque chose. Les faire passer
par du JavaScript aurait voulu dire retoucher chaque carte à chaque scan, et se
souvenir de la remettre quand le réglage change. Trois attributs sur `<html>` et
des sélecteurs d'attribut font le même travail sans qu'on parcoure quoi que ce
soit — le mécanisme du thème de la 4.8, réemployé.

```
data-tse-off     jetons de ce qui est éteint : « duree badge-hype tri-alpha »
data-tse-or      l'or de l'abonnement, quand il ne vaut pas « plein »
data-tse-apercu  la largeur de l'aperçu, quand elle ne vaut pas « normal »
```

### L'invariant qui protège les mille assertions d'avant

**Sans réglage touché, aucun attribut n'est écrit sur la racine.** Tout le bloc
CSS des réglages est inerte : pas un de ses sélecteurs ne s'apparie, et la
feuille est celle d'avant au caractère près.

Ce n'est pas une valeur bien choisie, c'est un **attribut absent** — donc
vérifiable à l'œil, et vérifié dans les deux sens par le scénario 118 : absent
au départ, et exact dès qu'on coupe quelque chose.

### Le panneau ne sait pas ce qu'est un réglage

Il reçoit de la page trois ensembles — ce qui est réglable, ce qui est réglé, ce
qui serait par défaut — et ne porte **que** la présentation : l'ordre, les
titres, les libellés.

Une seconde table des types et des valeurs permises aurait divergé de celle de
`content.js` au premier réglage ajouté, et c'est le panneau qui aurait eu tort en
silence : une case pour un réglage disparu, ou rien pour un réglage neuf.

`npm run parity` déduit désormais les clés de libellé de la table `OPT_DEFS`.
**Ajouter un réglage sans lui écrire de libellé fait échouer la parité dans les
douze langues d'un coup** ; sans ce lien, il se serait affiché sous son
identifiant brut.

### Le banc a trouvé une faute dès sa première exécution

J'avais dérivé le défaut de `abosPeriode` de `CFG.SUBS_PAGE_TTL`, pour ne pas
répéter le nombre six. C'était faux, et l'assertion « chaque défaut de choix
appartient à sa propre liste de valeurs » l'a dit du premier coup :

**`tests/build.mjs` réécrit cette constante à quatre secondes** pour que le
relevé des abonnements soit éprouvable. Le défaut du réglage devenait 0,0011 —
absent de sa propre liste, impossible à poser, introuvable dans le menu.

Les deux nombres ne disent pas la même chose : la constante est une durée qu'on
accélère pour mesurer, le réglage est un choix d'utilisateur en heures. Qu'ils
coïncident en production est un fait, pas une définition. Ils sont séparés, et
une assertion lue **sur le fichier source** — seul endroit où la constante a
encore sa valeur de production — garde ce qui les relie encore.

### Onze libellés qu'on n'a pas écrits

Les cases des badges empruntent leurs noms au mode d'emploi, qui les portait
déjà. Ce n'est pas une économie de clés : c'est la garantie que la case montre
**exactement** le badge que le chapitre 3 dessine et que la carte affiche. Onze
clés neuves auraient pu dériver de celles-là ; celles-là ne peuvent pas dériver
d'elles-mêmes.

Et ce qui ne se traduit pas ne se traduit pas : « 360p30 », « 4:19 » et « 30 »
sont des exemples ou des symboles, pas des mots.

### Les mutants

| Mutant | Assertion qui tombe |
| --- | --- |
| la règle CSS de la durée disparaît | la durée reste visible malgré son jeton |
| le stockage écrit l'état complet | l'écart n'est plus seul, et la clé ne part plus |
| la validation accepte tout | la valeur hors liste passe, l'ancienne est perdue |
| les jeux stockent ce qu'on garde | le jeton préfixé devient son contraire |
| le rattrapage du focus est retiré | le focus retombe sur le corps du document |
| l'aperçu coupé s'arme quand même | il s'ouvre alors qu'on l'a éteint |
| un identifiant disparaît de `GROUPES_OPT` | le contrat de présentation dénonce l'oubli |
| le thème forcé est ignoré | « clair » ne tient pas quand Twitch redit « sombre » |

### Ce qui n'y est pas, et pourquoi

Le catalogue proposé en comptait une soixantaine. Ce qui a été écarté à dessein :

- **La mémoire des choix d'interface** — tri, filtres, mode Top Chaînes. Ce sont
  des choix de session, et les retenir est un autre débat que celui des
  réglages.
- **Le son de l'aperçu.** `muted` est exigé par la politique d'autoplay des
  navigateurs, et un son qui part au survol est hostile.
- **« Toujours animé malgré le système ».** Passer outre un réglage
  d'accessibilité explicite n'est pas une option à offrir. Le sens inverse —
  « toujours calme » — le serait ; il n'a simplement pas été demandé.

## Le mouvement réduit, relu de près (v4.9)

La mesure a tranché. La commande ajoutée la veille a rendu ceci, sur le Chrome
de l'utilisateur :

```
verdict          "immobile — mouvement réduit demandé par le système"
fraiches          1        ← la carte est bien là
animations        0        ← et rien ne l'anime
mouvementReduit   true     ← parce que le système l'a demandé
opacite           1
largeur           4.8
```

Trois signalements, deux corrections justes mais hors sujet, et la réponse en une
ligne : **Chrome rapportait `prefers-reduced-motion: reduce`, Firefox non.** Même
machine, même réglage Windows, deux lectures. La barre était présente et
parfaitement immobile — l'utilisateur voyait la marque, il ne la voyait pas
vivre.

### Ma règle de la 4.7 était trop large, et la norme le dit

J'avais arrêté ce battement **net**. C'était une lecture grossière du réglage.

La WCAG définit l'« animation de mouvement » comme celle qui crée l'**illusion
d'un déplacement**, et exclut explicitement de cette définition les changements
de couleur, de flou et d'**opacité**. Le `scaleX` de la barre est du mouvement —
il change une taille — et il doit partir. Son opacité, non.

Sous « mouvement réduit », le battement **demeure donc, en version calme** :

| | mouvement libre | mouvement réduit |
| --- | --- | --- |
| largeur | 3 → 6 px, animée | **4,8 px, fixe** |
| halo | 4 → 18 px, animé | **10 px, fixe** |
| opacité | 0,3 → 1 | **0,45 → 1** |
| cycle | 1,4 s | **2 s** |

Quelqu'un qui demande moins de mouvement n'a pas demandé moins d'information. Il
a droit au même signal, dit plus doucement.

### Deux assertions tournées, et c'est une mesure de terrain qui l'a exigé

Le scénario 113 **constatait** l'arrêt net (« mouvement refusé : le battement
s'arrête »), et le 116 constatait `animations: 0`. Les deux encodaient une
politique que la norme ne demandait pas. Ils exigent maintenant les deux moitiés
à la fois : que la largeur ne varie **pas d'un centième de pixel**, et que
l'opacité respire encore.

| Mutant | Assertion qui tombe |
| --- | --- |
| le battement s'arrête de nouveau | l'opacité ne respire plus |
| le régime calme garde le `scaleX` | la largeur varie de trois pixels |

Le verdict de `tse.battement()` nomme désormais ce régime — « battement calme —
mouvement réduit respecté » — sans quoi une amplitude de 2,2 se lirait comme un
défaut alors qu'elle est le comportement voulu.

### Et les arcs-en-ciel du subathon, pour la même raison

J'avais écrit, en 4.7, que leur arrêt restait justifié parce que leur limite
n'était pas le mouvement mais la **fréquence**. L'utilisateur a
répondu : « ce n'est pas normal qu'il soit arrêté alors que sur Firefox oui. » Il
a raison, et mon argument était incomplet.

Une **teinte qui dérive** n'est pas un déplacement : la même définition WCAG qui
exclut l'opacité exclut la couleur. Ce qui reste vrai, c'est que le critère
2.3.1 vise le **clignotement**, et que ce cycle change de teinte 5,3 fois par
seconde — au-delà des trois par seconde du critère, dont seul l'argument d'aire
le met hors de cause.

**Le compromis porte donc sur la cadence**, seule grandeur que les deux critères
partagent : le tour passe de 1,5 s à **8 s**, soit une teinte par seconde — le
tiers du seuil de clignotement. La couleur vit encore, elle cesse d'être agitée.
La cadence reste commune à la pastille et au badge, comme en mouvement libre :
les deux sont visibles ensemble, et deux durées différentes se décaleraient en
quelques secondes.

| Mutant | Assertion qui tombe |
| --- | --- |
| l'arc-en-ciel s'arrête de nouveau | les deux animations sont absentes |
| il ralentit à peine (2 s au lieu de 8) | la cadence reste au-dessus du seuil |
| seule la pastille ralentit | les deux cadences divergent — 8 s contre 1,5 |

### Un banc qui s'appuyait sur le produit pour tenir sa mesure

Le relevé de la palette des badges, dans le mode d'emploi, ouvrait sa vue sous
« mouvement réduit » **pour que l'arc-en-ciel s'arrête** — sans quoi comparer
dix teintes pendant qu'une onzième change dépend de l'instant. Ce ralentissement
lui retirait sa béquille.

Il fige désormais les animations lui-même, puis les relance. Un banc qui s'appuie
sur un comportement du produit pour tenir sa mesure change de sujet le jour où ce
comportement change — et il ne le dit pas.

## Faire dire à la page ce qu'on ne peut pas y voir (v4.8.1)

« Toujours pas de clignotement côté Chrome. » Troisième fois. J'y ai répondu
deux fois par une hypothèse — d'abord le halo qui sautait faute de couches
appariées, puis `prefers-reduced-motion`, que Chrome et Firefox ne rapportent pas
pareil sous Windows. Les deux corrections étaient justes ; aucune n'a réglé le
problème, et aucune n'était **vérifiable d'ici**.

Cette machine ne joint pas Twitch. Un battement ne se prouve pas par un
raisonnement, et j'ai déjà écrit dans ce README ce que coûte une correction
fondée sur une supposition — quatre versions, sur la ligne du pseudo. Cette
fois, la page répond elle-même.

### Quatre nombres à la place de deux hypothèses

Le rapport porte désormais un bloc `battement`, et chacune de ses lignes ferme
une branche entière de l'enquête :

```
battement.fraiches     0     ← aucune chaîne en direct depuis moins de dix minutes
battement.animations   0     ← la règle ne s'applique pas : sélecteur, cascade, feuille
battement.etat     running   ← « paused » dirait un navigateur qui gèle ses animations
mouvementReduit     true     ← l'utilisateur a demandé l'immobilité
```

Aucune de ces quatre réponses n'a besoin d'être devinée. Et la première n'aurait
jamais été produite par une hypothèse : il n'y a peut-être rien à voir **parce
qu'il n'y a rien à montrer**.

### Et une commande pour l'amplitude

Un instantané dit qu'une animation existe et qu'elle tourne. Il ne dit pas qu'on
la **voie** : une animation peut être présente, à la bonne durée, en cours — et
parfaitement invisible si son amplitude est plate. C'est exactement ce que
décrit « ça ne clignote pas » sans que rien ne paraisse cassé.

```js
await tse.battement()
// { verdict: "le battement est bien là", fraiches: 1, animations: 1,
//   etat: "running", dureeMs: 1400, opaciteMin: 0.3, opaciteMax: 1,
//   rapport: 3.33, largeurMin: 3, largeurMax: 6 }
```

Le relevé se fait image par image sur un cycle entier, dont la durée est **lue
sur l'animation** et jamais recopiée. Quatre verdicts possibles, et ils ne se
confondent pas : pas de chaîne fraîche · aucune animation · immobile par demande
du système · amplitude plate.

### Le scénario 116 éprouve le diagnostic, pas le battement

Sept assertions, trois mutants, aucun survivant. Ce dépôt a déjà livré **deux
diagnostics qui regardaient à côté** — le bloc de centrage sautait justement les
cartes dont le centrage était signalé, et `sansAncre` comptait des crochets là où
l'ancre était devenue autre chose. Un diagnostic qu'on ne mesure pas ment aussi
bien qu'un autre.

| Mutant | Assertion qui tombe |
| --- | --- |
| le compte d'animations ne filtre plus sur la barre | il annonce deux animations là où il n'y en a aucune |
| le verdict ne distingue plus l'immobilité demandée | « règle absente » là où l'utilisateur a demandé le calme |
| l'amplitude ne décide plus du verdict | « le battement est bien là » sur une animation plate |

**Le troisième mutant a survécu à la première rédaction**, et c'est lui qui a
fait écrire la quatrième situation du scénario : dans un décor sain, mesurer
l'amplitude ou se contenter de trouver l'animation donne le même verdict. Il
fallait le décor où elles divergent — des arrêts aplatis, animation intacte — et
c'est justement la branche pour laquelle cette commande existe.

## Les deux thèmes de Twitch (v4.8)

Deux demandes : « il n'y a plus de clignotement sur Chrome, c'est bon côté
Firefox », et « adapte entièrement l'extension quand Twitch est en clair ».

### Le clignotement disparu d'un navigateur et pas de l'autre

La 4.7 a rendu ce battement sensible à `prefers-reduced-motion` — il était la
seule animation du produit à l'ignorer. Or **Chrome et Firefox ne rapportent pas
ce réglage de la même façon sous Windows** : Chrome le déduit de « Afficher les
animations », Firefox suit longtemps sa propre préférence. Même machine, même
réglage, deux réponses — et donc un battement d'un côté, pas de l'autre.

Le rapport le dit désormais : `page.mouvementReduit`. La question ne se posera
pas une deuxième fois.

Une vraie faiblesse a été corrigée au passage : les deux arrêts du battement ne
portaient pas le **même nombre de couches d'ombre**. Une liste d'ombres ne
s'interpole que couche à couche ; l'arrêt le plus court était complété par du
transparent, si bien que le halo **sautait** au lieu de croître. La moitié du
battement se perdait là.

### « Adapte entièrement l'extension »

Cette feuille de 1 900 lignes ne connaissait qu'un thème. Ses surfaces étaient
écrites en dur pour le sombre — texte clair, bordures blanches translucides,
champs noirs — si bien qu'en clair l'extension posait des panneaux **noirs au
milieu d'une page blanche**.

**Deux familles, et elles ne se traitent pas pareil.**

Les **neutres** se déduisent des variables de Twitch, qui basculent toutes
seules. Nos valeurs sombres restent en repli : si Twitch renomme une variable,
on retombe sur le rendu d'avant plutôt que sur du texte invisible.

Les **accents** ne se déduisent pas. Un texte pâle sur un fond translucide clair
est illisible, quelle que soit la variable. Les douze badges ont donc une
seconde palette, et ses contrastes ont été **mesurés** : entre 4,66 et 5,16:1
sur le fond réellement composé de chaque badge — car un badge translucide ne se
juge pas contre la surface du panneau mais contre le mélange des deux.

### L'encre

Une trentaine de couleurs de cette feuille sont du blanc à une opacité donnée :
un texte à 0,42, un filet à 0,17, une hachure à 0,34. Les recopier une à une en
noir, c'était soixante valeurs à tenir en parallèle et une occasion d'en oublier
une. On ne bascule donc que les **composantes** :

```css
--tse-encre: 255, 255, 255;   /* sombre */
--tse-encre: 0, 0, 0;         /* clair  */
```

Les opacités ne changent pas, parce que ce sont elles qui portent la hiérarchie,
et une hiérarchie n'a pas de thème. Ce qui reste blanc dans les deux thèmes est
nommé : les **reflets**. Un éclat spéculaire sur une bordure dorée n'est pas de
l'encre, et le lustré du ruban se pose sur des surfaces colorées, jamais sur le
fond d'un panneau.

### Le repère est le nôtre

La feuille ne s'accroche pas au `data-a-theme` de Twitch : elle suit
`data-tse-theme`, que nous posons d'après trois indices successifs — l'attribut
de Twitch, sa classe de racine, puis la **luminance du fond réellement calculé**,
qui ne peut pas se périmer. Quatre versions ont appris ce que coûte une règle
suspendue à un attribut de l'hôte.

Un observateur surveille la racine : le thème est un interrupteur du menu, la
page ne bouge pas autour, et un aperçu resté noir sur une page devenue blanche
se verrait.

### Ce que les mesures ont trouvé dans le thème SOMBRE

Le harnais ne posait pas les variables de Twitch. En les lui donnant — sans quoi
aucun contraste relevé n'aurait de sens — **trois défauts sont apparus, dont un
qui n'a rien à voir avec le thème clair** :

`--color-text-alt-2, #adadb8` et `--color-text-alt, #6e6e7a` : **la variable et
son repli se contredisaient**. #adadb8 *est* la valeur de `--color-text-alt`, pas
celle de `--color-text-alt-2`. Le repli disait donc une intention que la variable
défaisait dès qu'elle existait — c'est-à-dire sur le vrai Twitch et nulle part
ailleurs. Mesuré sur la durée d'un direct : **3,83:1 au lieu de 8,67**, sous le
seuil AA, depuis toujours. Trois règles étaient touchées.

### Le panneau de la barre d'outils

C'est une page d'extension : elle ne voit ni le `<html>` de Twitch ni sa feuille.
Elle apprend le thème par le rapport et le **retient** d'une ouverture à l'autre.
Tant qu'elle ne sait pas, elle suit `prefers-color-scheme` — un pari, et il est
borné : dès qu'un rapport arrive, l'attribut tranche.

### Le scénario 115

Six assertions, quatre mutants, aucun survivant. Ce qui s'y mesure n'est pas
l'aspect mais la **lisibilité** : « adapté » n'est pas une opinion, c'est un
rapport de contraste.

| Mutant | Assertion qui tombe |
| --- | --- |
| l'encre ne bascule plus | le lavis éclaircit dans les deux thèmes |
| les badges perdent leur variante claire | dix contrastes tombent à 1,26:1 |
| la racine ne reçoit plus le repère | le thème n'est ni posé ni rapporté |
| l'arc-en-ciel clair revient aux teintes sombres | la pire image tombe à 1,12:1 |

**L'arc-en-ciel se mesure sur tout son tour**, et pas seulement au repos : la
première rédaction n'avait vérifié que sa couleur d'arrêt, et la sonde l'a saisi
en plein cycle à **4,45:1** — sous le seuil, un huitième du temps. Les huit
images tiennent maintenant entre 5,08 et 5,35:1.

## Tous les badges, un battement qu'on voit, et deux arcs-en-ciel qui ne s'arrêtaient pas (v4.7)

Trois demandes : montrer **tous** les badges dans le mode d'emploi, rendre le
clignotement violet des nouveaux streams **visible**, et auditer le reste.
L'audit a répondu à la deuxième question mieux que prévu.

### Le mode d'emploi en montrait dix ; l'aperçu en pose douze

Il manquait deux pastilles, et pas les moins fréquentes :

- **Ancien abonné** — le même or que l'abonnement en cours, désaturé. Une teinte
  à part entière, qui n'était montrée nulle part.
- **Le badge neutre** — celui qui reprend **telle quelle** une mention ajoutée
  par Twitch et que l'extension ne traduit pas. C'est le seul badge qui n'a pas
  de couleur, et c'est l'absence de couleur qui le définit : lui en donner une
  le trahirait.

Le chapitre dit désormais les variantes qui partagent une teinte plutôt que de
les taire : le bleu du co-stream se lit « Co-stream de … » côté invité et
« Stream Hôte » côté organisateur ; le violet dit « En live avec … ».

L'assertion du banc suit : onze modificateurs, dix couleurs, et deux contrôles
de plus — le douzième badge porte exactement la couleur par défaut, et l'or de
l'ancien abonné est plus pâle que celui de l'abonné sans être le même.

### « On le remarque à peine »

Le battement du stream frais allait de **0,7 à 1** d'opacité. Trente pour cent
d'écart sur une barre de trois pixels, dans une colonne qui en compte quinze :
le signalement est juste, et il était même généreux.

On ne rend pas un signal visible en le rendant bruyant, on lui donne de
l'**amplitude**. Trois leviers, aucun coûteux :

| | avant | après |
| --- | --- | --- |
| opacité | 0,7 → 1 (rapport 1,4) | **0,3 → 1** (rapport 3,3) |
| largeur | 3 px, fixe | **3 → 6 px**, par `scaleX` |
| halo | 6 px | **18 px** |
| cycle | 1,8 s | **1,4 s** |

La barre **respire** : un `transform` ne provoque aucune mise en page, le
compositeur s'en charge seul. Et le banc mesure l'amplitude parcourue, pas la
déclaration — la durée du cycle est lue sur l'animation elle-même, jamais
recopiée.

### Et ce que l'audit a trouvé en tirant ce fil

**Le battement du stream frais était la seule animation du produit à ignorer
`prefers-reduced-motion`.** Le subathon, l'or de l'abonnement, l'anneau de
l'avatar s'y arrêtent depuis longtemps ; la barre violette, non. Elle s'arrête
désormais — **à son point haut**, large et lumineuse : on perd le mouvement, pas
l'information.

Puis, en croisant *chaque* `@keyframes` avec ce bloc, une trouvaille plus
sérieuse : **les deux arcs-en-ciel du subathon ne s'arrêtaient pas non plus**, et
pour deux raisons différentes.

- La **pastille** est déclarée sur `.side-nav-card[data-tse-subathon-day]
  .tse-subathon-jour` — trois classes contre une : la **spécificité** l'emportait.
- Le **badge** est déclaré plus bas dans la feuille, à spécificité égale :
  l'**ordre** l'emportait.

Ce n'est pas un détail de style. Le commentaire de ces deux animations invoquait
alors ce réglage comme la sortie qui mettait leur fréquence — huit teintes par
seconde et demie — hors de cause vis-à-vis de la WCAG 2.3.1. **La garantie était écrite, et
elle ne tenait pas.** Sur une règle d'accessibilité, « doit gagner » est
exactement ce que `!important` veut dire.

### `*` ne couvre pas les pseudo-éléments

La feuille du panneau s'annonçait exhaustive :

```css
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
```

Le sélecteur universel désigne des **éléments** ; `::before` et `::after` n'en
sont pas. La barre violette de la maquette — un `::before` — continuait donc de
battre là aussi. La règle nomme désormais les trois.

### Le tourniquet de chargement, laissé tel quel

Il reste une animation hors de ce bloc : la roue du voile de chargement. Le choix
est délibéré et mérite d'être écrit plutôt que passé sous silence — une roue
arrêtée ne se lit pas comme « immobile », elle se lit comme **bloquée**, et elle
ne clignote pas. C'est la seule motion du produit dont le retrait coûterait plus
qu'il ne rapporte.

### Les scénarios 113 et 114

Treize assertions, six mutants, aucun survivant :

| Mutant | Assertion qui tombe |
| --- | --- |
| l'ancienne amplitude revient (0,7 → 1) | le rapport d'opacité, et l'écart lui-même |
| la barre ne respire plus en largeur | la largeur rendue ne varie plus |
| le mouvement réduit n'arrête plus le battement | l'animation tourne encore |
| le mouvement réduit l'arrête à son point bas | la barre reste, mais pâle et fine |
| `!important` retiré du bloc | les deux arcs-en-ciel tournent, couleurs à l'appui |
| le bloc n'annule plus que la pastille | le badge de l'aperçu tourne encore |

### Ce que l'audit n'a PAS trouvé

Comme la fois précédente : aucun identifiant mort, aucune constante `CFG` jamais
lue, aucune classe `tse-` stylée sans être posée, aucune clé du rapport qui
n'arrive pas au panneau. Les quatre passes automatiques sont revenues vides — et
c'est la cinquième, celle qui croise les animations avec le mouvement réduit, qui
a tout donné.

## L'audit de la ligne du pseudo (v4.6)

Signalement : « le symbole Subathon à côté du nom du streamer est collé à lui »,
puis la précision qui donne la cause — « côté Top Chaînes, quand il n'y a qu'une
chaîne suivie ». Et une demande d'audit de tout ce qui a été ajouté depuis la
4.0.

Les deux se sont rejoints : **le défaut signalé et quatre autres viennent de la
même supposition**, et cette supposition n'était plus vraie.

### Le JS avait appris à se passer du crochet, pas la feuille de style

`cardNameEl` sait retrouver la ligne du pseudo sur une carte qui n'a pas le
crochet d'automatisation de Twitch. La pastille se posait donc bien. Mais
**quatre règles CSS** visaient encore cette ligne par
`p[data-a-target="side-nav-title"]`, et sur une carte décorée — « En live avec »,
co-stream, et sur **toute carte fabriquée par clonage de l'une d'elles** — elles
ne s'appliquaient pas. En silence.

| Ce qui cessait de s'appliquer | Ce que ça donnait |
| --- | --- |
| `display: flex` + `gap: 4px` sur la ligne du pseudo | la pastille de subathon collée au nom — **le signalement** |
| l'or d'une carte d'abonné | la catégorie dorée, le nom non |
| le centrage d'une carte sans catégorie | le pseudo en l'air, sur le décor EXACT qui avait fait écrire la règle |
| la 3e ligne de Twitch | (voir plus bas : celle-là pouvait effacer le pseudo) |

**On nomme donc la ligne nous-mêmes.** Le scan pose une classe `tse-nom` sur ce
que `cardNameEl` retrouve, et les quatre règles la suivent. Ce n'est pas une
invention : la catégorie et l'avatar d'une carte d'abonné sont désignés de cette
façon depuis longtemps, et le commentaire qui les accompagne disait déjà
pourquoi — « une feuille de style qui recopie cinq emplacements finit par en
oublier un ». Le nom était le cinquième.

### La règle qui pouvait effacer le pseudo

Twitch peut afficher une 3e ligne (le titre du direct) dans le bloc metadata. On
la masque en visant « tout frère suivant du groupe » — une règle écrite quand le
groupe portait le pseudo **et** la catégorie, où tout ce qui le suivait était
forcément un intrus.

Twitch a depuis sorti le pseudo du groupe. Il le pose **avant**, et un frère
précédent n'est pas atteint par `~` : la règle ne fait donc rien de mal
aujourd'hui. Le jour où l'ordre changerait, elle effacerait le pseudo de toutes
les cartes, d'un coup et sans un mot. Elle nomme désormais ce qu'elle épargne.

### Le repérage ne dépend plus d'un rang non plus

Le scénario écrit pour cette règle a trouvé autre chose : avec le pseudo posé
**après** le groupe, `cardNameEl` rendait la catégorie. La règle « la première
ligne » était juste pour la disposition d'aujourd'hui, et fausse pour sa
symétrique.

Elle est donc remplacée par une règle de **structure** : une ligne qui vit hors
du groupe nom + catégorie est le pseudo — quel que soit son côté. Le rang ne sert
plus que lorsque les deux lignes sont dans le groupe, c'est-à-dire la disposition
historique et celle d'une chaîne sans catégorie.

### Une sonde pour l'élément le plus visible de la carte

L'avatar a la sienne, le compteur a la sienne, la catégorie a la sienne. **Le
pseudo n'en avait aucune** — et c'est l'élément dont l'emplacement a changé deux
fois en une série de versions, en emportant six fonctions à chaque fois. Le
rapport annonçait « tous les sélecteurs critiques répondent » pendant que Top
Chaînes était vide.

`cardName` est désormais une sonde **critique**. Un déplacement du pseudo se
verra au premier rapport, à la ligne prévue pour ça.

### Deux diagnostics qui regardaient à côté

Deux blocs ajoutés pour trancher des questions ouvertes ne pouvaient pas les
trancher :

- **`centrage`** sautait les cartes sans le crochet — c'est-à-dire les cartes
  décorées, celles-là mêmes dont le centrage était signalé. Trois rapports de
  suite ont affiché « cartes 0 » sur une sidebar qui en portait.
- **`subathons.sansAncre`** comptait les crochets, alors que l'ancre est ce que
  `cardNameEl` trouve depuis la 4.5.2. Il annonçait « pas d'ancre » sur des
  cartes qui en avaient une.

Les deux passent par `cardNameEl`.

### Une régression de performance, corrigée

L'exclusion de la ligne du nom dans `cardCategoryEl`, écrite en 4.5.3, déroulait
une collection complète par branche et par carte — cinq branches, une centaine de
cartes, à chaque scan — là où le cas ordinaire se tranche du premier coup. Elle
ne déroule plus la liste que dans le cas exact pour lequel elle a été écrite.

### Ce que l'audit n'a PAS trouvé

Il faut le dire aussi : aucun identifiant mort, aucune constante `CFG` jamais
lue, aucune classe `tse-` stylée sans être posée, et aucune clé du rapport qui
n'arrive pas au panneau. Les quatre passes automatiques sont revenues vides.

### Les scénarios 111 et 112

Neuf assertions, huit mutants, aucun survivant :

| Mutant | Assertion qui tombe |
| --- | --- |
| la règle du subathon revient au crochet | la pastille touche le pseudo |
| la marque `tse-nom` n'est plus posée | la carte fabriquée n'a plus de marque du tout |
| le `gap` tombe à zéro | l'écart mesuré vaut 0 |
| l'or revient au crochet | le nom d'une carte d'abonné décorée n'est plus doré |
| la règle de centrage revient au crochet | la carte sans crochet est à 8 px de son axe |
| la 3e ligne n'épargne plus le pseudo | le pseudo posé après le groupe disparaît |
| la ligne hors du groupe n'est plus reconnue | le pseudo et la catégorie s'inversent |
| le rang prend la dernière ligne | deux scénarios tombent |

## Twitch a sorti le pseudo du groupe (v4.5.5)

Signalement : « ça a l'air de marcher, sauf que le nom du streamer et sa
catégorie sur Top Chaînes sont inversés ». Trente cartes fabriquées, toutes
fausses — un défaut qu'aucun compteur n'aurait montré, puisque tout était
compté juste.

Et pour la première fois en cinq versions, **le rapport portait la réponse**. Le
recensement ajouté la veille disait :

```
crochet   9        ← neuf cartes sur dix portent le crochet d'automatisation
p1       10        ← mais leur groupe nom+catégorie n'a qu'UNE ligne
```

Ce groupe en a toujours porté **deux**. Twitch en a sorti le pseudo : il vit
désormais à côté, dans le bloc marqué `side-nav-card-metadata`, et
`.side-nav-card__metadata` ne garde que la catégorie.

### Une seule carte s'en ressentait, et c'était la mauvaise

Les neuf cartes qui gardent le crochet ne changent rien : il les désigne sans
ambiguïté. La dixième — une carte décorée, sans crochet — cherchait son pseudo
**dans le groupe**, et n'y trouvait que la catégorie. Or c'est elle, et elle
seule, qui sert de modèle au clonage.

Le repli cherchait donc dans le mauvais conteneur. Le corriger tient en un mot :
la **boîte marquée** d'abord, le groupe ensuite. Elle contient les deux lignes,
quelle que soit la disposition.

### Aucun attribut ne désigne le pseudo

Trois rédactions ont cherché un **attribut** qui le désigne, et le terrain les a
démenties l'une après l'autre :

- le crochet d'automatisation — absent des cartes décorées ;
- « la ligne sans `title` » — elle écarte les **deux** lignes quand Twitch titre
  aussi le pseudo, ce qu'il fait dès qu'il le tronque ;
- la même, quand seule la catégorie n'est pas titrée — elle désigne alors
  carrément la **mauvaise**, avec aplomb.

C'est **l'ordre** qui le désigne, et lui seul : le pseudo est la première ligne,
dans toutes les dispositions observées — celle où les deux lignes vivent dans le
groupe, celle où Twitch en a sorti le pseudo, celle d'une chaîne sans catégorie
qui n'a qu'une ligne. Le titre du direct, troisième ligne, vient après les deux
autres et n'est donc jamais premier.

### Le recensement nomme désormais le déplacement

`p0…p3` comptait les lignes du seul groupe. Son « une seule ligne » était la
bonne nouvelle, mais il ne disait pas **où était passée l'autre**. Le bloc porte
maintenant `b0…b3` pour la boîte marquée, et surtout `nomHorsGroupe` : le nombre
de cartes dont le pseudo a quitté le groupe. Un seul nombre, et il nomme le
changement.

### Les scénarios 109 et 110

Cinq assertions, cinq mutants, aucun survivant :

| Mutant | Assertion qui tombe |
| --- | --- |
| le groupe repasse devant la boîte marquée | le pseudo et la catégorie s'inversent |
| le repère prend la dernière ligne | les deux scénarios tombent |
| le repère redevient « la ligne sans `title` » | le scénario 110, et lui seul |
| le recensement ne compte plus la boîte marquée | `b2` reste à zéro |
| `nomHorsGroupe` ne compte jamais | il reste à zéro là où il doit valoir 1 |

**Le scénario 110 existe parce que le 109 ne suffisait pas.** Le 109 reproduit
le balisage du terrain, où les deux lignes portent un `title` — et l'ancienne
heuristique y rend le bon résultat **par accident** : elle ne trouve rien et
retombe sur la première ligne. Elle survivait donc au banc. Le 110 la départage
avec une carte où seul le pseudo est titré, et c'est le seul endroit où elle
meurt.

## Ce qu'un rapport ne pouvait pas dire (v4.5.4)

Quatre versions ont corrigé le repérage du pseudo, et chaque rapport suivant a
démenti la précédente. Le dernier ne disait plus `modele: repli` mais **rien du
tout** — plus aucun candidat ne passait, alors que `subathons.sansAncre 0` au
même instant prouvait que le repérage fonctionnait sur une autre carte de la
même sidebar.

C'est la quatrième fois, et c'est le signe que le problème n'est pas dans la
correction : **il est dans ce qu'on peut observer.** On déduisait le balisage
d'un compteur à zéro, ce qui revient à deviner.

### Le recensement du balisage

Le rapport porte désormais un bloc « LIGNES DE CARTE », relevé sur les cartes en
direct de la section suivie. Il ne juge rien, il compte :

```
cartes          7     ← cartes en direct examinées
crochet         1     ← celles qui portent p[data-a-target="side-nav-title"]
groupe          7     ← celles qui exposent le groupe nom + catégorie
p0 p1 p2 p3     0 1 6 0
toutesTitrees   6     ← groupes dont TOUTES les lignes portent un `title`
nomTitre        6
sansNom         0     ← cartes pour lesquelles le repérage échoue quand même
```

Sept nombres, et ils tranchent une question que quatre versions ont dû poser.
Un banc ne peut pas les produire : ils décrivent le Twitch d'aujourd'hui, celui
qu'aucune machine d'ici ne peut joindre.

### Et où la passe s'arrête

`page.sortie` dit à quel moment le classement a renoncé : `hors-mode`,
`pas-de-section`, `pas-de-modele`, `pas-de-conteneur`, `clone-nul`, ou `ok`.
Un « modele: repli » accompagné de « fabriquees 0 » se lisait de **deux
façons** — le modèle a été refusé, ou son clone l'a été — et cette ambiguïté a
coûté une version à chaque fois.

`page.modeleEssais` complète : combien de modèles se sont défaits **au clonage**
avant qu'un tienne. Zéro est le cas nominal. Une passe qui s'y reprend à trois
fois se lisait jusqu'ici exactement comme une passe qui réussit du premier coup,
et ce n'est pas la même santé.

`page.modele`, enfin, ne dit plus le candidat **choisi** mais celui qui a
réellement **fabriqué** une carte. Une passe où toutes les cartes existent déjà
n'en éprouve aucun : elle annonçait pourtant un modèle, sans qu'il ait rien fait.

### Deux repères valent mieux qu'un

La 4.5.3 avait ramené le repérage du pseudo à un seul critère — « la ligne qui
ne porte pas de `title` », la catégorie portant toujours le sien. Il est juste,
et il est **fragile** : Twitch pose aussi un `title` sur le pseudo quand il le
tronque. Les deux lignes en portent alors un, le critère ne les départage plus —
il les écarte **toutes** — et la carte entière est refusée.

À défaut de ligne sans `title`, on prend donc la **première** du groupe : le
pseudo est au-dessus de la catégorie dans toutes les dispositions connues de
Twitch. Se tromper de ligne serait grave ; il n'y a ici qu'une ligne à se
tromper, et c'est la bonne.

Le même `title` trompait `cardCategoryEl`, qui prenait « le premier `p[title]` »
— donc le pseudo. L'exclusion de la ligne du nom, introduite en 4.5.3 pour le
seul dernier repli, vaut maintenant pour **toutes** ses branches.

### Un clone raté ne condamne plus la passe

Un candidat peut passer toutes les gardes et ne se révéler inexploitable qu'une
fois **cloné** : `scrubClone` retire les décorations de Twitch, et si l'une
d'elles enveloppe le groupe nom + catégorie, le clone perd ses lignes.

La passe abandonnait alors tout, et la suivante reprenait le même mauvais
modèle, indéfiniment. Le classement garde désormais une **liste de candidats** —
jusqu'à trois cartes neutres, la carte décorée, puis le modèle mémorisé — et ne
renonce qu'après les avoir épuisés.

Deux corrections qui se tiennent : le modèle ne se mémorise qu'**après** avoir
produit une carte. L'une sans l'autre ne servirait à rien — la mémoire rejouée
serait le mauvais modèle, celui qui venait justement de s'y installer.

### Les scénarios 107 et 108

Neuf assertions, quatre mutants, aucun survivant :

| Mutant | Assertion qui tombe |
| --- | --- |
| le filet de `cardNameEl` saute | plus rien n'est fabriqué quand les deux lignes sont titrées |
| `cardCategoryEl` n'exclut le nom que du dernier repli | la carte fabriquée porte « c0 » pour pseudo |
| un clone raté condamne à nouveau la passe | le classement reste vide, `sortie: clone-nul` |
| le modèle se mémorise dès qu'il est choisi | la mémoire rejoue le modèle qui ne produit rien |

**Deux décors ont dû être corrigés**, et les deux erreurs se ressemblent : ils
éprouvaient moins que ce qu'ils annonçaient. Le premier attendait la catégorie
traduite là où le DOM porte le nom brut du jeu. Le second enveloppait la seule
ligne du pseudo — or le filet prend alors celle de la catégorie, et le clone
« réussissait ». Il enveloppe désormais le groupe entier, seul décor qui prive
vraiment le clone de ses deux lignes.

## Les deux gardes qui s'annulaient (v4.5.3)

La 4.5.2 a corrigé un chemin et en a laissé un autre ouvert. Le rapport du
lendemain le disait en trois lignes :

```
modele        repli     ← un modèle a été trouvé, et nettoyé
modeleRefus   pseudo    ← et son clone n'avait pas de ligne de pseudo
fabriquees    0
```

`subathons.sansAncre 0` au même instant : le repli de la 4.5.2 **fonctionnait**
sur la carte de subathon. Il échouait sur le clone. La différence entre les deux
tient à un mot : **la catégorie**.

### Le repli se mordait la queue

`cardNameEl` cherchait la ligne qui n'est « ni la catégorie ni porteuse d'un
`title` », et demandait la catégorie à `cardCategoryEl`. Or le DERNIER repli de
`cardCategoryEl` est « le premier `<p>` de la metadata » — c'est-à-dire **le
pseudo lui-même**, dès que la chaîne n'annonce aucune catégorie.

Sur une carte sans crochet **et** sans catégorie, une garde écartait le nom,
l'autre écartait la catégorie, et il ne restait rien à écrire. Les deux gardes,
décrites comme complémentaires, étaient en fait **mutuellement destructrices** —
sur exactement la carte pour laquelle elles avaient été écrites.

Le défaut se reproduit en huit lignes de décor, et il rend les trois valeurs du
rapport à l'identique : `{"fab":0,"modele":"repli","refus":"pseudo"}`.

### Et il en cachait un second, que personne n'aurait vu venir

La même confusion faisait lire le **pseudo comme catégorie**. La fabrication
écrivait donc le nom dans ce `<p>`, puis la catégorie **par-dessus**, dans le
même. Corriger le premier défaut sans voir celui-là aurait remplacé un « Top
Chaînes » vide par un « Top Chaînes » **plein et faux** : trente cartes nommées
d'après leur catégorie. C'est l'assertion qui lit le contenu de la carte
fabriquée qui l'a montré, pas celle qui les compte.

La correction est dans `cardCategoryEl` : son dernier repli ne rend jamais la
ligne du pseudo. **Une carte sans catégorie n'a pas de catégorie** ; c'est `null`
qu'il faut rendre. `data-tse-category` ne vaut donc plus le login, et les filtres
ne s'appliquent plus à une catégorie qui n'existe pas.

### Un modèle se vérifie avant d'être adopté

Reste la forme générale du défaut, qui aurait survécu à la correction du cas
particulier. Le second choix de modèle ajouté en 4.5.1 passe **avant** le modèle
mémorisé ; s'il se révèle inexploitable, la fabrication rend `null` et le clonage
abandonne pour de bon.

On exige donc du candidat ce que la fabrication exigera de son clone : un lien,
et une ligne de pseudo. Un candidat qui échoue n'est ni adopté **ni mémorisé** —
il laisse la place au suivant, et à défaut au modèle relevé plus tôt dans la
session. La carte qui n'est pas une carte de chaîne — une promotion de Twitch,
une invite à ouvrir les stories — s'écarte ici toute seule, sans qu'on ait à la
nommer. Les deux boucles de modèle sont concernées : le classement mondial et
les cartes en avance sur Twitch.

### Les scénarios 105 et 106

Huit assertions, quatre mutants, aucun survivant :

| Mutant | Assertion qui tombe |
| --- | --- |
| `cardCategoryEl` retrouve son repli naïf | la carte fabriquée porte « c0 » au lieu de son pseudo |
| | …et la chaîne sans catégorie s'en voit inventer une à son nom |
| le garde saute dans le classement mondial | le modèle mémorisé ne reprend jamais la main |
| le garde saute dans les cartes en avance | plus une seule carte n'est posée en avance |
| le garde ne vérifie plus que le lien | les deux à la fois |

**Le décor a dû être corrigé une fois**, et l'erreur mérite d'être écrite : il
faisait passer la carte illisible en premier *dans le DOM*. Or c'est le **tri de
l'extension** qui décide de l'ordre, et il range par spectateurs — la carte
propre repassait donc devant, le garde n'avait plus rien à écarter, et le mutant
qui le retire survivait en silence. La carte illisible est désormais la plus
regardée des deux.

## La ligne du pseudo quand Twitch ne la marque pas (v4.5.2)

Signalement, le lendemain de la 4.5.1 : « j'ai plus de cartes dans Top Chaînes
quand je n'ai plus qu'une seule qui a *en live avec* ». Le rapport donnait la
correction de la veille **et** son insuffisance, sur deux lignes voisines :

```
modele      repli     ← un modèle A ÉTÉ trouvé, et nettoyé
fabriquees  0         ← et il n'en est toujours rien sorti
```

La 4.5.1 avait bien ouvert la porte : la carte décorée servait désormais de
modèle. Le clonage renonçait **un cran plus bas**.

### Twitch ne marque pas toujours le pseudo

Tout ce fichier visait le pseudo par `p[data-a-target="side-nav-title"]`, et
c'est le bon repère — sur une carte ordinaire. La disposition « En live avec »,
celle que Twitch rend avec `primary-with-small-avatar`, **ne le porte pas**.
Sans ce crochet, la fabrication rendait `null` et pas une carte ne naissait.

C'était déjà la cause du défaut d'avant. À la 4.5, une chaîne au quatorzième
jour de subathon n'avait pas sa pastille : même chaîne, même disposition, même
crochet manquant. Le repli avait alors été écrit **sur place**, dans la pose de
la pastille. Deux endroits savaient la même chose, un seul l'avait appris.

### Un seul endroit le sait

`cardNameEl` cherche, dans le groupe nom + catégorie — `.side-nav-card__metadata`
quand Twitch le pose, le bloc marqué sinon —, la première ligne qui n'est ni la
catégorie ni porteuse d'un `title`. Le repli est **étroit**, et il le doit :
écrire un pseudo dans la mauvaise ligne serait pire que de ne rien écrire. La
troisième ligne de Twitch, le titre du direct, vit hors de ce groupe et n'est
donc jamais candidate.

Trois appelants s'en servent : la pastille de subathon, la fabrication des
cartes du classement, et **le nom lu dans l'aperçu**. Ce troisième-là n'a jamais
été signalé et écrivait pourtant déjà faux : le badge d'un co-stream annonçait
« Co-stream de **Ironmouse** » — la capitalisation du login, son dernier recours
— pendant que la carte de l'hôte, deux lignes plus haut, affichait « IronMouse ».

### Ce que le rapport dit maintenant

`page.modeleRefus` vaut `liens`, `pseudo`, ou rien : ce qui a manqué au clone
quand il n'a pas abouti. Un « modele: repli » accompagné de « fabriquees 0 » ne
disait pas lequel des deux — et c'est l'écart qu'un même utilisateur a rapporté
deux fois de suite.

### Le scénario 104, augmenté

Il passe de quatre assertions à sept, et son décor prive désormais la carte de
son crochet — ce que fait Twitch, et que le décor ne faisait pas.

| Mutant | Assertion qui tombe |
| --- | --- |
| la fabrication renonce sans repli | rien n'est fabriqué, et le rapport dit « pseudo » |
| le repli vise la ligne porteuse d'un `title` | le pseudo est écrit dans la catégorie |
| l'aperçu revient au sélecteur brut | le badge nomme « Seule » là où la carte dit « seule » |

La deuxième ligne mérite un mot. La première rédaction n'assertait **que** le
nombre de cartes fabriquées — or un repli qui se trompe de ligne les fabrique
quand même : les compteurs restaient verts et les cartes affichaient n'importe
quoi. Lire OÙ le nom et la catégorie ont été écrits est ce qui fait tomber le
mutant. Les scénarios 17 et 23 clonent la même carte décorée ; leur décor a
suivi.

## Top Chaînes vide, et ce que le rapport disait en deux chiffres (v4.5.1)

Signalement : « gros problème, on ne voit que IronMouse dans Top Chaînes.
Actuellement elle est également la seule en live dans mes chaînes suivies. » Le
rapport donnait la cause sans ambiguïté :

```
pool        2124      ← le classement mondial est parfaitement connu
fabriquees  0         ← et pas une seule carte n'a été posée
```

### Le mode Top Chaînes ne dessine pas ses cartes, il les clone

C'est ce qui les rend indiscernables de celles de Twitch : toutes les classes
viennent avec le clone. Il lui faut donc un **modèle** — une carte native en
direct — et il n'en acceptait qu'une **neutre**, pour ne pas transposer ses
décorations sur une chaîne qui n'a rien à voir : un badge « +3 » sur l'avatar
d'une chaîne qui ne collabore avec personne, un co-stream inexistant annoncé
dans l'aperçu.

Le raisonnement était juste, sa conclusion trop stricte. **Une seule chaîne
suivie en direct, et elle portait une pastille de collaboration.** Aucun modèle,
donc rien à afficher — sur un classement de deux mille chaînes.

### On ne refuse plus la carte, on la nettoie

`scrubClone` ne retirait que ce que l'extension avait posé. Il retire désormais
aussi ce que **Twitch** pose : mini-avatar de co-stream, mini-avatar d'un « En
live avec », logo de sponsor, pastille de rôle — et le « +N » d'une
collaboration, sous ses deux formes.

Cette dernière mérite un mot, parce qu'elle décide de tout. Quand le « +N » est
**accolé** à la catégorie, la pastille collab le RETIRE du texte : le clone est
propre sans qu'on ait rien fait. Quand il est dans son **propre élément**, elle
se contente de le MASQUER — et `scrubClone` efface les styles. Le « +2 »
reparaissait donc sur **les trente cartes fabriquées**, c'est ce que le mutant
montre.

Le modèle neutre reste **préféré** ; la carte décorée n'est qu'un second choix.
La carte **sponsorisée** reste écartée : sa mise en page diffère — avatar et
statut sur une ligne, puis le nom, puis la catégorie — et aucun nettoyage ne la
redresse.

Les cartes en avance sur Twitch suivaient la même règle et avaient le même
défaut ; elles ont le même repli.

### D'où vient le modèle, écrit dans le rapport

`page.modele` vaut `neutre`, `repli`, `memoire` ou rien. Trois provenances qui ne
disent pas la même chose : la première est le cas nominal, la deuxième dit qu'on
a nettoyé une carte décorée faute de mieux — utile le jour où Twitch inventera
une décoration que le nettoyage ne connaît pas —, la troisième qu'aucune carte
native n'est en ligne et qu'on rejoue un modèle relevé plus tôt.

C'est aussi ce qui rend la **préférence** observable. Une fois les décorations
nettoyées, les deux modèles produisent des cartes identiques : la préférence ne
se lit nulle part dans le DOM, et l'assertion qui prétendait la vérifier ne
prouvait rien — le mutant qui la supprimait survivait. Le rapport la nomme, donc
le banc peut la tenir.

### Le scénario 104

Quatre assertions, quatre mutants, aucun survivant :

| Mutant | Assertion qui tombe |
| --- | --- |
| le second choix de modèle saute | rien n'est fabriqué (le défaut signalé) |
| les décorations de Twitch ne sont plus nettoyées | trente cartes portent un mini-avatar de co-stream |
| le « +N » n'est plus neutralisé | trente cartes portent une pastille « +2 » |
| le modèle neutre n'est plus préféré | le rapport dit « repli » là où il doit dire « neutre » |

Deux d'entre eux ont d'abord survécu. Le décor accolait le « +N » à la catégorie
— forme que la pastille collab retire toute seule — et la préférence était
vérifiée sur un DOM qui ne la porte pas. Les deux corrections du décor sont
écrites au-dessus de leurs assertions.

## Trois retours, et ce qu'un audit a trouvé derrière (v4.5)

### Les entailles disent « coupure », et non « autre catégorie »

Demande : « peux-tu montrer sur la frise une façon de montrer que ce sont bien
des coupures ? » La marque était un trait blanc posé sur le ruban — c'est-à-dire
exactement ce à quoi ressemble une part de plus, d'une couleur qu'on n'a pas
encore vue.

Ce qui fait lire une coupure, c'est l'**interruption** : le fond reparaît là où
le direct s'est arrêté, deux arêtes **ambre** marquent l'entaille, et elle
dépasse légèrement en haut et en bas pour qu'on la voie comme une entaille et non
comme un segment. L'ambre est celui du compte écrit dans l'en-tête : l'œil relie
« 3 coupures » aux trois entailles sans qu'un mot le dise.

Le plancher passe de deux à trois pixels — à deux, l'entaille se confondait avec
la jointure de deux parts voisines. Et chaque entaille porte sa **durée** en
infobulle, que le compte ne dit pas et que trois pixels ne peuvent pas dire ; le
compte lui-même porte la liste complète.

### Au-delà de trois coupures

Question posée, réponse chiffrée. Deux mécanismes, deux bornes :

- les coupures **observées** pendant que l'onglet est ouvert s'accumulent
  jusqu'à `RECONNECT_CUTS_MAX`, soit vingt-quatre ;
- les coupures **retrouvées** dans les archives dépendent du nombre d'archives
  demandées. Trois en 4.3.1 bornaient à deux, cinq en 4.4 bornaient à quatre.
  **Huit** en couvrent sept.

Au-delà, on paierait une charge utile — chaque archive porte ses chapitres —
pour un cas qui ne se produit pas.

### La pastille de subathon qui manquait

Signalement : une chaîne au quatorzième jour, badge **présent dans l'aperçu** —
donc détection juste — et **aucune pastille sur sa carte**, quand ses voisines en
avaient une. Elle était en « En live avec », la disposition que Twitch rend
autrement.

Tout ce fichier vise le pseudo par `p[data-a-target="side-nav-title"]`. Il y a
désormais un **repli**, et il est étroit : la première ligne de la metadata qui
n'est ni la catégorie ni un élément à nous. Écrire « J14 » dans la mauvaise ligne
serait pire que de ne rien écrire.

**Et une mesure, parce que deux versions ont déjà corrigé à l'aveugle ici.** Le
rapport sépare enfin deux choses que l'écart `detectes` / `marquees` confondait :
`sansPastille` ne compte que des cartes **présentes et décorées** dont le jour est
connu, et `sansAncre` dit combien d'entre elles n'ont pas le crochet du pseudo. Si
les deux sont égaux, la cause est nommée.

### La liste qui se dérobe sous le pointeur

Signalement : « en Top Chaînes, on n'a pas le temps de lire une carte, elle
disparaît car la liste s'update et la souris n'est plus sur la carte qu'on
survole. »

C'est structurel : le classement mondial se retrie à chaque relevé, une chaîne
gagne mille spectateurs, et la carte glisse de trois rangs sous un pointeur qui
n'a pas bougé. L'aperçu se ferme alors non parce qu'on l'a quitté, mais parce que
la carte est partie.

**Le tri attend, il ne s'annule pas.** Tant qu'un aperçu est ouvert, l'ordre
affiché reste celui qu'on lisait, et la carte survolée n'est pas retirée même si
elle sort du top trente. La fermeture programme un scan : le classement reprend
aussitôt sa place. Les **contenus**, eux, continuent de vivre — compteurs,
durées, badges : ce qui gênait était le mouvement, pas la fraîcheur, et une
retenue qui gèlerait aussi les contenus remplacerait une gêne par une carte qui
ment.

### Ce que l'audit a trouvé, et que personne n'aurait signalé

La règle de la 4.2 vide la metadata d'une carte **sans catégorie** : elle épargne
le `<p>` du pseudo et ses **ancêtres**, et masque tout le reste. Elle masquait
donc aussi ses **descendants** — or le pseudo d'une carte de subathon n'est pas
un texte nu : c'est une enveloppe et une pastille, toutes deux posées **dans** le
`<p>`.

**Une chaîne sans catégorie en subathon perdait sa pastille et son nom.** Les
deux conditions se rencontrent rarement ; le rapport de l'utilisateur rend
d'ailleurs `cartes 0` sur ce bloc. Personne ne l'aurait signalé avant longtemps,
et il aurait été très difficile de le relier à sa cause. Une troisième exclusion
épargne désormais la descendance, et le scénario 99 porte le cas.

C'est le second défaut de cette série livré par une correction précédente. Les
deux fois, la cause est la même : une règle écrite pour un cas, appliquée à une
population plus large qu'on ne l'avait regardée.

### Ce que l'audit a vérifié sans rien trouver

- **Aucun identifiant mort** parmi les dix-huit ajoutés depuis la 4.2 : chacun
  est déclaré et lu.
- **Tous les registres sont bornés** : `passeDirect` (120 chaînes × 200
  chapitres), `sondees`, `chapitres`, `declarees`, `reprises`, `derniersDirects`,
  `frises`, `empileurs`, `ecarteesDeclaree`.
- **Aucune trace de débogage** : les `console.*` sont l'API publique et deux
  avertissements de panne. Aucun `TODO`, `FIXME` ni `debugger`.
- **Les champs neufs du rapport arrivent bien au panneau** : ils vivent dans des
  objets que le bloc aplatit en entier, ce qui est le seul montage qui ne se
  perde pas en silence.

### Un mutant qui survit, et pourquoi on le dit

`close()` programme un scan pour que l'ordre reprenne sa place **tout de suite**
au lieu d'attendre le relevé suivant. Retirer cette ligne ne fait tomber aucune
assertion : dans le banc, le relevé périodique est accéléré à six cents
millisecondes et rattrape le retard avant qu'on mesure. En production il vaut
trente secondes, et la différence est bien réelle — mais une assertion qui
prétendrait la voir ici serait une assertion de hasard. On garde la ligne, et on
écrit qu'elle n'est pas prouvée.

## Autant de coupures que le direct en a eu (v4.4)

Signalement, et il est précis : « BenZaie a déjà eu une coupure, qui s'est bien
affichée dans la frise et la partie “Précédemment”. Mais il a eu une deuxième
coupure. Et là, plus rien ne s'affiche. » Puis, après réinstallation : « le
survol marche pour BenZaie mais ne prend plus en compte les anciennes
coupures », avec la capture — **« 1 coupure — 41m »** sur un direct qui en avait
davantage.

Deux défauts distincts, et ils se ressemblaient à l'écran.

### La chaîne ne se remontait que d'un cran

La sonde cherchait l'archive qui raccorde au départ du direct courant, et
s'arrêtait là. Un direct coupé deux fois a pourtant **une archive par tronçon**,
et la chaîne se remonte par récurrence : l'archive qui raccorde devient le
tronçon précédent, et **son** départ devient la borne suivante.

```
t-5h        ┤ premier tronçon      (Just Chatting, puis Elden Ring)
t-1h  -1s   ┤ fin        ← coupure
t-1h        ┤ tronçon du milieu    (Rocket League)
t     -1s   ┤ fin        ← coupure
maintenant  ┤ tronçon courant      (VALORANT)
```

Ce qu'on affichait n'était pas faux, c'était **tronqué** — et tronqué de la
pire manière, puisque la partie perdue est la plus ancienne, celle qu'aucune
observation ne pourra jamais rattraper. On demande donc **cinq** archives au
lieu de trois (une par tronçon, plus celle du direct courant), ce qui couvre
quatre coupures.

### Le passé appartenait à une session, pas au direct

Le registre du passé était rangé par identifiant de **stream**. À la coupure
suivante cet identifiant change — c'est la définition même d'une reprise — et
tout le passé récolté disparaissait avec lui. C'est exactement la première
phrase du signalement : la première coupure s'affichait, la seconde effaçait
tout.

**La clé est donc l'origine**, qui ne bouge pas tant que les reprises
s'enchaînent et qui saute dès qu'un vrai nouveau direct commence. C'est le même
critère que celui de la frise, et ce n'est pas un hasard : les deux répondent à
la question « est-ce toujours le même direct ? ». Une origine qui change
invalide le passé d'elle-même, sans purge — un direct de la veille ne réhérite
de rien.

Il s'**accumule** : la sonde y verse les tronçons d'avant, la requête de
chapitres y verse le tronçon courant, et chaque nouvelle coupure ajoute sans
rien retirer.

### Une course entre deux réponses, dans les deux sens

Les deux sources partent au même survol et **ne reviennent pas dans un ordre
garanti**. Or l'adoption d'une reprise DÉPLACE l'origine, du départ du tronçon
vers celui de la chaîne :

- si les **chapitres** arrivent d'abord, ils se rangent sous l'ancienne origine
  et la sonde doit les **reprendre** en arrivant ;
- si la **sonde** arrive d'abord, les chapitres doivent **relire** l'origine au
  moment où leur réponse revient, au lieu d'employer celle qu'ils connaissaient
  au départ.

Les deux corrections sont nécessaires, et chacune est invisible dans l'ordre que
l'autre couvre. Le harnais rendait toujours le même ordre : il porte désormais
un retard par nom d'opération (`__retardOp`), et le scénario joue les deux.

### Le pont mourait dans le cache avant/arrière

Un utilisateur a rapporté, depuis la liste d'erreurs de l'extension :

> Unchecked runtime.lastError: The page keeping the extension port is moved into
> back/forward cache, so the message channel is closed.

…avec le rapport de diagnostic qui allait avec : « ponts : aucun », « démarrage
inachevé », alors que la barre latérale fonctionnait sous ses yeux. Quand une
page entre dans le back/forward cache, Chrome ferme lui-même les ports
d'extension. `visibilitychange` ne rattrape pas le retour — une page restaurée
peut revenir sans que la visibilité ait changé de valeur, et le port reste mort
pour le reste de sa vie.

`pagehide` et `pageshow` sont les deux seuls événements qui nomment ce cycle.
Le pont s'y raccroche, et `persisted` distingue le retour du cache d'un
chargement ordinaire. Le message de console, lui, disparaît parce qu'on
**consulte** `runtime.lastError` dans le gestionnaire de déconnexion : un port
qui tombe est le cas normal ici, et il n'a rien à faire dans une liste
d'erreurs.

### Le scénario 102

Vingt-deux assertions, neuf mutants, aucun survivant :

| Mutant | Assertions qui tombent |
| --- | --- |
| la chaîne ne remonte qu'un cran | 4 |
| le passé reste rangé par session de stream | 9 |
| l'origine est celle du dernier maillon | 3 |
| le tronçon courant ne rejoint pas le passé | 2 |
| le passé n'est pas invalidé quand l'origine change | 1 |
| l'accumulation écrase au lieu de fusionner | 1 |
| le passé n'est pas reporté sous la nouvelle origine | 1 |
| l'origine n'est pas relue à l'arrivée de la réponse | 1 |
| la fenêtre de reprise saute | 2 |

Quatre d'entre eux ont d'abord **survécu**, et c'est ce passage qui a valu le
plus cher — il a fait apparaître la course décrite plus haut, qu'aucune
relecture n'avait vue.

### Un décor qui se trompait une fois sur deux

`lengthSeconds` est un entier de secondes : la fin d'une archive n'est connue
qu'à une demi-seconde près. Le décor visait un trou de **zéro**, qui devenait
donc négatif une fois sur deux — et un trou négatif est rejeté. Le banc a changé
de résultat le jour où un cas s'est ajouté devant, sans que rien d'autre ne
bouge. Les trous se visent désormais à 1,2 s, très à l'intérieur de la fenêtre
de 2,5 s du banc.

## La sonde qui ne partait presque jamais (v4.3.1)

La 4.3 a ajouté une sonde qui demande à Twitch les archives d'une chaîne pour y
retrouver une coupure qu'on n'a pas vue passer. Le rapport de l'utilisateur qui
l'a essayée tient en un chiffre :

```
chapitres.reprise.sondes 1        ← sur 229 survols
chapitres.reprise.trouvees 0
```

### Deux durées qui n'ont rien à voir

Une garde exigeait que le direct courant ait **moins de dix minutes**, au motif
qu'« un direct plus vieux que la fenêtre de reprise ne peut plus être le tronçon
d'après quoi que ce soit ». Elle confondait :

- **l'âge du direct courant**, qui grandit sans cesse ;
- **le trou** entre la fin de l'archive d'avant et le départ de ce direct — deux
  instants **fixes dans le passé**, dont l'écart ne bouge plus jamais.

Un direct qui tourne depuis une heure et demie après une coupure de trois
minutes a toujours un trou de trois minutes. La chaîne signalée était à **1h37**
au moment du test : insondable, et pour une raison qui n'existait pas.

### Le badge et le fait n'ont pas la même durée de vie

C'était déjà écrit ailleurs dans le fichier, et la garde le contredisait :
« Reprise après coupure » est une **nouvelle**, elle s'éteint au bout de dix
minutes. Le **fait**, lui, appartient au direct entier — six heures plus tard,
ce direct a toujours été coupé, et c'est ce que la frise doit pouvoir dire.

Adopter une reprise vieille d'une heure ne rallume donc **aucun** badge : son
horodatage est celui du tronçon, pas celui de la découverte. Elle rend l'origine,
le compte de coupures, la marque sur le ruban et le passé d'avant la coupure.

### Ce qui borne vraiment la dépense

Pas l'âge du direct, mais trois choses qui, elles, sont vraies :

- **une opération par session de stream** — le registre des sessions déjà
  sondées ;
- **au survol seulement**, jamais au scan ;
- **jamais sur une chaîne déjà chaînée**, par observation ou par une sonde
  précédente.

Plus un plafond par page (`RECONNECT_PROBE_MAX`), filet contre un état imprévu,
dont la saturation se lirait dans le rapport.

### Le bloc CENTRAGE était muet, et il ne disait pas pourquoi

Le premier rapport a rendu `cartes 0` — ce qui ne distingue pas « aucune chaîne
n'est sans catégorie en ce moment » de « le marqueur ne se pose pas ». Le bloc
porte donc un second nombre, `sansLigne`, compté sur ce que le **DOM** montre
plutôt que sur notre marqueur, et la géométrie est mesurée sur l'**union** des
deux populations. Égaux, le marqueur suit le DOM ; `sansLigne` seul non nul,
c'est le marqueur qu'il faut aller voir.

### Le scénario 102 porte désormais le cas qui manquait

Un direct de **deux heures** après une coupure d'une seconde — la chaîne
signalée, transposée à l'échelle du banc. Trois assertions, et le mutant qui
rétablit la garde de la 4.3 en fait tomber trois :

| Mutant | Assertions qui tombent |
| --- | --- |
| la garde « direct de moins de dix minutes » est rétablie | 3 |
| le plafond par page est posé à zéro | 4 |

Le premier est exactement le défaut livré en 4.3. Le banc ne pouvait pas le
voir : tous ses directs étaient jeunes.

## La reprise qui ne marchait pas (v4.3)

Deux signalements, une capture d'écran, et un rapport de diagnostic. Trois
défauts, dont un que deux versions avaient manqué.

### La ligne qui détruisait la frise

`suivreCategorie` jetait le registre entier dès qu'un relevé rendait un direct
**en ligne sans catégorie** :

```js
if (id) { frises.delete(login); return; }   // « rien ne dit ce qu'on regarde »
```

Le raisonnement tenait sur l'instant et manquait le cas qui compte : **un direct
qui reprend n'a pas encore de catégorie pendant les premières secondes.** Le
badge de reprise se posait — il ne dépend pas de la catégorie — puis la ligne
suivante jetait le passé que la reprise venait précisément de préserver. C'est
le signalement, mot pour mot : « il avait une frise avant, et il n'en a plus du
tout quand il a repris. »

Le même défaut expliquait un second symptôme qu'on n'avait pas relié : **une
chaîne qui n'annonce jamais de catégorie n'avait jamais de frise non plus**, sa
frise étant détruite à chaque relevé.

Ce qu'on fait à la place : rien. La tenue de session — l'origine, l'identifiant,
la fin de la retenue hors ligne — ne dépend pas de la catégorie et a déjà eu
lieu. Il reste seulement à **ne pas ouvrir de segment** sur une catégorie qu'on
ne connaît pas. Le dernier segment s'étend jusqu'à maintenant : on ne sait pas
que ça a changé, et se taire n'est pas inventer.

### La coupure qu'on n'a pas vue passer

Tout le dispositif de reprise reposait sur une **observation** : pour savoir
qu'un direct a repris, il fallait l'avoir vu en ligne avant la coupure, dans
cette page-ci. Un onglet ouvert pendant la coupure, un rechargement, une chaîne
qu'on ne suit pas — et le direct repart de zéro.

Le signalement venait avec sa preuve. Le rapport disait `page ouverte depuis
344 s` ; la capture de la page « Vidéos » de la chaîne montrait les deux
enregistrements côte à côte :

| Archive | Durée | Âge |
| --- | --- | --- |
| celle d'après | 5:46 | il y a 6 minutes |
| celle d'avant | 9:51:19 | il y a 10 heures |

**Ce que nous n'avons pas vu, Twitch l'a archivé.**

#### Ce que la 4.0 avait conclu, et pourquoi c'était la moitié du problème

La 4.0 avait établi qu'un enregistrement peut **traverser** une reconnexion —
mesuré, un recouvrement de 39 minutes — et en avait tiré qu'il suffisait de
dater la requête de chapitres sur l'origine. C'est vrai **quand Twitch garde le
même enregistrement**. La capture montre le cas inverse, tout aussi réel : un
enregistrement **neuf**, et le passé dans le précédent. Les deux existent ; ne
traiter que le premier laissait le second sans rien.

#### Le critère est un raccord, et il ne se devine pas

`videos(first: 3)` au lieu de 1, et l'on cherche une archive qui **se termine**
dans la fenêtre de reprise avant le départ du direct courant.

- L'archive du direct **courant** commence avec lui : elle ne raccorde rien,
  elle *est* le tronçon d'après. Écartée d'elle-même.
- Une archive terminée il y a six heures ne raccorde rien non plus.
- Une archive terminée trois minutes avant le départ **est** le tronçon d'avant.

Trouvée, elle donne d'un coup le badge, l'origine, le compte de coupures, la
marque sur le ruban — **et ses chapitres**, c'est-à-dire tout ce que le direct a
traversé avant la coupure, daté à la seconde par Twitch.

#### Ce que ça coûte

Une opération, au survol, **une seule fois par session de stream**, et
uniquement sur un direct **jeune** dont on ne sait rien. Une chaîne suivie
depuis le début de son live n'en déclenche aucune : il n'y aurait rien à
apprendre. Les compteurs sont dans le rapport
(`reseau.chapitres.reprise.{sondes, trouvees, adoptees}`).

L'exception du subathon vaut pour la sonde comme pour l'observation directe —
sans quoi la sonde l'aurait contournée par la porte de derrière.

### Le centrage : deux corrections à l'aveugle, et pourquoi

C'est le défaut le plus embarrassant de cette série, parce qu'il a été
« corrigé » deux fois sans effet.

La 3.98 posait `align-self: stretch`, c'est-à-dire **un pari** : que la rangée
étire sa colonne à sa hauteur, de sorte qu'il y ait quelque chose à centrer
dedans. La 4.2 a retiré les intrus de la boîte — vrai problème, vraie
correction — **sans toucher à ce pari-là**. Si Twitch épingle la colonne en
haut, les deux restent inertes.

Et le banc restait vert, parce qu'il **modélise** une rangée qui étire. Une
modélisation qui ne porte qu'un seul des cas possibles ne peut pas départager
une correction qui marche d'une correction qui ne marche pas.

**On ne parie plus, on couvre les deux cas.** Trois déclarations, chacune inerte
là où l'autre agit : `align-self: center` centre la boîte quand elle tient dans
la rangée ; `margin-block: auto` fait de même sur une grille et prend le pas sur
un `align-items` imposé ; la colonne centrée reste pour le cas où la boîte est
étirée malgré tout. En `!important`, parce qu'une règle de Twitch sur la même
propriété gagnait sinon par ordre de cascade et qu'on ne peut pas viser sa
classe — elle est hachée à chaque build.

Le harnais **épingle** désormais la colonne d'une carte, pour de bon, avec une
règle qui gagne. C'est la seule assertion du scénario 99 qui distingue cette
correction de celle de la 3.98.

#### Et une mesure, pour ne pas recommencer une troisième fois

La feuille de style de Twitch n'est pas lisible depuis ce dépôt, et le banc n'en
porte qu'un modèle. Le rapport de diagnostic porte donc un bloc **CENTRAGE** qui
mesure, sur la page réelle : combien de cartes sont marquées sans catégorie,
combien ont leur pseudo à plus de 2 px du centre de leur rangée, l'écart signé
de la première, les deux hauteurs, et ce que le navigateur a retenu de nos
déclarations (`display`, `align-self`, `parentDisplay`). Un `parentDisplay:
block` dirait à lui seul pourquoi aucun alignement ne prend.

### Les scénarios 101 et 102

Quinze assertions, neuf mutants, aucun survivant — **après correction de deux
assertions qui ne prouvaient rien** :

| Mutant | Assertions qui tombent |
| --- | --- |
| la ligne qui détruisait la frise est rétablie | 4 |
| un relevé muet ouvre quand même un segment | 4 |
| la sonde ne part plus | 4 |
| le raccord ne regarde que la première archive | 4 |
| la fenêtre de reprise saute | 2 |
| l'exception du subathon saute | 1 |
| les chapitres d'avant ne sont pas rapportés | 2 |
| la frise n'est pas recalée sur l'origine | 1 |
| la sonde repart à chaque survol | 1 |

Les deux derniers ont d'abord **survécu**, et c'est le passage qui valait le plus
cher :

- *le recalage de l'origine* n'avait aucun effet observable tant que l'archive
  d'avant portait des chapitres — ils datent la frise à eux seuls. Il a fallu
  un décor où l'archive raccorde **sans porter un seul chapitre** : sans le
  recalage, la frise annonce « 0m » à côté de « 1 coupure » sur un direct de
  cinq heures. Elle ne se tait pas, elle se trompe ;
- *le registre des sondes* était couvert par une autre garde — « cette chaîne
  est déjà chaînée » — sur la seule chaîne que le test re-survolait. On
  re-survole désormais une chaîne qui **n'a rien donné**, où cette autre garde
  ne s'applique pas.

Une assertion qui passe sur un mutant ne prouve rien, et le seul moyen de le
savoir est de fabriquer le mutant.

### Attention à l'échelle, dans le banc

`RECONNECT_GAP_MAX` vaut dix minutes en production et **2,5 secondes** dans le
banc (`tests/build.mjs`). Les trous du scénario 102 sont donc exprimés en
secondes : un trou d'une seconde est une reprise, un trou de dix n'en est pas
une. Les écrire en minutes aurait mis les deux hors fenêtre — et les deux
assertions seraient passées sans rien prouver.

## Le co-streamer sans catégorie (v4.2)

**Signalement d'un utilisateur :** « dans un co-stream, si l'un des streamers n'a
pas mis de catégorie, il n'est pas centré verticalement ». La règle qui recentre
ce pseudo existe pourtant depuis la 3.98, et le banc la tient.

### Ce qu'elle supposait sans le dire

La règle **étire** la boîte des métadonnées sur la hauteur de la rangée, puis en
**centre le contenu**. Cela ne recentre le pseudo que si le pseudo est seul à
occuper la boîte. C'est vrai d'une carte ordinaire. Ça ne l'est pas d'une carte
de co-stream : Twitch pose un **mini-avatar dans le bloc metadata** — celui dont
l'`alt` dit « Co-stream d'un stream de … », et dont l'extension tire déjà le
login de l'hôte pour l'aperçu. La boîte fait alors deux lignes même sans
catégorie ; la centrer ne déplace rien, et le pseudo reste en haut.

### On ne nomme pas les intrus, on nomme ce qui reste

Le correctif ne liste pas ce qu'il faut masquer — mini-avatar, « +N » de
collaboration, ligne annexe : la liste changerait au premier remaniement de
Twitch. Il dit l'inverse : **sans catégorie, seul le pseudo occupe de la place**,
tout le reste de la metadata cesse d'en prendre.

**Masquer n'est pas perdre.** Le CSS ne change rien à ce que lisent
`querySelector` et `textContent` : le « +N » est toujours relevé sur le texte de
la carte puis reporté en pastille sur l'avatar, et l'hôte du co-stream est
toujours extractible — l'aperçu au survol continue de dire « Co-stream de … ».

### Le garde-fou, et pourquoi il est sur le conteneur

La règle épargne le pseudo en s'ancrant sur `data-a-target="side-nav-title"`, un
hook d'automatisation de Twitch. Si Twitch le retirait, une règle naïve n'aurait
plus rien à épargner et **effacerait le texte de la carte**. L'exiger sur le
conteneur (`:has()`) la rend **inerte** dans ce cas au lieu de la rendre fausse.

### Le harnais a dû grandir d'un cran

Le vrai Twitch enveloppe le pseudo et la catégorie dans un
`.side-nav-card__metadata`, à l'intérieur du bloc marqué `data-a-target` — une
autre règle de la feuille s'appuie sur ce couple depuis longtemps. Le harnais,
lui, aplatissait les deux en un seul niveau.

Sans ce niveau intermédiaire, la clause qui épargne les **ancêtres** du pseudo
n'était pas testable : la retirer laissait le banc vert alors qu'elle viderait
les cartes en production. Le harnais modélise donc les deux niveaux, et le
mutant qui supprime cette clause tombe désormais avec une carte sans texte.

### Le scénario 99

Cinq assertions, quatre mutants, aucun survivant :

| Mutant | Assertion qui tombe |
| --- | --- |
| la règle saute | le pseudo n'est plus centré |
| la clause qui épargne les ancêtres du pseudo saute | la carte perd son texte |
| le garde-fou `:has()` saute | la carte sans hook est effacée |
| la règle ne se limite plus aux cartes sans catégorie | la carte voisine perd sa catégorie |

## La langue déclarée, second témoin (v4.2)

La 4.1 écarte du classement les chaînes qui posent **plus de deux** tags de
langue. Elle laisse passer celles qui en posent deux, et c'est voulu : un stream
bilingue existe. Mais deux tags suffisent aussi à entrer dans deux classements
sans parler ni l'une ni l'autre, et **rien dans les tags ne sépare les deux
cas** : ils se ressemblent exactement.

### Le témoin ne peut pas venir des tags

Twitch en a un autre, et l'extension s'en sert déjà ailleurs : la **langue
déclarée dans les réglages de la chaîne**, celle sur laquelle
`broadcasterLanguages` filtre. Les deux ne mesurent pas la même chose — le tag
suit la soirée, la déclaration suit le compte — et c'est précisément ce qui en
fait un témoin : **on ne la retouche pas pour le classement du jour**.

La règle tient en une phrase : *une chaîne qui déclare deux langues en tag reste
au classement si sa langue de réglage est l'une des deux.*

| Cas | Réglage | Tags | Verdict |
| --- | --- | --- | --- |
| un francophone qui fait sa soirée en anglais | FR | Français + English | reste |
| un événement doublé | EN | English + Español | reste |
| deux classements visés | EN | Français + Português | **sort** |

### Le silence n'écarte jamais

Réponse absente, champ inconnu du schéma, coupure réseau, langue hors de notre
table : la chaîne **reste**. Une règle qui écarterait sur une panne ferait un
classement dépendant de la qualité du wifi.

Et **un seul tag n'est pas concerné du tout**. Une langue déclarée une fois n'est
pas un empilement : ce qu'on traque est l'empilement, pas le désaccord entre un
réglage et un tag.

### Écrite sans pouvoir l'exécuter

`users(logins:)` est éprouvé — c'est la forme de `TseChannels`, celle qui sert
toute la barre latérale. `broadcastSettings { language }` est une
**reconstitution** : cette machine n'a pas accès à twitch.tv. D'où le dispositif
déjà employé pour les chapitres de VOD et pour la voie du tag, qui a tranché deux
fois :

- **requête isolée** — un champ inconnu ne peut donc pas emporter la marche ;
- **échec silencieux** — la chaîne reste au classement ;
- **compteurs par issue** dans le rapport (`global.langueDeclaree`) ;
- **refus du schéma mémorisé** pour la session : on n'insiste pas cinquante fois
  sur une requête que le serveur refuse.

Le coût : une opération par tranche de chaînes nouvellement vues avec deux tags,
et rien ensuite — une langue de réglage ne change pas dans la session. Zéro pour
l'immense majorité des chaînes, qui n'en déclarent qu'une ou aucune.

### L'exclusion est différée, et c'est le cœur du dispositif

Au premier passage la langue déclarée n'est pas connue : la chaîne **entre**. La
demande part, la réponse arrive, et c'est la lecture **suivante** qui l'écarte.
Le scénario attend donc la disparition — ce qui prouve du même coup que la
requête a réellement eu lieu et changé le résultat.

Le filtre est posé sur `readStream`, au même endroit que la borne à deux et pour
la même raison : c'est le **seul passage obligé** des deux voies d'entrée du
classement.

### Le scénario 100

Sept assertions, sept mutants, aucun survivant :

| Mutant | Assertions qui tombent |
| --- | --- |
| la règle saute | 3 |
| la règle s'applique quel que soit le nombre de tags | 1 |
| le silence écarte | 1 |
| une langue hors table est jugée quand même | 1 |
| le refus du schéma n'est pas retenu | 1 |
| le code ISO est comparé sans passer par la table des langues | 2 |
| le compteur d'écartées ne compte plus | 1 |

Le sixième mérite un mot : Twitch rend un code (`fr`), l'extension range ses tags
par nom canonique (`Français`), et onze des trente et une langues ont un code de
drapeau différent de leur code de langue. Comparer les deux directement écarte
**toutes** les chaînes bilingues au lieu d'aucune — un défaut qui se voit, mais
seulement si le banc porte un cas qui devait rester.

## Ce qu'un audit a trouvé (v4.1.1)

Relecture complète des quatre dernières versions — code mort, traces de débogage,
bornes de mémoire, coût des chemins chauds, et surtout l'écart entre ce que les
commentaires promettent et ce que le code fait. Cinq points, aucun visible à
l'écran, tous réels.

### Le registre des reprises ne se réinsérait pas

`Map` itère dans l'ordre de PREMIÈRE insertion, et `set` sur une clé existante ne
la déplace pas. La purge de `reprises` sortait donc l'entrée la plus anciennement
INSÉRÉE — c'est-à-dire, sur une chaîne qui saute plusieurs fois, celle qu'on
venait justement de revoir.

Ce piège exact avait déjà été payé deux fois dans ce fichier, et corrigé deux
fois — pour le registre des frises, puis pour celui des chapitres, chacun avec
son commentaire. Le troisième registre l'a reproduit. Le `delete` avant le `set`
est revenu, et le commentaire dit désormais que c'est la troisième fois.

Portée réelle : faible — le plafond est à deux cents reprises simultanées. Mais
un défaut qu'on a nommé deux fois et qu'on refait une troisième est un défaut
qu'il faut corriger sans discuter de sa portée.

### Un compteur qu'il fallait savoir diviser pour le lire

`global.tagsEmpiles` comptait les LECTURES écartées par la règle des tags de
langue, et le README annonçait « le nombre de chaînes ». Ce n'est pas la même
chose : une marche complète repasse toutes les deux minutes et demie, si bien
qu'un seul empileur présent trois heures durant pesait plus de soixante-dix.

Un nombre qu'il faut diviser par une cadence pour l'interpréter n'est pas
lisible dans un rapport collé — et c'est précisément ce que ce fichier reproche
ailleurs à d'autres compteurs. On retient donc les LOGINS, dans un registre borné
comme ses pairs, et le rapport en rend le cardinal : « 2 » veut dire deux
chaînes.

### Une règle de style morte

`.courbe-valeur` était déclarée dans la feuille du panneau et appliquée nulle
part : elle stylait les étiquettes de durée de la courbe des retards, retirées
depuis — le dessin les avait rendues redondantes avec les cartouches. La règle,
elle, avait survécu à ce qu'elle habillait.

C'est la seule règle morte des deux feuilles. Les vingt-deux autres classes que
la lecture naïve signale sont construites par concaténation (`'tuile--' + ton`,
`'d-badge d-badge--' + mod`) et bel et bien appliquées.

### Deux lectures de la même vérité

La garde « est-ce un subathon ? » lisait `cache.get(login)?.subathon` en direct,
alors que `subathonDe(login)` existe et dit exactement cela. Deux lecteurs d'un
même champ finissent toujours par en dire deux choses différentes ; il n'en reste
qu'un.

### Ce que la durée d'une catégorie absorbe, et qu'elle ne disait pas

Pendant une coupure, la frise n'observe rien : le segment en cours s'étend
jusqu'à maintenant, donc la durée de SA catégorie compte les minutes mortes.
« Valorant 2h10 » inclut les trois minutes où la chaîne était éteinte.

C'est assumé — c'est même ce qu'on demande au total, « comme s'il n'y avait pas
eu de coupure » — mais ce n'était écrit nulle part. Découper le segment et
retrancher le trou donnerait un chiffre plus juste et une frise moins lisible :
deux bandes d'une même catégorie séparées d'un cheveu. La marque sur le ruban
est là pour que l'écart ne soit pas invisible, et le commentaire le dit
maintenant.

### Ce que l'audit a vérifié sans rien trouver

- **Aucune trace de débogage.** Les **onze** `console.log` de `content.js` sont
  l'API publique de la console — ce que rendent `tse.scores()`, `tse.subs()`,
  `tse.roster()`, `tse.lag()`, `tse.reset()`, `tse.cycles()`, `tse.apercu()` et
  `tse.bascules()` quand ils n'ont rien à montrer — pas des oublis. Aucun
  `TODO`, `FIXME` ni `debugger`.

  *Cette ligne annonçait **trois** pendant une dizaine de versions.* Elle ne
  comptait que ceux dont le texte est écrit en clair (« [tse] aucun… ») et
  manquait les huit qui passent par la table `S.console*` — huit appels tout
  aussi légitimes, et invisibles à une lecture qui cherche une chaîne. Un
  audit les a comptés ; c'est le genre de chiffre qui se périme sans bruit
  parce que personne ne le recompte.
- **Aucun identifiant mort** parmi les vingt et un ajoutés depuis la 3.98 :
  chacun est déclaré et lu.
- **Aucune règle `.tse-*` morte** dans la feuille de la barre latérale — les
  trois que la lecture naïve signale sont construites par concaténation.
- **Toutes les mémoires sont bornées** : `derniersDirects` (600),
  `reprises` (200), les marques de coupure (24), les empileurs (200), les
  frises (500), les chapitres — et la retenue hors ligne est bornée par le
  TEMPS, ce qu'une assertion du scénario 95 éprouve sur le rapport.
- **Les trois compteurs neufs arrivent bien dans le rapport collable** :
  `frise.retenues` / `frise.lachees`, `reseau.chapitres.vodTardif` et
  `global.tagsEmpiles`. C'est le piège habituel du panneau — un champ ajouté à
  `rapport()` est perdu en silence s'il n'a pas de bloc — et les trois passent
  par des blocs qui aplatissent leur objet entier.
- **Aucune entrée dérobée dans le classement.** La règle des tags de langue est
  posée sur `readStream`, seul passage obligé ; `setViewers`, la troisième porte
  possible, ne met à jour que des entrées déjà présentes et n'en ajoute jamais.

### Une redondance laissée en place, et pourquoi

`friseDe` est calculée quatre fois par survol — deux fois pour le ruban, deux
fois pour le badge de basculement — là où une seule suffirait. C'est du travail
en double, et il est resté.

La raison est un arbitrage, pas un oubli : la fonction est en O(n) sur n petit
(douze segments observés, autant de chapitres dans le cas ordinaire), soit
quelques microsecondes par survol, contre une refonte de deux fonctions couvertes
par une trentaine d'assertions. Un gain nul contre un risque non nul se refuse.

## Les tags de langue empilés (v4.1)

Les tags de langue sont libres. Rien n'empêche un streamer d'en poser dix pour
figurer dans dix classements — et le signalement d'un utilisateur dit que cela
se pratique. Une chaîne ne diffuse pas en dix langues à la fois : passé un
certain nombre, le tag ne dit plus ce qu'on parle, il dit qu'on veut être trouvé
partout.

**Deux, parce que deux existe.** Un stream bilingue est courant — un francophone
qui fait sa soirée en anglais, un événement doublé — et l'écarter serait punir un
usage réel. Trois ne l'est plus. Au-delà de deux langues déclarées, la chaîne
sort du classement.

### Une seule lecture, donc un seul endroit où filtrer

Le module du classement a **deux voies d'entrée** : la descente par catégories,
qui visite les catégories une à une, et la voie du tag, qui demande directement
à Twitch le classement trié sur un tag de langue. Deux chemins, deux requêtes,
deux reconstructions de pool — mais **une seule lecture** : `readStream`, qui
traduit un nœud de stream en enregistrement plat.

Le filtre se pose donc là, et nulle part ailleurs. Posé dans la descente, il
aurait laissé passer par la voie du tag tout ce qu'il écarte — et c'est
précisément la voie qu'un empileur de tags cherche à atteindre.

### Ce qu'on compte, et ce qu'on ne compte pas

On compte les tags qui sont **exactement** l'un des trente et un noms canoniques
de langue que Twitch pose (`LANG_SET`, dérivé de la table des drapeaux). Un
stream qui porte « Français », « Speedrun », « English » et « LGBTQIAPlus » en
déclare **deux** : il reste. Compter les tags plutôt que les langues écarterait
toute chaîne un peu renseignée, ce qui n'a rien à voir avec l'abus qu'on vise.

On compte aussi les tags **de Twitch**, avant que la voie du tag n'ajoute
elle-même celui qu'elle vient de demander. Ce qu'on juge est ce que la chaîne
déclare, pas ce que nous lui posons.

### Ce que la règle coûte, et où elle ne s'applique pas

Le prix est connu : **un événement réellement diffusé en trois langues disparaît
lui aussi** du classement. C'est la conséquence assumée d'une borne à deux ; elle
se relève d'un chiffre si les rapports montrent qu'elle mord trop.

Et elle ne s'applique **qu'au classement**. La liste de vos chaînes suivies n'est
pas un classement mais votre propre choix : une chaîne suivie qui empile les tags
reste dans votre barre latérale, et son filtre de langue continue de la ranger
sous chacune des langues qu'elle déclare. Rien de ce qui vous appartient n'est
filtré par cette règle.

### L'exclusion se compte

`global.tagsEmpiles` porte le nombre de **chaînes distinctes** écartées pour
cette raison. Le premier jet comptait les LECTURES rejetées, ce qui n'est pas la
même chose : une marche complète repasse toutes les deux minutes et demie, si
bien qu'un seul empileur présent trois heures durant pesait plus de soixante-dix
dans le rapport. Un nombre qu'il faut savoir diviser par une cadence pour le
lire n'est pas un nombre lisible. On retient donc les logins — registre borné
comme ses pairs — et le rapport en rend le cardinal : « 2 » veut dire deux
chaînes.

### Le scénario 98

Cinq assertions, quatre mutants, aucun survivant :

| Mutant | Assertions qui tombent |
| --- | --- |
| la borne saute (aucun filtre) | 3 |
| la borne compte TOUS les tags | 1 |
| la borne est posée à trois | 1 |
| le compteur ne compte plus | 1 |

Le premier fait tomber l'assertion de la **voie du tag** en même temps que celle
de la descente : c'est ce qui prouve que les deux chemins passent bien par le
même filtre, sans avoir à mutiler l'un des deux pour le vérifier.

## Ce que le VOD savait et qu'on refusait de lire (v4.0)

Trois choses, et elles ont la même racine : l'enregistrement en sait plus que
nous, et la version précédente s'était interdit de le consulter.

### La prémisse de la 3.99 était fausse, et ce fichier le disait déjà

La 3.99 refusait toute demande de chapitres dès qu'une coupure était connue, au
motif que « Twitch ouvre un enregistrement par SESSION ». C'était une déduction,
pas une observation — et la contre-preuve était dans le dépôt depuis la 3.76,
écrite dans `segmentsDuVod` :

> Un enregistrement peut commencer AVANT le stream courant : c'est le cas d'une
> reconnexion, où le VOD continue pendant que `createdAt` repart.

Le rapport d'utilisateur qui avait fait écrire ces lignes mesurait l'écart :
**trente-neuf minutes**, sur un enregistrement toujours en cours. Autrement dit
le passé d'avant la coupure n'est pas perdu — il est dans le VOD courant, et la
3.99 venait d'interdire d'aller le chercher.

Il n'y avait donc rien à ajouter, seulement une date à corriger. Tout ce module
compare des instants à un nombre — quels moments regardent ce live, si
l'enregistrement en couvre le début, si la liste des archives a rendu le bon —
et ce nombre était le départ du TRONÇON. C'est l'**origine** du direct qu'il
fallait lui donner :

```js
fetchChapitres(login, flux.id,
               Date.parse(debutReel(login, flux.createdAt)) || 0)
```

Une ligne, et les quatre heures d'avant la coupure reviennent — y compris pour
quelqu'un qui n'avait pas Twitch ouvert.

### Le raccord ne doit plus perdre ce qu'on a vu

Restait le cas où Twitch ouvrirait bel et bien un enregistrement neuf. Le
raccord posait les chapitres du VOD d'abord, puis n'ajoutait nos segments que
s'ils étaient POSTÉRIEURS au dernier connu : les nôtres, plus anciens, tombaient
dans le `continue` et disparaissaient.

Ce cas-là n'est d'ailleurs pas propre aux coupures — une chaîne qui active
l'archivage en cours de diffusion le produit aussi. On met donc en tête ce que
nous avons observé AVANT le premier chapitre : le VOD ne le couvre pas, il n'a
rien à en dire, et c'est du temps qu'on a vu de nos yeux. Là où les deux se
recouvrent, le VOD reste prioritaire — il date à la seconde, nous au prochain
relevé.

### Faut-il aller chercher les archives PRÉCÉDENTES ?

La question se pose pour le seul cas qui reste : une chaîne qui a repris, et
dont Twitch aurait ouvert un enregistrement neuf. Le passé serait alors dans
l'archive d'avant, qu'on pourrait lire — `videos(first: 2, sort: TIME)` rend son
`createdAt` et son `lengthSeconds`, donc sa fin ; un écart de moins de dix
minutes avec le départ du live dirait « c'est la suite ».

**La réponse, aujourd'hui, est non — et ce n'est pas un refus de principe.**

D'abord parce que ce cas n'a jamais été observé : le seul recouvrement mesuré
sur une reconnexion est celui d'un VOD qui CONTINUE. Ensuite parce qu'il faudrait
une quatrième porte, avec ses propres échecs à distinguer et à instrumenter, pour
un gain qui n'existe peut-être pas. Enfin parce que le raccord ci-dessus fait
déjà que rien n'est PERDU dans ce cas : ce qu'on a vu reste, seul manque ce qu'on
n'a pas vu.

Et parce que je n'ai pas pu le mesurer : la machine où ceci est écrit n'a pas
accès à `gql.twitch.tv` — le mandataire de sortie répond 403 au CONNECT. La
distribution des écarts entre deux archives consécutives d'une même chaîne est
donc hors de portée d'ici.

**On instrumente donc au lieu de deviner.** `chapitres.vodTardif` compte les
enregistrements servis qui commencent APRÈS l'origine du direct — c'est-à-dire
exactement le nombre de fois où le second monde s'est présenté. À zéro sur des
rapports portant des reprises, la porte n'a pas lieu d'être ; non nul, elle
devient justifiée, et on saura de combien.

### Le badge « Vient de passer sur … », appris de la frise

Le badge naissait d'une OBSERVATION : deux relevés consécutifs, même identifiant
de stream, deux catégories. Il ne pouvait donc paraître que sur une chaîne qu'on
regardait déjà au moment du changement — et il manquait précisément là où il
sert le plus. Un retour d'usage le montre : la frise annonce « 7m · en cours »
sur une catégorie prise il y a sept minutes, et aucun badge ne le dit.

La frise, elle, le sait : ses chapitres viennent du VOD, qui date les changements
à la seconde et n'a pas besoin de nous pour les voir. Si son dernier segment a
moins de dix minutes, le streamer vient de basculer. C'est la même information,
apprise autrement — et le badge se pose donc en repli, quand l'observation n'a
rien donné.

**Trois refus, et chacun éviterait une affirmation fausse :**

| Refus | Ce qu'il éviterait |
| --- | --- |
| une frise de CLIPS | ses bornes sont des minorants : le premier clip d'une catégorie est postérieur à son début, parfois de beaucoup |
| un seul segment | ce n'est pas un basculement mais un début de live — « vient de passer sur » dirait qu'il a changé quand il a commencé |
| au-delà de `CATEGORY_SWITCH_TTL` | la même péremption que le badge observé, lue sur la même constante : deux nouvelles de même nature qui s'éteindraient à deux moments différents seraient deux nouvelles différentes |

Le badge est reposé quand les chapitres arrivent, qui est APRÈS l'ouverture du
popup : il porte donc une marque (`data-tse-bascule-frise`) qui permet de le
remplacer sans doublon, et il s'insère derrière l'étiquette de classification et
la reprise — l'une se lit avant de regarder, l'autre explique la carte entière.

### Le subathon ne coupe pas, il recommence

Twitch impose de relancer une diffusion au moins toutes les quarante-huit heures.
Un subathon, qui dure des jours, est donc **fait de redémarrages**, et chacun
d'eux ressemble trait pour trait à une reprise après coupure : identifiant neuf,
compteur à zéro, quelques minutes d'interruption.

Les chaîner produirait une frise de plusieurs jours, illisible par
construction — le ruban n'a que quelques centaines de pixels, et une semaine de
direct y écraserait chaque catégorie à moins d'un trait. Le compte des coupures,
lui, annoncerait « 14 coupures » là où il ne s'est rien passé d'anormal : une
alarme pour une routine.

Sur un subathon, un redémarrage est donc un **nouveau direct** : pas de badge,
pas de compte, pas d'origine reprise, et la frise repart. Le numéro de jour, lui,
continue de dire où en est l'événement — c'est la pastille qui porte la durée
longue, et elle la porte mieux qu'un ruban.

La détection lit le titre **des deux côtés**, celui qui arrive et celui qu'on
avait : au redémarrage la mention est presque toujours encore là, mais un
streamer qui l'écrit après coup laisserait passer un chaînage que la mémoire
d'avant, elle, aurait refusé.

### Le scénario 97

Huit assertions, six mutants, aucun survivant :

| Mutant | Assertions qui tombent |
| --- | --- |
| la demande de chapitres repart du tronçon | 1 |
| nos segments antérieurs au VOD sont perdus | 1 |
| le badge ne se déduit plus de la frise | 1 |
| un seul segment suffirait au badge | 1 |
| une frise de clips donne le badge | 1 |
| le badge ignore la péremption | 1 |

**Trois des refus ont d'abord été éprouvés à vide, et c'est le décor qui mentait.**
`CATEGORY_SWITCH_TTL` vaut dix minutes en production et deux secondes et demie
dans le banc : un basculement « vieux de sept minutes » y est périmé, et les
trois assertions de refus passaient donc par l'ÂGE du segment et non par la règle
qu'elles prétendaient éprouver. Elles ne tombaient sous aucun mutant. Chaque cas
pose désormais son instant juste avant son survol.

## La frise qui ne recommence pas (v3.99)

La 3.97 avait éteint la barre violette sur une reprise ; la 3.98 avait mis la
durée du direct entier sur la carte. Un retour d'usage a tranché autrement, et
il avait raison sur les deux points.

**La carte compte la session, comme Twitch.** Deux vérités pour une même chose
valent moins qu'une seule bien placée, et une carte de barre latérale n'a de
place que pour une durée. Ce qui serait faux, ce n'est pas que le compteur
reparte de zéro — c'est de laisser croire qu'on n'a rien raté. Or cela, ce n'est
pas le compteur qui le dit, c'est la barre violette. Elle reste donc éteinte (la
garde est revenue dans `updateFreshness`, à l'endroit exact où elle avait été
retirée), le compteur repart de zéro comme chez Twitch, et le direct entier se
lit dans l'aperçu — qui, lui, a la place de dire les deux.

**Mais la frise, elle, recommençait**, et c'était le vrai dégât. Il ne se voyait
pas depuis le code : `suivreCategorie` repart de zéro dès que l'identifiant de
stream change, et il change à chaque reprise. Un spectateur qui survolait après
une coupure de trois minutes ne voyait plus rien du direct — « Précédemment sur
ce live » redémarrait à la sixième heure, ce qui est exactement le contraire de
ce que ce bloc promet.

### Le bon critère n'est pas l'identifiant, c'est l'origine

`debutReel` rend le départ de la CHAÎNE de tronçons : il ne bouge pas tant que
les reprises s'enchaînent, et il saute dès qu'un vrai nouveau direct commence.
Même origine, même direct — on garde tout et on adopte le nouvel identifiant :

```js
const memeDirect = !!f && f.streamId !== id
                   && !!f.debutStream && f.debutStream === debutStream;
```

La comparaison exige `debutStream` non nul, et ce n'est pas de la prudence
d'usage : deux `null` sont égaux sans rien prouver, et un `createdAt` illisible
ferait alors passer n'importe quelle session pour la suite de la précédente.

La frise est datée de cette origine, ce qui en fait **le seul endroit du produit
dont l'échelle couvre le direct entier**. Son total — déjà affiché en tête
depuis la 3.94 — devient donc la durée juste, coupures comprises.

### Une coupure de trois minutes tombe sur six relevés

La continuité par l'origine ne suffisait pas. La frise était détruite au premier
relevé hors ligne (`frises.delete(login)`), et à trente secondes de cadence une
coupure de trois minutes en produit six : il ne restait plus rien à raccorder au
retour.

Elle est donc **retenue** au lieu d'être jetée, et pour exactement la même durée
que le badge — au-delà, ce n'est plus le même direct, et c'est la même question
qui se pose. La retenue est bornée par le temps et non par la bonne volonté :
passé `RECONNECT_GAP_MAX`, la frise part, et le registre ne peut pas se remplir
de chaînes éteintes.

Cette borne-là **ne se voit pas à l'écran**, et c'est ce qui a rendu son
assertion intéressante : la comparaison d'origine suffirait à faire repartir la
frise de zéro même si le registre gardait l'entrée morte jusqu'à la fin des
temps. Le mutant qui supprime la libération survivait donc à toutes les
assertions d'affichage. Ce qui se joue n'est pas le rendu mais la MÉMOIRE — et
c'est le rapport qui la dit : `frise.retenues` compte les frises entrées en
attente, `frise.lachees` celles que l'attente a fini par emporter.

### Ce que le ruban en dit

Le compte des coupures se pose **à gauche du total**, contre lui, parce que
c'est de lui qu'il parle : « 6h12 » sur un direct qui a sauté deux fois se lit
comme six heures d'affilée, ce qui n'est pas ce qui s'est passé.

Sur le ruban, chaque coupure est une **entaille** — posée en absolu par-dessus
les parts, et non insérée entre elles : la part de chaque segment est calculée
sur sa durée, et glisser une boîte de plus dans la rangée décalerait tout ce qui
suit.

**On dessine un intervalle, pas un instant**, et c'est la seule chose honnête à
dessiner. On sait quand la chaîne a été vue en ligne pour la dernière fois, et
quand elle est revenue ; entre les deux, la coupure a eu lieu à un moment qu'on
ignore. La marque couvre donc ce trou, à sa place et à sa largeur, avec un
plancher de deux pixels — sans quoi trois minutes sur six heures ne feraient
rien du tout.

Un demi pour cent est réservé à droite. Une coupure qui vient d'avoir lieu tombe
à cent pour cent du ruban : la marque commencerait au bord droit et le
débordement caché la taillerait à néant — invisible précisément dans le cas où
elle est la plus utile. Un demi pour cent vaut à peu près les deux pixels du
plancher sur la largeur d'un popup, soit moins que ce que le ruban sait montrer.

Le COMPTE, lui, n'est pas borné : c'est un entier, il ne coûte rien, et
l'annoncer faux serait pire que ne pas l'annoncer. Seules les MARQUES le sont,
à vingt-quatre — au-delà, des traits plus serrés ne se distinguent plus les uns
des autres.

### Le VOD n'a plus rien à dire sur un direct coupé

Twitch ouvre un enregistrement par SESSION. Sur une chaîne qui a repris, le VOD
du tronçon courant ne couvre que lui, et ses chapitres — datés d'après sa propre
naissance — viendraient se placer APRÈS ce que nous avons observé avant la
coupure. Le raccord les met en tête puis n'ajoute nos segments que s'ils sont
postérieurs : **tout notre passé disparaîtrait** au profit d'un prélude qui ne
parle que des dix dernières minutes.

Pire, `continu` — « le VOD couvre le live sans le moindre changement » — ferait
remonter la catégorie courante jusqu'à l'origine de la chaîne, six heures plus
tôt, sur la foi d'un enregistrement qui n'en couvre que dix minutes. Une
invention, et de la pire espèce : plausible.

Dès qu'une coupure est connue, on ne demande donc plus rien (`friseACombler`) et
on n'utilise rien (`preludeDe`). La garde est aux deux endroits : un prélude a
pu être récupéré AVANT la coupure, et rien ne garantit l'ordre des deux
événements.

### Les badges prennent une puce

Quatre libellés changent de forme, et c'est une question de rangée : dans une
suite de pastilles, l'intitulé et sa valeur se lisent mieux séparés que collés.

| Avant | Après |
| --- | --- |
| `Subathon · JOUR 12` | `Subathon • JOUR 12` |
| `Abonné 2 mois` | `Abonné • 2 MOIS` |
| `Anciennement abonné 1 mois` | `Ancien abonné • 1 MOIS` |
| `Série de visionnage 1` | `Série de visionnage • 1` |

Les trois premiers sont à nous : trente écritures, dix langues, et la règle de
pluriel slave inchangée — le scénario 64 continue de l'éprouver sur les douze
cas du piège des 11-14, en capitales désormais.

**Le quatrième est à Twitch**, et c'est ce qui borne ce qu'on peut en faire. Ces
lignes-là sont injectées sous la carte dans la langue de l'interface ; on les
reprend en badge telles quelles. Recomposer la phrase — « Série • 1 Visionnage »
— demanderait de la réécrire dans dix langues à partir d'une chaîne qu'on ne
peut pas lire d'ici, c'est-à-dire d'inventer dix traductions et d'espérer. On
détache donc le NOMBRE FINAL, qui est un nombre partout, et les mots restent les
siens. La transformation ne touche que les lignes « autres » : le hype train et
la réduction d'abonnement ont leur propre formulation, souvent sans nombre
terminal, et les toucher pourrait couper une phrase en deux.

### Le scénario 95, et ce qu'il a fallu lui apprendre

Il passe de huit assertions à dix-sept, et son décor a changé deux fois. Il
fallait d'abord **une frise à sauver** : un seul segment ne fait pas une frise,
le bloc se taisant quand il n'aurait à raconter que notre propre fenêtre
d'observation. La chaîne bascule donc une fois avant la coupure.

Il fallait ensuite **une coupure qu'on voit passer**. Les autres cas changent
d'identifiant d'un relevé à l'autre — la chaîne n'est jamais observée hors
ligne, ce qui est le cas le plus fréquent à trente secondes de cadence. La
retenue, elle, ne s'éprouve que sur une chaîne qu'on a vraiment vue s'éteindre.

Neuf mutants, aucun survivant :

| Mutant | Assertions qui tombent |
| --- | --- |
| la frise repart à chaque changement d'identifiant | 5 |
| la frise est détruite dès le premier relevé hors ligne | 1 |
| la retenue ne s'arrête jamais | 1 |
| la retenue est lâchée aussitôt | 2 |
| la frise date du tronçon, pas du direct | 5 |
| aucune marque n'est gardée | 3 |
| le compte des coupures n'est pas affiché | 3 |
| le compte repart à chaque reprise | 1 |
| la carte ne compte plus la session | 1 |

Le dernier de la liste est celui qui dit le mieux ce que cette version a
tranché : rétablir la durée du direct sur la carte fait tomber une assertion,
parce que ce n'est plus là qu'elle doit être.

**Deux scénarios voisins ont dû suivre.** Le 78 vérifiait qu'« une nouvelle
session repart d'une seule catégorie » en changeant simplement l'identifiant de
stream — ce qui décrit aujourd'hui une reprise, dont la frise est justement
conservée. Son décor produit donc maintenant une vraie coupure, au-delà de la
borne. Et le 88, qui lit le SOURCE pour exiger que la réinsertion du registre
précède l'aiguillage, cherchait un aiguillage qui a changé de texte.

## La frise des catégories (v3.70)

Twitch n'affiche la suite des catégories traversées par un stream **nulle
part** tant qu'il est en cours : ses chapitres n'existent que sur le VOD, après
coup, et seulement si la chaîne en garde un. Le pipeline, lui, voyait cette
information passer toutes les 30 secondes — et la jetait.

Elle est désormais gardée, et l'aperçu la rend sous la carte :

```
PRÉCÉDEMMENT SUR CE LIVE
▨▨▨▨▨▨▨▨▨▨▨│███│██████████│█████████████████████│██
  non observé                                  1h35
  Discussions                                   24m
  Hades II                                     1h47
  Overwatch                                    3h21
▸ League of Legends                12m · en cours
```

Une **barre proportionnelle** puis une **liste**, et les deux sont nécessaires :
la barre donne la forme du live d'un coup d'œil — trois heures d'Overwatch
contre douze minutes de LoL se voient sans lire ; la liste donne les noms et les
durées exactes. La barre est `aria-hidden` : une barre qui porterait
l'information par la seule couleur serait illisible à qui ne les distingue pas.

### Ce que la frise sait, et ce qu'elle avoue

Elle ne sait que **ce qu'elle a vu**. Un onglet ouvert à la troisième heure d'un
live ignore les deux premières, et présenter le premier segment observé comme le
début du stream serait une invention. On connaît l'heure de départ du live : la
part non observée est donc **mesurée**, dessinée hachurée, **à sa vraie
proportion**. Un segment gris à sa taille réelle est un aveu à l'échelle ; un
premier segment présenté comme le début serait un mensonge.

Trois autres règles, chacune pour une raison :

- **le bloc n'apparaît pas** tant qu'aucun basculement n'a été observé. Une
  seule catégorie n'apprend rien que la carte ne dise déjà, et laisserait croire
  que le live n'a connu qu'elle ;
- **une nouvelle session efface tout.** L'identifiant de stream change à chaque
  redémarrage ; garder la frise ferait porter au nouveau live les durées de
  l'ancien ;
- **rien n'est persisté.** Après un rechargement, l'extension n'a rien observé —
  reconstituer la frise depuis un stockage affirmerait une continuité qu'on n'a
  pas vue.

### Deux pièges, et comment ils sont tenus

**Canonique contre libellé.** Twitch rend deux noms par catégorie : `name`
(stable) et `displayName` (traduit). Comparer les libellés ferait naître un faux
segment au premier changement de langue ; ne garder que le canonique afficherait
des noms anglais dans une interface française. La comparaison est canonique, le
libellé est mémorisé — **et rafraîchi** à chaque observation, défaut trouvé par
le banc : il était figé à la création du segment, si bien qu'une traduction
arrivant plus tard ne remontait jamais.

**Les couleurs.** La première rédaction projetait un hachage du nom sur les 360°
du cercle : stable, sans liste à tenir, et fausse à l'usage. Sur la toute
première capture, « Hades II » et « League of Legends » étaient deux roses
presque identiques, côte à côte. La palette est maintenant **fermée** — huit
teintes espacées — le hachage en choisit l'index, et une seconde passe déplace
les collisions **au sein d'une même frise**. La stabilité d'une couleur est un
confort ; la distinction est ce qui fait qu'on lit la barre.

### Le passé du live, quand Twitch veut bien le dire (v3.71)

La frise ne savait que ce qu'**elle** avait vu. Un rapport d'utilisateur l'a
pointé aussitôt — *« faudra le connaître même si on n'était pas sur Twitch et
que le live avait commencé »* — capture à l'appui : `non observé 6h04` écrasant
deux segments de deux minutes.

Il existe une source, et une seule. Twitch n'expose nulle part l'historique de
catégories d'un stream **en cours** ; mais si la chaîne archive ses diffusions,
le VOD existe **dès le début** du live et gagne un « moment » à chaque
changement de jeu — ce sont les chapitres de la barre de lecture d'un replay.
Ils portent exactement ce qui manque : la catégorie et sa position en
millisecondes depuis le départ.

**Cette requête n'a jamais été exécutée contre le vrai Twitch.** La machine où
elle a été écrite n'a pas accès à `twitch.tv` — le proxy refuse la connexion. Sa
forme suit le schéma public et ce que le lecteur de Twitch demande lui-même,
mais c'est une reconstitution, pas une observation. Trois conséquences assumées :

- elle est **séparée** de `TsePreview`. Greffée dessus, un champ inexistant
  ferait échouer la requête entière et emporterait le titre et les étiquettes de
  l'aperçu. Isolée, son échec ne coûte rien ;
- tout échec **retombe en silence** sur la frise observée. L'utilisateur ne perd
  rien, il ne gagne pas ;
- et il est **consigné au journal d'erreurs**, donc le premier rapport reçu dira
  si la requête est juste. C'est le seul moyen honnête d'éprouver ce qu'on ne
  peut pas exécuter.

Le scénario 79 ne prouve donc pas que la requête est juste : il prouve que la
**fusion** est correcte et que **tout** échec retombe sans rien casser — schéma
qui refuse, chaîne sans archive, VOD sans moment. Au pire, l'utilisateur
retrouve la frise d'hier.

**Une requête de plus, et seulement quand elle peut servir** : au survol, une
fois par stream, et uniquement si la frise porte une part non observée. Une
chaîne suivie depuis le début de son live n'en déclenche aucune — une requête
qui n'apprend rien est une requête de trop, et une assertion l'interdit.

**La fusion préfère les chapitres.** Là où les deux se recouvrent, Twitch date
le changement à la seconde ; nous, au prochain relevé, donc jusqu'à trente
secondes plus tard. On part des chapitres et l'on n'ajoute de son côté que ce
qu'ils ne portent pas encore — à condition que ce soit **postérieur** au dernier
connu, sans quoi un chapitre en retard ferait naître un segment qui remonte le
temps.

#### Le seuil d'affichage, corrigé deux fois par deux rapports

Il a bougé deux fois, et les deux mouvements viennent d'un retour d'utilisateur
— c'est-à-dire de la seule source qui pouvait trancher.

**D'abord un basculement était exigé.** Cinq minutes après l'installation :
*« je n'ai pas la nouveauté »*. Une fonctionnalité qui peut rester invisible des
heures ne se distingue pas d'une fonctionnalité cassée.

**Puis le seuil est tombé à un segment**, et l'affichage est devenu ceci :

```
  non observé    2h52
▸ Discussions    3m · en cours
```

Deuxième rapport : *« il faut pas qu'on puisse avoir la partie non observé »*.
Il avait raison — cette barre-là ne dit rien du **live**, elle dit que nous
regardons depuis trois minutes.

Le point d'équilibre est donc **« avoir quelque chose à dire »** : deux segments,
**ou** un prélude venu du VOD, **ou** un live vu depuis son début. Ce qu'on ne
fait **pas**, c'est prolonger la catégorie courante jusqu'au départ du stream
pour faire disparaître le hachuré : un streamer qui a basculé cinq minutes avant
qu'on ouvre Twitch se verrait attribuer sept heures d'une catégorie qu'il vient
de prendre. Se taire coûte un bloc ; inventer coûte la confiance qu'on peut
avoir dans tous les autres.

**Un défaut est né de cette correction, et le banc l'a pris dans la minute.**
« Qu'affiche-t-on ? » et « faut-il aller chercher le passé ? » n'ont pas la même
réponse, et la porte de la requête posait la seconde question à la fonction
d'affichage. Dès que celle-ci s'est tue sur le cas dégénéré, la requête de
chapitres a cessé de partir — précisément dans le cas qu'elle existe pour
combler.

#### Ce que Twitch a répondu, compté

Le premier rapport reçu après la mise en service des chapitres portait
`ERREURS (0)` et `echecs 0`. La requête n'avait donc rien cassé — mais rien ne
disait si elle avait seulement été **envoyée**, ni ce qu'elle avait rendu. Trois
causes possibles, trois réparations opposées, aucun moyen de choisir.

Le bloc `RÉSEAU` porte maintenant `chapitres.demandes`, `.servis`, `.sansVod`,
`.sansMoment`, `.sansStream` et `.reseau`. Ces compteurs ne vont **pas** au
journal d'erreurs : une chaîne qui n'archive pas ses diffusions est un cas
ordinaire, pas un défaut. C'est la leçon de l'onglet « mobile », appliquée avant
de la répéter.

#### Ce que le VOD atteste, et ce qu'il n'atteste pas (v3.73)

Le rapport suivant a tranché ce que je ne pouvais pas trancher :

```
chapitres.demandes     19
chapitres.servis        6      ← la requête FONCTIONNE contre le vrai Twitch
chapitres.sansMoment    8      ← VOD présent, zéro moment
chapitres.sansVod       5
ERREURS (0)
```

`servis: 6` prouve que `archiveVideo`, `moments(momentRequestType:
VIDEO_CHAPTER_MARKERS)` et `GameChangeMomentDetails` existent bien — la requête
reconstituée était juste. Et comme le journal d'erreurs est vide, les huit
`sansMoment` sont tous des **VOD sans le moindre moment**.

Or les chapitres marquent les **changements** de jeu. Un enregistrement qui
couvre tout le live et n'en porte aucun **atteste** donc que la catégorie n'a
pas bougé depuis le départ. Ce n'est pas une hypothèse : c'est une réponse.
La frise peut remonter au début du live sans rien inventer — ce qui répond au
troisième rapport, *« j'aimerais quand même avoir cette fonctionnalité même s'il
y a une seule catégorie durant le stream »*.

**La garde qui rend la conclusion légitime** : l'enregistrement doit couvrir le
live. Un VOD démarré dix minutes après le stream ne peut rien dire de ces dix
minutes, et l'absence de chapitre n'y prouve rien. Au-delà de deux minutes
d'écart, on ne conclut pas et la frise se tait.

Le compteur `chapitres.continus` sépare désormais ce cas des trois autres.

#### Le badge « Contenu classé » sous la frise

Quatrième rapport : *« j'ai l'impression que le badge Mature est en dessous de
la partie Précédemment »*. C'était exact, et la cause était une duplication —
**trois** fonctions créaient la zone des badges, toutes trois par `appendChild`
sur le corps du popup. C'était juste tant que la frise n'existait pas ; elle est
ajoutée en dernier, et ce badge-là arrive **après** elle, puisqu'il attend la
réponse de `TsePreview`. La zone se créait alors sous la frise.

La règle n'existe plus qu'à un endroit : on insère avant la frise quand elle est
là. Trois copies d'une même règle finissent toujours par diverger.

**Le premier scénario écrit pour ce défaut ne le reproduisait pas.** Il faisait
naître la frise d'une requête de chapitres — donc *après* le badge — et l'ordre
était bon par accident : la mutation qui casse l'insertion ne le faisait pas
échouer. Il provoque maintenant un basculement, ce qui donne une frise
construite dès le rendu, synchrone, comme dans le cas signalé.

#### Ce qui restait muet, et la seconde porte (v3.74)

Le rapport suivant montrait quatre chaînes en `sansVod` : `archiveVideo` rendait
`null`. Cela peut vouloir dire *« cette chaîne n'archive pas »* — et c'est alors
définitif — mais aussi que l'enregistrement en cours n'est pas exposé par **ce
champ-là**. Twitch a une seconde porte, celle que sa propre page « Vidéos »
emprunte : la liste des archives, la plus récente d'abord.

Elle est **séparée**, et ne part que là où la première a échoué : la greffer sur
la requête principale ferait tomber les douze cas qui marchent si l'un de ses
arguments est faux. Une requête de plus par stream, comptée à part
(`chapitres.replis` / `.replisServis`), et le prochain rapport dira si elle sert.

**Le banc y a trouvé un défaut que la première voie masquait.** La garde qui
vérifie que l'enregistrement couvre le live ne bornait l'écart que **par le
haut** : `depart - debutStream <= ÉCART`. C'est vrai pour un VOD commencé après
le stream — et vrai aussi pour celui d'hier, dont l'écart vaut *moins* trente
heures. Sans conséquence tant que le VOD venait d'`archiveVideo`, qui est celui
du live par construction ; faux dès que le repli propose la dernière archive
connue, qui peut être n'importe laquelle. La valeur absolue est la seule forme
juste.

#### Trois retouches d'affichage

- **Les compteurs s'additionnent.** Un rapport affichait `demandes 16` et des
  issues totalisant 23 : `sansMoment` était incrémenté *puis* `continus` sur le
  même appel. Un lecteur qui additionne des compteurs et tombe à côté cesse, à
  juste titre, de leur faire confiance. Les sept issues sont exclusives, et une
  assertion vérifie que leur somme vaut `demandes`.
- **Les couleurs de la frise.** La première palette était choisie pour ne pas
  crier sur le fond sombre — trop bien choisie : sur une barre de sept pixels,
  on distinguait mal les teintes. Une barre dont on ne lit pas les frontières ne
  remplit pas son seul office. Chroma nettement relevée, teintes espacées d'une
  quarantaine de degrés, barre à neuf pixels.
- **Les respirations.** Le corps du popup est une colonne flex à `gap: 6px`, et
  la frise y ajoutait 9 px de marge propre — quinze pixels au-dessus du filet là
  où le titre et les badges n'en ont que six. Deux endroits décidaient d'un même
  espacement ; il n'y en a plus qu'un, et une assertion mesure les deux écarts
  sur le rendu.

#### Pourquoi le repli n'a pas servi (v3.75)

Le rapport suivant a rendu `replis 12, replisServis 0` : la seconde porte avait
été tentée douze fois et n'avait jamais servi. Impossible d'en tirer quoi que ce
soit — requête refusée, chaîne sans la moindre archive, ou archive d'un autre
jour ? **Trois causes, trois suites différentes**, et une seule d'entre elles
justifierait de continuer à dépenser une requête. Même angle mort que la fois
d'avant, même remède : `replisErreur`, `replisVides` et `replisHorsSujet` les
séparent, et leur somme vaut le nombre de tentatives.

Si le prochain rapport donne `replisVides 12`, la réponse sera définitive :
**pour une chaîne qui n'archive pas ses diffusions, Twitch ne conserve aucune
trace des catégories passées.** Il n'y a alors rien à récupérer — pas parce que
la requête est mauvaise, mais parce que la donnée n'existe pas.

Le gap du corps de l'aperçu passe par ailleurs de six à dix pixels, valeur
demandée à l'usage. C'est le seul nombre à changer : la frise n'a pas de marge
propre, précisément pour qu'il n'y ait qu'un endroit qui décide. Une assertion
vérifie la valeur et non seulement l'égalité des deux respirations — sans quoi
elles pourraient dériver ensemble sans que rien ne le dise.

#### De quel côté le candidat est rejeté (v3.76)

Le rapport suivant a répondu, et **pas ce qui était pronostiqué** :

```
chapitres.replisErreur      0    ← la requête fonctionne
chapitres.replisVides       1    ← une seule chaîne sans aucune archive
chapitres.replisHorsSujet   4    ← quatre archives trouvées, puis écartées
```

Ce n'est donc pas Twitch qui manque de données : c'est la garde qui les jette.
Mais « hors sujet » couvrait deux verdicts **opposés**, et les compter ensemble
laissait la question ouverte :

- trop **tôt** de trente heures, c'est le VOD d'hier. La chaîne n'archive pas ce
  live-ci, et il n'y a rien à récupérer — jamais ;
- trop **tôt** de vingt minutes, ce serait le VOD de ce live sur un stream qui a
  reconnecté : `stream.createdAt` repart à la reconnexion, l'enregistrement non.
  Celui-là mériterait d'être pris ;
- trop **tard**, c'est un enregistrement démarré en retard, qui ne peut rien
  dire du début.

Le signe et l'amplitude — deux entiers, `repliEcartMinMin` et
`repliEcartMaxMin` — tranchent entre ces trois lectures sans qu'on ait à
deviner. C'est la troisième fois que la même discipline s'applique : un
compteur qui agrège des causes contraires ne renseigne sur aucune.

## Le ruban à plat, et la fiche remise à jour (v3.94)

### La hachure est retirée

Les parts d'une frise de clips étaient hachurées de biais, et la part inconnue
avec elles. C'était le seul moyen, à l'époque, d'avouer que ces bornes-là ne
sont pas des heures. Deux choses l'ont rendue inutile, et une troisième
nuisible.

**Ce qui la remplace le dit mieux.** La vague `~` nomme l'approche là où elle
est — sur les durées de catégorie, et pas sur le total ni sur la part antérieure
au premier clip, qui sont exacts. Le fondu, lui, dessine l'intervalle douteux
**à sa largeur**. La hachure, elle, disait « tout ceci est approché » sur des
parts dont certaines ne le sont pas.

**Et elle salissait le reste.** Posée par-dessus les couleurs, elle en
assombrissait la moitié et rendait deux teintes voisines difficiles à
distinguer — sur un ruban dont *toute* la fonction est de faire correspondre des
couleurs à une légende.

Quatre règles se réduisent à une. Le temps qu'on n'a pas observé n'a plus besoin
d'être hachuré : il n'a aucune couleur de fond, et le ruban laisse voir son
propre socle — un creux sombre là où les autres parts portent une teinte. Un
vide se lit comme un vide.

La liste, elle, garde ses deux traits discontinus : le tireté de « avant le
premier clip » et le pointillé de la ligne de repli. Ce ne sont pas des
hachures mais des traits de quatre pixels, et ils distinguent deux lignes qui ne
sont pas des catégories.

### L'arc-en-ciel passe à une seconde et demie

Vitesse demandée, vitesse appliquée — sur la pastille **comme** sur le badge :
les deux sont visibles en même temps dès qu'on survole une carte de subathon, et
deux cycles de durées différentes se décaleraient en quelques secondes.

**Un mot sur ce que cette vitesse engage.** Huit arrêts en une seconde et demie,
c'est un changement toutes les 187 ms, et la luminance relative varie jusqu'à
0,41 d'un arrêt au voisin. Ce rythme **dépasse** le critère de fréquence de la
règle WCAG 2.3.1 — plus de trois variations par seconde — et ce n'est pas lui
qui met l'effet hors de cause : c'est l'**aire**. Le critère ne s'applique
qu'au-delà de 25 % d'un champ de dix degrés, soit environ 21 800 px² ; le badge
en occupe 2 478 (11 %) et la pastille 392 (1,8 %).

La marge tient donc à la **taille** de ces deux éléments, et à elle seule : les
agrandir franchement demanderait de ralentir le cycle d'autant. `prefers-reduced-motion`
l'arrête complètement, ce qui reste la seule sortie qui vaille.

> **Retiré en 4.14.0.** Le bloc « mouvement réduit » n'existe plus : voir
> *Moins de règles, une boucle qui se referme, un mode d'emploi refait*.

### Ce que la mutation a corrigé dans le banc

L'échantillonneur de l'arc-en-ciel **recopiait** la durée du cycle : douze
secondes, écrites en dur. Passée à une seconde et demie, il parcourait huit
tours au lieu d'un, deux arrêts par pas — et le contrôle du fondu tombait sur un
code parfaitement sain. Un banc qui recopie une constante du produit mesure sa
propre copie. La durée se lit désormais sur l'animation elle-même.

### La fiche du Store rattrape trois fonctionnalités

Douze fiches, douze langues, et trois sections qui manquaient — le produit avait
pris de l'avance sur sa description :

- **« Précédemment sur ce live »** — la frise des catégories, son ruban à
  l'échelle, sa reconstruction par les clips et ses aveux d'ignorance ;
- **les subathons** — la pastille du jour, le badge, l'arc-en-ciel, et le fait
  que rien n'est deviné de la durée ;
- **le panneau de la barre d'outils** — les habitudes dessinées, les chiffres,
  et le rapport de diagnostic sans aucune liste personnelle.

Plus une puce de badge dans la section qui les énumère. Le squelette des douze
fiches passe de 20 à **23 sections**, de 73 à **85 puces**, de 88 à **112
étoiles** — et `npm run store` le vérifie sur les douze d'un coup, parce qu'une
section oubliée en traduisant ne se voit pas autrement.

**Une promesse de plus entre au contrat.** La liste des libellés que la fiche
cite mot pour mot et que le code doit porter passe de huit à neuf entrées :
`Subathon · DAY` s'y ajoute. Cette liste existe parce que la fiche a promis un
badge d'étiquettes pendant dix versions avant qu'il n'existe ; on ne recommence
pas.

## L'arc-en-ciel du subathon, et trois corrections de frise (v3.93)

### Un badge dans l'aperçu, et une couleur qui les traverse toutes

Un subathon est un événement exceptionnel. Il porte désormais son propre badge —
`Subathon · JOUR 10` — et, pour le dire, une couleur qui n'appartient à personne
parce qu'elle les parcourt toutes : huit arrêts, un fondu de l'un à l'autre,
douze secondes pour le tour. La pastille `J…` de la carte suit la même.

**Le contraste est tenu sur tout le chemin, et non aux seuls arrêts.** C'est le
piège de cette animation : le navigateur interpole en sRGB entre deux arrêts, et
le milieu d'un segment n'est ni l'un ni l'autre — un rouge et un vert voisins se
croisent en un olive terne, plus sombre que les deux. Le chemin entier a donc
été échantillonné, pas seulement les huit couleurs écrites.

**Et la clarté ne se devine pas de la teinte.** À clarté HSL égale, un bleu pèse
trois fois moins qu'un jaune en luminance : un arc-en-ciel posé à la même clarté
partout s'éteint sur le bleu et le violet. Les huit textes sont donc à
saturation et clarté constantes, et c'est le **fond du badge** qui est recalculé
teinte par teinte.

| Mesuré sur les 40 pas du cycle | Résultat |
|---|---|
| texte sur les trois fonds de carte | jamais moins de **6,87:1** (plancher : 4,5:1) |
| texte sur le fond composé du badge | **7,03 à 7,41:1** |
| la famille des badges fixes, pour comparaison | 6,38 à 7,67:1 |

L'arc-en-ciel est donc **plus constant** que les badges fixes qui l'entourent.
Un mutant qui pose un bleu « à clarté naïve » à un seul arrêt fait tomber la
pastille à **2,71:1** — c'est exactement ce que ce calcul existe pour empêcher.

**Le mouvement réduit garde la couleur et perd le mouvement.** Ce qui reste
n'est pas une teinte au hasard : c'est le cyan que le calcul des badges
désignait — le seul créneau de teinte encore libre, à 181°, à 34° du vert du
sponsor et 35° du bleu du co-stream, pour 7,06:1 sur son fond composé. Les
utilisateurs qui refusent le mouvement ne verront que celle-là : elle méritait
d'être choisie, pas tirée au sort.

### Le clignotement de « Top Chaînes »

« L'élément `J…` clignote toutes les 30 secondes. » La cause n'était pas dans
l'animation.

Une carte du classement est décorée **deux fois par relevé** : d'abord avec une
amorce bâtie à la main depuis le classement, puis avec la réponse de
`TseChannels`. Le classement ne demande pas les titres — il en pèserait mille
six cents pour une marque décorative — donc l'amorce n'a rien à dire du
subathon. Et **une absence de champ se lisait comme « ce n'en est pas un »** :
la pastille tombait à l'amorce et revenait à la réponse. Une fois par relevé,
indéfiniment.

Trois états, donc, et non deux : `undefined` veut dire *on n'en sait rien* et ne
touche à rien ; `null` veut dire *on sait que non* et défait la marque. Traiter
l'absence d'information comme une information est exactement ce que le reste du
module refuse de faire.

Le banc l'échantillonne **image par image** — le trou durait le temps d'un
aller-retour réseau. Deux relevés, une lecture à chaque rafraîchissement
d'écran, zéro absence tolérée.

### La vague, et ce qu'elle qualifie exactement

Sur une frise de clips, la durée d'une catégorie est une **approche** : ses
bornes sont les instants où un clip prouve qu'elle était en cours, et le vrai
début est antérieur. `~2h28` le dit en un caractère.

Elle ne se pose pas sur tout, et c'est ce qui lui donne son sens :

| | Exact | Approché |
|---|---|---|
| total de l'en-tête (durée du direct) | `8h36` | |
| avant le premier clip (deux instants connus) | `40m` | |
| durée d'une catégorie | | `~2h28` |

Une vague posée partout serait décorative ; posée sur le seul approché, elle se
lit. Le banc exige les **deux sens** — présente sur les catégories, absente sur
les deux durées exactes — faute de quoi un préfixe collé à toutes les durées
passerait le contrôle.

### La borne du premier clip s'estompe aussi

Le premier segment commence au premier clip qui le **prouve**. Mais la
catégorie, elle, avait commencé avant — quelque part entre le départ du direct
et ce clip, et rien ne dit où. L'intervalle douteux est donc la part inconnue
**tout entière**, d'où un fondu à 100 % : il ne dit pas « c'était cette
catégorie », il dit « ça l'est devenu quelque part là-dedans ».

La hachure reste par-dessus, parce que le fondu ne rachète pas l'ignorance. Sur
une frise de **chapitres**, rien de tout cela : le VOD donne l'heure du premier
changement comme celle des suivants, et en estomper une serait avouer un doute
qu'on n'a pas.

### Le « ×8 » ne reposait pas sur la même ligne que son nom

Le nombre de retours est écrit plus petit que la catégorie qu'il compte —
10,5 px contre 12. La rangée les **centrait**, et deux corps différents centrés
ne reposent pas sur la même ligne : mesuré, **0,81 px** d'écart.

Moins d'un pixel, et parfaitement visible — parce qu'une liste en donne huit
exemplaires l'un sous l'autre, et que l'œil lit la colonne, pas la ligne. Un
utilisateur l'a vu avant le banc.

La rangée s'aligne désormais sur les **lignes de base**. La pastille de couleur,
elle, reste centrée : c'est un trait de 14 px sans texte, dont la « ligne de
base » est le bord inférieur — alignée comme du texte, elle plongerait sous la
rangée.

## La sidebar qui se vidait, et pourquoi rien ne le disait (v3.92)

Un utilisateur : « de temps en temps, l'ensemble de mes chaînes suivies a
disparu ». Le rapport joint ne portait **aucune erreur** — `appels 1676`,
`echecs 0`, `erreurs (0)`, aucune pause réseau. Il portait en revanche quatre
chiffres qui, ensemble, ne peuvent pas être vrais :

```
cartes 9 · decorees 9 · roster 128 · cache 136 · fabriquees 0
```

Cent vingt-huit chaînes connues, cent trente-six en cache, neuf cartes à
l'écran — et **aucune carte fabriquée**. Le module des cartes en avance existe
exactement pour ce cas.

### La contradiction était écrite en toutes lettres

Les sondes disaient deux choses incompatibles à trois lignes d'écart :

```
! ok   cardClass   .side-nav-card              9 carte(s)
  na   cardLink    DOM.cardLinkSelector        aucune carte à sonder
! na   liveStatus  liveStatusOf()              aucune carte live à sonder
```

Neuf cartes existaient, et il n'y en avait **aucune à sonder**. La différence
entre les deux mesures est leur portée : `cardClass` compte dans tout le
document, les autres ne prélèvent que **dans la section suivie**.

### Une section vide est pire que pas de section

`followedSection()` est le pivot du module : une quinzaine d'appelants en
dépendent, et tous enchaînent sur `section.querySelectorAll('.side-nav-card')`.
Elle rendait une section **réelle mais vide**.

Rendre `null` aurait au moins été honnête : les appelants sortent tous sur
`if (!section) return`. Rendre une section vide leur fait conclure que la barre
**est** vide — et ils se taisent tous ensemble, sans une erreur, sans un
compteur, sans rien qui dise pourquoi.

Le module des **cartes en avance** y cherche son modèle de clonage. Pas de
carte, pas de modèle, `return` — et la chaîne que Twitch n'a pas encore posée
n'apparaît nulle part : ni par Twitch, ni par nous. C'est `fabriquees 0` avec
un roster de 128. Le relevé du roster passe par la même section : il avait cessé
d'apprendre, lui aussi.

### La section qui porte les cartes l'emporte

Le libellé désigne un **candidat** ; ce sont les **cartes** qui tranchent entre
plusieurs candidats, ou qui disqualifient un candidat vide. Deux causes mènent
au même symptôme, et la même règle les couvre toutes deux :

- un autre nœud portant le même `aria-label` **usurpe** la section — le cas
  s'était déjà produit une fois, avec un bouton de l'extension elle-même ;
- Twitch **remanie** sa barre, et l'en-tête cesse de partager une
  `.side-nav-section` avec la liste.

Quand aucun candidat ne porte de carte, il reste un ancrage que la langue
n'atteint pas : Twitch marque ses cartes suivies d'un
`data-test-selector="followed-channel"`, et ses recommandations d'un autre
(`recommended-channel`, `similarity-channel`). **La section qui contient de
telles cartes est la section suivie**, quel que soit son en-tête — et ce repli
ne peut pas se tromper de voisine, puisque le marqueur ne s'y trouve pas. Nos
propres cartes fabriquées en sont écartées : ce sont des clones, elles portent
le marqueur de leur modèle et désigneraient la section où **nous** les avons
posées.

En dernier recours, le comportement d'avant : le premier candidat, même vide.
Une barre dont personne n'est en ligne est un cas parfaitement normal, et
rendre `null` là où l'on rendait une section changerait le comportement de
quinze appelants pour rien.

### Le rapport dit désormais par où la section a été trouvée

```
── SECTION SUIVIE / FOLLOWED SECTION ─────────────────────────
  voie                   cartes
  vides                  0
  parCartes              3
  aucune                 0
```

`libelle` est le cas ordinaire ; **`cartes`** signifie qu'un candidat vide a été
écarté ; **`marqueur`**, que le libellé n'a rien donné et que la structure a
tranché ; **`libelle-vide`**, qu'on rend une section sans cartes — normal si
personne n'est en ligne, anormal sinon. Il n'y avait rien de tout cela dans le
rapport reçu : la cause ne se déduisait que de l'étrangeté des sondes.

### Ce que le banc montre

Le scénario 92 monte les **deux** causes, parce qu'un rapport ne permet d'en
écarter aucune, puis le symptôme complet : une chaîne apprise, que Twitch
retire de sa barre et qui repasse en direct sous un libellé usurpé.

Contre la rédaction d'avant, les six assertions tombent, et elles tombent en
recopiant le rapport reçu : `cardLink "na"` avec deux cartes décorées, et
`{"existe":false,"fabriquee":false}` là où l'utilisateur lisait `fabriquees 0`.

## La pastille passe à droite du pseudo (v3.92)

Le numéro de jour dit **quel événement** diffuse cette chaîne. C'est une
propriété de la chaîne, pas une nuance de sa durée : sa place est contre son
nom, et non dans le compteur d'ancienneté.

Et le compteur **redevient celui de tout le monde**. Il avait porté la pastille,
puis une chaleur en braise ; les deux sont retirés. Un chiffre qu'on lit pour
lui-même n'a pas à être repeint, et deux cartes voisines dont l'une est teinte
ne se comparent plus.

| | v3.91 | v3.92 |
|---|---|---|
| place | dans le compteur | à droite du pseudo |
| corps | celui de la durée (12 px) | `10px` |
| graisse | 700 | 600 |
| durée | braise `#ff8a5c`, graisse 700 | couleur et graisse standard |

### Le nom devient un élément, et il le faut

Twitch laisse le pseudo en **nœud de texte nu**. Sous `display: flex`, ce nœud
devient un élément *anonyme* — et un élément anonyme ne peut pas recevoir
`min-width: 0`. Il refuse donc de rétrécir, et c'est la **pastille** qui sort de
la boîte : mesuré à **98 px hors cadre**, invisible.

Le nœud est donc enveloppé dans un `<span>`. L'ellipse retombe alors sur le nom,
qui est ce qu'on peut abréger, et la pastille reste lisible jusqu'au bout.
L'arbitrage n'est pas arbitraire : `J9` abrégé ne veut plus rien dire,
`UnPseudoTresLong…` se lit encore.

**On déplace le nœud de Twitch, on ne le recopie pas.** React garde une
référence sur *ce* nœud-là pour y écrire le pseudo ; le recopier dans un élément
neuf et jeter l'original le ferait écrire dans un nœud détaché de la page, et le
nom cesserait de suivre la chaîne que la carte affiche — un défaut qui ne se
verrait qu'après un recyclage de carte. Le banc pose un témoin sur le nœud avant
la décoration et vérifie que c'est **le même objet** qui se retrouve dans
l'enveloppe.

### Le pseudo que le reste du code lit

Le `<p>` porte maintenant deux enfants : son `textContent` vaut `mouseJ9`, un
pseudo qui n'est celui de personne. `displayNameFor` lit donc l'enveloppe quand
elle est là — sans quoi ce nom-là partait dans les badges de l'aperçu et dans
les phrases de co-stream.

Le mutant qui relit le `<p>` entier rend `En live avec **mouseJ9**`. Il avait
d'abord **survécu** : l'assertion qui devait le tuer était placée *après*
l'étape qui défait la marque, où le `<p>` était redevenu un simple `mouse`. Une
assertion posée au mauvais moment du scénario ne prouve rien de plus qu'une
assertion absente.

### Deux déclarations que la mutation a corrigées

`flex: 0 0 auto` sur la pastille : je l'avais écrit en croyant que c'était lui
qui l'empêchait de céder. Le retirer, ou le ramener à `0 1 auto`, ne change
**rien** — un élément flex sans `overflow` a `min-width: auto`, c'est-à-dire sa
largeur de contenu, et `J120` ne peut pas rétrécir plus que `J120`. La
déclaration est retirée.

`text-overflow: ellipsis` sur l'enveloppe, à l'inverse, est bien nécessaire — et
**aucune mesure du banc ne peut l'attester** : le caractère `…` n'ajoute aucun
nœud et ne change aucun rectangle. Le scénario contrôle donc que les deux
propriétés sont bien *calculées* sur l'élément. C'est un contrôle de mécanisme,
plus faible qu'un contrôle d'effet, et c'est dit comme tel.

### Une valeur demandée qui n'existe pas

Le `vertical-align: center` transmis n'est pas du CSS valide — le navigateur
écarte la déclaration et retombe sur `baseline`. L'intention était claire et se
réalise autrement : dans une rangée flex, `vertical-align` n'a aucun effet sur
les éléments, et c'est `align-items: center` posé sur le titre qui centre la
pastille sur le nom. Écrire la propriété inerte à côté ferait croire qu'elle
travaille. Le banc mesure l'écart entre les **milieux** des deux boîtes : zéro.

## Quatre corrections sur retour d'usage (v3.91)

Deux captures d'une sidebar réelle, et quatre demandes. Aucune n'était une
idée neuve : chacune corrige quelque chose que le rendu montrait et que la
relecture du code ne pouvait pas montrer.

### L'anneau est retiré

Le contour lumineux de la v3.90 occupait le périmètre de la carte, seul canal
que rien ne prenait. Sur une capture isolée il tenait sa promesse ; dans une
colonne de quinze cartes il **prenait toute l'attention**. La carte ne se
distinguait plus, elle criait.

Il ne reste donc **qu'une marque** : le compteur qui chauffe et sa pastille de
jour. Rien n'est plus injecté dans la carte — un attribut, une pastille dans
un élément que l'extension écrivait déjà, et pas un nœud de plus. Le banc le
vérifie en comptant les enfants directs de la carte qui ne sont pas son lien :
zéro.

### La pastille : creuse, et alignée au pixel

Pleine, elle était un bloc de couleur dans une colonne qui n'en porte aucun —
elle pesait plus que la durée dont elle n'est que le préfixe. Elle est
désormais réduite à son **contour**, avec le fond de la carte au travers :
pas une couleur choisie qui ressemble à celle de la carte, **aucune** couleur,
de sorte qu'elle suive le survol, la sélection et la lueur d'abonné sans qu'on
ait à les prévoir.

Trois grandeurs se mesurent plutôt que de se regarder, et le banc les exige :

| | Attendu | Mesuré |
|---|---|---|
| corps du texte | celui de la durée | `12px` contre `12px` |
| ligne de base | la même | écart **0,00 px** |
| hauteur de la ligne | inchangée | `16,80` contre `16,80` |

**Ce que j'avais mal diagnostiqué.** La capture montrait la pastille montée
d'un cran, et j'ai d'abord cru à un problème de tailles : j'ai réduit le corps.
La sonde a dit le contraire. Une boîte `inline-block` aligne sa propre ligne de
base sur celle du texte voisin ; le seul décalage venait du `vertical-align: 1px`
que la v3.90 posait. Retiré, l'écart tombe à zéro **à toutes les tailles** — et
la pastille peut donc garder le corps exact de la durée, ce qui était la
demande.

Je m'étais persuadé du contraire en comparant des **rectangles de glyphes**,
dont le bas descend avec le corps : deux textes de tailles différentes n'y ont
jamais le même bas, alignés ou non. La sonde qui tranche est une boîte de
hauteur nulle en `vertical-align: baseline`, dont le bord inférieur *est* la
ligne de base.

### La carte à deux étages, et la règle qui n'y était pour rien

Sur le décor étroit du banc, la carte de subathon mesurait **34 px de haut
contre 16**. La pastille passait sur son propre étage.

La cause : nous injectons dans une page dont nous n'écrivons pas la feuille.
Une règle de l'hôte aussi banale que `.quelqueChose span { display: block }`
bat une classe seule, et la pastille cesse d'être en ligne. Le sélecteur porte
donc **deux classes** — `.tse-uptime > .tse-subathon-jour` — et passe devant.

**J'ai d'abord accusé le retour à la ligne** et ajouté un `white-space: nowrap`.
La mesure l'a réfuté : la colonne de droite s'élargit d'elle-même quand son
contenu grandit — 66,9 px pour `168h40`, 75,7 px pour `J120 168h40`, sur une
seule ligne avec ou sans la règle. Aucun décor ne pouvait la rendre nécessaire,
et un mutant qui la retirait survivait à tout le banc. **Elle est retirée** :
une règle qu'aucune mesure ne défend se fait passer pour la cause du défaut
qu'une autre a corrigé.

### Le « ×7 » appartient au nom, pas à la durée

`Discussions … … … ×7  7h25` : le nombre de retours se lisait à trois cents
pixels de la catégorie qu'il compte. `Discussions ×7` est **une** information ;
la couper en deux morceaux éloignés obligeait l'œil à faire le chemin.

Le nom portait `flex: 1 1 auto` : sa **boîte** prenait tout l'espace libre —
392 px mesurés pour un texte qui en occupe soixante-dix — et le `×7`, posé
juste après cette boîte, se retrouvait au loin pendant que le texte restait
calé à gauche. Le nom ne s'étire plus ; la durée se pousse au bord droit par
`margin-left: auto`, puisque c'est elle, et non le nom, qui tient la colonne
que l'œil parcourt verticalement.

**Et le piège était dans la mesure.** Un mutant remettant `flex: 1 1 auto` a
d'abord *survécu* : l'assertion comparait le bord de la **boîte** du nom au
`×7`, et cet écart vaut cinq pixels dans les deux cas, la boîte grandissant
avec le nom. J'ai failli en conclure que la correction était inutile et la
retirer. Ce qui se voit est la distance au **texte** — une plage la donne, une
boîte ne la donne pas. Sur le texte, l'écart vaut 5 px avec la règle et
**333 px** sans elle.

### La borne que les clips ne savent pas dater

Un chapitre de VOD donne l'heure du basculement. Un **clip** ne donne que la
preuve qu'à telle minute, telle catégorie était en cours. Entre le dernier clip
de l'une et le premier de la suivante, le changement a eu lieu quelque part, et
rien ne dit où. Un trait net à cet endroit affirmait une minute qu'on ignore —
exactement ce que le reste de ce module refuse de faire.

Le ruban **estompe** donc ces bornes-là, et le fondu est **à l'échelle** : sa
largeur est celle de l'intervalle douteux. Dix minutes de doute donnent dix
minutes de fondu ; deux clips consécutifs à une minute d'écart donnent une
borne presque nette, **parce qu'elle l'est presque**. Une frise de chapitres
n'en porte aucun : le banc exige zéro part estompée sur une frise dont chaque
heure est donnée par Twitch.

Le décor du banc donne un nombre vérifiable à la main. Les clips tombent à
−230 et −215 pour *Discussions*, puis à −150 et −40 pour *Hades II*. Le segment
*Discussions* est dessiné de −230 à −150, soit **80 minutes** ; mais le dernier
clip qui le prouve date de −215, et le premier qui prouve *Hades II* de −150.
**65 minutes de doute sur 80**, soit les `81,25 %` que le ruban doit estomper —
ni une largeur forfaitaire, ni le segment entier.

Le fondu se pose sur **la fin du segment qui précède** la borne, et non sur le
début du suivant : le segment suivant commence à son premier clip, si bien que
l'intervalle douteux tombe entièrement dans la queue du précédent. L'estomper
de l'autre côté le placerait là où l'on sait.

**Deux corrections sont venues de la capture.** La couture entre parts traçait
un trait net au milieu du fondu — c'est-à-dire l'affirmation que le fondu venait
de retirer ; elle s'efface là où l'on doute. Et le dégradé, posé en tête de
pile, était opaque à sa fin et **recouvrait la hachure** : la part perdait son
grain juste avant la borne pour le retrouver après, ce qui redessinait la
rupture. Il passe en dernière couche, et porte les **deux** couleurs en clair
plutôt que de fondre depuis `transparent` — un orange à moitié opaque sur du
cyan donne un olive terne qui n'est ni l'un ni l'autre.

## La carte d'un subathon (v3.90)

Un **subathon** est un direct que les abonnements prolongent : il ne s'arrête
pas, il dure des jours, il traverse des dizaines de catégories. C'est le format
le plus singulier de la plateforme, et jusqu'ici la sidebar le montrait comme
n'importe quel autre direct : une ligne, un compteur, rien.

Deux marques, et rien de plus : un **anneau de lumière** qui fait le tour de la
carte, et une **pastille de jour** collée à la durée — `J9 31h05`.

### Ce qu'on n'emploie pas pour le reconnaître : l'ancienneté

C'était le signal évident, et il est faux. Un subathon **à sa deuxième heure du
premier jour en est un** ; un rediffuseur qui laisse tourner sa chaîne
vingt-quatre heures n'en est pas un. `createdAt` mesure la **session**, pas le
format — et une reconnexion la remet à zéro sans interrompre l'événement.

La durée ne prouve donc rien dans un sens ni dans l'autre. La faire entrer dans
la règle n'aurait fait qu'ajouter un faux négatif au début et un faux positif à
la fin.

### Ce qu'on emploie : les deux endroits où le streamer le dit

Le titre et les tags. Trois règles, dont **deux sont des conjonctions** :

| | Ce qui déclenche | Exemple |
|---|---|---|
| (a) | le titre **nomme** l'événement — `subathon`, `sub-a-thon`, `SUB A THON` | `SUBATHON DAY 12` |
| (b) | un mot en **`thon`** *et* un numéro de jour | `!MOUSEATHON DAY 9` |
| (c) | un **tag** `Subathon` *et* un numéro de jour dans le titre | `Chill stream jour 5` |

**Pourquoi (b) et (c) exigent le numéro de jour.** *Marathon* est un jeu de
Bungie sorti en 2025 : un direct de deux heures qui y joue porte un mot en
« thon » et n'est rien d'autre qu'une partie. Le numéro de jour est ce qui
distingue un **nom** d'un **événement** — personne n'écrit « jour 9 » sur une
soirée. La conjonction n'est pas une prudence ajoutée : c'est elle qui rend la
règle juste.

Le mot **nu** `thon` est exclu — deux lettres sont exigées devant lui. C'est le
poisson, en français, et « je mange du thon jour 4 » ne décore rien.

### Le numéro de jour, dans les écritures qui ne s'écrivent pas comme la nôtre

Le nombre ne se pose pas au même endroit selon la langue : `day 9` en tête,
`9日目` en queue, `第9天` de part et d'autre. Trois formes d'expression le
couvrent, et les bornes de mot sont écrites en **propriétés Unicode** et non en
`\b`, qui ne connaît que l'ASCII et couperait `día` en deux.

La liste des mots qui disent « jour » couvre les langues où l'on diffuse en
volume, et elle en **écarte délibérément** certaines : le tchèque `den`, le
croate `dan` et le hongrois `nap` sont tous des mots anglais courants, et
`nap 3` n'annonce pas une diffusion de trois jours. Mieux vaut manquer une
langue que décorer une carte au hasard.

Les quatre cas en écriture non latine sont le vrai enjeu de la règle (c) : le
titre n'y porte **aucun mot latin**, et sans le tag rien ne les rattraperait.

### Le faux positif connu, nommé plutôt que tu

`python` est un mot en « thon ». Un titre `Python — Day 3` d'une série de code
sera pris pour un subathon. Le cas est rare, sans conséquence — une carte
décorée à tort — et le resserrer à `athon` le supprimerait au prix des noms
fabriqués en `-thon` sans `a`, que la règle demandée couvre expressément.

Il a sa ligne dans le banc, avec son verdict attendu. Si un jour il faut
trancher autrement, cette ligne dira exactement ce qu'on perd.

### Les deux marques — dont une n'a pas survécu

Le compteur d'ancienneté **chauffe** : il appartient à l'extension, personne
d'autre n'y touche, et il porte le numéro de jour. C'est le canal libre, et
c'est celui qui a été gardé.

Un **anneau de lumière** faisait le tour de la carte. Le périmètre était le
dernier canal que rien n'occupait — le trait de « fraîchement en ligne » est
intérieur, la lueur d'abonné est un fond — et il disait « ça tourne encore »
sans rien recouvrir. **Il a été retiré en v3.91** : sur une sidebar réelle il
prenait toute l'attention d'une colonne qui compte quinze cartes. Un signal qui
écrase ses voisins ne renseigne plus sur le sien.

Le rouge **plutôt que l'orange**, et c'est arithmétique : l'or de l'abonné est
à 37°, un orange à 25° lui serait voisin, et sur une carte à la fois abonnée et
en subathon les deux se seraient fondus en un même camaïeu chaud. On se pose à
9°, soit vingt-huit degrés d'écart.

### La pastille s'ajoute, elle ne réécrit pas

`J9 31h05`. Le compteur de durée est réécrit **toutes les minutes**, et
l'écraser entier ferait disparaître la pastille entre deux relevés. L'écriture
vise donc le **nœud texte** de fin plutôt que l'élément.

**La carte ordinaire ne change pas de chemin**, et c'est voulu : sans pastille,
on repasse par l'écriture d'avant, donc le contenu et le `textContent` de
l'élément sont exactement ceux d'hier — ce que le banc lit en quatre endroits.

Un subathon peut **ne pas se compter** : `24H SUBATHON` nomme l'événement sans
en numéroter le jour. La carte le marque alors sans pastille. On ne montre pas
un nombre qu'on n'a pas, et surtout on ne retombe pas sur `J1` par défaut, ce
qui serait une invention.

Le titre est **lu, jamais écrit**. Il n'entre dans l'extension que pour y
chercher un motif, et seul un **nombre** en ressort — le libellé (`J9`, `D9`,
`T9`, `第9天`) est bâti par la table de langue.

### Ce que le banc a trouvé, et que la relecture n'avait pas vu

La marque doit savoir **se défaire** : un streamer retire « subathon » de son
titre au milieu de sa diffusion, et React réutilise la même carte d'une chaîne
à l'autre. Elle se défaisait — mais **l'espace laissé derrière ne partait
pas**. L'espace qui sépare la pastille de la durée vit dans le nœud texte, pas
dans la pastille : la retirer seule laissait `␣31h05` sur la carte jusqu'au
relevé suivant.

Le relevé suivant le rattrapait. « À la minute prochaine » n'est pas une
réponse quand le décalage se voit.

L'assertion qui l'a trouvé compare le compteur à celui d'une **carte ordinaire
de même ancienneté**, plutôt que de recopier un format : `mouse.texte === 'J9 '
+ ordi.texte`. Un `includes` ne l'aurait pas vu.

### Le rapport de diagnostic dit laquelle des trois règles porte les cas

Cette détection ne tourne que sur ce que Twitch écrit dans le titre, et elle
n'a jamais pu être exécutée contre le vrai Twitch. Le rapport est donc le seul
œil qu'on aura :

- `detectes` vient du **cache**, `marquees` du **DOM**. Une carte non décorée
  peut vouloir dire que la détection n'a rien vu, ou qu'elle a vu et que la
  pose n'a pas suivi ; leur écart désigne le coupable sans avoir à deviner ;
- `voies` compte les cas par règle. Un rapport où tout arrive par `thon`
  dirait qu'on décore des parties de *Marathon* ; un rapport où `tag` ne sort
  jamais dirait que Twitch ne sert pas ce tag dans les tags libres, et que la
  règle (c) est lettre morte ;
- `sansJour` compte les subathons nommés mais non numérotés — ceux qui gardent
  l'anneau sans la pastille.

Tout est **relu à la demande** du cache et du DOM. Aucun compteur cumulatif :
un compteur qui s'incrémente à chaque passe dérive, et celui-ci doit dire un
**état**.

### Le titre coûte une soixantaine d'octets par chaîne

C'est un champ de plus dans une requête qui part de toute façon : aucune
opération supplémentaire, aucune permission, rien qui change au contrat
anonyme. Le volume est réel et se chiffre — environ **six kilo-octets par
balayage** sur les trente que pèse `TseChannels`, soit **+20 %**.

Ce qu'il achète, c'est le **numéro du jour**, qu'aucun calcul ne donne. Il
n'est écrit nulle part ailleurs : ni dans `createdAt`, qui repart à chaque
reconnexion, ni dans les tags, qui ne comptent rien.

### Le mouvement réduit garde l'information et perd le mouvement

`prefers-reduced-motion` fige la marque sans la retirer : la chaleur du
compteur se pose sur une teinte pleine. La pastille du jour, elle, n'a jamais
bougé — elle n'a rien à perdre, et c'est elle qui porte le sens.

> **Retiré en 4.14.0.** Le bloc « mouvement réduit » n'existe plus : voir
> *Moins de règles, une boucle qui se referme, un mode d'emploi refait*.

## La frise d'un subathon (v3.89)

Un utilisateur envoie une capture : **Ironmouse en subathon**, un direct qui ne
s'arrête pas. Trente et une heures au compteur, quinze basculements de
catégorie — et une frise qui faisait **deux fois la hauteur de la vignette**.

### Ce que la capture montrait vraiment

Huit des quinze lignes portaient « Discussions ». Entre deux jeux, une
streameuse repasse par sa catégorie de discussion, et la frise comptait chaque
retour comme une entrée neuve. Le bloc énumérait donc sept fois le même nom
sans jamais dire ce qui aurait été utile : **combien de temps au total**.

Et le défaut n'était pas qu'esthétique : **la liste n'était pas bornée**.
`CATEGORY_TRAIL_SEGMENTS` plafonne à douze le registre *observé* ; les chapitres
du VOD, eux, arrivent tous, sans plafond. D'où quinze lignes là où douze
étaient la limite supposée — et cent soixante sur une diffusion de deux
semaines.

### Une ligne par catégorie, et non par basculement

| | Avant | Après |
|---|---|---|
| Discussions | 7 lignes : 14m, 1h36, 1h28, 2h46, 17m, 5m, 1h00 | **une** : `Discussions ×7 7h26` |
| Watch Your Plastic Duck | 2 lignes : 7h14 et 1h08 | **une** : `×2 8h22 · en cours` |
| Hauteur du bloc | 15 lignes | **8** |

Le regroupement ne perd rien, et c'est ce qui le rend acceptable :

- la **somme par catégorie** est un renseignement que la liste n'a jamais
  donné — huit heures vingt-deux de Plastic Duck, jusqu'ici coupées en deux
  sans que rien ne les additionne ;
- le **nombre de retours** est dit par `×7`, donc « elle y est revenue » ne
  disparaît pas ;
- la **chronologie reste entière dans le ruban**, qui garde un trait par
  basculement. C'est déjà le partage des rôles : le ruban donne la forme, la
  liste donne les noms.

L'ordre est celui de la **première apparition**, et non celui des durées : l'œil
doit pouvoir suivre le ruban de gauche à droite et retrouver les lignes dans le
même ordre. Trier par durée mettrait Plastic Duck en tête et casserait la seule
chose qui relie les deux blocs.

**Un direct sans retour ne paie rien** : autant de lignes que de segments, aucun
`×N`. Le cas ordinaire est inchangé, au pixel près.

### Le plafond, et pourquoi il vaut exactement huit

Au-delà de huit catégories distinctes, deux lignes porteraient la même couleur —
la palette en compte huit — et une légende dont deux entrées se ressemblent ne
légende plus rien. Le plafond est donc **la taille de la palette**, ce qui n'est
pas un nombre choisi mais un nombre déduit.

On garde la catégorie **en cours** d'abord, quoi qu'il arrive — c'est la seule à
laquelle un survol répond vraiment — puis les plus longues. Le reste se replie
en une ligne : `+ 4 autres catégories · 3h52`.

**Une capture a corrigé le tri des couleurs.** Servie dans l'ordre
chronologique, la palette pouvait donner à une ligne *affichée* la teinte d'une
autre ligne affichée : un jeu repris en douzième position, gardé parce qu'il est
en cours, tombait sur la couleur d'un voisin de la liste. Toute la raison d'être
du plafond s'effondrait avec ça. Les couleurs vont désormais **aux lignes
affichées d'abord** ; les repliées prennent ce qui reste, et une teinte partagée
n'y trompe personne puisque aucune légende ne la désigne.

### Le ruban ne déborde plus

Second défaut, trouvé en poussant le décor : la largeur plancher des traits
était **fixe**, à quatre pixels. Le ruban fait 456 px ; au-delà de 114 traits, il
déborde — et comme il est en débordement caché, les derniers segments,
**dont celui en cours**, disparaissaient sans un mot.

Le plancher vaut désormais quatre pixels tant qu'il y a la place, et la part de
chacun sinon : `min(4px, calc(60% / var(--tse-parts)))`. Les soixante pour cent
laissent la marge nécessaire — si la somme des planchers valait exactement la
largeur, la moindre part qui grandit au-delà du sien la ferait déborder de
nouveau, les autres ne pouvant plus lui céder un pixel.

### Ce que la mutation a corrigé dans le banc lui-même

La première rédaction de l'assertion qui garde ce plancher posait **cent**
basculements. Elle passait — et elle passait **sans rien prouver** : cent fois
quatre pixels tiennent encore dans quatre cent cinquante-six. La mutation l'a
dit ; le décor en pose maintenant cent soixante, qui en demanderaient 644 sous
l'ancienne règle. Le débordement mesuré sous mutation est de **188 px**, soit
exactement la différence.

## Le panneau se met à dessiner (v3.88)

Deux vues qui ne se tabulent pas, et une refonte de la frise. Les trois sont du
**dessin**, et le dessin ne se juge pas sur du code : chacune a été
photographiée avant d'être gardée, et chacune a perdu quelque chose au
développement de la photo.

### Le rythme — ce que la mémoire des visites savait déjà

L'extension relève les visites depuis toujours, pour classer les chaînes par
popularité personnelle : jusqu'à vingt horodatages par chaîne, quatre cents
chaînes. Le score n'en tire qu'une décroissance exponentielle et **jette le
reste** — or ces horodatages portent une seconde information, entière et
gratuite : *quand* on regarde.

Sept lignes, vingt-quatre colonnes, à l'heure locale de qui lit. **Aucun
stockage nouveau**, aucune requête, aucune permission : c'est la même donnée,
lue par l'autre bout.

Ce que la vue **n'est pas**, et la description le dit en toutes lettres sous son
titre : ce n'est pas un temps de visionnage. Une visite se compte une fois par
chaîne et par tranche de trois heures, après un séjour minimal sur la page. Six
heures sur une seule chaîne pèsent donc moins que trois chaînes ouvertes coup
sur coup. C'est un **rythme** — le moment où l'on vient — et le présenter
autrement serait mentir sur la mesure.

La grille quantifie en quatre paliers, ce qui efface les écarts fins entre deux
heures voisines ; un **profil horaire** les rend, sur les mêmes verticales et
sans palier. C'est la projection de la grille sur ses colonnes, pas un second
dessin.

Deux corrections sont venues de la capture :

- l'**échelle du profil** était alignée en bas, avec les barres — c'est-à-dire
  à l'endroit exact où la valeur vaut zéro. Un maximum se pose là où il est
  atteint ;
- le profil **flottait** trop loin sous l'axe des heures et se lisait comme un
  objet séparé.

### La courbe des retards — et l'axe qu'il a fallu changer

La section « Retard de Twitch » donnait quatre nombres. Elle donne maintenant la
**forme** derrière eux : une cumulée, où la médiane et le 90e centile sont
littéralement les endroits où la courbe croise 50 % et 90 %. Le dessin explique
les cartouches au lieu de les répéter — et il ne coûte **aucune donnée de
plus**, la section envoyant déjà chaque relevé pour son tableau.

**J'avais écrit qu'une cumulée ne dégénère jamais. C'est faux, et la capture
l'a montré.** Elle ne dégénère pas en *ordonnée* — elle monte de 0 à 100 % quoi
qu'il arrive — mais elle dégénère en *abscisse* dès que la queue est lourde, et
une distribution de latences l'est toujours. Sur un décor réaliste — deux cent
quarante relevés sous deux minutes, deux traînards à une demi-heure — la courbe
montait à la verticale dans les **trois premiers pour cent** de la largeur puis
courait à plat sur tout le reste. Ni la médiane ni le 90e centile ne s'y
lisaient, et leurs deux étiquettes se chevauchaient dans le coin gauche.

L'axe est donc **logarithmique**, ce qui ne cache rien : les deux traînards
restent sur le tracé, simplement à une distance qui laisse voir le reste. Le
prix est un axe qu'il faut graduer — en durées rondes, parce que « 100 s » ne
veut rien dire pour personne. Deux détails ont suivi sur la même capture : le
haut de l'axe est **arrondi au palier suivant**, sans quoi les deux dernières
graduations se touchaient ; et le plateau final va **jusqu'au bord**, sans quoi
l'aire se refermait en diagonale — une pente qui se lisait comme une
décroissance alors qu'il ne s'était rien passé.

Le banc garde cette porte par l'assertion qui mesure **où tombe la médiane sur
la largeur du tracé**. Vérifié par mutation : en repassant l'abscisse en
linéaire, elle tombe à 2 %, et l'assertion tombe avec.

### La frise, redessinée

Elle tenait ; elle ne se tenait pas **ensemble**. Trois défauts précis :

1. **La barre était fragmentée.** Un intervalle d'un pixel entre les parts, sur
   un fond clair qui transparaissait : à quatre segments on lisait quatre objets
   posés côte à côte plutôt qu'une seule durée découpée. Le temps d'un live est
   *continu*. Les parts sont désormais jointives, séparées par une couture
   sombre tirée à l'intérieur de chacune — le ruban redevient un, ses frontières
   restent nettes.
2. **La pastille de la liste ne ressemblait pas à ce qu'elle nommait.** Un carré
   plat de neuf pixels en face d'une part hachurée : pour la ligne « non
   observé », la légende et le ruban ne se répondaient tout simplement pas. La
   pastille est devenue un **trait vertical** — une tranche du ruban,
   littéralement — et la ligne non observée porte un trait discontinu, comme sa
   part est hachurée.
3. **La frise ne disait pas sur quoi elle porte.** Un ruban sans échelle n'est
   qu'une proportion : « deux tiers, un tiers » de quoi ? La **durée totale**
   est maintenant en tête, à droite du libellé. C'est le seul ajout
   d'information de la refonte, et il coûte un nombre qu'on avait déjà.

Là encore, la capture a corrigé le dessin. La durée totale sortait en
**capitales** — « 4H12 » — parce que l'en-tête en porte pour son libellé. Et une
*tête de lecture* avait été posée au bord droit du segment en cours : elle ne
survit pas à sa propre boîte, le ruban étant une pilule à coins ronds en
débordement caché, où deux pixels tirés le long d'une extrémité courbe sont
rognés à presque rien. Elle était invisible sur les quatre cas photographiés, et
elle n'avait de toute façon rien à marquer — le bord droit du ruban *est*
maintenant, par construction.

Un piège mérite d'être écrit, parce qu'il est silencieux : la couleur des parts
et des pastilles est posée en ligne par `backgroundColor` et **non** par le
raccourci `background`, qui remet `background-image` à `none` et emporterait le
dégradé, la hachure des clips et celle de la part inconnue — trois règles qui
auraient l'air posées et ne s'appliqueraient pas.

## Une jumelle et un interrupteur mort (v3.87)

L'audit de la 3.86 avait laissé deux points de côté, jugés cosmétiques. Ils le
sont — mais l'un des deux cachait un trou de couverture, et c'est en le
regardant de près qu'on s'en est aperçu.

### Deux corps qui devaient évoluer ensemble

`oublierAbsents` et `reconcile` étaient la même fonction : **onze lignes
identiques sur douze**. La seule différence tenait à une garde — « pas
regardée, pas jugée » — qui n'a pas lieu d'être sur la voie du tag, puisque la
requête de tag regarde tout ce qui porte le tag.

Le danger d'une jumelle n'est pas la place qu'elle prend, c'est qu'on corrige
la règle d'éviction dans l'une et qu'on oublie l'autre — et que rien ne le
signale. La différence s'exprime donc maintenant par un **argument** :
`reconcile(poolTag, TOUT_REGARDE, vus, now)`, où `TOUT_REGARDE` est un ensemble
qui contient tout. Il n'y a plus qu'un corps à maintenir, et la seule chose que
la voie du tag ait de particulier est écrite là où on la lit.

Le dépôt passe de deux blocs dupliqués à **un** — celui qui reste est le
fragment GraphQL partagé par deux requêtes distinctes, et le factoriser
rendrait les deux requêtes moins lisibles, pas plus.

### L'interrupteur qui n'avait jamais servi

Le décor de test portait deux drapeaux que **aucun scénario n'a jamais mis à
`true`**, depuis l'entrée du harnais dans le dépôt. Ils ne décrivaient donc pas
un cas éprouvé : seulement une intention.

`__catOrdered` aurait fait rendre au stub des `streams` déjà triés. Le décor
les rend toujours à l'envers, et c'est ce qui donne leur valeur aux assertions
de classement — une réponse déjà triée les laisserait passer quoi que fasse le
module. L'interrupteur est retiré, le comportement reste.

`__upperCaseLogins`, lui, visait un vrai danger, et **c'est le seul trou de
couverture de tout l'audit**. Twitch traite les logins sans égard à la casse et
rien n'oblige sa réponse à rendre exactement la chaîne demandée — or c'est sur
ce champ que le lot se réindexe. La normalisation existait bien (trois
frontières la posent), elle n'était simplement **jamais éprouvée**.

Le scénario 13 s'en charge désormais, et la panne qu'il attrape n'est pas celle
de son voisin : l'ordre inversé fait changer les données de **propriétaire**,
la casse fait qu'elles n'arrivent **à personne** — chaque chaîne passe pour un
login que Twitch aurait omis, les cartes restent nues, et le cache reste vide.
Vérifié par mutation : en retirant le `toLowerCase()` de l'indexation, les
trois nouvelles assertions tombent — y compris `cache 0` — tandis que les cinq
qui les précèdent restent vertes. La couverture ajoutée est donc bien nouvelle.

## Ce qu'un audit trouve quand rien n'est cassé (v3.86)

Toutes les entrées de cette page partent d'un symptôme : quelqu'un a vu quelque
chose qui n'allait pas. Celle-ci part de rien — d'une relecture systématique
demandée sans panne à réparer. C'est un exercice différent, et il vaut la peine
d'en dire le résultat en entier, y compris ce qu'il n'a **pas** trouvé.

### Le seul défaut de fond : un mémo qui ne s'oubliait jamais

Le registre des chapitres de VOD — `streamId → { segments, continu, source }`
— n'avait **aucun plafond**. Ni borne de volume, ni purge périodique, ni
résidence au rapport. Il était le seul dans ce cas : `LIVE_CACHE_MAX`,
`META_CACHE_MAX`, `GS_CACHE_MAX`, `CATEGORY_TRAIL_MAX`, `CAT_LANGUE_MAX`,
`CATEGORY_SWITCH_MAX` bornent tous les autres, et le commentaire de ce dernier
énonce la règle : *une structure qui ne se purge pas finit par grossir sans fin
sur des mois d'usage.*

Ce qui a masqué l'omission est que ce registre **a** un TTL. Il n'en tire
simplement aucune conséquence : `CHAPITRES_TTL` décide s'il faut **redemander**,
jamais s'il faut oublier, et `preludeDe` lit l'entrée sans le consulter — à
dessein, puisque le passé d'un direct ne se dément pas. Une entrée par
diffusion survolée s'ajoutait donc pour la durée de l'onglet, avec jusqu'à
trente segments chacune quand la source est les clips.

**La borne est posée par le volume, jamais par l'âge**, et la distinction n'est
pas cosmétique. Évincer une entrée vieille de onze minutes ne corrigerait rien
— elle n'est pas fausse, elle est ancienne — et ferait repartir au survol
suivant une requête dont la réponse est déjà connue. Ce serait le contraire de
la règle qui gouverne toute cette porte : *une requête qui n'apprend rien est
une requête de trop.* On n'évince donc que sous la pression mémoire, la moins
récemment apprise en premier.

Le plafond se tient **à l'écriture**, dans `retenir`, et non au réveil d'un
minuteur : il vaut alors à tout instant. Et le rapport porte désormais
`resident` contre `max`, sur le modèle de `frise`. Les deux vont ensemble —
**une borne qu'on ne peut pas observer ne se vérifie pas**, et c'était
précisément la structure dont l'occupation n'apparaissait nulle part.

### La réinsertion qui ne couvrait qu'un cas sur deux

La 3.79 avait corrigé l'éviction du registre des frises : `Map` itère dans
l'ordre de **première** insertion et `set` ne déplace pas une clé existante, si
bien que purger par la tête sortait la frise la plus riche. La correction — un
`delete` avant le `set` — n'a été écrite que dans la branche « la chaîne
poursuit son direct ». L'autre branche, celle d'une chaîne qui **redémarre**
une diffusion, faisait un `set` sec sur une clé déjà présente.

Conséquence : une chaîne suivie de longue date qui relance un live gardait la
position la plus **ancienne**, et serait sortie la première — à l'instant même
où on venait de l'observer. Le paragraphe voisin promettait pourtant l'inverse :
*« une frise ne vieillit que si sa chaîne cesse de passer dans les relevés ».*

Le `delete` est donc remonté avant l'aiguillage. Il ne fait rien sur une chaîne
inconnue, et remet les deux autres en queue de file.

**Ce que cela ne change pas, et il faut le dire.** Aucun effet observable tant
que le registre reste sous sa borne, et la faire tomber demanderait plus de
cinq cents chaînes en cache. Le scénario 82 avait déjà tranché cette question
et refusé de fabriquer le décor : *on ne publie pas vert un scénario qui coûte
une minute pour un renseignement qu'une lecture donne.* Ce qui garde la porte
est donc écrit là où la faute se commet — dans la **forme** du code
d'écriture, seule chose qu'une régression future toucherait forcément.

### Trois documents qui avaient cessé de dire vrai

Dans un dépôt où la moitié de ce qu'on sait du produit est dans les marges, un
commentaire faux coûte plus qu'un commentaire absent : il envoie chercher un
bogue là où il n'y en a pas.

- **Deux blocs voisins s'y contredisaient.** Celui de la 3.80 annonçait que le
  menu catégorie, sous une langue choisie, montrerait « les catégories de cette
  langue » — c'était la route `games(options:)` que la 3.82 a retirée, faute
  d'exister dans le schéma. La réparation est écrite juste en dessous ; la
  phrase, elle, était restée. Seule sa seconde moitié était fausse : le menu
  langue propose bien toutes les langues de Twitch avec leur audience réelle.
- **Quatre lignes étaient écrites en séquences d'échappement** (`libell\u00E9`),
  entrées en 3.58 et illisibles depuis. Les seules du dépôt.
- **`friseDe` promettait une préférence de libellé qui n'a jamais existé** :
  « on garde le nôtre s'il est traduit et pas le sien ». Il n'y a pas lieu de
  l'écrire — les deux libellés viennent de la même source, `game.displayName` à
  défaut `game.name`, donc l'un ne peut pas être traduit quand l'autre ne l'est
  pas.

### Ce que l'audit n'a pas trouvé

Le reste est passé au crible et ressort intact : **zéro** constante de `CFG`
morte sur 100, **zéro** libellé mort sur 70 × 10 tables, **zéro** clé `_locales`
morte ou manquante sur 103 × 12 locales dans les deux sens, **zéro** classe CSS
morte, **zéro** fonction non référencée sur 283, **zéro** `catch {}` muet,
**zéro** fuite d'écouteur ou de minuteur, et **deux** blocs dupliqués dans
13 522 lignes.

La performance a été **mesurée** plutôt que devinée : `rescan()` coûte 13,5 ms
sur un pool de 1 800 chaînes, et ce coût ne suit pas la taille du pool (60 →
11,8 ms ; 1 800 → 15,1 ms) mais le nombre de cartes, à ~78 µs l'unité. Avec un
anti-rebond de 250 ms et le gel en onglet caché, cela plafonne à quelques
pour cent d'un cœur. **Aucune optimisation n'est donc proposée** : en signaler
une ici aurait été inventer un problème pour avoir quelque chose à corriger.

## Le menu catégorie sous une langue (v3.85)

Sous le globe, les chiffres du menu catégorie sont ceux de Twitch et ils sont
justes. Sous un drapeau, ils **disparaissaient** — et le tri retombait
alphabétique, ce qui se voyait au premier coup d'œil sur une capture : Albion
Online, Always On, Animaux…

**Deux fautes, et la seconde n'était pas là où le symptôme se voyait.**

### Le registre n'était rempli que dans un sens

Les mesures se rangent par couple (catégorie, langue). Deux questions les
lisent, et il fallait remplir **les deux sens** :

| question | ce qu'on fixe | ce qu'on parcourt | coût |
| --- | --- | --- | --- |
| combien de francophones **sur GTA V** ? | la catégorie | les 31 langues | 31 opérations |
| combien de francophones **sur chaque catégorie** ? | la langue | les 100 catégories | 100 opérations |

La 3.84 n'écrivait que le premier. Le second restait vide, donc le menu
catégorie n'avait aucun chiffre à afficher dès qu'une langue était choisie.
Chaque relevé emploie la requête que la sélection emploierait — ici
`game(name:){ streams(broadcasterLanguages: [code]) }`, celle de la passe de
portée — de sorte que le nombre annoncé et le nombre obtenu soient le même.

### Et la signature du menu ne voyait pas la différence

Le menu ne se réécrit que si sa **signature** change ; c'est ce qui l'empêche de
se fermer sous la souris à chaque scan. Or elle était calculée avec
`counts.get(v) || 0` : une catégorie passant d'**inconnue** à **mesurée à zéro**
donnait exactement le même texte. La signature ne bougeait pas, le menu ne se
reconstruisait pas, et le zéro n'apparaissait jamais.

Depuis que « on ne sait pas » et « personne » s'affichent différemment, la
signature doit voir cette différence-là aussi. C'est une faute dont le symptôme
était ailleurs que la cause, et seule une sonde en isolation l'a montrée — le
banc, lui, la reproduisait sans la nommer.

### Absent n'est pas zéro

| état | affichage | ce que ça dit |
| --- | --- | --- |
| jamais mesuré | *rien* | on ne sait pas |
| mesuré à zéro | `0` | cette langue n'a personne ici |

Les deux se ressemblaient ; ils ne se ressemblent plus, ni au rendu, ni dans la
signature, ni dans le tri.

## Un code refusé n'est plus jamais renvoyé (v3.85)

Effet de bord heureux, et éprouvé : le relevé qui remplit les chiffres
interroge **tous** les codes de langue dès la première catégorie choisie. Il
apprend là ceux que le schéma refuse et les partage avec la descente. Quand on
choisit ensuite une langue dont le code est mauvais, plus une seule requête ne
part avec lui — là où le banc en tolérait une.

Deux gardes ont été resserrées au passage :

- **une garde par clé**, et non une pour tout le monde. Un unique drapeau « un
  relevé est en cours » faisait *tomber* la demande suivante — celle d'une
  autre portée, qui n'avait rien à voir ;
- **les chiffres des menus passent avant les gardes de la marche.** Placés
  après, ils étaient inatteignables pendant qu'une marche tournait, c'est-à-dire
  précisément à l'instant où l'on vient de changer de filtre — donc où ils sont
  périmés.

## « 21 » là où il y en avait 318 (v3.84)

Un utilisateur a compté à la main : le drapeau hongrois annonçait **21**, et le
sélectionner en montrait **environ 318**. Il avait raison, et l'écart n'était
pas une approximation — c'était un autre nombre, quinze fois plus grand.

La cause tient en une ligne du même rapport : **`pool 14`**. Le compteur sommait
le pool mondial par tag de langue, or ce pool est un **top**. Les chaînes
hongroises pèsent 127, 22, 21, 17 spectateurs : elles passent toutes sous le
seuil mondial, et le pool n'en connaissait qu'une. Sommer un échantillon qui
exclut par construction ce qu'on veut compter ne donne pas un ordre de grandeur,
cela donne du bruit.

**Il n'y a qu'une définition qui tienne**, et c'est celle que l'utilisateur a
employée sans le dire :

> le chiffre en face d'un drapeau est la somme de ce qu'on obtient **en le
> choisissant**.

On le mesure donc avec la requête même que la sélection emploierait, et sur la
même profondeur :

| portée | requête de mesure | ce que la sélection emploie |
| --- | --- | --- |
| sans catégorie | `streams(freeformTags: [langue])` | la voie du tag — la même |
| avec une catégorie | `game(name:){ streams(broadcasterLanguages: [code]) }` | la passe de portée — la même |

Le nombre affiché et le nombre visible sont alors le **même nombre**, par
construction et non par chance. Le banc le vérifie littéralement : il somme les
chaînes servies et les compare au libellé du menu.

Trente et une opérations **légères** — un entier par chaîne, rien d'autre — une
fois par portée et par période de cinq minutes. Le repli sur le pool est
**retiré**, pas corrigé : il ne répondait à aucune question qu'un utilisateur
puisse se poser. Ce qu'on n'a pas mesuré ne s'écrit pas ; ce qu'on a mesuré à
zéro porte son zéro, parce que c'est une réponse.

## Les clips : « server error » n'est pas « unknown field » (v3.84)

Le premier rapport portant la troisième porte donnait `clips 5 · clipsErreur 5`,
et le journal : `réponse 200 avec erreurs GraphQL — server error`.

**Ce message ne dit pas la même chose qu'un refus de schéma.** Un argument
inconnu se fait nommer — `In field "freeformTags": Unknown field` — comme
`games` l'a montré deux versions plus tôt. Ici la requête a été **validée**, et
c'est le résolveur qui a échoué : quelque chose dans la combinaison ne lui
convient pas.

Deux défauts, donc, et le second est le plus coûteux :

1. la forme `criteria: { period: LAST_DAY, sort: CREATED_AT_DESC }` est réfutée ;
2. **la même forme a été redemandée cinq fois.** Une réponse *arrivée* et
   porteuse d'erreurs dit quelque chose de la forme ; une coupure de transport
   ne dit rien. Les replier sur la même sentinelle faisait rejouer une question
   déjà tranchée.

Les deux échecs sont désormais séparés. Un refus du serveur fait **avancer d'un
cran** une liste de formes ; une coupure retente la même. La liste épuisée, la
porte se ferme pour la session, et le rapport porte `clipsForme` — sans quoi
« clipsRefus 3 » ne dirait pas laquelle a été réfutée.

## La troisième porte : les clips (v3.83)

Un quart des survols n'a **aucun enregistrement** : dix-neuf chaînes sur
soixante-dix-sept dans un rapport, dont cinq sans la moindre archive et
quatorze dont la plus récente datait de huit heures à dix-sept jours avant le
live. Ces chaînes ne permettent pas le replay ; leur passé n'existe nulle part
sous forme de VOD.

**Le tour de ce qu'une requête anonyme peut atteindre a été fait** :
`archiveVideo` (première porte), `videos(type: ARCHIVE)` (deuxième), les types
`HIGHLIGHT` et `UPLOAD` — qui *dérivent* d'un VOD et manquent donc exactement
là où il manque — et `broadcastSettings`, qui ne dit que le présent. Les clips
sont la seule trace publique de ce qu'une chaîne diffusait à un instant passé.

### Ce qu'un clip prouve, et ce qu'il ne prouve pas

Il porte sa date et sa catégorie : « à 19 h 42, elle était sur Hadès II » est
une **observation**, au même titre que les nôtres. Mais deux clips ne disent
rien de l'intervalle qui les sépare. Placer un basculement à l'heure d'un clip
serait inventer.

D'où une règle étroite : **un segment ne commence qu'à un instant observé** — le
premier clip d'une suite de clips portant la même catégorie. Jamais avant.

### Et elle ne se présente pas comme les autres

| | frise de chapitres | frise de clips |
| --- | --- | --- |
| origine des bornes | Twitch, à la seconde | un clip, donc un **minorant** |
| tête de la frise | le début du live | « avant le premier clip », mesuré |
| mention | aucune | *d'après les clips* |
| barre | pleine | hachurée en biais |

La hachure reprend le vocabulaire visuel déjà employé pour la part inconnue :
même idée, même trait. Une frise de clips ne se lit pas comme une frise de
chapitres, et elle ne doit pas en avoir l'air.

Le banc le tient dans les deux sens : faire commencer le premier segment au
départ du live — l'invention que la règle refuse — fait tomber trois
assertions, dont celle qui nomme la part de tête.

## Les deux filtres se répondent enfin (v3.83)

Trois retours, sur la même capture, et trois défauts distincts.

**Le tri.** Les langues sans chiffre remontaient au-dessus de l'anglais à
130 k. `Map.get` rend `undefined` pour une langue non mesurée, et
`undefined - 130100` vaut `NaN` : un comparateur qui rend NaN ne trie pas, il
laisse l'ordre à la discrétion du moteur. Une valeur absente vaut désormais
zéro, et les langues chiffrées sont en tête, décroissantes.

**La symétrie.** Le menu langue suivait la catégorie choisie ; l'inverse
n'était pas vrai — drapeau français, et « Discussions 400 k », le chiffre du
monde entier sous un filtre qui n'en montre qu'une part. Les compteurs du menu
catégorie suivent maintenant la langue, et leur **ordre** avec eux. La *liste*,
elle, ne bouge toujours pas : c'est la leçon de la 3.80, où la lier au filtre
l'avait vidée puis grisée.

**Ce qu'une sélection apprend.** Le pool mondial ne descend pas très bas dans
une petite langue : sur « Grand Theft Auto V » il connaît l'anglais, le
français et l'allemand, et rien du tchèque. Le menu n'affichait donc aucun
chiffre en face du drapeau tchèque — et le choisir révélait **deux** chaînes.
Nous les avions ; nous ne les gardions pas.

Une passe de portée menée en langue mesure exactement ce couple : « le tchèque
sur GTA V pèse tant ». C'est gardé, borné à trois cents couples et périmé au
bout de dix minutes — une audience d'il y a un quart d'heure ne décrit plus
rien. Le menu s'enrichit donc de ce qu'on a réellement demandé, sans une
requête de plus.

**Et zéro ne s'écrit toujours pas**, des deux côtés : une catégorie ou une
langue que le pool n'a pas croisée n'est pas vide, elle est *inconnue*.

## Deux menus qu'il ne fallait pas lier (v3.82)

La 3.80 avait fait dépendre la liste des **catégories** de la langue choisie,
pour que ses compteurs suivent la langue. La source de cette liste — une
requête à Twitch qui s'est révélée inexistante, voir ci-dessous — rendait des
listes **vides**. Le menu catégorie se vidait donc avec elle et se grisait :

> choisir une langue rendait la catégorie inchoisissable, et choisir la
> catégorie d'abord la voyait se griser dès qu'on ajoutait une langue.

Les deux filtres doivent se poser dans **n'importe quel ordre**. La liste des
catégories est donc de nouveau, et définitivement, celle du monde. Ce qui
dépend de l'autre filtre est le **chiffre** du menu langue, et dans ce sens-là
seulement — un chiffre ne peut pas griser un menu.

## `games(options: {…})` : deux noms, deux refus, et la conclusion (v3.82)

L'idée était de demander à Twitch les catégories d'une langue pour en tirer
d'un coup l'audience de la langue et les compteurs du menu catégorie. Deux noms
d'argument ont été essayés, et les deux rapports sont sans appel :

| nom essayé | réponse de Twitch | ce qu'elle apprend |
| --- | --- | --- |
| `freeformTags` | `In field "freeformTags": Unknown field.` | le type d'entrée de `games` n'a pas ce champ |
| `tags` | accepté, **31 listes vides** | le champ existe, mais n'attend pas un nom de langue |

Que `streams` accepte `freeformTags` ne prouvait rien : deux connexions du même
schéma ne partagent pas leurs options. Et `tags` attend selon toute
vraisemblance des **identifiants** de tag, que nous n'avons pas et qu'il
faudrait aller chercher par une troisième requête, elle aussi devinée.

**On s'arrête là, et pas par lassitude : la donnée était déjà dans la maison.**
La marche mondiale récolte ~1 700 streams portant chacun son nombre de
spectateurs **et** ses tags de langue — la même réponse les apporte. Les sommer
donne exactement « le nombre total de spectateurs francophones », mesuré et
sans une requête de plus. Les trente et une opérations par TTL disparaissent
avec la voie qu'elles servaient.

Ce que cette somme n'est pas : le total de Twitch. C'est celui du **haut du
classement**, là où se trouve l'immense majorité de l'audience. La nuance est
dite ici plutôt que masquée par un chiffre qui aurait l'air officiel.

## Des spectateurs, et non des chaînes (v3.82)

Le menu langue comptait des **chaînes** : « 212 » voulait dire « 212 chaînes
francophones dans ce qu'on a récolté ». À côté, le menu catégorie affiche une
**audience**. Deux unités voisines, dont une seule répond à la question qu'on se
pose en ouvrant le menu.

Il compte désormais des spectateurs, et **la catégorie choisie porte le
compte** : « combien de spectateurs francophones sur cette catégorie ». Sans
catégorie, c'est le monde entier.

Deux précautions, et le banc tient les deux :

- **les options viennent du monde, les compteurs de la catégorie.** Les
  confondre coûte le filtre : une catégorie dont les trente plus grosses
  chaînes sont anglaises cesserait de *proposer* le français, alors que la
  requête en langue, elle, en trouve. Écrit d'abord dans l'autre sens, et pris
  par le banc dans la minute ;
- **zéro ne s'écrit pas.** Une langue que le pool n'a pas croisée dans cette
  catégorie n'y a pas forcément personne : notre échantillon s'arrête au
  sommet. Écrire « 0 » découragerait un choix qui, lui, part interroger l'API
  et peut très bien trouver du monde. Rien du tout se lit « on ne sait pas », et
  c'est la vérité.

## `freeformTags` sur `games` : le mot qui n'existe pas (v3.81)

La 3.80 demandait les catégories d'une langue avec
`games(options: { sort: VIEWER_COUNT, freeformTags: [langue] })`, par analogie
avec `streams` où ce filtre fonctionne. Twitch a répondu, trente et une fois :

```
Argument "options" has invalid value {sort: VIEWER_COUNT, freeformTags: [$tag]}.
In field "freeformTags": Unknown field.
```

**Et cette erreur ne dit pas la même chose que celle du plafond `first`.** Là,
la valeur d'un argument *reconnu* était hors bornes — donc le nom était bon.
Ici l'erreur porte sur le **nom** : le type d'entrée de `games` n'a pas ce
champ. Deux connexions du même schéma ne partagent pas leurs options, et
l'analogie était une supposition, pas un raisonnement. Le repli a fait son
travail — aucune erreur visible, les chiffres du globe conservés — mais la
fonctionnalité n'a jamais servi, et c'est exactement ce qu'un utilisateur a
signalé : *« les chiffres restent les mêmes entre le français et le globe »*.

**Ce qui change n'est pas seulement le nom.** Le coût d'une erreur, surtout :

| | 3.80 | 3.81 |
| --- | --- | --- |
| coût d'un nom faux | **31 opérations** | **1** |
| candidats essayables par session | 1 | autant qu'il y en a |
| le rapport dit quel nom a été essayé | non | `langues.argument` |

Une **sonde** part d'abord sur une seule langue — l'anglais, parce qu'il a
forcément des catégories, ce qui rend une réponse *vide* informative plutôt
qu'ambiguë. Elle seule décide si les trente autres valent la peine. Un candidat
réfuté fait avancer la liste d'un cran ; la liste épuisée, la voie se ferme
pour la session.

`freeformTags` est **retiré** des candidats : il est réfuté, le réessayer
brûlerait une sonde pour rien.

## La carte sans catégorie (v3.81)

Toutes les chaînes n'annoncent pas de catégorie. La rangée garde alors la
hauteur que lui donne sa colonne de droite — spectateurs au-dessus, durée en
dessous — pendant que la gauche n'a plus qu'une ligne, calée en haut. Le pseudo
flotte au-dessus d'un vide.

Le marqueur est posé **là où on sait** : sur la réponse de `TseChannels`, qui
fait autorité, et non sur la lecture du DOM — Twitch peut n'avoir pas encore
écrit la catégorie, et centrer sur cette lecture-là ferait clignoter la carte à
chaque relevé. Deux déclarations CSS, et il faut les deux : `align-self:
stretch` donne à la metadata la hauteur de sa rangée (sans quoi il n'y aurait
rien à centrer), la colonne flex centrée y place la ligne. Ni l'une ni l'autre
ne dépend d'une classe hashée de Twitch, et si la rangée cessait d'être une
flexbox elles deviendraient inertes plutôt que fausses.

## « Aucune chaîne en direct avec ce filtre » (v3.81)

Une catégorie croisée avec une langue peut n'avoir aucun direct. Sans un mot,
la barre latérale vide sous des menus qui ont l'air de fonctionner se lit comme
une panne, et l'on rejoue son filtre en se demandant ce qui ne marche pas.

**Le piège est le moment.** Le classement est vide pendant la fraction de
seconde qui suit chaque changement de filtre, le temps que la passe arrive : un
message posé sur « la liste est vide » clignoterait à chaque clic avant de se
démentir. Il n'apparaît donc que sur une sélection **résolue** — le classement
porté est bien celui qui est demandé.

**Et une panne n'est pas un résultat.** « Aucune chaîne ne correspond » et « je
n'ai rien pu charger » donnent la même barre vide, et la première phrase serait
un mensonge sur la seconde. Il faut donc, en plus, qu'une marche ait **abouti**
au moins une fois — sans quoi une coupure réseau se serait annoncée comme un
résultat. Le banc tient les deux : retirer cette garde fait apparaître le
message sur un réseau en panne, et l'assertion le dit dans ces termes.

## Le compteur qui comptait au mauvais moment (v3.81)

`affichees` et `muettes`, introduits en 3.80, comptaient à l'**ouverture** de
l'aperçu. Or les chapitres du VOD arrivent après : au premier rendu la frise se
tait souvent, puis paraît. Un rapport a donné `muettes 102` sur 129 survols
quand les issues de chapitres en annonçaient **64** affichables — trente-sept
frises comptées muettes qui s'affichaient une fraction de seconde plus tard.

Le compte suit désormais la **présence**, corrigée au moment où elle change. Il
est donc juste à tout instant, sans qu'il faille attendre la fermeture de
l'aperçu pour trancher.

## Trente et une langues, et le thaï qui n'existait pas (v3.80)

Le filtre langue en proposait vingt-six. Twitch en publie **trente et une**, et
la liste est vérifiable : `/directory/all/tags/Català`, `…/Български`,
`…/Slovenčina`, `…/Tagalog`, `…/بهاسملايو`. Ces cinq-là n'étaient ni
proposables **ni même détectables** — `LANG_SET` se dérive de la même table, si
bien qu'un tag `Català` posé sur un stream ne se voyait pas.

**Et une sixième langue était là sans y être.** La table écrivait `ไทย` ;
Twitch nomme son tag `ภาษาไทย` — littéralement « langue thaïe ». La
correspondance étant **exacte**, le thaï figurait dans le menu, avait son
drapeau, avait son code d'API… et n'avait jamais rien détecté. Aucune erreur,
aucun compteur, rien dans un rapport : une langue morte-née dont seule une
comparaison avec la liste de Twitch pouvait révéler l'absence.

C'est ce que le banc fait désormais (scénario 83) : il confronte la table aux
trente et un noms de tags, exige que chaque langue ait un drapeau **et** un
code, et refuse qu'un drapeau dorme sans langue. Remettre `ไทย` fait tomber
quatre assertions.

## L'audience par langue, et la garde qui décide de l'afficher (v3.80)

Les deux menus déroulants ne parlaient pas la même langue. Le filtre catégorie
affichait l'audience que **Twitch** publie — « 122 k | VALORANT ». Le filtre
langue affichait un décompte de **notre pool** — « 212 », le nombre de chaînes
de cette langue parmi les ~1 900 qu'on avait récoltées. Un nombre vrai, qui ne
parle que de nous, à côté d'un nombre qui parle de Twitch.

On demande donc à Twitch la même chose pour les langues que pour les
catégories : `games(options: { sort: VIEWER_COUNT, freeformTags: [langue] })`.
Une réponse, deux renseignements :

| | |
| --- | --- |
| la **somme** des audiences | ce que pèse cette langue, à côté de son drapeau |
| la **liste** des catégories | les compteurs du filtre catégorie quand cette langue est choisie |

Le globe garde les totaux mondiaux ; choisir une langue rebat les deux menus.
Une opération par langue, loties en une poignée de requêtes, **une fois toutes
les cinq minutes** et seulement en mode Top Chaînes — lancées sans attendre,
pour qu'un menu ne retarde jamais le classement.

**Ce qui n'était pas acquis, et qui se vérifie à l'exécution.** Que Twitch
accepte `freeformTags` sur `games` ne dit pas que les **compteurs** soient
portés par la langue : le filtre pourrait ne choisir que les catégories
rendues, en laissant à chacune son audience mondiale. On afficherait alors
« Català : 2,1 M ». Impossible de le vérifier depuis une machine sans accès à
twitch.tv — mais possible de le faire vérifier **par le code** :

> La somme des audiences par langue vaut à peu près l'audience mondiale si les
> compteurs sont portés, et **trente et une fois** l'audience mondiale sinon.

Le verdict se joue donc entre 1 et 31, et le seuil est posé à 2 — au large des
deux, là où aucune dérive de mesure ne peut le franchir. Tant que la garde n'a
pas tranché, ou si elle tranche contre, **rien n'est affiché** : le menu garde
le décompte de pool d'hier. Le rapport porte le verdict et la mesure qui l'a
produit (`langues.portee`, `langues.facteur`), sans quoi un refus serait un
verdict sans motif.

Le banc reproduit le piège : desserrer le seuil fait apparaître
`Català`, `Deutsch`, `English` et `Français` tous à **585 k** — l'audience du
monde entier, quatre fois. C'est exactement ce que la garde existe pour ne pas
montrer.

## Ce que la frise dit encore, et ce qu'elle tait (v3.80)

La 3.79 a rendu le registre des frises sain (`evincees 0`, `peuplees 123` sur
125 survols) — et de rares frises restaient invisibles. Les deux étaient vrais
en même temps : la frise **existait** et **se taisait**, faute d'avoir quelque
chose à dire. Un live commencé avant nous, une seule catégorie observée, aucun
enregistrement à interroger : la règle est de se taire plutôt que d'inventer.

Les compteurs de survol décrivaient l'état du registre ; ils ne disaient pas si
la frise avait été **montrée**. `affichees` et `muettes` mesurent exactement cet
écart, au moment où le verdict se prend — c'est-à-dire après que les chapitres
du VOD ont eu le temps d'arriver. Ils ne s'additionnent pas avec les trois
autres, et le rapport le dit : confondre l'état d'une donnée avec ce qu'on en a
fait est la façon la plus sûre de rendre un compteur inutile.

## La frise qui s'effaçait (v3.79)

Un rapport disait « y'a pas tous les *Précédemment* qui fonctionne », avec des
compteurs de chapitres irréprochables : **55 demandes, 0 erreur, 0 échec
réseau**, et une somme d'issues exacte. Ils n'avaient rien à se reprocher — ils
ne comptent que les requêtes **parties**. La panne était en amont, là où aucun
compteur ne regardait.

Le registre des frises était borné à **quarante** entrées. Le raisonnement
d'origine tenait en une phrase, et c'est cette phrase qui était fausse : « on
n'en affiche qu'une à la fois, celle de la chaîne survolée ». Elle confondait ce
qu'on **affiche** avec ce qu'on **alimente**. `suivreCategorie` reçoit chaque
login de chaque lot — c'est-à-dire tout le cache de streams. Le même rapport
disait `cache 210` et `cartes 128`, deux pages plus haut.

Ce que ça donnait, toutes les trente secondes :

| | |
| --- | --- |
| logins relevés par cycle | ~210 |
| places dans le registre | 40 |
| frises détruites puis recréées à chaque cycle | ~170 |

Et l'éviction visait **la plus riche**. `Map` itère dans l'ordre de *première*
insertion, et `set` sur une clé existante ne la déplace pas : purger par la tête
sortait la frise qui accumulait depuis le plus longtemps — précisément celle qui
avait un passé à raconter. Une chaîne apparue dix secondes plus tôt survivait à
celle qu'on suivait depuis une heure.

Pour l'utilisateur : survoler une carte n'avait qu'**une chance sur cinq** de
trouver une frise. Et sans frise, il n'y a ni affichage **ni requête de
chapitres** — d'où des compteurs sereins sur une fonctionnalité muette.

**Ce qui change.** La borne couvre désormais la population qui l'alimente
(`LIVE_CACHE_MAX`), et le banc lit les deux constantes à la source pour refuser
qu'on les désaccorde. La purge par le volume devient un dernier recours — une
chaîne qui s'éteint voit déjà sa frise retirée nommément — et elle sort
maintenant la moins récemment **observée**, non la première **insérée**.

**Et le rapport peut voir cette panne, désormais.** C'est la partie qui mérite
d'être lue, parce que les compteurs évidents n'auraient pas suffi :

```
── FRISE DES CATÉGORIES / CATEGORY TRAIL ─────────────────────
  resident               201
  max                    500
  survols                2
  absentes               0
  vides                  0
  peuplees               2
  evincees               0
```

Sous la borne fautive, `absentes` reste à **zéro** et `peuplees` vaut deux : la
frise était bien présente au survol — recréée vide au relevé d'avant. Un survol
sur une frise amnésique ressemble en tout point à un survol sain. Seuls
`resident` contre `max`, et surtout `evincees`, distinguent un registre sain
d'un registre qui tourne sur lui-même. Le banc le vérifie dans les deux sens :
ramener la borne à quarante fait tomber quatre assertions, dont celle qui exige
`evincees === 0`.

## Le classement par tag de langue (v3.77, confirmé en v3.78)

Idée venue d'un utilisateur, et elle vise juste. Twitch publie
`/directory/all/tags/Français` : un classement mondial, trié par spectateurs,
filtré sur le **tag** de langue. L'extension filtrait jusqu'ici sur
`broadcasterLanguages`, et les deux ne mesurent pas la même chose :

| | Ce que ça sélectionne |
| --- | --- |
| `broadcasterLanguages: [FR]` | la langue **déclarée dans les réglages** de la chaîne |
| tag `Français` | la langue **posée sur ce stream-là**, ce jour-là |

Un francophone qui fait une soirée en anglais garde `FR` dans ses réglages et
met le tag `English`. **Le tag suit le contenu, la déclaration suit le compte** —
et pour un classement, c'est le contenu qui compte. C'est d'ailleurs le tag que
Twitch emploie pour sa propre page.

**Et c'est une requête, pas trente.** La descente visite les catégories une à
une en appliquant le filtre de langue à chacune, puis prouve sa complétude par
un plancher de fenêtre. La voie du tag demande directement le classement
mondial trié — le tri est fait par le **serveur**, exactement comme pour la
page. Une page ne peut pas afficher un classement qu'elle n'a pas demandé : il
n'y a rien dans `/directory/all/tags/Français` qui ne soit dans la réponse
GraphQL qui la remplit. Et la complétude n'est plus à démontrer par un plancher
de fenêtre : les trente premiers d'une liste **déjà triée par le serveur** sont
les trente affichés, par construction.

**Pourquoi pas une iframe sur la page, comme pour les abonnements.** Le relevé
d'abonnements charge `/subscriptions` dans une iframe parce que cette page
**exige d'être connecté** — GraphQL anonyme ne peut pas voir vos abonnements,
jamais. Ce n'est pas un choix de simplicité, c'est une contrainte absolue. La
page des tags, elle, est publique : la contrainte n'existe pas, et passer par
elle reviendrait à payer le rendu complet d'une page Twitch — React, images,
aperçus vidéo — pour lire ce qu'un POST rend en JSON.

**Cette requête n'avait jamais été exécutée contre le vrai Twitch** quand elle a
été écrite : le nom de l'argument de filtre était une reconstitution. Le
dispositif habituel a donc été monté autour — requête **isolée**, échec qui
retombe **en silence** sur la descente d'aujourd'hui, et compteurs par issue
dans le rapport (`tags.demandes`, `.servis`, `.vides`, `.refus`, `.reseau`). Un
refus du schéma est mémorisé pour la session : un nom d'argument ne devient pas
valide en cours de route.

**Et le premier rapport a tranché** — c'est tout l'intérêt du dispositif :

```
tags.demandes 1 · tags.servis 0 · tags.refus 1 · tags.refuse true
ERREURS (1)
  gql  réponse 200 avec erreurs GraphQL — argument 'first' value must be between 1 and 30.
```

Ce message vaut **deux** renseignements, et le second est le plus important.
D'abord la borne : `streams(first:)` est plafonné à trente. Ensuite, et
surtout : l'erreur porte sur la **valeur** d'un argument, pas sur son **nom**.
La requête a donc été validée par le schéma — noms de champs et d'arguments
compris, `freeformTags` inclus. Un argument inconnu aurait produit une erreur de
schéma, pas une erreur de plage. **La voie du tag n'était pas refusée : elle
demandait trop.** `GLOBAL_TAG_MAX` est passé de 100 à 30, et le harnais
applique désormais la même borne (scénario 81) pour que la limite ne se
redécouvre pas en production.

Le plafond de Twitch et la profondeur du classement affiché sont maintenant
**liés** : la voie du tag n'annonce un classement complet que si une seule
réponse suffit à le couvrir. Au-delà, elle se retire et laisse la descente
reprendre la main, plutôt que de compléter les rangs manquants avec le report
de la passe précédente — du vieux présenté comme exact. Le banc lit les deux
constantes à la source et refuse qu'on les désaccorde.

**Ce qu'elle ne fait pas encore** : servir les langues que `LANG_API` ne connaît
pas. `wantedLang()` les écarte en amont faute de code d'énumération, alors que
le tag n'en a pas besoin. La requête étant désormais confirmée, ce gain est à
portée — il n'attendait que ça.

## API console

L'objet `tse` reste exposé dans la console DevTools de la page Twitch (onglet
**Console**, `F12`) : le panneau ne le remplace pas, il en est un client de plus.
Tout ce qu'il affiche est atteignable à la main, et `tse.panneau(section)` rend
exactement ce qu'il consomme.

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
- `tse.subs()` — liste les abonnements repérés, avec la date de l'observation.
- `tse.subs.refresh()` — force un relevé complet de `/subscriptions` sans
  attendre les six heures, et renvoie les chaînes trouvées. La colonne `abonné` vaut aussi `false` : c'est ce
  qui permet à une visite de corriger une entrée devenue fausse.
- `tse.cycles()` — journal des **voiles de chargement** : à quel instant chacun
  est monté, pour quelle raison (« démarrage », « remount de la sidebar »,
  « bascule réduit/étendu », « retour d'onglet », « entrée dans Top Chaînes »,
  « changement de catégorie »…) et ce qui l'a fait retomber (stabilité ou délai
  maximal). Sert à diagnostiquer une sidebar qui semble s'initialiser deux fois.
- `tse.global.*` — surface d'inspection du mode **Top Chaînes** :
  `await tse.global.on()` allume le mode et attend la marche complète,
  `tse.global.top(30)` affiche le classement calculé, `tse.global.cats(25)` les
  catégories classées, `tse.global.report()` l'état interne (seuil T, plancher
  de fenêtre, complétude, coût, cadence, absences tolérées) et
  `tse.global.off()` coupe et purge.

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
| `tse:subs` | abonnements repérés (visite + relevé de `/subscriptions`), leur ancienneté en mois et le passé d'abonné | tri « Mes abonnements en tête », style de carte, badge d'aperçu |
| `tse:substs` | date du dernier relevé complet, précédée du numéro du lecteur qui l'a produit | espacer les relevés de 6 h, et périmer d'office ceux d'une version antérieure |
| `tse:submois` | libellé de l'ancienneté, appris sur la page | lire le nombre de mois sans dépendre de la langue |

`tse.reset()` les efface toutes à tout moment ; vider les données de site de
`twitch.tv` depuis les réglages du navigateur fait de même.

Le mode **Top Chaînes** n'ajoute rien à cette liste : il ne mémorise rien, ne
persiste pas même le mode choisi, et ses requêtes empruntent exactement le même
chemin anonyme que le reste de l'extension — `credentials: 'omit'`, Client-ID
public, aucun jeton de session, aucune permission supplémentaire.

**Une exception, et une seule.** Depuis la 3.44, le relevé des abonnements
charge `https://www.twitch.tv/subscriptions` dans une iframe cachée, toutes les
six heures. Cette page-là est **authentifiée** — c'est une page de votre
compte. La nuance compte : l'extension ne lit ni ne transmet votre jeton, elle
demande une page et le navigateur l'authentifie avec ses cookies, comme pour
n'importe quel lien que vous cliqueriez. Rien n'est envoyé à un tiers, et le
résultat ne quitte pas `localStorage`. Désactivable par `SUBS_PAGE_ENABLED:
false`.

Depuis la 3.45, ce chargement a lieu **pendant** celui de la sidebar, et
seulement si la barre contient au moins une chaîne suivie — autrement dit,
jamais sur une session déconnectée.

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
├── package.json           outillage de vérification UNIQUEMENT (cf. plus bas)
├── eslint.config.mjs      règles de lint
├── promo.mjs              captures 1280×800 pour le Chrome Web Store
├── promo-run.mjs          les scènes et leurs textes, dans les douze langues
├── promo-marquee.mjs      bannière 1400×560 en tête de fiche
├── promo-tile.mjs         tuiles promotionnelles 440×280 (variantes A–D)
├── promo-tile-produit.mjs tuile 440×280 montrant l’extension en fonctionnement
├── promo-polices.mjs      taille les sous-ensembles CJK des captures
├── promo-fonts/           Inter et Noto embarquées dans les images (OFL 1.1)
├── store/                 le texte des douze fiches du Chrome Web Store
├── tests/
│   ├── run.mjs              le harnais Playwright (compté plus bas)
│   ├── page.html            faux Twitch (DOM réel + stub réseau GraphQL)
│   ├── build.mjs            copie content.js avec les durées accélérées
│   ├── degraisser.mjs       retire les commentaires du code livré (acorn)
│   ├── addon.mjs            assemble le paquet et le soumet à l'addons-linter
│   ├── prod.mjs             publie une branche dont l'arbre EST le paquet
│   ├── store.mjs            squelette des douze fiches + couverture des images
│   └── parity.mjs           parité des clés de traduction entre les 10 langues
├── README.md              ce fichier
└── README.en.md           version anglaise
```

**Ce qui est livré au navigateur**, c'est `manifest.json`, `content.js`,
`adblock.js`, `_locales/` et `icons/` — rien d'autre. L'extension n'a aucune
dépendance : `package.json` et `tests/` ne servent qu'à la vérifier, et ne sont
jamais empaquetés.

---

## Vérification

```bash
npm install                        # eslint + playwright + web-ext
npx playwright install chromium    # une fois
npm run check                      # lint + parité + paquet + harnais
npm run package                    # le .zip à soumettre
```

Quatre vérifications, indépendantes :

| Commande | Ce qu'elle contrôle |
|---|---|
| `npm run lint` | `content.js` et `adblock.js` — no-undef, `require-atomic-updates`, etc. |
| `npm run parity` | les cinq blocs de traduction portent exactement les mêmes clés |
| `npm run addon` | le paquet : assemblé depuis une liste blanche, complet, et rien de plus |
| `npm test` | le harnais Playwright : 139 scénarios, 1230 assertions |
| `npm run test-firefox` | les mêmes, sous Gecko (`TSE_MOTEUR=firefox`) |

Ces deux nombres-là ne sont pas décoratifs : `run.mjs` les confronte à ce qu'il
vient de compter, et échoue si le tableau ment. Un banc dont on annonce la
taille de mémoire finit toujours par l'annoncer fausse — cette ligne disait
544 quand il y en avait 579, et l'arborescence ci-dessus en annonçait 561 à
deux pages d'écart. Le compte des scénarios était faux lui aussi, pour une
raison qu'aucune relecture n'attrape : la numérotation **saute le 52**, si
bien qu'on lisait la plus haute étiquette au lieu de compter les blocs.

### Le paquet part sans ses commentaires (v3.59)

Ce dépôt commente beaucoup, et c'est voulu : la moitié de ce qu'on sait de ce
produit est écrite dans ses marges. Mais cette moitié-là vit **ici**, dans un
dépôt public — elle n'a pas à voyager dans chaque installation ni à traverser
la file de revue. `npm run addon` retire donc les commentaires du code
assemblé :

| Fichier | Avant | Après | Commentaires |
| --- | --- | --- | --- |
| `content.js` | 1093 Ko | 409 Ko | 3 371 → **2** |
| `adblock.js` | 124 Ko | 100 Ko | 290 → **2** |
| `panneau.js` | 98 Ko | 47 Ko | 133 → **0** |
| `bridge.js` | 15 Ko | 3 Ko | 25 → **0** |
| `background.js` | 9 Ko | 2 Ko | 21 → **0** |
| **les cinq** | **1340 Ko** | **562 Ko** | **−57 %** |

Ces chiffres sont **confrontés à la mesure** à chaque assemblage, ici comme
dans `README.en.md` et `store/README.md`. Ils ne se calculent pas, ils se
recopient — et un nombre recopié se périme sans bruit : la fiche du Store a
annoncé un paquet de 391 Ko pendant deux versions, c'est-à-dire le gain du
JavaScript **seul**, alors que le CSS était dégraissé lui aussi. `npm run
addon` relit donc les trois documents et compare ce qu'ils annoncent à ce
qu'il vient de peser, à 3 % près : assez large pour la croissance ordinaire
d'une version, trop étroit pour une phrase qui décrit le produit d'avant.

**Le retrait ne concerne QUE le paquet.** Il porte sur la copie assemblée dans
`dist/paquet/`, jamais sur les fichiers du dépôt : `content.js` garde TOUS ses
commentaires sur les branches de développement, et `npm run addon` relit les
sources après l'assemblage pour le constater — une ligne d'écriture qui
viserait la racine au lieu du paquet ferait échouer le contrôle. Les branches
`claude/firefox-prod` et `claude/chrome-prod`, elles, sont l'artefact : elles
n'existent que pour être téléchargées et soumises.

Ce que le paquet ne devient **pas** : minifié, ni obscurci. Les noms, les
retours à la ligne et l'indentation sont ceux du dépôt, ligne pour ligne — la
promesse « code source entièrement lisible » des douze fiches reste vraie au
mot près.

**Les mentions légales restent**, et ce n'est pas une politesse : `adblock.js`
est du code tiers sous licence MIT, laquelle exige que sa notice accompagne
« toute copie ou portion substantielle du logiciel » ; les drapeaux et le globe
de `content.js` viennent d'OpenMoji, sous CC BY-SA 4.0, qui exige
l'attribution. Les retirer aurait été une infraction, pas un gain de place.
Tout commentaire portant `Copyright`, `Licence` ou `License` est donc conservé
tel quel — ce sont exactement les quatre qui restent.

#### Deux garde-fous, et ils ne prouvent pas la même chose

Un découpage naïf casserait le fichier en silence, et il n'y a pas de silence
plus complet qu'une extension qui ne démarre plus chez l'utilisateur. La
séquence `//` apparaît dans chaque URL du fichier ; un début de bloc peut vivre
dans une chaîne. Le découpage est donc fait par **acorn**, jamais par une
expression régulière.

1. **Le flux de jetons**, vérifié à chaque assemblage : les deux textes doivent
   rendre les mêmes jetons, mêmes valeurs, même ordre. Rien d'autre qu'un
   commentaire ne peut alors être parti.
2. **L'exécution**, parce que le premier ne suffit pas. L'insertion automatique
   de points-virgules ne se voit **pas** dans un flux de jetons : `return`
   suivi d'un bloc multiligne puis de `5` rend `undefined`, et les mêmes jetons
   sans le saut de ligne rendent `5`. Un commentaire de bloc contenant un saut
   de ligne est donc remplacé par un saut de ligne, et le scénario 66 fait
   tourner six extraits-pièges avant et après pour le vérifier.

#### Le CSS n'est pas du JavaScript

La feuille de style vit dans un littéral de gabarit — `const CSS = \`…\`` — et
pour acorn c'est une **chaîne**. Ses 77 commentaires ne sont donc pas des
commentaires JavaScript, et la première passe ne les voit pas. Une seconde
passe les retire, et elle a ses propres pièges :

- une séquence `/*` dans une chaîne CSS (`content: "/*"`) n'ouvre rien ;
- un commentaire **collé à un jeton des deux côtés** ne peut pas être retiré
  sans changer la règle : `foo/*x*/bar` vaut deux identifiants et deviendrait
  `foobar`, un seul ; le remplacer par une espace ne sauve rien non plus, car
  dans un sélecteur `.a/*x*/.b` vaut `.a.b` et l'espace en ferait `.a .b`.
  Aucun des deux remplacements n'est juste partout, donc on ne retire que les
  commentaires dont **au moins un côté est déjà une espace** — les 77 le sont ;
- un commentaire qui déborderait sur une interpolation `${…}` est laissé
  intact, faute de pouvoir décider.

La passe est **ciblée par le nom de la variable**. Balayer tous les littéraux
de gabarit abîmerait le jour où l'un d'eux porterait du SVG ou du HTML
contenant `/*` — là ce n'est pas un commentaire, et le retirer changerait ce
qui s'affiche. Un seul littéral du fichier contient cette séquence aujourd'hui,
et c'est bien le CSS.

**La preuve, elle, ne se fait pas dans Node** : c'est le navigateur qui lit ce
CSS, donc c'est lui qu'on interroge. Le banc prend la feuille que l'extension a
réellement injectée — interpolations résolues comprises —, la dégraisse, fait
parser les deux par Chromium et compare son modèle objet : **139 règles, même
ordre, mêmes déclarations**.

Cette comparaison a d'abord échoué, et l'échec valait la peine : Chromium
**normalise** ce qu'il ressert — `#fff` devient `rgb(255, 255, 255)`, les
raccourcis sont éclatés — **sauf les valeurs contenant un `var()`**, qu'il rend
telles qu'on les a écrites, commentaire au milieu compris. Une règle du fichier
en porte un dans son `background`. Les règles sont donc comparées après retrait
des commentaires des deux côtés — ce qui ne coûte rien, puisque le seul cas
vraiment dangereux (un commentaire retiré entre deux jetons d'une valeur) tombe
précisément là où Chromium normalise, donc reste visible.

Enfin, `npm run prod` — qui publie les branches PROD READY — rejoue le **banc
complet sur le fichier tel qu'il part**, sans commentaires. Une publication est
rare ; les cinq minutes que ça coûte sont le meilleur marché du dépôt.
`npm run test-livre` fait la même chose à la demande.

#### Ce que ça change à la soumission

Le fichier envoyé n'est plus, octet pour octet, celui du dépôt : c'est un
fichier **produit** par une étape de construction. AMO demande alors de
pouvoir remonter à la source, et c'est immédiat ici — le dépôt est public, la
branche de développement porte `content.js` commenté, et `tests/degraisser.mjs`
est la seule transformation appliquée. Rien n'est minifié ni obscurci, donc la
règle qui compte vraiment pour la revue (« code lisible ») n'est pas touchée.
Si le formulaire réclame une archive des sources, c'est la branche
`claude/firefox` — ou `claude/chrome` — qu'il faut lui donner.

### Le rendu ne construit plus de balisage (v3.56.0)

Le validateur d'add-ons de Mozilla — lancé sur la branche `claude/firefox`, qui
partage ce `content.js` — signalait douze écritures `innerHTML`,
`insertAdjacentHTML` et `outerHTML` dans le rendu. Elles sont à zéro.

Ce n'était pas une correction de sûreté : l'échappement était en place, et les
douze sites avaient été relus un par un. C'est une correction de **fragilité**.
La sûreté tenait à ce qu'aucun appel n'oublie `escapeHtml`, et aucune relecture
ne garantit ça pour l'avenir. Les valeurs venues de Twitch — noms de chaînes,
catégories, titres, marques — passent désormais par `textContent` ou
`setAttribute`, qui ne peuvent rien interpréter.

**`escapeHtml` a disparu du fichier faute d'appelant.** C'est la preuve la plus
courte que la conversion est complète : il n'y a plus d'échappement à oublier.

Le HTML est également sorti des cinq tables de locale. `uiBadgeCostreamOf`
rendait `Co-stream de <strong>${nom}</strong>` ; elle rend maintenant du texte
pur où la place du nom est marquée par un `\u0000`, et le rendu y insère un
`<strong>` construit en DOM. Vingt fonctions, cinq langues — **pas un mot des
libellés n'a changé**, seul le balisage en est sorti.

`noeudStatique` est la seule porte qui reste vers un analyseur HTML, réservée au
balisage écrit dans `content.js` : icônes SVG, drapeaux, ossatures. La règle est
écrite dans le code, à côté de la fonction.

Le scénario 62 vérifie la propriété sur les deux chemins par lesquels du texte
de Twitch atteint le DOM — le nom d'un invité squad et une catégorie — avec la
charge `<img src=x onerror="…">`. La mutation qui remet un `innerHTML` à l'un
des deux endroits ne se contente pas de faire échouer le test : elle **exécute**
le `onerror`. C'est ce que l'ancien rendu risquait à chaque oubli.


### Ce qui part dans le paquet

`npm run addon` assemble `dist/paquet/` à partir d'une **liste blanche** —
`manifest.json`, `content.js`, `adblock.js`, `icons/`, `_locales/` — puis
vérifie que tout ce que le manifeste nomme est présent, que rien ne vient
d'ailleurs, et que les sept locales ont chacune leur `messages.json`.
`npm run package` en fait le `.zip`.

La liste blanche n'est pas un détail d'ergonomie. Un `.zip` fabriqué à la main
depuis le dépôt emporte l'outillage — `promo*.mjs`, `tests/` et sa page à
scripts en ligne — soit un demi-mégaoctet de code qui ne s'exécute chez
personne, et que les validateurs de magasin analysent quand même. Le portage
Firefox l'a découvert à ses dépens : cinq avertissements sur sept, à la
première soumission, venaient de fichiers de test. Une liste noire aurait
recréé le défaut au premier fichier ajouté ; une liste blanche a le défaut
inverse, qui est le bon — ce qu'on oublie d'inclure manque, et le contrôle
le voit.

Le même fichier `tests/addon.mjs` sert sur la branche `claude/firefox`, où il
ajoute les contrôles propres à AMO et appelle l'`addons-linter` de Mozilla. Il
lit le manifeste qu'il trouve : deux copies auraient divergé, celle-ci ne le
peut pas.

**Le harnais fait tourner l'extension pour de vrai**, dans Chromium, contre un
faux Twitch : `tests/page.html` reproduit le DOM réel de la barre latérale
(relevé sur le site, y compris ses pièges — le titre de section vit *à
l'intérieur* du bouton de tri, la rangée des stories vit *à côté* de
`#side-nav`, la racine CSS est à 62,5 %) et sert un stub de `gql.twitch.tv`
piloté par des fixtures. Plusieurs scénarios vont plus loin et servent la page
sous `https://www.twitch.tv` par interception réseau : sans une origine réelle,
un `postMessage` vers l'iframe du lecteur n'a nulle part où arriver.

`tests/build.mjs` ne transforme qu'une chose : les constantes de temps
(`LIVE_TTL`, `GLOBAL_STRUCT_TICK`, `GLOBAL_FULL_WALK_MS`…), divisées d'un
facteur constant pour que plusieurs cycles tiennent dans un test. Les
*rapports* entre elles sont conservés — c'est eux, et non les valeurs absolues,
qui décident du comportement. La logique éprouvée est celle du dépôt, ligne
pour ligne.

Le stub reproduit aussi les défauts mesurés de l'API, parce qu'un harnais trop
gentil laisse passer les bugs : `games` arrive classé mais `streams` ne l'est
pas, une chaîne peut manquer d'une réponse à l'autre (échantillonnage), et la
langue de diffusion d'un stream est indépendante des étiquettes qu'il affiche.

### Captures pour le Chrome Web Store

```bash
npm run promo           # → promo/*.png, 1280×800 exactement, cinq scènes × douze langues
npm run banniere        # → promo/00-banniere-*.png, 1400×560, douze langues
npm run tuile-produit   # → promo/tuile-E-produit.png, 440×280
npm run polices         # → promo-fonts/noto-sans-{jp,sc}-cjk.woff2 (cf. plus bas)
```

Les trois formats du Store, et la même contrainte pour les trois : **JPEG ou
PNG 24 bits, sans alpha**. Elle n'était honorée par aucun — une capture de
Playwright est un PNG RGBA, opaque mais avec un canal alpha quand même, et les
images sortaient donc en type 6. Le JPEG serait la réponse facile ; son
sous-échantillonnage de chrominance abîme précisément ce qui compte ici, les
bords colorés du texte doré et du violet. `promo.mjs` encode donc lui-même en
type 2 (truecolor), avec le choix de filtre par ligne que recommande la
spécification — et relit l'en-tête qu'il vient de produire avant de rendre le
fichier. `file` le confirme de l'extérieur : *PNG image data, 8-bit/color RGB*.

Même principe que le harnais, et pour la même raison : **l'extension tourne
pour de vrai** et on photographie ce qu'elle produit. Rien n'est redessiné. Le
rendu se fait en 2× puis est réduit à 1280×800 — la taille exacte qu'exige le
Chrome Web Store — par Chromium lui-même, ce qui donne un texte bien plus net
qu'un rendu direct.

Deux limites, à connaître avant de publier. L'habillage des cartes de Twitch
est une **reconstruction** : `tests/page.html` reproduit la structure du DOM,
pas l'apparence, et `promo.mjs` réécrit donc la mise en forme (avatar 30 px,
pseudo 13 px, point rouge). Tout ce que l'extension ajoute est authentique ;
le fond sur lequel elle l'ajoute est une approximation. Et les données sont des
fixtures : les chaînes sont **inventées** pour n'emprunter l'identité de
personne, les avatars sont générés, et la zone vidéo de l'aperçu est un dégradé
abstrait — une fausse image de jeu laisserait croire à un contenu qui n'existe
pas.

### La police, et pourquoi elle est dans le dépôt

Le conteneur n'a ni Inter, ni Helvetica, ni Arial : tout retombait sur DejaVu
Sans, une police qui n'est celle de personne. Le défaut se voyait deux fois —
sur le markup de Twitch, et sur l'extension elle-même, dont le CSS demande
`var(--font-base, "Inter", sans-serif)` et n'obtenait donc pas Inter non plus.

**Inter** est donc embarquée, dans `promo-fonts/` : quatre sous-ensembles
(latin, latin étendu, cyrillique et cyrillique étendu) en fichier **variable**,
soit un seul fichier par sous-ensemble pour toutes les graisses. Versionnée
plutôt que téléchargée à la demande — une capture ne doit pas dépendre d'un CDN
pour être reproductible — et injectée en base64 dans la feuille, avec la pile
exacte de Twitch posée là où Twitch la pose : `--font-base` sur la racine.
L'extension emprunte ainsi le **vrai** chemin, pas un repli qui n'existerait que
dans le harnais.

Le cyrillique n'est arrivé qu'avec la fiche russe, et il a fallu le chercher :
le contrôle de police mesurait une chaîne **latine**, servie par Inter comme il
se doit, et déclarait donc la police chargée pendant que le russe sortait en
DejaVu. Un garde-fou qui ne mesure qu'un cas ne prouve que ce cas-là.

Inter n'a en revanche **aucun idéogramme**, et ce n'est pas un manque : Twitch
non plus. Sa pile — `Inter, Roobert, "Helvetica Neue", Helvetica, Arial,
sans-serif` — n'a rien de CJK, et sur une vraie machine japonaise le navigateur
descend jusqu'à la police système. Les captures reproduisent ce comportement
avec **Noto Sans JP** et **Noto Sans SC** ajoutées en **dernier** recours, et
seulement pour la langue du document (`:root:lang(ja)`, `:root:lang(zh)`) —
sans quoi le chinois sortirait avec les formes japonaises. Une police japonaise
complète pèse plusieurs mégaoctets ; celles-ci sont **taillées** par
`npm run polices` aux caractères que ces images écrivent, relevés dans les
tables `ja` et `zh` de `content.js` et dans le discours des scènes, et font
moins de deux cents kilo-octets chacune.

Un sous-ensemble se périme : un idéogramme ajouté ailleurs et absent d'ici
sortirait en carré vide, sans que rien ne le dise. Avant chaque déclenchement,
`glyphesManquants()` dessine donc **chaque caractère effectivement écrit dans la
page** deux fois — avec la pile de la page, puis avec une famille qui n'existe
pas — et compare les pixels. Deux rendus identiques veulent dire que la pile n'a
rien apporté, et la capture s'arrête au lieu de sortir. La comparaison de
*largeurs* utilisée jusque-là ne pouvait pas faire ce travail : un idéogramme
fait exactement un cadratin dans toutes les polices, elle aurait déclaré absent
un glyphe présent.

Licence SIL Open Font 1.1 pour les trois familles, textes complets dans
`promo-fonts/OFL.txt` et `promo-fonts/OFL-noto.txt` ; provenance de chaque
fichier dans `promo-fonts/README.md`.

Les avatars, eux, ne portent plus l'initiale de la chaîne : sur une vraie barre
latérale ces trente pixels portent une photo, et une lettre disait « capture
d'essai ». Ce sont maintenant des compositions abstraites, déterministes par
pseudo — deux teintes, un foyer clair, un foyer sombre. À la taille où on les
voit elles se lisent comme des photos qu'on ne distingue pas, et personne n'y
est représenté.

Deux scènes — l'aperçu et celle des abonnements — ont besoin d'une mémoire
d'abonnements. Elle est **posée** dans le `localStorage` avant le démarrage du
script (`ABOS`, dans `promo.mjs`), et le relevé de `/subscriptions` est coupé
pour toutes les captures. La raison n'est pas la commodité : `tests/page.html`
sert cet onglet avec de **vrais** pseudos — c'est ce qu'il faut pour éprouver le
module, et c'est exactement ce qu'une image publiée ne doit pas porter.

Chaque scène vérifie d'ailleurs ce qu'elle photographie, et refuse de sortir une
image qui aurait perdu son sujet : trois cartes dorées et une pastille à douze
pour les abonnements — si le relevé passait outre, la pastille compterait treize
et plus, et la capture échouerait ; trois badges au moins dans l'aperçu ; une
pastille de subathon, un co-stream, un stream frais et cinq durées sur la scène
de la carte ; cinq lignes et huit segments dans la frise ; et, pour Top Chaînes,
deux pseudos qui n'existent que dans le classement mondial. Une capture jolie et
muette est le seul défaut que la mise en page ne peut pas signaler.

**Cinq scènes, et cinq exactement.** Le Store n'accepte que cinq images ; il en
sortait six, dont une restait au vestiaire. Les filtres et les tris, qui en
occupaient deux, n'ont plus d'image à eux : ils se devinent et ne distinguent
l'extension de rien. Ils sont restés en tant que **point**, une ligne dans la
cinquième image. À leur place, deux fonctions qui n'avaient pas d'image du tout
— la frise « Précédemment sur ce live » et les subathons. L'ordre des fichiers
EST le rang de publication ; il est justifié dans `store/README.md`.

Chaque image porte un chapô, un titre, **trois points** et une ligne de marque.
Les points ont remplacé le paragraphe des fiches précédentes, et c'est la seule
décision de cette refonte qui ait une raison mesurable : un paragraphe de trois
lignes à 29 px se lit à 1280 px de large, et ne se lit plus du tout dans la
vignette du Store, qui en fait 440. Trois amorces en gras s'attrapent à
n'importe quelle taille, et chacune porte sa preuve derrière un tiret. La
pastille qui les précède est **dessinée en CSS** et non écrite en caractère :
un « ▸ » n'est dans aucune des polices embarquées et sortirait de celle du
conteneur — ou en carré vide.

Deux plans de page, et ils ne sont pas un choix de goût. En **« cote »** —
images 2 à 5 — le produit tient dans 500 px à gauche et le discours dans 666 px
à droite ; la barre y passe à l'échelle 1,72, soit des rangées de 75 px contre
61 auparavant, ce qui est ce qui rend un pseudo lisible dans une vignette. En
**« empile »** — image 1 seulement — le titre passe à gauche, les points à
droite, et le produit s'étale dessous : cette image-là doit montrer la barre
**et** l'aperçu côte à côte, soit 766 px de produit, qui ne laisseraient que
430 px au texte.

Le titre y garde ses 72 px. Il a été mis à 62 par précaution, et c'était une
précaution inutile : ce qui repousse le produit vers le bas n'est pas le titre
mais la **colonne des points**, plus haute que lui dans les douze langues.
Grandir le titre jusqu'à elle ne coûte donc rien — et c'est l'image que la
vignette du Store montre à tout le monde.

Huit garde-fous mesurent chaque scène avant la capture, et se plaignent en
console plutôt que de laisser sortir une image bancale : le titre ne doit pas
être coupé, le produit et le discours doivent garder vingt-quatre pixels entre
eux (écart **déduit** du rendu, l'échelle du produit variant d'une scène à
l'autre), rien ne doit sortir du cadre, rien ne doit recouvrir la ligne de
marque, aucun point ne doit porter un mot plus long que sa colonne, Inter doit
être réellement chargée, le chapô doit tenir sur une seule ligne, et le titre
doit compter exactement les lignes qu'on lui a écrites.

Celui de la ligne de marque éprouve les **trois** blocs — le texte, les points
et le produit — et pas seulement celui qu'on soupçonnerait, parce que la marge
y est mince pour de vrai : en plan « cote » le cadre descend à 752 px quand la
ligne de marque commence à 742, et la plus longue des douze remonte jusqu'à
536 px, soit trois pixels du bord du cadre. Il a été éprouvé comme le reste du
dépôt, en le faisant échouer : une ligne de marque rallongée de quatre mots le
fait sortir, et sans elle il ne prouverait rien.

Les deux derniers gardent la même zone aveugle : **un retour à la ligne ne
déborde de rien**, donc aucune mesure de débordement ne peut le voir. C'est
ainsi qu'est passé « PRÉ-VISUALIZAÇÃO AO PASSAR », onze pixels de trop pour sa
pastille ; et c'est ainsi qu'a été rattrapé, dans treize scènes d'un coup, un
titre qui prenait un vers de plus que prévu depuis qu'Inter — dont la graisse
800 est réelle, là où le repli synthétisait son gras — a remplacé la police par
défaut. La taille des titres n'est donc pas choisie mais **mesurée** : 72 px est
le dernier cran où la plus longue ligne latine des douze langues tient dans les
666 px de la colonne. Le japonais et le chinois s'y lisent autrement — un
idéogramme fait un cadratin, donc 666 px en tiennent neuf, pas un de plus — et
c'est ce compte-là qui met le titre japonais du mode Top Chaînes sur trois vers :
le repli était écrit d'avance, autant l'écrire.

Ce compte a été trouvé dans la chaîne réelle, et il fallait bien ça : un banc de
mesure isolé, qui rendait pourtant la même chaîne dans la même police à la même
taille, annonçait deux crans de plus. Il se trompait de 5 % — assez pour faire
tomber un mot à la ligne suivante, pas assez pour se voir. Une largeur de texte
ne se modélise pas à côté de la page qui l'affiche ; elle s'y mesure.

Même leçon, un cran plus loin : la mise en page attend `document.fonts.ready`
avant de mesurer quoi que ce soit. Elle ne l'attendait pas, et la fiche
allemande l'a dit — ses trois points tiennent en trois lignes avec Inter et en
deux avec la police de repli, si bien que le produit était posé quatre pixels
**trop haut** et venait mordre dessus. Une police embarquée est immédiate ; elle
n'est pas déjà là.

### La tuile 440 × 280

Elle a d'abord porté deux panneaux en perspective — la barre à 0,78 et l'aperçu
à 0,52. C'était joli et illisible : les pseudos y tombaient à 10 px, sur une
image que le Store affiche plus petite encore. L'aperçu fait 480 px de large à
lui seul, soit plus que la tuile entière ; il n'existe aucune échelle à laquelle
il y soit lisible. Il a donc été retiré, et la place rendue à la barre.

L'agrandissement se paie en hauteur : le haut de la liste tombe à 152 px du
sommet de la barre et chaque carte en fait 43. À l'échelle 1, trois cartes
entrent et le pseudo fait 13 px ; à 1,22, deux cartes entrent et il en fait 16.
C'est ce second réglage qui est retenu, et le tri « abonnements en tête » est
activé pour que ces deux cartes-là soient justement celles qui portent l'or.
Le script mesure ce qu'il produit — cartes entières, cartes dorées, taille
**rendue** du pseudo — et échoue plutôt que de sortir une tuile illisible.

### La fiche elle-même

Le texte des douze fiches du Chrome Web Store vit dans **`store/`** — une par
locale publiée. Le tableau de bord n'a pas d'historique lisible : sans copie
versionnée ici, la seule trace d'une formulation serait la fiche en ligne. Voir
`store/README.md` pour la correspondance des locales, l'ordre conseillé des
captures (le Store n'en accepte que cinq, six sont produites), et les réponses
au formulaire « pratiques de confidentialité ».

`npm run store` tient ce que douze fiches de deux cents lignes rendent
impossible à relire, et il tient aussi leurs **images**. Douze fiches veulent
douze jeux d'images ; les cinq langues de la 3.57 ont eu leur texte avant, et
rien ne l'aurait dit — `promo/` est un dossier d'artefacts, ignoré par git, dont
personne ne compte les fichiers. Le contrôle compare donc les langues des trois
tables de discours (`promo-run.mjs`, `promo-marquee.mjs`, et `SECTION` dans
`promo.mjs`) à la liste des fiches, et vérifie que chaque libellé de section
existe bien dans `content.js`.

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
   dans son propre fichier, `adblock.js`, avec huit adaptations marquées —
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
