// Le mode d'emploi du panneau, d'une page HTML par langue à guide/<locale>.json.
//   node tests/guide.mjs DOSSIER
// DOSSIER porte une page par traduction : index.html pour le français,
// <locale>.html pour chacune des autres (de.html, es_419.html, zh_CN.html…),
// les noms des dossiers de _locales. De chaque page, on prend le titre
// (.vue-titre), la description (.vue-desc) et le contenu de .guide — le reste
// (en-tête, sélecteur de langue, pied) appartient à la page, pas au panneau.
//
// POURQUOI DU JSON, ET PAS LE HTML. Les pages de l'extension exigent Trusted
// Types sans aucune politique (4.33.0.14) : le panneau ne peut ni affecter
// innerHTML, ni analyser une chaîne de HTML. Il construit donc chaque nœud
// lui-même (cf. noeudGuide dans panneau.js), d'après l'arbre que ce script
// relève — un nœud est soit un texte, soit [nom, attributs | 0, ...enfants].
//
// RIEN N'EST RÉÉCRIT. La page est analysée par Chromium, le même analyseur que
// le panneau aura sous les yeux, et l'arbre en est relevé tel quel. Deux
// choses seulement n'y passent pas, et aucune ne se voit : les commentaires,
// et les suites d'espaces, de tabulations et de retours à la ligne, réduites à
// une espace — le guide n'a que des blancs qui se replient (white-space
// normal ou nowrap, vérifié ici même), et les espaces insécables restent.
//
// CE QUI EST REFUSÉ, page entière : un élément qui exécute, charge ou
// soumet ; un attribut d'événement ; un lien qui ne vise pas un chapitre de
// la page ; deux identifiants semblables ; une page dont la langue n'est pas
// celle de sa traduction.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dossier = process.argv[2] && resolve(process.argv[2]);
if (!dossier) { console.error('usage : node tests/guide.mjs DOSSIER'); process.exit(2); }

const INTERDITS = new Set(['script', 'style', 'iframe', 'frame', 'object', 'embed', 'link', 'meta', 'base',
  'form', 'input', 'button', 'select', 'textarea', 'img', 'video', 'audio', 'source', 'picture',
  'foreignobject', 'use', 'image', 'template', 'slot', 'dialog', 'portal']);

const locales = readdirSync(join(RACINE, '_locales')).sort();
const navigateur = await chromium.launch();
const page = await navigateur.newPage();
const refus = [];
mkdirSync(join(RACINE, 'guide'), { recursive: true });

for (const loc of locales) {
  const fichier = join(dossier, loc === 'fr' ? 'index.html' : `${loc}.html`);
  if (!existsSync(fichier)) { refus.push(`${loc} : ${fichier} absent`); continue; }
  const attendue = JSON.parse(readFileSync(join(RACINE, '_locales', loc, 'messages.json'), 'utf8')).panelLocale.message;
  await page.goto(pathToFileURL(fichier).href);
  const r = await page.evaluate(([INTERDITS]) => {
    const interdits = new Set(INTERDITS), fautes = [];
    const guide = document.querySelector('.guide');
    const titre = document.querySelector('.vue-titre');
    const desc = document.querySelector('.vue-desc');
    if (!guide || !titre || !desc) return { fautes: ['.guide, .vue-titre ou .vue-desc absent'] };
    const ids = [...guide.querySelectorAll('[id]')].map((e) => e.id);
    const doubles = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (doubles.length) fautes.push('identifiants en double : ' + doubles.join(', '));
    for (const e of guide.querySelectorAll('*')) {
      const ws = getComputedStyle(e).whiteSpace;
      if (!['normal', 'nowrap'].includes(ws)) fautes.push(`white-space « ${ws} » sur ${e.localName}.${e.getAttribute('class')}`);
    }
    const blancs = (t) => t.replace(/[ \t\n\r\f]+/g, ' ');
    const relever = (n) => {
      if (n.nodeType === Node.TEXT_NODE) return blancs(n.data);
      if (n.nodeType !== Node.ELEMENT_NODE) return null;
      const nom = n.localName;
      if (interdits.has(nom.toLowerCase())) fautes.push(`élément interdit : ${nom}`);
      const attrs = {};
      for (const a of n.attributes) {
        if (/^on/i.test(a.name)) fautes.push(`attribut d'événement : ${nom}[${a.name}]`);
        if (a.name === 'href' && !(/^#[A-Za-z][\w-]*$/.test(a.value) && ids.includes(a.value.slice(1)))) fautes.push(`lien hors du guide : ${a.value}`);
        if (/^(src|srcset|xlink:href|action|formaction|data|poster)$/i.test(a.name)) fautes.push(`attribut qui charge : ${nom}[${a.name}]`);
        attrs[a.name] = a.value;
      }
      const enfants = [...n.childNodes].map(relever).filter((x) => x !== null);
      return [nom, Object.keys(attrs).length ? attrs : 0, ...enfants];
    };
    return {
      lang: document.documentElement.lang,
      titre: blancs(titre.textContent).trim(),
      description: blancs(desc.textContent).trim(),
      contenu: [...guide.childNodes].map(relever).filter((x) => x !== null),
      fautes,
    };
  }, [[...INTERDITS]]);
  if (r.lang !== attendue) r.fautes.push(`langue de la page « ${r.lang} », celle de la traduction « ${attendue} »`);
  if (r.fautes.length) { refus.push(...r.fautes.map((f) => `${loc} : ${f}`)); continue; }
  // Les blancs du bord : sans effet au début et à la fin du conteneur.
  while (r.contenu.length && typeof r.contenu[0] === 'string' && !r.contenu[0].trim()) r.contenu.shift();
  while (r.contenu.length && typeof r.contenu.at(-1) === 'string' && !r.contenu.at(-1).trim()) r.contenu.pop();
  const sortie = { lang: r.lang, titre: r.titre, description: r.description, contenu: r.contenu };
  writeFileSync(join(RACINE, 'guide', `${loc}.json`), JSON.stringify(sortie) + '\n');
  console.log(`${loc.padEnd(6)} ${r.lang.padEnd(6)} ${r.contenu.length} nœuds de tête — « ${r.titre} »`);
}
await navigateur.close();
if (refus.length) { console.error('\n✗ refusé :\n  ' + refus.join('\n  ')); process.exit(1); }
console.log(`\n✓ ${locales.length} traductions écrites dans guide/`);
