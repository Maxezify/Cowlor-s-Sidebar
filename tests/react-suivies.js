/* ═════════ LE DÉCOR REACT (4.24.0.39) ═════════
   La section « Chaînes suivies » rendue par React 18 lui-même — chargé par
   page.html quand l'adresse porte `?react`.

   POURQUOI UN VRAI REACT. Le décor ordinaire pose des cartes que personne ne
   possède : on peut les déplacer, les sortir de leur parent, rien ne s'en
   plaint. Sur Twitch, React tient chacun de ces nœuds et les retrouve par
   leur parent — `removeChild`, `insertBefore` — quand il met la liste à jour.
   Un nœud qu'on a déplacé ailleurs, il ne le trouve plus : React lève une
   erreur, et la limite d'erreur qui entoure la section la démonte. C'est la
   section suivie qui disparaissait, et le banc ne pouvait pas le voir sans
   le propriétaire des nœuds.

   CE QUI EST MODÉLISÉ, ET CE QUI NE L'EST PAS. Le balisage de la carte est
   celui de __addCard. Chaque entrée peut avoir son enveloppe — un bloc et
   un nœud sans classe —, et une chaîne en direct et une chaîne hors ligne
   sont deux COMPOSANTS : passer de l'un à l'autre démonte la carte et en
   monte une neuve à sa place. La limite d'erreur rend la section vide et
   note l'erreur. Ce sont des hypothèses sur Twitch, pas un relevé : elles
   reproduisent ce que les captures ont montré — le doublon d'une coupure,
   la section disparue.

   window.__rx.set([{ login, nom, cat, v, live }...], { enveloppes })
     — l'ordre est celui de TWITCH ;
   window.__rx.vider() — React ne rend plus la section (sa disparition) ;
   window.__rxErreurs — les erreurs que la limite a attrapées. */
(() => {
  const statique = document.querySelector('.side-nav-section[aria-label="Chaînes suivies"]');
  const hote = document.createElement('div');
  hote.id = 'rx-suivies';
  statique.replaceWith(hote);

  const e = React.createElement;
  window.__rxErreurs = [];
  class Limite extends React.Component {
    constructor(p) { super(p); this.state = { err: null }; }
    static getDerivedStateFromError(err) { return { err }; }
    componentDidCatch(err) { window.__rxErreurs.push(String((err && err.message) || err)); }
    render() { return this.state.err ? null : this.props.children; }
  }
  const carte = (c, live) => e('div', { className: 'side-nav-card' },
    e('a', { className: 'side-nav-card__link', 'data-a-target': 'side-nav-card', id: 'nav-' + c.login,
             'aria-label': c.login + ', ' + c.cat, 'data-test-selector': 'followed-channel', href: '/' + c.login },
      e('div', { className: 'side-nav-card__avatar' + (live ? '' : ' side-nav-card__avatar--offline') },
        e('figure', { className: 'tw-avatar' },
          e('img', { className: 'tw-image-avatar', alt: '', src: 'https://cdn/' + c.login + '.png' }))),
      e('div', { className: 'mainblock' }, e('div', { className: 'metacell' },
        e('div', { 'data-a-target': 'side-nav-card-metadata' },
          e('div', { className: 'side-nav-card__metadata' },
            e('p', { 'data-a-target': 'side-nav-title' }, c.nom || c.login),
            c.cat ? e('p', { title: c.cat }, c.cat) : null)),
        e('div', { className: 'side-nav-card__live-status' }, e('div', null, e('div', null,
          live ? e('span', { className: 'tw-channel-status-indicator' }) : null,
          e('span', { 'aria-hidden': 'true' }, live ? c.v : 'Déconnecté'),
          e('p', { className: 'sr-only' }, (live ? c.v : 'Déconnecté') + ' spectateurs'))))))));
  const CarteLive = ({ c }) => carte(c, true);
  const CarteHors = ({ c }) => carte(c, false);
  const Entree = ({ c, env }) => {
    const k = e(c.live ? CarteLive : CarteHors, { c });
    return env ? e('div', { className: 'tw-transition' }, e('div', null, k)) : k;
  };
  const Section = ({ liste, env }) => e('div', { className: 'side-nav-section', 'aria-label': 'Chaînes suivies' },
    e('div', { className: 'followed-side-nav-header followed-side-nav-header--expanded' },
      e('button', { 'aria-expanded': 'false', 'aria-label': 'Trier par' },
        e('div', { className: 'followed-side-nav-header__dropdown-trigger' },
          e('div', { 'data-a-target': 'side-nav-header-expanded' }, e('h3', null, 'Chaînes suivies'))))),
    e('div', { className: 'tw-transition-group', id: 'rx-liste' },
      liste.map((c) => e(Entree, { key: c.login, c, env }))),
    e('button', { 'data-a-target': 'side-nav-show-more-button' }, 'Afficher plus'));

  const racine = ReactDOM.createRoot(hote);
  const rendre = (x) => ReactDOM.flushSync(() => racine.render(x));
  window.__rx = {
    set(liste, { enveloppes = true } = {}) {
      rendre(e(Limite, null, e(Section, { liste, env: enveloppes })));
    },
    vider() { rendre(null); },
    present: () => !!hote.querySelector('.side-nav-section'),
  };
})();
