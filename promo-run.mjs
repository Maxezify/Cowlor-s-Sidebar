import { scene, browser, ABOS } from './promo.mjs';

/* Cinq captures, et cinq seulement : c'est le maximum que le Chrome Web Store
   accepte. Il en sortait six, dont une restait au vestiaire — et la fiche
   choisissait donc, chaque fois, ce qu'elle n'allait PAS montrer. Cinq images
   écrites pour être cinq valent mieux qu'un tri fait après coup.

   L'ordre n'est pas un classement de nos préférences mais de ce que quelqu'un
   qui ne connaît pas l'extension a besoin de voir, dans l'ordre où il le
   regarde :

     1. L'APERÇU — la fonction phare, et la seule image que TOUT LE MONDE voit,
        puisque c'est elle que la vignette du Store montre. Elle doit donc dire
        à la fois « c'est une barre latérale Twitch » et « voilà ce qu'elle
        fait de mieux ». D'où le plan empilé : la barre ET l'aperçu, tous deux
        photographiés, sous un titre qui prend toute la largeur.
     2. LA CARTE — la valeur de tous les jours, celle qu'on voit sans rien
        faire : durée, co-streams, subathons.
     3. LA FRISE — la fonction qu'on ne trouve nulle part ailleurs, et celle
        qui demande le plus à être montrée pour être comprise.
     4. TOP CHAÎNES — la portée : l'extension ne s'arrête pas aux chaînes
        suivies.
     5. LES ABONNEMENTS — le plus personnel, et la place où la promesse de vie
        privée se dit le mieux, puisque c'est là qu'on parle de ce que
        l'extension sait de vous.

   Chaînes INVENTÉES : aucune identité réelle empruntée, aucun endossement
   suggéré. */

/* Le décor est une seule fonction, sérialisée vers la page : elle ne peut donc
   fermer sur rien. Elle reçoit la scène à monter et les titres traduits, et
   n'installe QUE ce que cette scène montre — une carte de subathon dans la
   scène du subathon, des chapitres de VOD dans celle de la frise. Un décor
   commun à cinq scènes obligerait chacune à composer avec les autres. */
