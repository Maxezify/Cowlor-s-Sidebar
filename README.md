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

**Mesuré le 21/08/2026** : les vingt-six codes sont acceptés par l'API. Une
requête, vingt-six opérations, une par langue — aucune erreur, et vingt-trois
ont ramené un stream d'exemple.

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
│   ├── run.mjs              le harnais : 561 assertions, 66 scénarios
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
| `npm test` | le harnais Playwright : 64 scénarios, 544 assertions |

### Le paquet part sans ses commentaires (v3.59)

Ce dépôt commente beaucoup, et c'est voulu : la moitié de ce qu'on sait de ce
produit est écrite dans ses marges. Mais cette moitié-là vit **ici**, dans un
dépôt public — elle n'a pas à voyager dans chaque installation ni à traverser
la file de revue. `npm run addon` retire donc les commentaires du code
assemblé :

| Fichier | Avant | Après | Commentaires |
| --- | --- | --- | --- |
| `content.js` | 563 Ko | 262 Ko | 2 721 JS + 77 CSS → **2** |
| `adblock.js` | 124 Ko | 100 Ko | 290 → **2** |
| **les deux** | **687 Ko** | **362 Ko** | **−47 %** |

**Le retrait ne concerne QUE le paquet.** Il porte sur la copie assemblée dans
`dist/paquet/`, jamais sur les fichiers du dépôt : `content.js` garde ses 2 721
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
npm run promo           # → promo/*.png, 1280×800 exactement, six scènes × douze langues
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
module, et c'est exactement ce qu'une image publiée ne doit pas porter. La scène
des abonnements vérifie d'ailleurs ce qu'elle photographie : quatre cartes
dorées, et une pastille à douze. Si le relevé passait outre, la pastille
compterait treize et plus, et la capture échouerait au lieu de sortir.

Six garde-fous mesurent chaque scène avant la capture, et se plaignent en
console plutôt que de laisser sortir une image bancale : le titre ne doit pas
être coupé, la colonne de texte ne doit pas s'approcher du cadre à moins de
vingt-quatre pixels (plancher **déduit** du cadre, dont l'échelle varie d'une
scène à l'autre), la fenêtre d'aperçu ne doit pas venir mordre sur le texte,
Inter doit être réellement chargée, le chapô doit tenir sur une seule ligne, et
le titre doit compter exactement les lignes qu'on lui a écrites.

Les deux derniers gardent la même zone aveugle : **un retour à la ligne ne
déborde de rien**, donc aucune mesure de débordement ne peut le voir. C'est
ainsi qu'est passé « PRÉ-VISUALIZAÇÃO AO PASSAR », onze pixels de trop pour sa
pastille ; et c'est ainsi qu'a été rattrapé, dans treize scènes d'un coup, un
titre qui prenait un vers de plus que prévu depuis qu'Inter — dont la graisse
800 est réelle, là où le repli synthétisait son gras — a remplacé la police par
défaut. La taille des titres n'est donc plus choisie mais **mesurée** : 72 px
est le dernier cran où « tells you everything. », la plus longue ligne latine
des douze langues, tient dans les 690 px de la colonne. Le japonais et le
chinois s'y lisent autrement — un idéogramme fait un cadratin, donc 690 px en
tiennent neuf, pas un de plus — et c'est ce compte-là qui a fait passer le titre
japonais du mode Top Chaînes à trois vers : le repli était écrit d'avance,
autant l'écrire. Dans la variante étroite le repli est de même voulu — aucune
taille lisible ne tient « avant de cliquer » d'un trait dans 378 px — et le
garde-fou y tolère un vers de plus, là seulement.

Ce 72 a été trouvé dans la chaîne réelle, et il fallait bien ça : un banc de
mesure isolé, qui rendait pourtant la même chaîne dans la même police à la même
taille, annonçait que 74 passait. Il se trompait de 5 % — assez pour faire
tomber un mot à la ligne suivante, pas assez pour se voir. Une largeur de texte
ne se modélise pas à côté de la page qui l'affiche ; elle s'y mesure.

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
