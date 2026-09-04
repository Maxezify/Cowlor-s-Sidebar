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

/** Le texte sans ses commentaires, mentions légales exceptées. */
export function degraisser(source) {
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
 */
export function memeCode(avant, apres) {
  const jetons = (src) => [...Parser.tokenizer(src, OPTIONS)]
    .map(t => JSON.stringify([t.type.label, t.value === undefined ? null : String(t.value)]));
  const a = jetons(avant), b = jetons(apres);
  if (a.length !== b.length) return `${a.length} jetons avant, ${b.length} après`;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return `jeton ${i} : ${a[i]} → ${b[i]}`;
  }
  return null;
}
