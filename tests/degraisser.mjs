/* ============================================================
 *  RETIRER LES COMMENTAIRES DU CODE LIVRÉ
 *  ------------------------------------------------------------
 *  Le dépôt commente beaucoup, et c'est voulu : la moitié de ce
 *  qu'on sait de ce produit est écrite dans ses marges. Ce qui
 *  part chez l'utilisateur n'a pas à porter cette moitié-là —
 *  elle vit dans le dépôt, qui est public.
 *
 *  DEUX RÈGLES, ET ELLES NE SE NÉGOCIENT PAS.
 *
 *  1. On ne retire QUE des commentaires, et on le PROUVE. Le
 *     découpage ne se fait pas à l'expression régulière : la
 *     séquence « // » apparaît dans chaque URL du fichier, et un
 *     début de bloc peut vivre dans une chaîne. C'est acorn qui
 *     dit où sont les commentaires, et le contrôle final compare
 *     le flux de JETONS de l'entrée et de la sortie : mêmes
 *     jetons, mêmes valeurs, même ordre. Un fichier qui aurait
 *     perdu autre chose qu'un commentaire ne peut pas passer.
 *
 *  2. Les mentions LÉGALES restent. adblock.js est du code tiers
 *     sous licence MIT, laquelle exige que sa notice accompagne
 *     « toute copie ou portion substantielle du logiciel ». La
 *     retirer ne serait pas un gain de place, ce serait une
 *     violation. Tout commentaire portant « Copyright »,
 *     « Licence » ou « License » est donc conservé tel quel.
 *
 *  CE QU'ON REPOSE À LA PLACE, enfin, n'est pas de la
 *  coquetterie. Un bloc qui CONTIENT un saut de ligne compte
 *  comme un saut de ligne pour l'insertion automatique de
 *  points-virgules : « return » suivi d'un tel bloc puis de « 5 »
 *  rend undefined, et les mêmes jetons sans le saut rendent 5. On
 *  repose donc un saut de ligne. Un bloc d'une seule ligne, lui,
 *  vaut au moins une espace, sinon « typeof/* c *\/x » devient
 *  « typeofx ». Et un commentaire de ligne ne possède pas le saut
 *  de ligne qui le suit : il part sans rien, et l'emporter
 *  recollerait « return » à la ligne d'après.
 *
 *  Ces trois cas sont les mutations que le scénario 66 rejoue ;
 *  aucun ne se voit dans le flux de jetons, et c'est pourquoi le
 *  banc EXÉCUTE des extraits au lieu de seulement les analyser.
 *
 *  DEUX PASSES, enfin, et la seconde ne parle pas la même langue.
 *  La feuille de style vit dans un littéral de gabarit : pour
 *  acorn c'est une CHAÎNE, et ses 77 commentaires ne sont donc pas
 *  des commentaires JavaScript. `degraisserCss` les retire, avec
 *  ses propres règles — cf. NOM_CSS et JETON_CSS plus bas — et sa
 *  propre preuve, qui ne se fait pas ici : le banc fait parser la
 *  feuille par Chromium, avant et après, et compare ses règles.
 *  C'est le navigateur qui lit ce CSS ; c'est donc lui qu'on
 *  interroge.
 * ============================================================ */
import { Parser } from 'acorn';

/* `allowReturnOutsideFunction` : un retire-commentaires n'a pas à juger de la
   validité sémantique de ce qu'on lui donne, seulement à le découper. La
   permission sert au banc, qui l'éprouve sur des CORPS de fonction — dont le
   piège central, un `return` coupé par un bloc multiligne. Elle ne change rien
   pour content.js et adblock.js, qui n'ont pas de retour au premier niveau. */
const OPTIONS = { ecmaVersion: 'latest', sourceType: 'script',
                  allowReturnOutsideFunction: true };

/* Ce qui reste, quoi qu'il arrive. La casse est ignorée, et « licence » est
   cherché dans ses deux orthographes : le dépôt écrit en français, la notice
   d'amont en anglais. */
