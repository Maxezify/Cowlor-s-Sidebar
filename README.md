# Cowlor's Sidebar for Twitch

Version 3.57.0 · Extension **Firefox** (Manifest V3) · 🇬🇧 [English version](README.en.md)

> **Branche Firefox.** Ce dépôt a deux lignes de publication. `claude/chrome`
> porte la version Chrome / Chromium ; cette branche porte la version Firefox.
> Le **seul** fichier du produit qui diffère entre les deux est `manifest.json`
> — `content.js` et `adblock.js` sont identiques octet pour octet, et un
> vérificateur le garantit (cf. « [Le portage Firefox](#le-portage-firefox-v3553) »).

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

L'extension est publiée sur **addons.mozilla.org** : ouvrez sa fiche
(recherchez « Cowlor's Sidebar for Twitch »), cliquez sur **Ajouter à
Firefox**, puis rechargez un onglet `https://www.twitch.tv/` — la sidebar est
enrichie automatiquement. Les mises à jour sont alors gérées par le navigateur.

### Installation manuelle (temporaire)

Vous pouvez aussi la charger à la main, à partir du dossier
`cowlors-sidebar-for-twitch` (ou du `.zip` décompressé) — utile pour tester une
version de développement :

1. Ouvrez `about:debugging#/runtime/this-firefox`.
2. Cliquez sur **Charger un module temporaire…**.
3. Sélectionnez le **`manifest.json`** du dossier (et non le dossier lui-même :
   c'est la différence avec Chrome, qui attend le dossier). Si vous êtes parti
   du `.zip`, décompressez-le d'abord.
4. Ouvrez (ou rechargez) un onglet `https://www.twitch.tv/`. La sidebar est
   enrichie automatiquement.

Un module chargé ainsi est **temporaire** : Firefox l'oublie à la fermeture.
Pour une installation qui survit au redémarrage, il faut un paquet signé — donc
passer par AMO.

Aucune permission supplémentaire n'est demandée : l'extension n'agit que sur les
pages `twitch.tv` et `player.twitch.tv`, et ne communique avec aucun serveur
tiers en dehors des appels que Twitch fait déjà lui-même (API GraphQL publique
de Twitch, miniatures, lecteur `player.twitch.tv` pour l'aperçu).

---

## Compatibilité

- **Firefox 140 ou supérieur.** Le plancher n'est pas choisi, il est **déduit**
  de deux clés du manifeste, et c'est la plus récente qui commande :

  | Ce qu'on déclare | Depuis |
  | --- | --- |
  | `"world": "MAIN"` dans `content_scripts` | Firefox **128** |
  | `browser_specific_settings.gecko.data_collection_permissions` | Firefox **140** |

  D'où 140. Descendre à 128 rendrait le manifeste incohérent avec lui-même, et
  l'`addons-linter` de Mozilla le dit mot pour mot. Le coût est nul : l'ESR 128
  est hors support depuis le 16 septembre 2025, et l'ESR actif est le 140 — la
  plage 128-139 n'est plus habitée par aucune version maintenue.
- **Firefox pour Android 142 ou supérieur** (`gecko_android`), la clé de
  collecte de données y étant arrivée deux versions plus tard. À noter que la
  sidebar des chaînes suivies n'existe pas sur le Twitch mobile : la
  compatibilité y est déclarée par cohérence, pas par utilité.
- Pour **Chrome, Edge, Brave, Opera, Vivaldi, Arc**, voir la branche
  `claude/chrome` : même code, manifeste sans le bloc `browser_specific_settings`.

---

## Le portage Firefox (v3.55.3)

### Ce qui change, et c'est peu

**Un seul fichier du produit diffère : `manifest.json`.** `content.js` et
`adblock.js` sont identiques octet pour octet entre les deux branches, et le
bloc `content_scripts` est identique lui aussi — un vérificateur le compare à
une constante et échoue s'il diverge (`npm run addon`). C'est la promesse du
portage, et elle est tenue par une machine plutôt que par une intention.

Cette étroitesse n'est pas un coup de chance : l'extension **n'appelle aucune
API d'extension**. Ni `chrome.*`, ni `browser.*`, ni `runtime`, ni `storage`,
ni arrière-plan, ni popup, ni page d'options, ni la moindre permission. Elle
n'est qu'un content script. Il n'y a donc rien à traduire d'un dialecte à
l'autre — le portage se réduit au manifeste.

Ce que le manifeste gagne :

```json
"browser_specific_settings": {
  "gecko": {
    "id": "cowlors-sidebar@maxezify.github.io",
    "strict_min_version": "140.0",
    "data_collection_permissions": { "required": ["none"] }
  },
  "gecko_android": { "strict_min_version": "142.0" }
}
```

- **L'identifiant est obligatoire en MV3** : AMO n'en attribue plus. Sans lui,
  la soumission est refusée — c'était la seule *erreur* du manifeste Chrome
  passé au linter de Mozilla.
- **`data_collection_permissions` est obligatoire** pour toute nouvelle
  extension depuis le **3 novembre 2025**. La valeur honnête est ici `"none"` :
  l'extension ne collecte ni ne transmet rien, ce que le reste de ce document
  détaille et que l'absence totale de permission rend vérifiable.

### Deux API que Chrome a et que Firefox n'a pas

Le code n'a pas eu à changer, mais il fallait établir qu'il **dégrade
correctement**. Deux appels seulement sont concernés, tous deux déjà gardés :

| API | Firefox | Ce que fait le code sans elle |
| --- | --- | --- |
| `location.ancestorOrigins` | absente avant ~148 | le pont d'aperçu retombe sur les deux origines déclarées au manifeste pour viser son `postMessage` |
| `requestVideoFrameCallback` | depuis 132 (donc présente au plancher) | la course à trois signaux se joue sur les deux restants — `playing` et `readyState` |

La première est **la** divergence du portage. Si son repli était cassé,
l'aperçu ne se dévoilerait jamais sous Firefox, et rien dans le code ne le
dirait : le pont resterait simplement muet.

### Ce qui est vérifié, et par quoi

Il faut être précis, parce que la différence compte.

**Vérifié.** Le manifeste passe l'`addons-linter` de Mozilla — celui-là même
qu'AMO applique à la soumission — avec **zéro erreur**. Le scénario 61 du banc
rejoue le comportement de Firefox : `requestVideoFrameCallback` est réellement
retirée de la page, et la lecture d'`ancestorOrigins` est neutralisée à la
construction sur une copie (`content.firefox.test.js`), parce qu'elle ne peut
pas l'être autrement — la propriété est `[LegacyUnforgeable]`, propre et non
configurable. Mesuré, pas supposé : `delete location.ancestorOrigins` rend
`false`, la version « prototype » rend `true` **sans rien retirer**, et
redéfinir lève un `TypeError`. La première écriture de ce scénario croyait la
supprimer et ne supprimait rien ; ses assertions étaient vertes et ne testaient
personne. C'est une garde sur le décor lui-même qui l'a dit.

**Vérifié sur un vrai Firefox — le point qui restait ouvert est clos.**
L'environnement de développement ne peut pas lancer Firefox : sa politique
réseau bloque le téléchargement du binaire de Playwright, et tout le banc
tourne donc sous Chromium, y compris les scénarios qui simulent Firefox.
Restait ce qu'aucune simulation ne donne : l'injection en monde `MAIN` à
`document_start` arrive-t-elle avant les scripts de Twitch dans le moteur de
Mozilla ? La documentation dit que oui — *« les content scripts à
`document_start` s'exécutent toujours avant les scripts de la page »*
([bug 1388429](https://bugzilla.mozilla.org/show_bug.cgi?id=1388429)) — mais une
documentation n'est pas une mesure.

La mesure a été faite, sur Firefox, avec la procédure ci-dessous. Relevé :

| Contrôle | Résultat |
| --- | --- |
| monde `MAIN` — `window.tse` visible depuis la console de la page | ✅ `object` |
| CSS de l'extension posé | ✅ |
| démarrage allé au bout — `history.pushState` enveloppé | ✅ |
| **`adblock.js` a capté le `fetch` NATIF dans l'iframe du lecteur** | ✅ `true` |

La dernière ligne est celle qui tranche : la valeur captée avant remplacement
est le `fetch` natif, donc **personne ne l'avait enveloppée avant nous**.
`document_start` en monde `MAIN` se comporte sous Gecko comme sous Chromium.

**Ce qui reste appuyé sur le banc, et non sur Firefox.** Le comportement
fonctionnel — aperçus, levage de l'interstitielle, tris, filtres — reste prouvé
sous Chromium, plus le scénario 61 qui rejoue les manques de Firefox. Le risque
de plateforme est levé ; le risque de rendu ne l'est que par transitivité.

### Comment vérifier `document_start` sous Firefox

Chargez l'extension via `about:debugging#/runtime/this-firefox` → **Charger un
module temporaire…** → le `manifest.json`. Firefox n'injecte **pas** dans les
onglets déjà ouverts : ouvrez `https://www.twitch.tv/` *après*, ou rechargez.

#### 1. Le script tourne-t-il, et dans le bon monde ?

Console (**F12**), puis :

```js
(() => {
  const s = document.getElementById('tse-css');
  const natif = (f) => { try { return /\[native code\]/.test(Function.prototype.toString.call(f)); }
                         catch { return false; } };
  const out = [];
  const dit = (c, ok, d) => out.push({ contrôle: c, verdict: ok ? '✅' : '❌', détail: String(d) });
  dit('1. monde MAIN — window.tse visible depuis la page',
      window.tse != null && typeof window.tse === 'object', typeof window.tse);
  dit('2. le CSS de l\'extension est posé', !!s, s ? 'oui' : 'absent');
  dit('3. le démarrage est allé au bout — history.pushState enveloppé',
      !natif(history.pushState), natif(history.pushState) ? 'natif' : 'enveloppé');
  console.table(out);
  return out;
})();
```

Les trois doivent être verts. Le contrôle 1 est celui qui prouve le monde
`MAIN` : en monde isolé, `window.tse` serait invisible depuis la console de la
page. Ils ne disent en revanche **rien** du moment de l'injection.

#### 2. L'ordre : pourquoi le DOM ne peut pas y répondre

Une version antérieure de cette page proposait de regarder **où** le
`<style id="tse-css">` avait atterri : premier enfant de son conteneur, avant
tout `<script>`. Sur une page statique, la mesure est juste et discrimine
proprement — vérifié sous Chromium en ne faisant varier que le `run_at`.

Sur le vrai Twitch, elle ne vaut rien, et le relevé le montre : le `<style>` y
est le **76ᵉ** enfant de `<head>`. Twitch réécrit son `<head>` en continu
pendant le démarrage de son SPA — préchargements, feuilles de style de
composants, morceaux de bundle — et une partie de ces nœuds est insérée **en
tête**, ce qui repousse le nôtre. La position observée est donc celle
d'aujourd'hui, pas celle de l'injection. Elle ne prouve ni la précocité ni le
retard.

Sur un moteur donné le conteneur diffère d'ailleurs, sans que ce soit un
défaut : Chromium n'a créé que `documentElement` quand il injecte, là où Gecko
a déjà monté un squelette complet. Mozilla le documente : *« le parseur met en
place le squelette DOM initial avant de débloquer les scripts et de laisser
l'événement `document-element-inserted` se déclencher, de sorte que plus que le
seul élément document existe au moment où il est émis »*
([bug 1333990](https://bugzilla.mozilla.org/show_bug.cgi?id=1333990)).

#### 3. L'ordre : la seule mesure qui tienne

Il faut un fait **capté au moment de l'injection**, que la page ne puisse pas
réécrire ensuite. Le blocage de pub en fournit un : `adblock.js` capture
`window.fetch` avant de le remplacer, et garde la valeur captée. Si elle est
**native**, personne ne l'avait enveloppée avant nous — la course est gagnée, et
c'est précisément la garantie que `document_start` doit offrir.

`adblock.js` ne travaille que dans l'iframe du lecteur (il se retire du stream
principal, cf. sa garde `window.top === window`). Or l'iframe d'aperçu meurt dès
qu'on quitte la carte du survol, donc avant d'avoir pu changer de contexte dans
les outils. On s'en fabrique donc une, qui reste. Sur `https://www.twitch.tv/`,
dans la console :

```js
const f = document.createElement('iframe');
f.id = 'tse-sonde';
f.src = 'https://player.twitch.tv/?channel=twitch&parent=www.twitch.tv&muted=true';
f.style.cssText = 'position:fixed;bottom:0;right:0;width:400px;height:225px;z-index:99999';
document.body.appendChild(f);
```

Puis, **dans la barre d'outils des outils de développement, le sélecteur de
contexte** — l'icône en forme de cadre, à droite ; si elle n'apparaît pas, elle
est dans le menu de débordement `»`. Choisissez l'entrée `player.twitch.tv`. La
console travaille désormais dans l'iframe. Tapez :

```js
/\[native code\]/.test(String(window.__vaft2RealFetch))   // → true attendu
```

- **`true`** → `adblock.js` a capté le `fetch` natif : il est passé avant tout
  script de la page. `document_start` est confirmé, et le portage est bon.
- **`false`** → quelqu'un avait déjà enveloppé `fetch` : nous sommes passés
  après.
- **`undefined`** → soit la console est restée sur la frame du haut (`adblock.js`
  s'y retire volontairement), soit le content script n'a pas été injecté dans
  l'iframe.

Pour finir, revenez au contexte de la page et retirez la sonde :

```js
document.getElementById('tse-sonde').remove();
```

Enfin, **surveillez les erreurs de la console au chargement**. Un canari précis :
`detectLanguage()` lit `document.documentElement.lang` sans garde. Si Gecko
injectait plus tôt encore que Chromium — avant même `documentElement` — l'erreur
serait `can't access property "lang", document.documentElement is null`, et elle
serait bruyante. Son absence est donc une information.

### Le paquet, et les avertissements qui restent

Le premier envoi à AMO a rendu **17 avertissements**, là où le contrôle local
n'en montrait que 12. L'écart n'était pas un hasard : le `.zip` contenait **tout
le dépôt** — `promo.mjs`, `promo-marquee.mjs`, le harnais `tests/run.mjs` et sa
page `tests/page.html` à scripts en ligne — et le validateur jugeait cinq
fichiers qui ne s'exécutent jamais chez personne.

Le contrôle local, lui, passait `--ignore-files` au linter : il validait un
paquet **hypothétique**, celui qu'on aurait aimé envoyer. C'est le genre de
vérification qui rassure sans rien garantir.

`npm run addon` assemble donc maintenant le paquet dans `dist/paquet/` à partir
d'une **liste blanche** — `manifest.json`, `content.js`, `adblock.js`, `icons/`,
`_locales/` — puis passe le linter sur **le paquet**, sans exclusion. Une liste
noire (« ignore ceci, ignore cela ») aurait recréé le défaut au premier fichier
ajouté : ce qu'on oublie d'exclure part. La liste blanche a le défaut inverse,
qui est le bon : ce qu'on oublie d'inclure **manque**, et un contrôle le voit —
chaque fichier que le manifeste nomme doit être présent, et rien ne doit venir
d'ailleurs que de la liste. `npm run package` en fait le `.zip` à soumettre.

### Le paquet part sans ses commentaires (v3.59)

Ce dépôt commente beaucoup, et c'est voulu : la moitié de ce qu'on sait de ce
produit est écrite dans ses marges. Mais cette moitié-là vit **ici**, dans un
dépôt public — elle n'a pas à voyager dans chaque installation ni à traverser
la file de revue. `npm run addon` retire donc les commentaires du code
assemblé :

| Fichier | Avant | Après | Commentaires |
| --- | --- | --- | --- |
| `content.js` | 775 Ko | 328 Ko | 3 007 → **2** |
| `adblock.js` | 124 Ko | 100 Ko | 290 → **2** |
| `panneau.js` | 53 Ko | 27 Ko | 71 → **0** |
| `bridge.js` | 11 Ko | 3 Ko | 20 → **0** |
| `background.js` | 9 Ko | 2 Ko | 21 → **0** |
| **les cinq** | **972 Ko** | **459 Ko** | **−53 %** |

Ces chiffres sont **confrontés à la mesure** à chaque assemblage, ici comme
dans `README.en.md` et `store/README.md`. Ils ne se calculent pas, ils se
recopient — et un nombre recopié se périme sans bruit : la fiche du Store a
annoncé un paquet de 391 Ko pendant deux versions, c'est-à-dire le gain du
JavaScript **seul**, alors que le CSS était dégraissé lui aussi. `npm run
addon` relit donc les trois documents et compare ce qu'ils annoncent à ce
qu'il vient de peser, à 3 % près : assez large pour la croissance ordinaire
d'une version, trop étroit pour une phrase qui décrit le produit d'avant.

**Le retrait ne concerne QUE le paquet.** Il porte sur la copie assemblée dans
`dist/paquet/`, jamais sur les fichiers du dépôt : `content.js` garde ses 3 007
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

Les douze avertissements restants portaient tous sur le même code —
`UNSAFE_VAR_ASSIGNMENT` — sur les écritures `innerHTML`, `insertAdjacentHTML` et
`outerHTML` du rendu. Ils sont à zéro.

Le linter n'accepte que du balisage **statique** : un littéral passe, une
variable non — même une constante qui ne contient qu'un littéral, ce qui a été
mesuré et ferme la porte à toute ruse. La seule sortie honnête était donc de
construire le DOM plutôt que d'assembler des chaînes.

Ce n'est pas une correction de sûreté : l'échappement était en place, et les
douze sites avaient été relus un par un. C'est une correction de **fragilité**.
La sûreté tenait à ce qu'aucun appel n'oublie `escapeHtml`, et aucune relecture
ne garantit ça pour l'avenir. Désormais les valeurs venues de Twitch — noms de
chaînes, catégories, titres, marques — passent par `textContent` ou
`setAttribute`, qui ne peuvent rien interpréter.

**`escapeHtml` a disparu du fichier faute d'appelant.** C'est la preuve la plus
courte que la conversion est complète : il n'y a plus d'échappement à oublier.

Trois choses ont bougé :

- **`badgeHtml` rend un nœud** (`badgeNoeud`), et les six sites de badges
  insèrent par `replaceWith`, `prepend`, `before`, `appendChild`.
- **Le HTML est sorti des tables de locale.** `uiBadgeCostreamOf` rendait
  `Co-stream de <strong>${nom}</strong>` ; elle rend maintenant du texte pur où
  la place du nom est marquée par un `\u0000`, et le rendu y insère un
  `<strong>` construit en DOM. Vingt fonctions, cinq langues — **pas un mot des
  libellés n'a changé**, seul le balisage en est sorti.
- **`noeudStatique` est la seule porte qui reste vers un analyseur HTML**, et
  elle est réservée au balisage écrit dans `content.js` : icônes SVG, drapeaux,
  ossatures. L'addons-linter ne surveille pas `DOMParser` — y faire passer une
  donnée externe ferait taire son avertissement sans rien corriger, ce qui
  serait pire que l'avertissement. La règle est écrite dans le code, à côté de
  la fonction.

Le banc ne couvrait ni le contenu de ces badges ni cette propriété : la refonte
aurait pu perdre le `<strong>` des noms sans rien casser de visible. Le scénario
62 le vérifie désormais sur les deux chemins par lesquels du texte de Twitch
atteint le DOM — le nom d'un invité squad et une catégorie — avec la même
charge : `<img src=x onerror="…">`. Elle s'affiche en toutes lettres, aucune
balise n'est créée, rien ne s'exécute. La mutation qui remet un `innerHTML` à
l'un des deux endroits le fait tomber.

Le compte reste tenu par un **cliquet** : `content.js` a droit à zéro
avertissement, comme tous les autres fichiers. Le premier qui apparaît fait
échouer `npm run addon`.

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
| `--switch` | `rgba(120, 215, 60, .24)` | `#2f4623` | `#a8e86b` | 91° | 7,15:1 |
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
npm run test-firefox        # les mêmes 686 assertions, sous Gecko
```

Le banc choisit son moteur par `TSE_MOTEUR` (`chromium` par défaut), annonce
lequel en tête de sortie et le rappelle dans son verdict — un journal qui ne le
dit pas ne se compare à rien. Rien n'est adapté ni contourné : un échec là-bas
est un renseignement, soit sur le produit, soit sur ce que le harnais tenait
pour acquis. **Deux provocations sont les plus susceptibles de demander un
ajustement à la première passe** : la redirection servie par le harnais au
scénario 75, qui donne une origine opaque sous Blink, et la sortie de fenêtre du
scénario 76, dont l'ordre des événements de souris n'est pas garanti identique.

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

### Les deux marques, et pourquoi ce sont celles-là

**Le périmètre de la carte n'était pris par rien.** Le trait de « fraîchement
en ligne » est intérieur et à gauche ; la lueur d'abonné est un fond. Une
lumière qui fait le **tour** dit « ça tourne encore » sans rien recouvrir — et
une carte peut porter les trois signaux à la fois sans qu'aucun ne se perde.

L'anneau est un **élément injecté**, et non un pseudo-élément : `::before`
appartient déjà à « frais », `::after` à « abonné ». Il est `aria-hidden` de
bout en bout — c'est la pastille qui porte le sens.

**Une capture a corrigé l'anneau.** La première rédaction faisait partir le
dégradé conique d'un secteur **entièrement transparent** : sur les trois quarts
du tour il n'y avait pas d'anneau du tout, et l'œil lisait non pas une lumière
qui tourne mais une **bordure cassée**, un défaut de rendu. Le socle est
désormais continu — faible, mais présent sur les 360° — et la portion vive s'y
déplace. C'est le contraste avec le socle qui dessine le mouvement, pas
l'absence de socle.

Sans `mask-composite`, l'anneau **reste vide** : le contour se fabrique en
peignant tout le cadre puis en découpant l'intérieur, et là où ce découpage
n'a pas lieu, le dégradé recouvrirait la carte entière.

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

`prefers-reduced-motion` fige les deux marques sans en retirer aucune : la
chaleur du compteur se pose sur une teinte pleine, l'anneau devient un liseré
immobile et **uniforme**. Uniforme, parce qu'un anneau figé garderait sa
portion vive arrêtée à un endroit du tour — c'est-à-dire exactement la bordure
asymétrique qu'on venait de corriger.

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
  correspond plus — utile pour diagnostiquer une éventuelle panne. Cet
  avertissement **nomme la sonde fautive**, et pas seulement « des sélecteurs » :
  la page « Erreurs » du navigateur ne retient que le `console.warn`, jamais le
  tableau imprimé juste après, et un rapport d'utilisateur ne disait donc rien
  d'exploitable.
- `tse.diagnose.auto()` — rejoue le contrôle **périodique**, celui qui porte sa
  mémoire : il n'avertit qu'une fois par incident et se réarme quand tout est
  redevenu vert. Utile pour reprovoquer l'alerte sans attendre le prochain tour
  d'entretien. `tse.diagnose()`, lui, ne fait qu'imprimer et ne change rien.
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
npm run check                      # lint + parité + manifeste Firefox + harnais
```

Quatre vérifications, indépendantes :

| Commande | Ce qu'elle contrôle |
|---|---|
| `npm run lint` | `content.js` et `adblock.js` — no-undef, `require-atomic-updates`, etc. |
| `npm run parity` | les cinq blocs de traduction portent exactement les mêmes clés |
| `npm run addon` | le manifeste Firefox : les invariants du dépôt, **puis** l'`addons-linter` de Mozilla — celui qu'AMO applique à la soumission |
| `npm test` | le harnais Playwright : 91 scénarios, 841 assertions |
| `npm run test-firefox` | les mêmes, sous Gecko (`TSE_MOTEUR=firefox`) |

Ces deux nombres-là ne sont pas décoratifs : `run.mjs` les confronte à ce qu'il
vient de compter, et échoue si le tableau ment. Un banc dont on annonce la
taille de mémoire finit toujours par l'annoncer fausse — cette ligne disait
544 quand il y en avait 579, et l'arborescence ci-dessus en annonçait 561 à
deux pages d'écart. Le compte des scénarios était faux lui aussi, pour une
raison qu'aucune relecture n'attrape : la numérotation **saute le 52**, si
bien qu'on lisait la plus haute étiquette au lieu de compter les blocs.

`npm run addon` mérite un mot : ses six assertions de manifeste sont celles que le
linter ne peut pas connaître, parce qu'elles appartiennent à ce dépôt — la
version suit `package.json`, le plancher Firefox reste cohérent avec la clé la
plus récente du manifeste, et le bloc `content_scripts` est **mot pour mot**
celui de la branche Chrome. Un manifeste peut être parfaitement recevable par
AMO et avoir silencieusement divergé de l'autre branche ; le linter n'y verrait
rien.

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