const DECOR = ({ scene, titres }) => {
  const h = (min) => new Date(Date.now() - min * 60_000).toISOString();
  const c = (l, cat, v) => window.__addCard(l, cat, v);
  // Co-stream Guest Star entre kiraplays (hôte) et atlasgaming (invitée).
  const costream = () => {
    const invites = [
      { id: '102', login: 'kiraplays',   viewers: 9310, combined: 15570 },
      { id: '103', login: 'atlasgaming', viewers: 6240, combined: 15570 },
    ];
    window.__gs = {
      '102': { hostId: '102', hostLogin: 'kiraplays', guests: invites },
      '103': { hostId: '102', hostLogin: 'kiraplays', guests: invites },
    };
  };

  if (scene === 'apercu') {
    window.__fx = {
      novaflux:    { id:'101', createdAt:h(259), viewers:18420, game:'Just Chatting',
                     tags:['Français'], title:titres.novaflux },
      kiraplays:   { id:'102', createdAt:h(132), viewers:9310,  game:'League of Legends',
                     tags:['Français'], title:titres.kiraplays },
      atlasgaming: { id:'103', createdAt:h(94),  viewers:6240,  game:'Valorant', tags:['Français'] },
      mirabelle:   { id:'104', createdAt:h(311), viewers:4180,  game:'Art',      tags:['Français'] },
      orionwave:   { id:'105', createdAt:h(3),   viewers:2870,  game:'Minecraft',tags:['Français'] },
    };
    costream();
    c('novaflux','Just Chatting','18,4 k');
    c('kiraplays','League of Legends','15,5 k');
    c('atlasgaming','League of Legends','15,5 k');
    c('mirabelle','Art','4,1 k');
    c('orionwave','Minecraft','2,8 k');
    return;
  }

  if (scene === 'carte') {
    window.__fx = {
      aurorelys:   { id:'109', createdAt:h(1094), viewers:24310, game:'Just Chatting',
                     tags:['Français'], title:titres.aurorelys },
      kiraplays:   { id:'102', createdAt:h(132), viewers:9310,  game:'League of Legends',
                     tags:['Français'], title:titres.kiraplays },
      atlasgaming: { id:'103', createdAt:h(94),  viewers:6240,  game:'Valorant', tags:['Français'] },
      mirabelle:   { id:'104', createdAt:h(311), viewers:4180,  game:'Art',      tags:['Français'] },
      orionwave:   { id:'105', createdAt:h(3),   viewers:2870,  game:'Minecraft',tags:['Français'] },
    };
    costream();
    c('aurorelys','Just Chatting','24,3 k');
    c('kiraplays','League of Legends','15,5 k');
    c('atlasgaming','League of Legends','15,5 k');
    c('mirabelle','Art','4,1 k');
    c('orionwave','Minecraft','2,8 k');
    return;
  }

  if (scene === 'frise') {
    /* Sept heures vingt de direct, huit basculements, cinq catégories — dont
       une revisitée trois fois, une autre deux. Cinq et non trois : la liste
       occupe alors la moitié du panneau au lieu du quart, et c'est elle le
       sujet de l'image — la zone vidéo, elle, ne dit rien de plus grande que
       petite. Cinq reste sous les huit lignes que la palette de la frise peut
       tenir, au-delà desquelles les dernières se replient en « + N autres
       catégories » ; on montre ici la frise entière.
       Les chapitres du VOD sont la source la PLUS sûre de la frise : les
       durées de l'image sont donc exactes, et c'est bien ce qu'on veut montrer
       d'une fonction dont l'argument est de ne jamais inventer un chiffre. */
    window.__fx = {
      novaflux:    { id:'101', createdAt:h(440), viewers:18420, game:'Elden Ring',
                     tags:['Français'], title:titres.novaflux },
      mirabelle:   { id:'104', createdAt:h(311), viewers:4180,  game:'Art',      tags:['Français'] },
      orionwave:   { id:'105', createdAt:h(3),   viewers:2870,  game:'Minecraft',tags:['Français'] },
    };
    window.__vod = {
      novaflux: { createdAt: h(440), chapitres: [
        { pos: 0,             jeu: 'Just Chatting' },
        { pos:  40 * 60_000,  jeu: 'Elden Ring' },
        { pos: 135 * 60_000,  jeu: 'Just Chatting' },
        { pos: 160 * 60_000,  jeu: 'Hades II' },
        { pos: 230 * 60_000,  jeu: 'Art' },
        { pos: 285 * 60_000,  jeu: 'Just Chatting' },
        { pos: 315 * 60_000,  jeu: 'Minecraft' },
        { pos: 380 * 60_000,  jeu: 'Elden Ring' }] },
    };
    c('novaflux','Elden Ring','18,4 k');
    c('mirabelle','Art','4,1 k');
    c('orionwave','Minecraft','2,8 k');
    return;
  }

  if (scene === 'top') {
    window.__fx = {
      novaflux:    { id:'101', createdAt:h(259), viewers:18420, game:'Just Chatting',
                     tags:['Français'], title:titres.novaflux },
      kiraplays:   { id:'102', createdAt:h(132), viewers:9310,  game:'League of Legends',
                     tags:['Français'], title:titres.kiraplays },
      atlasgaming: { id:'103', createdAt:h(94),  viewers:6240,  game:'Valorant', tags:['Français'] },
      mirabelle:   { id:'104', createdAt:h(311), viewers:4180,  game:'Art',      tags:['Français'] },
      orionwave:   { id:'105', createdAt:h(3),   viewers:2870,  game:'Minecraft',tags:['Français'] },
    };
    costream();
    c('novaflux','Just Chatting','18,4 k');
    c('kiraplays','League of Legends','15,5 k');
    c('atlasgaming','League of Legends','15,5 k');
    c('mirabelle','Art','4,1 k');
    c('orionwave','Minecraft','2,8 k');
    /* Classement mondial. SEPT chaînes, et le nombre est réfléchi : au-delà,
       la liste dépasse les sept cents pixels de la zone et l'échelle du cadre
       tombe pour la faire tenir — les cartes de cette image sortiraient plus
       petites que celles des quatre autres. À sept, le cadre garde sa taille
       et déborde tout juste : le fondu du bas dit alors ce qu'il faut dire,
       « la liste continue », ce qu'un cadrage au ras de la dernière carte
       n'aurait pas dit du tout pour un classement qui en compte trente.
       createdAt EXPLICITE : sans lui le stub date les streams du 1er janvier
       et les cartes affichent des milliers d'heures. */
    window.__cats = [
      { name:'Just Chatting', viewers:412_000, streams:[
        { login:'solstice_tv', viewers:64_200, createdAt:h(196), tags:['Français'] },
        { login:'novaflux',    viewers:18_420, createdAt:h(259), tags:['Français'] },
        { login:'valehart',    viewers:12_050, createdAt:h(38),  tags:['Français'] }] },
      { name:'League of Legends', viewers:288_000, streams:[
        { login:'kiraplays',   viewers:15_570, createdAt:h(132), tags:['Français'] },
        { login:'zephyrlane',  viewers:31_400, createdAt:h(87),  tags:['Français'] }] },
      { name:'GTA V', viewers:196_000, streams:[
        { login:'ravencourt',  viewers:27_800, createdAt:h(421), tags:['Français'] }] },
      { name:'Valorant', viewers:151_000, streams:[
        { login:'atlasgaming', viewers:6_240,  createdAt:h(94),  tags:['Français'] }] },
    ];
    return;
  }

  if (scene === 'abo') {
    /* Trois des cinq chaînes sont dans la mémoire d'abonnements — kiraplays,
       mirabelle et lumenkai. Les neuf autres de cette mémoire n'émettent pas :
       elles ne se voient que par le total porté par la pastille du tri, qui
       est justement ce que cette pastille compte. Pas de co-stream ici : il
       regrouperait deux cartes et brouillerait le seul regroupement que cette
       image doit montrer, celui de l'or. */
    window.__fx = {
      novaflux:    { id:'101', createdAt:h(259), viewers:18420, game:'Just Chatting',
                     tags:['Français'], title:titres.novaflux },
      kiraplays:   { id:'102', createdAt:h(132), viewers:15570, game:'League of Legends',
                     tags:['Français'], title:titres.kiraplays },
      mirabelle:   { id:'104', createdAt:h(311), viewers:4180,  game:'Art',      tags:['Français'] },
      orionwave:   { id:'105', createdAt:h(3),   viewers:2870,  game:'Minecraft',tags:['Français'] },
      lumenkai:    { id:'108', createdAt:h(76),  viewers:980,   game:'Just Chatting', tags:['Deutsch'] },
    };
    c('novaflux','Just Chatting','18,4 k');
    c('kiraplays','League of Legends','15,5 k');
    c('mirabelle','Art','4,1 k');
    c('orionwave','Minecraft','2,8 k');
    c('lumenkai','Just Chatting','980');
    return;
  }

  throw new Error('scène inconnue : ' + scene);
};

/* Le discours, fiche par fiche. Cinq entrées de quatre champs : le chapô, le
   titre (dont les coupures sont ÉCRITES, une par <br>, et vérifiées sur le
   rendu), les trois points, la ligne de marque.

   Les titres de stream, eux, sont des fixtures et non du discours — mais ils
   sont traduits quand même, parce qu'une capture japonaise dont le seul texte
   libre serait en français ne ressemblerait à rien. Deux d'entre eux portent
   un numéro de jour, et c'est délibéré : « — jour 12 » sur kiraplays montre
   qu'un chiffre de jour NE SUFFIT PAS à faire un subathon (rien ne décore
   cette carte), là où « Subathon jour 9 » sur aurorelys en fait un. Le mot
   « Subathon » est écrit en alphabet latin dans les douze, y compris en russe,
   en japonais et en chinois : c'est ainsi que les chaînes l'écrivent, et c'est
   la seule graphie que la détection reconnaisse par son nom. */
