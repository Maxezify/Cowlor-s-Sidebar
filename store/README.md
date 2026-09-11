# Fiche addons.mozilla.org

> **Branche Firefox.** Ces fiches sont celles d'AMO. Elles sont identiques à
> celles de la branche `claude/chrome` **à une ligne près** par langue : celle
> qui nomme le bouton d'installation, « Ajouter à Chrome » devenant « Ajouter à
> Firefox ». Rien d'autre ne change — le produit décrit est le même.

Ce dossier est la **source** de ce qui est publié sur la fiche. Le tableau de
bord d'AMO n'a pas d'historique lisible : sans copie versionnée ici, la seule
trace d'une formulation est la fiche elle-même, et une correction d'il y a six
mois est introuvable. Ces fichiers existent pour ça.

Le texte est en **clair** : le champ de description longue du tableau de bord
n'interprète ni Markdown ni HTML. Les `★`, les `➤`, les émojis et les filets
`━` sont donc des caractères, pas une mise en forme — ils survivent au
copier-coller.

Le ton est celui de la fiche d'origine, écrite par l'auteur : deuxième personne,
enthousiaste, titres en capitales encadrés d'étoiles, un émoji par section. Une
traduction qui l'aplatirait en prose neutre serait une régression, même exacte.

`npm run store` tient ce que douze fiches de deux cents lignes rendent
impossible à relire : leur **squelette** doit être identique — même nombre de
sections, de séparateurs, de puces et d'étoiles que la fiche anglaise — la liste
des dix langues doit être complète partout, la ligne d'installation doit nommer
le bon magasin (le polonais décline le nom, « Firefoksa », donc le contrôle
cherche la racine et non le mot entier), et les libellés que la fiche cite mot
pour mot doivent exister dans `content.js`. Ce dernier point vient d'une erreur
réelle : la fiche a promis un badge d'étiquettes pendant dix versions avant
qu'il n'existe.

## Les douze fiches

| Fichier | Locale du tableau de bord |
| --- | --- |
| `description-en.txt` | English — **la version de référence**, celle d'où partent les onze autres |
| `description-fr.txt` | Français |
| `description-de.txt` | Deutsch |
| `description-es.txt` | Español (Espagne : *ratón*, *directo*, *vosotros*) |
| `description-es-419.txt` | Español (Latinoamérica : *mouse*, *en vivo*, voseo) |
| `description-pt-BR.txt` | Português (Brasil) |
| `description-pt-PT.txt` | Português (Portugal) |
| `description-it.txt` | Italiano |
| `description-pl.txt` | Polski |
| `description-ru.txt` | Русский |
| `description-ja.txt` | 日本語 |
| `description-zh-CN.txt` | 简体中文 |