const LEGAL = /copyright|licen[cs]e/i;

/* Les séparateurs de ligne au sens de la grammaire : LF, CR, et les deux
   séparateurs Unicode que le tokenizer traite comme tels. */
const SAUT = /[\n\r\u2028\u2029]/;

/* La feuille de style vit DANS un littéral de gabarit — `const CSS = ...` —
   c'est-à-dire, pour acorn, à l'intérieur d'une chaîne. Ses 77 commentaires ne
   sont donc pas des commentaires JavaScript, et le retrait ci-dessus ne les
   voit pas. Il faut un second passage, qui parle CSS.

   Ce passage est CIBLÉ par le nom de la variable, et c'est délibéré. Balayer
   tous les littéraux de gabarit abîmerait le jour où l'un d'eux porterait du
   SVG ou du HTML contenant la séquence « /* » : là, ce n'est pas un
   commentaire, et le retirer changerait ce qui s'affiche. Aujourd'hui un seul
   littéral du fichier contient cette séquence, et c'est bien CSS. Si on le
   renommait, le retrait cesserait — silencieusement, mais sans rien casser, et
   le banc mesure le gain propre au CSS pour s'en apercevoir. */
const NOM_CSS = /css/i;

/* Les caractères qui composent un jeton CSS. En retirer un commentaire qui les
   sépare RECOLLERAIT deux jetons — « foo/*x*\/bar » vaut deux identifiants et
   deviendrait « foobar », un seul. Le remplacer par une espace ne sauve rien :
   dans un sélecteur, « .a/*x*\/.b » vaut « .a.b » et l'espace en ferait « .a
   .b », qui désigne autre chose. Aucun des deux remplacements n'est juste dans
   tous les cas, donc on ne retire QUE les commentaires dont au moins un côté
   est déjà une espace — les 77 de ce fichier le sont. Les autres restent, et
   c'est un commentaire de trop, jamais une règle changée. */
const JETON_CSS = /[\w%#.-]/;

/** Un fragment de CSS sans ses commentaires. Les chaînes sont respectées. */
export function sansCommentairesCss(texte) {
  let out = '', i = 0, chaine = null;
  while (i < texte.length) {
    const c = texte[i];
    if (chaine) {
      if (c === '\\') { out += texte.slice(i, i + 2); i += 2; continue; }
      if (c === chaine) chaine = null;
      out += c; i++; continue;
    }
    if (c === '"' || c === '\'') { chaine = c; out += c; i++; continue; }
    if (c === '/' && texte[i + 1] === '*') {
      const fin = texte.indexOf('*/', i + 2);
      // Pas de fermeture dans ce fragment : le commentaire déborde sur une
      // interpolation, ou n'en est pas un. On ne touche à rien.
      if (fin === -1) { out += texte.slice(i); break; }
      // Aux deux bords du fragment, on suppose le pire : de l'autre côté il y
      // a une interpolation, donc peut-être un jeton.
      const avant = out.length ? out[out.length - 1] : 'x';
      const apres = fin + 2 < texte.length ? texte[fin + 2] : 'x';
      if (JETON_CSS.test(avant) && JETON_CSS.test(apres)) {
        out += texte.slice(i, fin + 2);      // collé des deux côtés : conservé
      }
      i = fin + 2; continue;
    }
    out += c; i++;
  }
  return out;
}

/** Le texte sans les commentaires CSS de ses littéraux de style. */
export function degraisserCss(source) {
  const ast = Parser.parse(source, OPTIONS);
  const morceaux = [];
  (function visite(n, parent) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'TemplateLiteral'
        && parent?.type === 'VariableDeclarator' && NOM_CSS.test(parent.id?.name ?? '')) {
      for (const q of n.quasis) morceaux.push([q.start, q.end]);
    }
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(x => visite(x, n));
      else if (v && typeof v.type === 'string') visite(v, n);
    }
  })(ast, null);

  let out = '', curseur = 0;
  for (const [a, b] of morceaux.sort((x, y) => x[0] - y[0])) {
    out += source.slice(curseur, a) + sansCommentairesCss(source.slice(a, b));
    curseur = b;
  }
  return out + source.slice(curseur);
}

