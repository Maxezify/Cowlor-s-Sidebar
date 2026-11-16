// Extrait des scénarios du banc par numéro, pour les rejouer seuls.
//   node tests/suivi/extrait.mjs 120 227 …      (depuis la racine d'un arbre)
// Écrit tests/_extrait.mjs : le prélude de tests/run.mjs (tout ce qui précède
// le scénario 1), puis, dans l'ordre du fichier, chaque déclaration de haut
// niveau sans `await` (les aides partagées), les blocs `{ titre('N. …') }`
// demandés, et l'épilogue (fermeture du navigateur, bilan). Les scénarios non
// demandés — en bloc ou à plat — ne sont pas copiés. Seuls les scénarios
// écrits en bloc s'extraient ; un scénario à plat est signalé introuvable.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const numeroDe = (n) => {
  if (n.type !== 'BlockStatement' || !n.body.length) return null;
  const e = n.body[0];
  if (e.type !== 'ExpressionStatement' || e.expression.type !== 'CallExpression') return null;
  const c = e.expression;
  if (c.callee.type !== 'Identifier' || c.callee.name !== 'titre') return null;
  const a = c.arguments[0];
  const t = a && (a.type === 'Literal' ? a.value : a.type === 'TemplateLiteral' ? a.quasis[0].value.cooked : null);
  const m = /^(\d+)\. /.exec(t || '');
  return m ? m[1] : null;
};
const estTitreUn = (n) => n.type === 'ExpressionStatement' && n.expression.type === 'CallExpression'
  && n.expression.callee.name === 'titre' && /^1\. /.test(n.expression.arguments[0]?.value || '');
const contientAwait = (n) => {
  let vu = false;
  const visiter = (x) => {
    if (vu || !x || typeof x.type !== 'string') return;
    if (/Function/.test(x.type)) return;            // un await dans une fonction ne s'exécute pas à la déclaration
    if (x.type === 'AwaitExpression') { vu = true; return; }
    for (const k of Object.keys(x)) {
      const v = x[k];
      if (Array.isArray(v)) v.forEach(visiter); else if (v && typeof v === 'object') visiter(v);
    }
  };
  visiter(n);
  return vu;
};

/* `arbre` : la racine d'un arbre du dépôt ; `numeros` : les scénarios voulus.
   Rend la liste des numéros trouvés, dans l'ordre du fichier ; lève une
   erreur qui les nomme si l'un manque. */
export function extraire(arbre, numeros) {
  const { Parser } = createRequire(join(arbre, 'package.json'))('acorn');
  const voulus = new Set(numeros.map(String));
  const src = readFileSync(join(arbre, 'tests', 'run.mjs'), 'utf8');
  const corps = Parser.parse(src, { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true }).body;
  const premier = corps.findIndex(estTitreUn);
  const dernierBloc = corps.reduce((m, n, i) => (numeroDe(n) ? i : m), -1);
  const garde = [];
  const trouves = [];
  corps.forEach((n, i) => {
    if (i < premier) { garde.push(n); return; }
    const num = numeroDe(n);
    if (num) { if (voulus.has(num)) { garde.push(n); trouves.push(num); } return; }
    if (i > dernierBloc) { garde.push(n); return; }
    if ((n.type === 'FunctionDeclaration' || n.type === 'VariableDeclaration' || n.type === 'ClassDeclaration') && !contientAwait(n)) garde.push(n);
  });
  const manquants = [...voulus].filter((v) => !trouves.includes(v));
  if (manquants.length) throw new Error(`scénarios introuvables (ou non en bloc) : ${manquants.join(', ')}`);
  writeFileSync(join(arbre, 'tests', '_extrait.mjs'), garde.map((n) => src.slice(n.start, n.end)).join('\n') + '\n');
  return trouves;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const t = extraire(process.cwd(), process.argv.slice(2));
    console.log('extrait', t.join(' '), '→ tests/_extrait.mjs');
  } catch (e) { console.error(e.message); process.exit(1); }
}
