// Parité des locales : extrait les blocs de STRINGS et compare les jeux de clés.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'content.js'), 'utf8');
const lines = src.split('\n');

// Repère les ouvertures de bloc locale : "    fr: {" (indentation 4)
const starts = [];
lines.forEach((l, i) => {
  const m = /^ {4}(fr|en|de|es|pt): Object\.freeze\(\{\s*$/.exec(l);
  if (m) starts.push({ lang: m[1], line: i });
});
if (starts.length !== 5) { console.error('Blocs trouvés :', starts.map(s => s.lang)); process.exit(1); }

const keysOf = (from) => {
  const out = [];
  for (let i = from + 1; i < lines.length; i++) {
    if (/^ {4}\}\)/.test(lines[i])) break;
    const m = /^ {6}([A-Za-z0-9_]+):/.exec(lines[i]); // clé de 1er niveau
    if (m) out.push(m[1]);
  }
  return out;
};

const byLang = new Map(starts.map(s => [s.lang, keysOf(s.line)]));
let bad = 0;

for (const [lang, keys] of byLang) {
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupes.length) { console.error(`✗ ${lang} : clés dupliquées → ${[...new Set(dupes)].join(', ')}`); bad++; }
}

const ref = byLang.get('fr');
for (const [lang, keys] of byLang) {
  if (lang === 'fr') continue;
  const missing = ref.filter(k => !keys.includes(k));
  const extra   = keys.filter(k => !ref.includes(k));
  if (missing.length) { console.error(`✗ ${lang} : manque → ${missing.join(', ')}`); bad++; }
  if (extra.length)   { console.error(`✗ ${lang} : en trop → ${extra.join(', ')}`); bad++; }
}

console.log(`Locales : ${[...byLang].map(([l, k]) => `${l}=${k.length}`).join('  ')}`);
console.log(bad ? `✗ ${bad} problème(s)` : '✓ parité des locales OK');
process.exit(bad ? 1 : 0);
