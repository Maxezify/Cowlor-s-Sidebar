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

Les douze fiches se tiennent par leur structure : **20 sections `➤`**, **21
séparateurs**, **73 puces** et **88 étoiles**. C'est le profil de la fiche
anglaise, et `npm run store` le compare à celui des onze autres : une section
oubliée en traduisant se voit à ce compte-là, immédiatement.

Huit affirmations sont **vérifiables dans le code**, et doivent changer le jour
où le code change :

1. **« Six façons de trier »** — `getSortButtons()` en rend six. C'était cinq
   avant la 3.44 ; la fiche l'a dit faux pendant une dizaine de versions.
2. **Le bloc console** — `tse.scores()`, `tse.scores.raw()`, `tse.subs()`,
   `tse.subs.refresh()`, `tse.reset()` existent tous sur `window.tse`.
3. **« Aucune permission louche — l'extension ne tourne QUE sur twitch.tv »** —
   `manifest.json` ne porte aucune clé `permissions` ni `host_permissions` ;
   seuls les `matches` du content script donnent accès à `www.twitch.tv`,
   `twitch.tv` et `player.twitch.tv`, tous trois sous le même domaine.
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
   livrés tels quels, ni minifiés ni obscurcis, commentaires compris.
8. **« Étiquettes de contenu … forment leur propre badge »** — `updateCclBadge`
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
| Captures d'écran | 1280 × 800 | `npm run promo` | `01-hero-<L>.png` … `06-abonnes-<L>.png` |
| Petite tuile promotionnelle | 440 × 280 | `npm run tuile-produit` | `tuile-E-produit.png` |

`<L>` est la clé de capture de la fiche, **une par langue** : `en`, `fr`, `de`,
`es`, `es419`, `ptbr`, `ptpt`, `it`, `pl`, `ru`, `ja`, `zh`. Douze fiches, douze
jeux d'images — soit 12 bannières et 72 captures. Les cinq langues arrivées avec
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

Le Store n'accepte que **cinq** captures. Six sont produites ; l'ordre conseillé,
et celle qui reste au vestiaire :

| Rang | Fichier | Pourquoi |
| --- | --- | --- |
| 1 | `01-hero-<L>.png` | ce que fait l'extension, en une image |
| 2 | `06-abonnes-<L>.png` | l'or sur les cartes — ce que personne d'autre ne fait |
| 3 | `02-apercu-<L>.png` | l'aperçu au survol, la fonction la plus démonstrative |
| 4 | `03-top-<L>.png` | le mode Top Chaînes, la plus grosse fonction |
| 5 | `05-tri-<L>.png` | les six tris |
| — | `04-filtres-<L>.png` | filtrer par catégorie et par langue se devine ; c'est la moins distinctive des six |

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