La **description courte** (132 caractères, celle qui s'affiche sous le nom) ne
se saisit pas ici : elle vient du manifeste, clé `extDescription` de
`_locales/<langue>/messages.json`. Rien à recopier, le Store la lit du paquet.

## Ce qui doit rester vrai

Les douze fiches se tiennent par leur structure : **23 sections `➤`**, **24
séparateurs**, **84 puces** et **110 étoiles**. C'est le profil de la fiche
anglaise, et `npm run store` le compare à celui des onze autres : une section
oubliée en traduisant se voit à ce compte-là, immédiatement. Ces nombres ne se
recopient pas : le script les DÉDUIT de la fiche anglaise, si bien qu'ajouter
une section aux douze les met à jour toute seule — ils sont ici pour être lus,
pas pour être tenus à jour à la main.

Neuf affirmations sont **vérifiables dans le code**, et doivent changer le jour
où le code change :

1. **« Six façons de trier »** — `getSortButtons()` en rend six. C'était cinq
   avant la 3.44 ; la fiche l'a dit faux pendant une dizaine de versions.
2. **Le bloc console** — `tse.scores()`, `tse.scores.raw()`, `tse.subs()`,
   `tse.subs.refresh()`, `tse.reset()` existent tous sur `window.tse`. Depuis
   la 3.62 la fiche peut aussi promettre le **panneau de la barre d'outils** :
   `manifest.json` porte `action.default_popup`, et `npm run addon` vérifie
   qu'il pointe bien sur `panneau.html`. La console n'est pas remplacée pour
   autant — le panneau en est un client de plus, et la fiche ne doit pas
   laisser croire l'inverse.
3. **« Aucune permission louche — l'extension ne tourne QUE sur twitch.tv »** —
   `manifest.json` ne porte aucune clé `permissions` ni `host_permissions` ;
   seuls les `matches` des content scripts donnent accès à `www.twitch.tv`,
   `twitch.tv` et `player.twitch.tv`, tous trois sous le même domaine. Le
   panneau de la 3.62 n'a rien changé à cela, et ce n'était pas gratuit : la
   voie courte — le panneau appelant `chrome.tabs.sendMessage` — aurait exigé
   une permission d'hôte. C'est l'onglet qui appelle, précisément pour que
   cette phrase reste vraie. Voir la section « Le panneau de la barre
   d'outils » du README principal.
4. **« Des appels anonymes »** — vrai des requêtes que l'extension émet
   elle-même : `credentials: 'omit'`, Client-ID public, aucun jeton.
5. **« Une exception, dite tout haut »** — le relevé des abonnements charge
   `twitch.tv/subscriptions` dans une iframe, et cette page-là est authentifiée
   par le navigateur. Le point 4 ne la couvre pas ; c'est pourquoi la fiche la
   nomme séparément, juste après lui, au lieu de la laisser passer sous
   « anonyme ». Voir la section « Vie privée » du README principal.
6. **« Le blocage de pub reste à sa place »** — `adblock.js` ne s'active que
   dans une iframe (garde `window.top !== window`), donc uniquement dans
   l'aperçu que l'extension ouvre elle-même. Le lecteur principal n'est jamais
   touché.
7. **« Code source entièrement lisible »** — `content.js` et `adblock.js` sont
   livrés **ni minifiés ni obscurcis** : mêmes noms, mêmes lignes, même
   indentation que dans le dépôt. Depuis la 3.59 le paquet part en revanche
   **sans les commentaires** — ceux du JavaScript, et depuis la 3.60 ceux du
   CSS aussi (1001 → 463 Ko) ; la phrase reste vraie au mot près — c'est de
   lisibilité qu'elle parle, pas d'annotations — et les commentaires, eux,
   sont dans le dépôt public. Ce chiffre-là est confronté à la mesure par
   `npm run addon` : il a été faux, et personne ne l'a vu. Les mentions
   légales, elles, restent dans le paquet : la licence MIT d'`adblock.js` et
   les deux crédits OpenMoji de `content.js` l'exigent. Voir
   `tests/degraisser.mjs`.
8. **« Subathon · JOUR 10 »** — le badge de subathon existe (`uiBadgeSubathon`,
   les dix tables), et la détection qui le déclenche ne lit QUE le titre du
   direct et les tags. La fiche promet aussi la pastille « J9 » contre le
   pseudo et l'arc-en-ciel : les deux sont posés par `appliquerSubathon` et par
   les keyframes `tse-subathon-teinte` / `tse-subathon-badge`. Le contrôle
   `CITES` de `tests/store.mjs` tient la partie stable du libellé.
9. **« Étiquettes de contenu … forment leur propre badge »** — `updateCclBadge`
   les pose en tête des badges de l'aperçu, depuis les identifiants que rend
   `contentClassificationLabels`. Cette phrase a été FAUSSE de la 3.44 à la
   3.54 : la fiche promettait un badge que rien n'implémentait, et personne ne
   s'en était aperçu parce qu'aucun contrôle ne relie une promesse de fiche à
   une ligne de code. Cette liste-ci est ce contrôle ; elle n'existe que pour
   ça.

## Images

Trois emplacements, trois commandes, et une contrainte commune que le tableau de
bord rappelle sur chacun : **JPEG ou PNG 24 bits, sans alpha**.

| Emplacement | Taille | Commande | Fichiers |
| --- | --- | --- | --- |
| Bannière en haut de la page | 1400 × 560 | `npm run banniere` | `00-banniere-<L>.png` |
| Captures d'écran | 1280 × 800 | `npm run promo` | `01-apercu-<L>.png` … `05-abonnes-<L>.png` |
| Petite tuile promotionnelle | 440 × 280 | `npm run tuile-produit` | `tuile-E-produit.png` |

`<L>` est la clé de capture de la fiche, **une par langue** : `en`, `fr`, `de`,
`es`, `es419`, `ptbr`, `ptpt`, `it`, `pl`, `ru`, `ja`, `zh`. Douze fiches, douze
jeux d'images — soit 12 bannières et 60 captures. Les cinq langues arrivées avec
la 3.57 ont d'abord eu leur texte sans leurs images ; c'est le genre d'écart
qu'aucune relecture ne rattrape, puisque les images ne sont pas dans le dépôt.
`npm run store` compte donc les langues des trois tables de discours
(`promo-run.mjs`, `promo-marquee.mjs`, `SECTION` dans `promo.mjs`) et les
confronte aux fiches présentes.

Tout sort dans `promo/`, ignoré par git : ce sont des artefacts, régénérables à
l'identique. Et tout sort **sans canal alpha** — ce n'était pas le cas avant
qu'on écrive la bannière : les images étaient en RGBA, opaques mais de type 6,
ce que le Store est en droit de refuser. `promo.mjs` encode désormais le PNG
lui-même et relit son propre en-tête. Pour vérifier de l'extérieur :

```bash
file promo/*.png    # doit dire « 8-bit/color RGB », jamais « RGBA »
```

### Les polices

Les captures embarquent les leurs : une image publiée ne doit pas dépendre du
réseau. Inter couvre le latin et le cyrillique en quatre fichiers figés ; le
japonais et le chinois sont servis par deux sous-ensembles de Noto **taillés aux
caractères de ces images**, que `npm run polices` refait. Ces deux-là se
périment — un idéogramme ajouté dans `content.js` et absent du sous-ensemble
sortirait en carré vide. C'est pourquoi chaque déclenchement mesure, sur la page
rendue, tous les caractères qu'elle affiche, et s'arrête plutôt que de
photographier ce qu'aucune police embarquée ne couvre. Voir
`promo-fonts/README.md`.

### Les cinq captures, et leur ordre

Le Store n'en accepte que **cinq**, et il en sortait six : une restait donc au
vestiaire, et la fiche choisissait à chaque publication ce qu'elle n'allait PAS
montrer. Elles sont désormais cinq, écrites pour être cinq. Le numéro du fichier
EST le rang : la première image est celle que la vignette du Store montre à tout
le monde, la cinquième celle que presque personne ne fait défiler jusqu'à voir.

| Rang | Fichier | Pourquoi là |
| --- | --- | --- |
| 1 | `01-apercu-<L>.png` | la fonction phare, et la seule image vue par tout le monde : elle doit dire « barre latérale Twitch » ET « voilà ce qu'elle fait de mieux » |
| 2 | `02-carte-<L>.png` | la valeur de tous les jours, celle qu'on voit sans rien faire : durée, co-streams, subathons |
| 3 | `03-frise-<L>.png` | « Précédemment sur ce live » — ce qui n'existe nulle part ailleurs, et ce qui demande le plus à être montré pour être compris |
| 4 | `04-top-<L>.png` | la portée : l'extension ne s'arrête pas aux chaînes suivies |
| 5 | `05-abonnes-<L>.png` | le plus personnel, et l'endroit où la promesse de vie privée se dit le mieux |

Ce qui a disparu au passage : les filtres et les tris n'ont plus d'image à eux.
Ils se devinent, ils ne distinguent l'extension de rien, et ils occupaient deux
des six emplacements. Ils sont restés en tant que **points** — une ligne dans la
cinquième image — ce qui est exactement le poids qu'ils méritent.

### Ce que porte chaque image

Chaque capture a la même charpente : un chapô, un titre de 72 pixels sur deux
lignes, **trois points**, une ligne de marque. Les points ont remplacé le
paragraphe des fiches précédentes, et c'est la seule décision de cette refonte
qui ait une raison mesurable : un paragraphe de trois lignes à 29 px se lit à
1280 px de large et ne se lit plus du tout dans la vignette du Store, qui en
fait 440. Trois amorces en gras s'attrapent à n'importe quelle taille, et
chacune porte sa preuve derrière un tiret.

La ligne de marque n'est pas décorative non plus : elle porte un argument
DIFFÉRENT par image — gratuit, le fouillis en moins, jamais un chiffre inventé,
un clic pour revenir, lu dans votre navigateur. Cinq images, cinq raisons
d'installer, sans qu'aucune ne coûte une ligne au discours.

Deux plans de page, et ils ne sont pas un choix de goût :

- **« cote »** (images 2 à 5) — le produit à gauche dans 500 px, le discours à
  droite dans 666 px. La barre y tient à l'échelle 1,72, soit des rangées de
  75 px : c'est ce qui rend un pseudo lisible dans une vignette.
- **« empile »** (image 1) — le titre en bandeau, le produit dessous. Il n'existe
  que parce que cette image doit montrer la barre ET l'aperçu côte à côte, soit
  766 px de produit, qui ne laisseraient que 430 px au texte.

## Le formulaire « Pratiques de confidentialité »

Le tableau de bord pose ses questions à part, et **aucune réponse ne se déduit
de la description**. Ce que le code permet de répondre :

- **Objectif unique** — enrichir la barre latérale des chaînes suivies de
  Twitch. Tout ce que fait l'extension y revient : les informations sur les
  cartes, les filtres, les tris, l'aperçu, le mode Top Chaînes. Le blocage de
  publicité n'est pas une seconde fonction offerte à l'utilisateur : il ne
  s'applique qu'à l'iframe de l'aperçu que l'extension ouvre elle-même, et
  n'a aucun effet sur le lecteur que l'utilisateur regarde. À dire dans ces
  termes-là si la question est posée.
- **Justification des permissions d'hôte** — `www.twitch.tv`, `twitch.tv` et
  `player.twitch.tv` : l'extension modifie la barre latérale de Twitch et ouvre
  l'aperçu vidéo sur `player.twitch.tv`. Elle n'a accès à aucun autre domaine.
- **Usage à distance du code** — non. Aucun script n'est chargé depuis le
  réseau ; tout ce qui s'exécute est dans le paquet.
- **Collecte de données** — l'extension n'envoie **rien** nulle part. Ce qu'elle
  mémorise (historique de visites, abonnements repérés et leur ancienneté) vit
  dans le `localStorage` de `twitch.tv` et ne quitte jamais la machine. Les
  trois certifications de la fin du formulaire — pas de revente, pas d'usage
  étranger à l'objectif unique, pas d'évaluation de solvabilité — sont donc
  toutes vraies.