const T = {
  fr: { ui:'fr', section:'fr',
    titres:{ novaflux:'On refait le monde, et après on joue',
             kiraplays:'Objectif Master avant la fin du mois — jour 12',
             aurorelys:'Subathon jour 9 — on ne dort plus' },
    apercu:['Aperçu au survol', 'Regardez <em>avant</em><br>de cliquer.',
      ['<b>Le stream en direct</b> — le vrai flux, pas une miniature figée',
       '<b>Le titre complet</b> — lisible avant même le clic',
       '<b>Le contexte en badges</b> — abonnement, co-stream, sponsor, Hype Train'],
      "<b>Cowlor's Sidebar</b> · gratuit, sans compte, sans pub"],
    carte: ["En un coup d'œil", 'Votre sidebar<br>vous <em>dit tout</em>.',
      ['<b>La durée du direct</b> — sous les spectateurs, mise à jour en continu',
       '<b>Les co-streams colorés</b> — qui joue avec qui, sans rien survoler',
       '<b>Les subathons repérés</b> — le jour en cours, contre le pseudo'],
      "<b>Cowlor's Sidebar</b> · et le fouillis de Twitch en moins"],
    frise: ['Précédemment sur ce live', "Ce qui s'est passé<br><em>avant</em> vous.",
      ['<b>Tout le parcours</b> — chaque catégorie traversée, et sa durée',
       "<b>À l'échelle</b> — la largeur d'une bande, c'est du temps réel",
       '<b>Sans rien inventer</b> — une heure incertaine, et la couleur se fond'],
      "<b>Cowlor's Sidebar</b> · jamais un chiffre inventé"],
    top:   ['Top Chaînes', 'Tout Twitch,<br>dans <em>votre</em> sidebar.',
      ['<b>Le classement mondial</b> — les 30 plus regardées, recalculé en continu',
       '<b>Par catégorie, par langue</b> — un vrai top 30 pour chacune',
       '<b>Tout le reste suit</b> — aperçu, durée, badges : des cartes comme les autres'],
      "<b>Cowlor's Sidebar</b> · un clic pour y aller, un clic pour revenir"],
    abo:   ['Abonnements', 'La barre sait qui<br>vous <em>soutenez</em>.',
      ['<b>En or, regroupés en tête</b> — un tri rien que pour eux',
       '<b>Depuis combien de mois</b> — au survol, même les abonnements expirés',
       '<b>Six tris, deux filtres</b> — catégorie, langue, durée, popularité perso'],
      "<b>Cowlor's Sidebar</b> · lu dans votre navigateur, jamais envoyé ailleurs"] },

  en: { ui:'en', section:'en',
    titres:{ novaflux:'Putting the world to rights, then we play',
             kiraplays:'Road to Master before the month ends — day 12',
             aurorelys:'Subathon day 9 — nobody sleeps tonight' },
    apercu:['Hover preview', 'Watch <em>before</em><br>you click.',
      ['<b>The live stream</b> — the real feed, not a frozen thumbnail',
       '<b>The full title</b> — readable before you click',
       '<b>The context in badges</b> — subscription, co-stream, sponsor, Hype Train'],
      "<b>Cowlor's Sidebar</b> · free, no account, no ads"],
    carte: ['At a glance', 'Your sidebar<br><em>tells you</em> more.',
      ['<b>Stream uptime</b> — under the viewer count, updated continuously',
       '<b>Colour-coded co-streams</b> — who plays with whom, no hovering',
       '<b>Subathons spotted</b> — the current day, right beside the name'],
      "<b>Cowlor's Sidebar</b> · and Twitch's clutter gone"],
    frise: ['Previously on this stream', 'What you<br><em>missed</em> so far.',
      ['<b>The whole run</b> — every category played, and how long it lasted',
       '<b>To scale</b> — the width of a band is real time',
       '<b>Nothing invented</b> — when the time is uncertain, the colour fades'],
      "<b>Cowlor's Sidebar</b> · never a made-up number"],
    top:   ['Top Channels', 'All of Twitch,<br>in <em>your</em> sidebar.',
      ['<b>The global ranking</b> — the 30 most watched, recomputed continuously',
       '<b>By category, by language</b> — a real top 30 for each',
       '<b>Everything else follows</b> — preview, uptime, badges: ordinary cards'],
      "<b>Cowlor's Sidebar</b> · one click there, one click back"],
    abo:   ['Subscriptions', 'Your sidebar knows<br>who you <em>support</em>.',
      ['<b>Gilded, grouped on top</b> — a sort just for them',
       '<b>How many months in</b> — on hover, expired ones too',
       '<b>Six sorts, two filters</b> — category, language, uptime, your own top'],
      "<b>Cowlor's Sidebar</b> · read in your browser, never sent anywhere"] },

  de: { ui:'de', section:'de',
    titres:{ novaflux:'Wir lösen die Weltprobleme, dann wird gespielt',
             kiraplays:'Auf zu Master vor Monatsende — Tag 12',
             aurorelys:'Subathon Tag 9 — keiner schläft mehr' },
    apercu:['Vorschau beim Überfahren', 'Schau hin,<br><em>bevor</em> du klickst.',
      ['<b>Der Stream live</b> — der echte Feed, kein eingefrorenes Standbild',
       '<b>Der ganze Titel</b> — lesbar, bevor du klickst',
       '<b>Der Kontext als Badge</b> — Abo, Co-Stream, Sponsor, Hype Train'],
      "<b>Cowlor's Sidebar</b> · gratis, ohne Konto, ohne Werbung"],
    carte: ['Auf einen Blick', 'Deine Sidebar<br><em>sagt dir</em> mehr.',
      ['<b>Die Stream-Dauer</b> — unter den Zuschauern, laufend aktualisiert',
       '<b>Farbige Co-Streams</b> — wer mit wem spielt, ganz ohne Überfahren',
       '<b>Erkannte Subathons</b> — der laufende Tag, direkt am Namen'],
      "<b>Cowlor's Sidebar</b> · und das Durcheinander ist weg"],
    frise: ['Was bisher geschah', 'Was du bisher<br><em>verpasst</em> hast.',
      ['<b>Der ganze Verlauf</b> — jede gespielte Kategorie und ihre Dauer',
       '<b>Maßstabsgetreu</b> — die Breite eines Streifens ist echte Zeit',
       '<b>Nichts erfunden</b> — ist die Uhrzeit unsicher, verläuft die Farbe'],
      "<b>Cowlor's Sidebar</b> · nie eine erfundene Zahl"],
    top:   ['Top-Kanäle', 'Ganz Twitch,<br>in <em>deiner</em> Sidebar.',
      ['<b>Die weltweite Rangliste</b> — die 30 meistgesehenen, laufend neu berechnet',
       '<b>Nach Kategorie, nach Sprache</b> — je eine echte Top 30',
       '<b>Alles andere bleibt</b> — Vorschau, Dauer, Badges: Karten wie alle'],
      "<b>Cowlor's Sidebar</b> · ein Klick hin, ein Klick zurück"],
    abo:   ['Abos', 'Deine Sidebar<br>kennt deine <em>Abos</em>.',
      ['<b>Golden, oben gruppiert</b> — eine Sortierung nur für sie',
       '<b>Seit wie vielen Monaten</b> — beim Überfahren, auch abgelaufene',
       '<b>Sechs Sortierungen, zwei Filter</b> — Kategorie, Sprache, Dauer, Beliebtheit'],
      "<b>Cowlor's Sidebar</b> · im Browser gelesen, nie irgendwohin gesendet"] },

  es: { ui:'es', section:'es',
    titres:{ novaflux:'Arreglamos el mundo y luego jugamos',
             kiraplays:'Camino a Master antes de fin de mes — día 12',
             aurorelys:'Subathon día 9 — ya nadie duerme' },
    apercu:['Vista previa al pasar', 'Mira <em>antes</em><br>de hacer clic.',
      ['<b>El directo de verdad</b> — el flujo en vivo, no una miniatura congelada',
       '<b>El título completo</b> — legible antes de hacer clic',
       '<b>El contexto en insignias</b> — suscripción, co-stream, patrocinio, Hype Train'],
      "<b>Cowlor's Sidebar</b> · gratis, sin cuenta, sin anuncios"],
    carte: ['De un vistazo', 'Tu barra lateral<br><em>te cuenta</em> más.',
      ['<b>La duración del directo</b> — bajo los espectadores, siempre al día',
       '<b>Co-streams con color</b> — quién juega con quién, sin pasar por encima',
       '<b>Subatones detectados</b> — el día en curso, junto al nombre'],
      "<b>Cowlor's Sidebar</b> · y sin el desorden de Twitch"],
    frise: ['Anteriormente en este directo', 'Lo que pasó<br><em>antes</em> de llegar.',
      ['<b>Todo el recorrido</b> — cada categoría jugada y lo que duró',
       '<b>A escala</b> — el ancho de una banda es tiempo real',
       '<b>Sin inventar nada</b> — si la hora es incierta, el color se funde'],
      "<b>Cowlor's Sidebar</b> · nunca una cifra inventada"],
    top:   ['Top Canales', 'Todo Twitch, en <em>tu</em><br>barra lateral.',
      ['<b>La clasificación mundial</b> — los 30 más vistos, recalculado sin parar',
       '<b>Por categoría, por idioma</b> — un top 30 de verdad para cada uno',
       '<b>Todo lo demás sigue</b> — vista previa, duración, insignias: tarjetas normales'],
      "<b>Cowlor's Sidebar</b> · un clic para ir, un clic para volver"],
    abo:   ['Suscripciones', 'Tu barra sabe<br>a quién <em>apoyas</em>.',
      ['<b>Doradas y arriba del todo</b> — un orden solo para ellas',
       '<b>Cuántos meses llevas</b> — al pasar por encima, también las caducadas',
       '<b>Seis órdenes, dos filtros</b> — categoría, idioma, duración, popularidad'],
      "<b>Cowlor's Sidebar</b> · se lee en tu navegador, nunca se envía a ningún sitio"] },

  es419: { ui:'es', section:'es',
    titres:{ novaflux:'Arreglamos el mundo y después jugamos',
             kiraplays:'Camino a Master antes de fin de mes — día 12',
             aurorelys:'Subathon día 9 — ya nadie duerme' },
    apercu:['Vista previa al pasar', 'Mirá <em>antes</em><br>de hacer clic.',
      ['<b>El vivo de verdad</b> — el flujo en vivo, no una miniatura congelada',
       '<b>El título completo</b> — legible antes de hacer clic',
       '<b>El contexto en insignias</b> — suscripción, co-stream, patrocinio, Hype Train'],
      "<b>Cowlor's Sidebar</b> · gratis, sin cuenta, sin anuncios"],
    carte: ['De un vistazo', 'Tu barra lateral<br><em>te cuenta</em> más.',
      ['<b>La duración del vivo</b> — bajo los espectadores, siempre al día',
       '<b>Co-streams con color</b> — quién juega con quién, sin pasar por encima',
       '<b>Subatones detectados</b> — el día en curso, junto al nombre'],
      "<b>Cowlor's Sidebar</b> · y sin el desorden de Twitch"],
    frise: ['Anteriormente en este vivo', 'Lo que pasó<br><em>antes</em> de llegar.',
      ['<b>Todo el recorrido</b> — cada categoría jugada y lo que duró',
       '<b>A escala</b> — el ancho de una banda es tiempo real',
       '<b>Sin inventar nada</b> — si la hora es incierta, el color se funde'],
      "<b>Cowlor's Sidebar</b> · nunca una cifra inventada"],
    top:   ['Top Canales', 'Todo Twitch, en <em>tu</em><br>barra lateral.',
      ['<b>La clasificación mundial</b> — los 30 más vistos, recalculado sin parar',
       '<b>Por categoría, por idioma</b> — un top 30 de verdad para cada uno',
       '<b>Todo lo demás sigue</b> — vista previa, duración, insignias: tarjetas normales'],
      "<b>Cowlor's Sidebar</b> · un clic para ir, un clic para volver"],
    abo:   ['Suscripciones', 'Tu barra sabe<br>a quién <em>apoyás</em>.',
      ['<b>Doradas y arriba del todo</b> — un orden solo para ellas',
       '<b>Cuántos meses llevás</b> — al pasar por encima, también las vencidas',
       '<b>Seis órdenes, dos filtros</b> — categoría, idioma, duración, popularidad'],
      "<b>Cowlor's Sidebar</b> · se lee en tu navegador, nunca se envía a ningún lado"] },

  ptbr: { ui:'pt', section:'ptbr',
    titres:{ novaflux:'Resolvendo o mundo e depois a gente joga',
             kiraplays:'Rumo ao Mestre antes do fim do mês — dia 12',
             aurorelys:'Subathon dia 9 — ninguém dorme mais' },
    apercu:['Prévia ao passar o mouse', 'Veja <em>antes</em><br>de clicar.',
      ['<b>A live de verdade</b> — o fluxo ao vivo, não uma miniatura parada',
       '<b>O título completo</b> — legível antes do clique',
       '<b>O contexto em selos</b> — inscrição, co-stream, patrocínio, Hype Train'],
      "<b>Cowlor's Sidebar</b> · grátis, sem conta, sem anúncios"],
    carte: ['Num relance', 'Sua barra lateral<br><em>conta</em> mais.',
      ['<b>O tempo de live</b> — abaixo dos espectadores, sempre atualizado',
       '<b>Co-streams coloridos</b> — quem joga com quem, sem passar o mouse',
       '<b>Subathons detectados</b> — o dia atual, ao lado do nome'],
      "<b>Cowlor's Sidebar</b> · e a bagunça da Twitch de fora"],
    frise: ['Anteriormente nesta live', 'O que rolou<br><em>antes</em> de você.',
      ['<b>O percurso inteiro</b> — cada categoria jogada e quanto durou',
       '<b>Em escala</b> — a largura de uma faixa é tempo real',
       '<b>Sem inventar nada</b> — hora incerta, e a cor se dissolve'],
      "<b>Cowlor's Sidebar</b> · nunca um número inventado"],
    top:   ['Top Canais', 'A Twitch inteira,<br>na <em>sua</em> barra.',
      ['<b>O ranking mundial</b> — os 30 mais assistidos, recalculado sempre',
       '<b>Por categoria, por idioma</b> — um top 30 de verdade para cada',
       '<b>O resto continua</b> — prévia, tempo, selos: cartões como os outros'],
      "<b>Cowlor's Sidebar</b> · um clique para ir, um para voltar"],
    abo:   ['Inscrições', 'Sua barra sabe<br>quem você <em>apoia</em>.',
      ['<b>Douradas, agrupadas no topo</b> — uma ordem só para elas',
       '<b>Há quantos meses</b> — ao passar o mouse, até as que expiraram',
       '<b>Seis ordens, dois filtros</b> — categoria, idioma, tempo, popularidade'],
      "<b>Cowlor's Sidebar</b> · fica no seu navegador, e nunca sai de lá"] },

  ptpt: { ui:'pt', section:'ptpt',
    titres:{ novaflux:'A resolver o mundo e depois joga-se',
             kiraplays:'Rumo a Mestre antes do fim do mês — dia 12',
             aurorelys:'Subathon dia 9 — já ninguém dorme' },
    apercu:['Pré-visualização ao passar', 'Vê <em>antes</em><br>de clicares.',
      ['<b>A emissão a sério</b> — o fluxo em direto, não uma miniatura parada',
       '<b>O título completo</b> — legível antes do clique',
       '<b>O contexto em selos</b> — subscrição, co-stream, patrocínio, Hype Train'],
      "<b>Cowlor's Sidebar</b> · grátis, sem conta, sem anúncios"],
    carte: ['Num relance', 'A tua barra lateral<br><em>diz-te</em> mais.',
      ['<b>A duração da emissão</b> — por baixo dos espectadores, sempre atual',
       '<b>Co-streams coloridos</b> — quem joga com quem, sem passar por cima',
       '<b>Subathons detetados</b> — o dia em curso, ao lado do nome'],
      "<b>Cowlor's Sidebar</b> · e a confusão da Twitch de fora"],
    frise: ['Anteriormente nesta emissão', 'O que aconteceu<br><em>antes</em> de ti.',
      ['<b>O percurso inteiro</b> — cada categoria jogada e quanto durou',
       '<b>À escala</b> — a largura de uma faixa é tempo real',
       '<b>Sem inventar nada</b> — hora incerta, e a cor dissolve-se'],
      "<b>Cowlor's Sidebar</b> · nunca um número inventado"],
    top:   ['Top Canais', 'A Twitch inteira,<br>na <em>tua</em> barra.',
      ['<b>O ranking mundial</b> — os 30 mais vistos, recalculado sem parar',
       '<b>Por categoria, por idioma</b> — um top 30 a sério para cada',
       '<b>O resto continua</b> — pré-visualização, tempo, selos: cartões como os outros'],
      "<b>Cowlor's Sidebar</b> · um clique para ir, um para voltar"],
    abo:   ['Subscrições', 'A tua barra sabe<br>quem <em>apoias</em>.',
      ['<b>Douradas, agrupadas no topo</b> — uma ordem só para elas',
       '<b>Há quantos meses lá estás</b> — ao passares por cima, até as expiradas',
       '<b>Seis ordens, dois filtros</b> — categoria, idioma, tempo, popularidade'],
      "<b>Cowlor's Sidebar</b> · fica no teu navegador, e nunca sai de lá"] },

  it: { ui:'it', section:'it',
    titres:{ novaflux:'Sistemiamo il mondo, poi si gioca',
             kiraplays:'Obiettivo Master prima di fine mese — giorno 12',
             aurorelys:'Subathon giorno 9 — non si dorme più' },
    apercu:['Anteprima al passaggio', 'Guarda <em>prima</em><br>di cliccare.',
      ['<b>La diretta vera</b> — il flusso dal vivo, non una miniatura ferma',
       '<b>Il titolo completo</b> — leggibile prima del clic',
       '<b>Il contesto in badge</b> — abbonamento, co-stream, sponsor, Hype Train'],
      "<b>Cowlor's Sidebar</b> · gratis, senza account, senza pubblicità"],
    carte: ["A colpo d'occhio", 'La tua sidebar<br><em>ti dice</em> di più.',
      ['<b>La durata della diretta</b> — sotto gli spettatori, sempre aggiornata',
       '<b>Co-stream colorati</b> — chi gioca con chi, senza passarci sopra',
       '<b>Subathon riconosciuti</b> — il giorno in corso, accanto al nome'],
      "<b>Cowlor's Sidebar</b> · e il disordine di Twitch in meno"],
    frise: ['Precedentemente in diretta', "Cos'è successo<br><em>prima</em> di te.",
      ['<b>Tutto il percorso</b> — ogni categoria attraversata e quanto è durata',
       '<b>In scala</b> — la larghezza di una fascia è tempo reale',
       "<b>Senza inventare</b> — se l'ora è incerta, il colore sfuma"],
      "<b>Cowlor's Sidebar</b> · mai un numero inventato"],
    top:   ['Canali di punta', 'Tutto Twitch,<br>nella <em>tua</em> sidebar.',
      ['<b>La classifica mondiale</b> — i 30 più visti, ricalcolata di continuo',
       '<b>Per categoria, per lingua</b> — una vera top 30 per ciascuna',
       '<b>Tutto il resto segue</b> — anteprima, durata, badge: schede come le altre'],
      "<b>Cowlor's Sidebar</b> · un clic per andare, un clic per tornare"],
    abo:   ['Abbonamenti', 'La sidebar sa<br>chi <em>sostieni</em>.',
      ['<b>Dorati, raggruppati in cima</b> — un ordinamento solo per loro',
       '<b>Da quanti mesi ci sei</b> — al passaggio, anche quelli scaduti',
       '<b>Sei ordinamenti, due filtri</b> — categoria, lingua, durata, popolarità'],
      "<b>Cowlor's Sidebar</b> · letto nel tuo browser, mai inviato altrove"] },

  pl: { ui:'pl', section:'pl',
    titres:{ novaflux:'Naprawiamy świat, a potem gramy',
             kiraplays:'Droga do Mastera przed końcem miesiąca — dzień 12',
             aurorelys:'Subathon dzień 9 — nikt już nie śpi' },
    apercu:['Podgląd po najechaniu', 'Zobacz,<br><em>zanim</em> klikniesz.',
      ['<b>Transmisja na żywo</b> — prawdziwy obraz, nie zamrożona miniatura',
       '<b>Pełny tytuł</b> — czytelny jeszcze przed kliknięciem',
       '<b>Kontekst w plakietkach</b> — subskrypcja, co-stream, sponsor, Hype Train'],
      "<b>Cowlor's Sidebar</b> · za darmo, bez konta, bez reklam"],
    carte: ['Na pierwszy rzut oka', 'Twój pasek<br><em>mówi ci</em> więcej.',
      ['<b>Czas transmisji</b> — pod liczbą widzów, odświeżany na bieżąco',
       '<b>Kolorowe co-streamy</b> — kto gra z kim, bez najeżdżania',
       '<b>Wykryte subathony</b> — bieżący dzień, tuż przy nazwie'],
      "<b>Cowlor's Sidebar</b> · i bałaganu Twitcha mniej"],
    frise: ['Wcześniej na tej transmisji', 'Co się działo<br><em>przed</em> tobą.',
      ['<b>Cała trasa</b> — każda kategoria i to, ile trwała',
       '<b>W skali</b> — szerokość paska to prawdziwy czas',
       '<b>Nic zmyślonego</b> — gdy godzina jest niepewna, kolor się rozmywa'],
      "<b>Cowlor's Sidebar</b> · nigdy zmyślonej liczby"],
    top:   ['Najpopularniejsze kanały', 'Cały Twitch<br>w <em>twoim</em> pasku.',
      ['<b>Ranking światowy</b> — 30 najczęściej oglądanych, liczony bez przerwy',
       '<b>Według kategorii i języka</b> — prawdziwa trzydziestka dla każdego',
       '<b>Reszta działa dalej</b> — podgląd, czas, plakietki: zwykłe karty'],
      "<b>Cowlor's Sidebar</b> · jedno kliknięcie tam, jedno z powrotem"],
    abo:   ['Subskrypcje', 'Pasek wie,<br>kogo <em>wspierasz</em>.',
      ['<b>Złote, zebrane na górze</b> — sortowanie tylko dla nich',
       '<b>Od ilu miesięcy</b> — po najechaniu, także te wygasłe',
       '<b>Sześć sortowań, dwa filtry</b> — kategoria, język, czas, popularność'],
      "<b>Cowlor's Sidebar</b> · czytane w przeglądarce, nigdy nigdzie nie wysyłane"] },

  ru: { ui:'ru', section:'ru',
    titres:{ novaflux:'Решаем судьбы мира, потом играем',
             kiraplays:'Путь к Мастеру до конца месяца — день 12',
             aurorelys:'Subathon день 9 — уже никто не спит' },
    apercu:['Превью при наведении', 'Смотрите<br><em>до</em> клика.',
      ['<b>Живой эфир</b> — настоящий поток, а не застывшая картинка',
       '<b>Полное название</b> — читается ещё до клика',
       '<b>Контекст в значках</b> — подписка, ко-стрим, спонсор, Hype Train'],
      "<b>Cowlor's Sidebar</b> · бесплатно, без аккаунта, без рекламы"],
    carte: ['С одного взгляда', 'Ваша панель<br><em>знает</em> больше.',
      ['<b>Время эфира</b> — под числом зрителей, обновляется само',
       '<b>Цветные ко-стримы</b> — кто с кем играет, без наведения',
       '<b>Найденные сабатоны</b> — текущий день, рядом с именем'],
      "<b>Cowlor's Sidebar</b> · и без беспорядка Twitch"],
    frise: ['Ранее в этом эфире', 'Что было<br><em>до</em> вас.',
      ['<b>Весь путь</b> — каждая категория и сколько она длилась',
       '<b>В масштабе</b> — ширина полосы это реальное время',
       '<b>Ничего не выдумано</b> — время неточное, и цвет растворяется'],
      "<b>Cowlor's Sidebar</b> · никаких выдуманных цифр"],
    top:   ['Топ каналов', 'Весь Twitch<br>в <em>вашей</em> панели.',
      ['<b>Мировой рейтинг</b> — 30 самых просматриваемых, считается непрерывно',
       '<b>По категории и языку</b> — настоящий топ-30 для каждого',
       '<b>Всё остальное работает</b> — превью, время, значки: обычные карточки'],
      "<b>Cowlor's Sidebar</b> · один клик туда, один обратно"],
    abo:   ['Подписки', 'Панель знает<br>ваши <em>подписки</em>.',
      ['<b>Золотом и вверху списка</b> — сортировка только для них',
       '<b>Сколько месяцев вы рядом</b> — при наведении, даже истёкшие',
       '<b>Шесть сортировок, два фильтра</b> — категория, язык, время, популярность'],
      "<b>Cowlor's Sidebar</b> · читается в браузере, никуда не отправляется"] },

  ja: { ui:'ja', section:'ja',
    titres:{ novaflux:'世界を語り尽くしてから遊ぶ',
             kiraplays:'月末までにマスター到達へ — 12日目',
             aurorelys:'Subathon 9日目 — もう眠らない' },
    apercu:['ホバープレビュー', 'クリックの<br><em>前に</em>見る。',
      ['<b>本物のライブ映像</b> — 止まった画像ではなく、実際の配信',
       '<b>タイトルは全文</b> — クリックする前に読めます',
       '<b>文脈はバッジで</b> — サブスク、コラボ、スポンサー、Hype Train'],
      "<b>Cowlor's Sidebar</b> · 無料、アカウント不要、広告なし"],
    carte: ['ひと目で', 'サイドバーが<br><em>もっと</em>教えます。',
      ['<b>配信時間</b> — 視聴者数の下に、常に更新',
       '<b>色分けされたコラボ配信</b> — 誰と誰が一緒か、ホバー不要',
       '<b>サブアソンを検出</b> — 何日目かを名前のとなりに'],
      "<b>Cowlor's Sidebar</b> · Twitch の散らかりもなくなります"],
    frise: ['前回までのこの配信', 'あなたが来る<br><em>前</em>のできごと。',
      ['<b>すべての道のり</b> — 通過したカテゴリーと、その長さ',
       '<b>実寸で</b> — 帯の幅は、そのまま実際の時間',
       '<b>作り話はなし</b> — 時刻が不確かなら、色がにじみます'],
      "<b>Cowlor's Sidebar</b> · 数字をでっち上げません"],
    top:   ['トップチャンネル', 'Twitch のすべてを<br><em>あなたの</em><br>サイドバーに。',
      ['<b>世界の順位</b> — 視聴者数の多い30チャンネル、常に再計算',
       '<b>カテゴリー別、言語別</b> — それぞれに本物のトップ30',
       '<b>ほかは全部そのまま</b> — プレビュー、時間、バッジ：普通のカードです'],
      "<b>Cowlor's Sidebar</b> · 行くのも戻るのもワンクリック"],
    abo:   ['サブスク', '誰を<em>応援</em>して<br>いるか分かる。',
      ['<b>金色にして上にまとめる</b> — そのための並べ替え',
       '<b>何か月続いているか</b> — ホバーで、期限切れも',
       '<b>6つの並べ替え、2つの絞り込み</b> — カテゴリー、言語、時間、人気度'],
      "<b>Cowlor's Sidebar</b> · ブラウザーで読むだけ、どこにも送りません"] },

  zh: { ui:'zh', section:'zh',
    titres:{ novaflux:'先聊聊天下事，然后开打',
             kiraplays:'月底前冲上大师 — 第 12 天',
             aurorelys:'Subathon 第 9 天 — 不睡了' },
    apercu:['悬停预览', '点击前<br>先<em>看一眼</em>。',
      ['<b>真正的直播画面</b> — 是实时流，不是静止缩略图',
       '<b>完整的标题</b> — 点击之前就能读完',
       '<b>上下文用徽章说明</b> — 订阅、联合直播、赞助、Hype Train'],
      "<b>Cowlor's Sidebar</b> · 免费、无需账号、没有广告"],
    carte: ['一眼看清', '侧边栏<br><em>告诉你</em>更多。',
      ['<b>开播时长</b> — 就在观众数下面，持续更新',
       '<b>彩色的联合直播</b> — 谁和谁一起播，不用悬停',
       '<b>自动认出马拉松</b> — 第几天，就写在名字旁'],
      "<b>Cowlor's Sidebar</b> · 还少了 Twitch 的一堆杂乱"],
    frise: ['本场直播前情提要', '你来之前<br><em>发生</em>了什么。',
      ['<b>整段经过</b> — 每个玩过的分类，以及持续多久',
       '<b>按比例</b> — 色带的宽度就是真实时间',
       '<b>绝不编造</b> — 时间不确定时，颜色会渐隐'],
      "<b>Cowlor's Sidebar</b> · 从不编造数字"],
    top:   ['热门频道', '整个 Twitch，<br>都在<em>你的</em>侧边栏。',
      ['<b>全球排行</b> — 观看人数最多的 30 个，持续重新计算',
       '<b>按分类、按语言</b> — 每一项都是真正的前 30',
       '<b>其他一切照旧</b> — 预览、时长、徽章：和普通卡片一样'],
      "<b>Cowlor's Sidebar</b> · 一键前往，一键返回"],
    abo:   ['订阅', '侧边栏知道<br>你在<em>支持</em>谁。',
      ['<b>标成金色，集中在顶部</b> — 有一种排序专为它们',
       '<b>已经订阅了多少个月</b> — 悬停就能看到，过期的也算',
       '<b>六种排序、两种筛选</b> — 分类、语言、时长、个人热度'],
      "<b>Cowlor's Sidebar</b> · 在浏览器里读取，从不外发"] },
};

