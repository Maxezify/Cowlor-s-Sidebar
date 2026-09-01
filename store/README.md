# Fiche Chrome Web Store

Ce dossier est la **source** de ce qui est publié sur la fiche. Le tableau de
bord du Chrome Web Store n'a pas d'historique lisible : sans copie versionnée
ici, la seule trace d'une formulation est la fiche elle-même, et une correction
d'il y a six mois est introuvable. Ces fichiers existent pour ça.

Le texte est en **clair** : le champ « Description détaillée » du tableau de bord
n'interprète ni Markdown ni HTML. Les `★`, les `➤`, les émojis et les filets
`━` sont donc des caractères, pas une mise en forme — ils survivent au
copier-coller.

Le ton est celui de la fiche d'origine, écrite par l'auteur : deuxième personne,
enthousiaste, titres en capitales encadrés d'étoiles, un émoji par section. Une
traduction qui l'aplatirait en prose neutre serait une régression, même exacte.

## Les sept fiches

| Fichier | Locale du tableau de bord |
| --- | --- |
| `description-en.txt` | English — **la version de référence**, celle d'où partent les six autres |
| `description-fr.txt` | Français |
| `description-de.txt` | Deutsch |
| `description-es.txt` | Español (Espagne : *ratón*, *directo*, *vosotros*) |
| `description-es-419.txt` | Español (Latinoamérica : *mouse*, *en vivo*, voseo) |
| `description-pt-BR.txt` | Português (Brasil) |
| `description-pt-PT.txt` | Português (Portugal) |

La **description courte** (132 caractères, celle qui s'affiche sous le nom) ne
se saisit pas ici : elle vient du manifeste, clé `extDescription` de
`_locales/<langue>/messages.json`. Rien à recopier, le Store la lit du paquet.

## Ce qui doit rester vrai

Les sept fiches se tiennent par leur structure : **20 sections `➤`**, **22
puces `- ★ … ★`** dont **8 dans la section vie privée**, et un bloc console de
cinq commandes. Une modification qui n'est portée que dans une langue se voit à
ce compte-là — c'est le seul contrôle qui existe, il n'y a pas de harnais pour
du texte de fiche.

Sept affirmations sont **vérifiables dans le code**, et doivent changer le jour
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

## Images

Les captures sont produites par `npm run promo` (1280 × 800, sept langues) et la
tuile par `npm run tuile-produit` (440 × 280). Elles sortent dans `promo/`, qui
est ignoré par git : ce sont des artefacts, régénérables à l'identique.

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
