/* Sous-ensembles CJK des polices de présentation.
   `npm run polices` — à relancer quand un texte japonais ou chinois change.

   Pourquoi un script, et pas deux fichiers posés une fois pour toutes.

   Les captures embarquent leurs polices : une image de fiche ne doit pas
   dépendre du réseau pour être reproductible (cf. le commentaire de POLICE
   dans promo.mjs). Pour le latin et le cyrillique, cela tient en quatre
   fichiers — Inter couvre tout l'alphabet en 180 Ko.

   Le japonais et le chinois n'ont pas cette chance. Noto Sans JP pèse plusieurs
   mégaoctets, et Google le sert en cent vingt-quatre morceaux ; les embarquer
   tous mettrait onze mégaoctets d'artefacts dans un dépôt qui en fait moins de
   deux. Or on connaît EXACTEMENT les caractères dont ces captures ont besoin :
   ce sont ceux des tables `ja` et `zh` de content.js, plus ceux du discours
   écrit dans promo-run.mjs et promo-marquee.mjs. Ce script les relève et
   demande à Google un sous-ensemble taillé dessus — quelques dizaines de Ko.

   Le prix de ce choix est la péremption : un caractère ajouté dans content.js
   et absent du sous-ensemble sortirait en tofu, sans que rien ne le dise. C'est
   pourquoi promo.mjs mesure, sur la page RENDUE, chaque caractère qu'elle
   affiche, et refuse de photographier ce qu'aucune police embarquée ne couvre.
   Le garde-fou dit alors de relancer cette commande ; il n'y a pas d'autre
   façon de s'en apercevoir.

   Licence : Noto Sans JP et Noto Sans SC sont sous SIL Open Font License 1.1,
   comme Inter. Le texte complet est dans promo-fonts/OFL-noto.txt. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));

/* Les blocs Unicode qu'Inter ne couvre pas et que ces deux polices doivent
   prendre en charge : ponctuation CJK, kana, idéogrammes (dont l'extension A
   et les formes de compatibilité), et les formes pleine chasse — « ， » et
   « ： » ne sont pas les signes latins, et Inter ne les a pas. */
const CJK = /[　-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/g;

/* Ce qu'aucune source ne contient et que le navigateur produira quand même :
   Intl.NumberFormat en notation compacte écrit les grands nombres en myriades.
   « 41,2万 » sort du formateur, pas d'une chaîne de content.js — aucun relevé
   de source ne peut le trouver. Les deux échelons supérieurs sont là par
   prudence : le jour où une catégorie dépasse cent millions de spectateurs,
   l'image ne sortira pas avec un carré vide. */
const INTL = '万億亿千百';

const SOURCES = ['content.js', 'promo.mjs', 'promo-run.mjs', 'promo-marquee.mjs',
                 'promo-tile-produit.mjs'];

const texte = SOURCES.map((f) => readFileSync(join(ICI, f), 'utf8')).join('');
const repertoire = [...new Set((texte.match(CJK) || []).concat([...INTL]))].sort();
console.log(`Répertoire relevé : ${repertoire.length} caractères`);

/* L'agent est celui d'un Chrome récent, et ce n'est pas cosmétique : Google
   sert du TTF aux agents qu'il ne reconnaît pas, et le WOFF2 aux autres. Node
   annonce « node », donc sans cette ligne on embarquerait des fichiers cinq
   fois plus lourds. */
const AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
              '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/* Google répond par une feuille contenant la plage RÉELLEMENT couverte. C'est
   la réponse à la question qu'on se pose vraiment — « la police a-t-elle ces
   glyphes ? » — et elle ne coûte pas un analyseur de fontes : il suffit de la
   lire. Un caractère demandé qui n'y figure pas est un caractère que la police
   n'a pas ; on le dit, et on continue, parce que le répertoire est l'UNION du
   japonais et du chinois : Noto Sans JP n'a pas à connaître « 侧 », qui
   n'apparaît que dans les chaînes chinoises. Ce qui compte in fine est mesuré
   sur la page rendue, langue par langue, par le garde-fou de promo.mjs. */
const plageCouverte = (css) => {
  const couverts = new Set();
  for (const m of css.matchAll(/unicode-range:\s*([^;]+);/g)) {
    for (const p of m[1].split(',')) {
      const r = p.trim().replace(/^U\+/i, '').split('-');
      const a = parseInt(r[0], 16);
      const b = r.length > 1 ? parseInt(r[1], 16) : a;
      for (let c = a; c <= b; c++) couverts.add(String.fromCodePoint(c));
    }
  }
  return couverts;
};

const familles = [
  { famille: 'Noto Sans JP', fichier: 'noto-sans-jp-cjk.woff2', langue: 'ja' },
  { famille: 'Noto Sans SC', fichier: 'noto-sans-sc-cjk.woff2', langue: 'zh' },
];

for (const { famille, fichier } of familles) {
  const url = 'https://fonts.googleapis.com/css2?family=' +
    encodeURIComponent(famille).replace(/%20/g, '+') +
    ':wght@100..900&text=' + encodeURIComponent(repertoire.join(''));
  const css = await (await fetch(url, { headers: { 'User-Agent': AGENT } })).text();
  const src = /url\((https:\/\/[^)]+)\)\s*format\('woff2'\)/.exec(css);
  if (!src) throw new Error(`pas de WOFF2 dans la réponse pour ${famille} :\n${css.slice(0, 400)}`);

  const couverts = plageCouverte(css);
  const absents = repertoire.filter((c) => !couverts.has(c));

  const octets = Buffer.from(await (await fetch(src[1], { headers: { 'User-Agent': AGENT } })).arrayBuffer());
  // Contrôle de l'en-tête PRODUIT plutôt que de l'intention : « wOF2 ».
  if (octets.subarray(0, 4).toString('latin1') !== 'wOF2') {
    throw new Error(`${fichier} n'est pas un WOFF2 (en-tête : ${octets.subarray(0, 4).toString('hex')})`);
  }
  writeFileSync(join(ICI, 'promo-fonts', fichier), octets);
  console.log(`  ✓ ${fichier} — ${(octets.length / 1024).toFixed(0)} Ko, ` +
              `${repertoire.length - absents.length}/${repertoire.length} caractères` +
              (absents.length ? ` (absents de cette police : ${absents.join('')})` : ''));
}