const LANGUES = process.env.PROMO_LANGS
  ? process.env.PROMO_LANGS.split(',')
  : Object.keys(T);
console.log('Captures 1280 x 800 :');

/* Un décor ne prouve rien s'il rend une image muette. Chaque scène vérifie
   donc, sur le rendu, que ce qu'elle promet de montrer EST là — une pastille
   de subathon, une frise peuplée, des cartes dorées. Une capture qui aurait
   perdu son sujet sortirait sinon jolie et fausse, et c'est le genre de défaut
   qu'on ne voit qu'une fois la fiche publiée. */
const exiger = async (page, quoi, sonde) => {
  const vu = await page.evaluate(sonde);
  if (!vu.ok) throw new Error(`${quoi} : ${JSON.stringify(vu)}`);
};

for (const L of LANGUES) {
  const S = T[L];
  if (!S) throw new Error('fiche inconnue : ' + L);
  console.log('— ' + L);
  const commun = (nom, cle, extra = {}) => ({
    nom: `${nom}-${L}`, lang:S.ui, section:S.section,
    jeu:DECOR, jeuArg:{ scene:cle, titres:S.titres },
    chapo:S[cle][0], titre:S[cle][1], points:S[cle][2], marque:S[cle][3], ...extra,
  });

  /* ── 1. L'aperçu ───────────────────────────────────────────────────────
     La mémoire d'abonnements est posée ici AUSSI : kiraplays en fait partie,
     et c'est ce qui met dans l'aperçu le badge « Abonné 9 mois ». Sans elle la
     capture montrerait un aperçu amputé de sa ligne la plus personnelle. */
  await scene(commun('01-apercu', 'apercu', {
    plan:'empile', produit:'barre+apercu', stockage:ABOS,
    apres: async (page) => {
      await page.evaluate(() => [...document.querySelectorAll('.side-nav-card')]
        .find(x => x.dataset.tseLogin === 'kiraplays')
        .dispatchEvent(new MouseEvent('mouseenter', { bubbles:false })));
      await page.waitForTimeout(2600);
      await exiger(page, 'l\'aperçu n\'a pas ses badges', () => {
        const b = [...document.querySelectorAll('.tse-preview__badge')].map(x => x.textContent);
        return { ok: b.length >= 3, badges: b };
      });
    } }));

  /* ── 2. La carte ─────────────────────────────────────────────────────── */
  await scene(commun('02-carte', 'carte', {
    apres: async (page) => {
      await exiger(page, 'la carte ne porte pas ses trois marques', () => {
        const q = (s) => document.querySelector(s);
        const jour = q('.side-nav-card[data-tse-subathon-day] .tse-subathon-jour');
        const duree = document.querySelectorAll('.tse-uptime').length;
        return { ok: !!jour && !!q('.side-nav-card[data-tse-costream-key]')
                     && !!q('.side-nav-card.tse-fresh') && duree === 5,
                 jour: jour && jour.textContent,
                 costream: !!q('.side-nav-card[data-tse-costream-key]'),
                 frais: !!q('.side-nav-card.tse-fresh'), duree };
      });
    } }));

  /* ── 3. La frise ───────────────────────────────────────────────────────
     L'aperçu SEUL : la frise le rend haut de cinq cents pixels, et la barre à
     côté ne dirait rien de plus que sur les quatre autres images. */
  await scene(commun('03-frise', 'frise', {
    produit:'apercu',
    apres: async (page) => {
      await page.evaluate(() => [...document.querySelectorAll('.side-nav-card')]
        .find(x => x.dataset.tseLogin === 'novaflux')
        .dispatchEvent(new MouseEvent('mouseenter', { bubbles:false })));
      await page.waitForTimeout(3000);
      await exiger(page, 'la frise n\'est pas celle du décor', () => {
        const l = [...document.querySelectorAll('.tse-preview__frise-ligne')]
          .map(x => x.querySelector('.tse-preview__frise-nom').textContent);
        const p = document.querySelectorAll('.tse-preview__frise-part').length;
        return { ok: l.length === 5 && p === 8, lignes: l, parts: p };
      });
    } }));

  /* ── 4. Top Chaînes ────────────────────────────────────────────────────── */
  await scene(commun('04-top', 'top', {
    apres: async (page) => {
      await page.evaluate(() =>
        document.querySelector('#tse-mode-row [data-tse-mode="global"]').click());
      await page.waitForTimeout(2600);
      await exiger(page, 'le mode global n\'a pas pris', () => {
        const n = [...document.querySelectorAll('.side-nav-card')]
          .map(c => c.dataset.tseLogin);
        return { ok: n.includes('solstice_tv') && n.includes('zephyrlane'), logins:n };
      });
    } }));

  /* ── 5. Les abonnements ──────────────────────────────────────────────────
     Le tri « mes abonnements en tête » est activé pour que l'or se regroupe en
     haut — c'est là qu'on voit d'un coup d'œil ce que la barre a reconnu — et
     la pastille du bouton porte le total connu, douze, dont neuf chaînes qui
     n'émettent pas en ce moment. */
  await scene(commun('05-abonnes', 'abo', {
    stockage:ABOS,
    apres: async (page) => {
      await page.evaluate(() => {
        const b = document.querySelector('#tse-sort-row [data-tse-sort-mode="subs"]');
        if (!b) throw new Error('bouton de tri « abonnements » absent');
        if (b.disabled) throw new Error('bouton de tri « abonnements » grisé');
        b.click();
      });
      await page.waitForTimeout(1200);
      /* Une capture qui ne montrerait aucune carte dorée serait une capture
         mensongère, et rien dans la mise en page ne le signalerait. Le TOTAL
         importe autant : s'il dépassait douze, c'est que le relevé aurait
         tourné malgré tout et versé les pseudos de la page de test. */
      await exiger(page, 'l\'or n\'est pas au rendez-vous', () => ({
        ok: document.querySelectorAll('.tse-sub').length === 3
            && document.querySelector('#tse-sort-row .tse-sort-count')?.textContent === '12',
        dorees: document.querySelectorAll('.tse-sub').length,
        total: document.querySelector('#tse-sort-row .tse-sort-count')?.textContent || '',
      }));
    } }));
}

await browser.close();