/**
 * Le texte sans ses commentaires — JavaScript d'abord, CSS ensuite, mentions
 * légales exceptées.
 *
 * Les deux passes sont séparées et dans cet ordre : la première retire des
 * commentaires JS et déplace donc toutes les positions, la seconde reparcourt
 * le résultat pour y trouver le littéral de style. Les fusionner obligerait à
 * tenir deux jeux de positions dans la même boucle, pour rien.
 */
export function degraisser(source) {
  return degraisserCss(degraisserJs(source));
}

/** Le texte sans ses commentaires JAVASCRIPT, mentions légales exceptées. */
export function degraisserJs(source) {
  const comments = [];
  Parser.parse(source, { ...OPTIONS, onComment: comments });

  let out = '';
  let curseur = 0;
  for (const c of comments) {
    if (LEGAL.test(c.value)) continue;              // notice conservée telle quelle
    out += source.slice(curseur, c.start);
    /* Un bloc multiligne vaut saut de ligne pour l'ASI, et un bloc d'une seule
       ligne vaut au moins une espace : « typeof/* c *\/x » deviendrait sinon
       « typeofx », un identifiant. Le premier cas ne se voit pas dans le flux
       de jetons, le second s'y voit — on se garde des deux ici plutôt que de
       compter sur le contrôle en aval. */
    if (c.type === 'Block') out += SAUT.test(c.value) ? '\n' : ' ';
    curseur = c.end;
  }
  out += source.slice(curseur);

  /* Les lignes devenues vides, et elles sont légion : un bloc de quarante
     lignes en laisse une, mais quarante commentaires de ligne en laissent
     quarante. Toute suite de lignes blanches se réduit à une seule — jamais à
     zéro, pour que le fichier reste lisible par qui l'ouvrira. */
  return out.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
}

/** Combien de commentaires porte un texte, et combien sont des notices. */
export function compterCommentaires(source) {
  const c = [];
  Parser.parse(source, { ...OPTIONS, onComment: c });
  return { total: c.length, legaux: c.filter(x => LEGAL.test(x.value)).length };
}

/**
 * La preuve, et c'est elle qui autorise tout le reste : les deux textes
 * rendent-ils EXACTEMENT le même flux de jetons ?
 *
 * Comparer les octets ne dirait rien — ils diffèrent, c'est le but. Comparer
 * les arbres serait plus faible qu'il n'y paraît : un AST ne porte pas les
 * positions, donc deux fichiers dont l'ASI diffère peuvent partager le leur.
 * Les jetons, eux, sont ce que le moteur lit vraiment.
 *
 * Rend null si les deux flux sont identiques, sinon la première différence.
 *
 * UNE exception, et elle est nécessaire depuis que le CSS est dégraissé lui
 * aussi : le contenu d'un littéral de gabarit EST un jeton, valeur comprise.
 * Retirer un commentaire CSS le change donc, et la comparaison brute le
 * refuserait. On normalise les deux côtés de la même façon — commentaires CSS
 * retirés, espaces de fin et lignes blanches réduites — de sorte que l'écart
 * toléré à l'intérieur d'un gabarit soit EXACTEMENT celui qu'on s'autorise, ni
 * plus. Une lettre changée dans une règle échoue toujours.
 */
export function memeCode(avant, apres) {
  const normaliser = (label, valeur) => label !== 'template' ? valeur
    : sansCommentairesCss(valeur).replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
  const jetons = (src) => [...Parser.tokenizer(src, OPTIONS)]
    .map(t => JSON.stringify([t.type.label,
      t.value === undefined ? null : normaliser(t.type.label, String(t.value))]));
  const a = jetons(avant), b = jetons(apres);
  if (a.length !== b.length) return `${a.length} jetons avant, ${b.length} après`;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return `jeton ${i} : ${a[i]} → ${b[i]}`;
  }
  return null;
}
