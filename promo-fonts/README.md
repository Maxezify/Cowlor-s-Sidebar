# Polices des images de présentation

Ces fichiers ne sont **pas** livrés dans l'extension. Ils ne servent qu'aux
images de fiche — captures, bannières, tuile — produites par `promo.mjs` et
embarquées en base64 dans la page photographiée : une capture ne doit pas
dépendre du réseau pour être reproductible.

Sans eux, tout retombe sur DejaVu Sans, la police par défaut du conteneur. Ce
n'est celle de personne, et le défaut se voit deux fois — sur le faux Twitch et
sur l'extension, dont le CSS demande `var(--font-base, "Inter", sans-serif)`.

## Ce qu'il y a ici

| Fichier | Couvre | Provenance |
| --- | --- | --- |
| `inter-latin.woff2` | latin | Google Fonts, Inter v20, fichier variable 100–900 |
| `inter-latin-ext.woff2` | latin étendu (dont le polonais) | idem |
| `inter-cyrillic.woff2` | cyrillique (russe) | idem |
| `inter-cyrillic-ext.woff2` | cyrillique étendu | idem |
| `noto-sans-jp-cjk.woff2` | japonais | `npm run polices` |
| `noto-sans-sc-cjk.woff2` | chinois simplifié | `npm run polices` |

Les quatre sous-ensembles d'Inter sont **figés** : ils couvrent leur alphabet en
entier, rien dans le dépôt ne peut les périmer, et les re-télécharger sur une
version plus récente d'Inter changerait le dessin de toutes les images publiées.
Ils se remplacent à la main, délibérément, ou pas du tout.

Les deux polices CJK, elles, sont **taillées** aux caractères que ces images
écrivent — les tables `ja` et `zh` de `content.js` et le discours de
`promo-run.mjs` / `promo-marquee.mjs`. Une police japonaise complète pèse
plusieurs mégaoctets ; celles-ci font moins de deux cents kilo-octets chacune.
Le prix de ce choix est qu'elles se périment : un idéogramme ajouté quelque part
et absent d'ici sortirait en carré vide. `npm run polices` les refait, et
`glyphesManquants()` — appelé avant chaque déclenchement — refuse de
photographier une page dont un caractère n'est couvert par aucune de ces six
polices.

## Le CJK arrive en dernier, et c'est voulu

La pile de Twitch est `Inter, Roobert, "Helvetica Neue", Helvetica, Arial,
sans-serif` : aucune de ces polices n'a d'idéogramme. Sur une vraie machine
japonaise, le navigateur descend jusqu'à la police système. `promo.mjs`
reproduit ce comportement en ajoutant Noto **après** toute la pile, et
seulement pour la langue du document (`:root:lang(ja)`, `:root:lang(zh)`) —
sans quoi le chinois sortirait avec les formes japonaises. Le latin de ces
mêmes pages continue de venir d'Inter.

## Licences

Les trois familles sont sous **SIL Open Font License 1.1**, qui exige que le
texte de la licence accompagne toute redistribution :

- `OFL.txt` — Inter (The Inter Project Authors)
- `OFL-noto.txt` — Noto Sans JP et Noto Sans SC (Adobe, nom réservé « Source »)
