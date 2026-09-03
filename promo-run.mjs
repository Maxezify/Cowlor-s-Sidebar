import { scene, browser, ABOS } from './promo.mjs';

// Chaînes INVENTÉES : aucune identité réelle empruntée, aucun endossement suggéré.
const DECOR = (TITRES) => {
  const h = (min) => new Date(Date.now() - min * 60_000).toISOString();
  window.__fx = {
    novaflux:    { id:'101', createdAt:h(259), viewers:18420, game:'Just Chatting',      tags:['Français'],
                   title:TITRES.novaflux },
    kiraplays:   { id:'102', createdAt:h(132), viewers:9310,  game:'League of Legends',  tags:['Français'],
                   title:TITRES.kiraplays },
    atlasgaming: { id:'103', createdAt:h(94),  viewers:6240,  game:'Valorant',           tags:['Français'] },
    mirabelle:   { id:'104', createdAt:h(311), viewers:4180,  game:'Art',                tags:['Français'] },
    orionwave:   { id:'105', createdAt:h(3),   viewers:2870,  game:'Minecraft',          tags:['Français'] },
    duskraven:   { id:'106', createdAt:h(47),  viewers:1960,  game:'Elden Ring',         tags:['English'] },
    pixelforge:  { id:'107', createdAt:h(188), viewers:1240,  game:'Software & Games',   tags:['English'] },
    lumenkai:    { id:'108', createdAt:h(76),  viewers:980,   game:'Just Chatting',      tags:['Deutsch'] },
  };
  // Un vrai co-stream Guest Star entre deux des chaînes.
  const invites = [
    { id:'102', login:'kiraplays',   viewers:9310, combined:15570 },
    { id:'103', login:'atlasgaming', viewers:6240, combined:15570 },
  ];
  window.__gs = {
    '102': { hostId:'102', hostLogin:'kiraplays', guests:invites },
    '103': { hostId:'102', hostLogin:'kiraplays', guests:invites },
  };
  const c = (l, cat, v) => window.__addCard(l, cat, v);
  c('novaflux','Just Chatting','18,4 k');
  c('kiraplays','League of Legends','15,5 k');
  c('atlasgaming','League of Legends','15,5 k');
  c('mirabelle','Art','4,1 k');
  c('orionwave','Minecraft','2,8 k');
  c('duskraven','Elden Ring','1,9 k');
  c('pixelforge','Software & Games','1,2 k');
  c('lumenkai','Just Chatting','980');
  // Classement mondial pour le mode « Top Chaînes ».
  // createdAt EXPLICITE : sans lui le stub date les streams du 1er janvier et
  // les cartes affichent des durées de plusieurs milliers d'heures.
  window.__cats = [
    { name:'Just Chatting', viewers:412_000, streams:[
      { login:'solstice_tv', viewers:64_200, createdAt:h(196), tags:['Français'] },
      { login:'novaflux',    viewers:18_420, createdAt:h(259), tags:['Français'] },
      { login:'valehart',    viewers:12_050, createdAt:h(38),  tags:['Français'] }] },
    { name:'League of Legends', viewers:288_000, streams:[
      { login:'kiraplays',   viewers:15_570, createdAt:h(132), tags:['Français'] },
      { login:'zephyrlane',  viewers:31_400, createdAt:h(87),  tags:['Français'] }] },
    { name:'GTA V', viewers:196_000, streams:[
      { login:'ravencourt',  viewers:27_800, createdAt:h(421), tags:['Français'] },
      { login:'brumefall',   viewers:9_640,  createdAt:h(12),  tags:['Français'] }] },
    { name:'Valorant', viewers:151_000, streams:[
      { login:'atlasgaming', viewers:6_240,  createdAt:h(94),  tags:['Français'] },
      { login:'ombrelune',   viewers:5_130,  createdAt:h(163), tags:['Français'] }] },
  ];
};

const T = {
  fr: { ui:'fr', section:'fr',
    titres:{ novaflux:'On refait le monde avant le sub-ton de ce soir', kiraplays:'Objectif Master avant la fin du mois — jour 12' },
    hero:  ['<span class="kicker">Twitch, mais en mieux</span>' +
            '<h1>Votre sidebar<br>vous <em>dit tout</em>.</h1>' +
            '<p>Durée de stream, co-streams colorés, streams qui viennent de démarrer. ' +
            'Les infos qu\'il fallait aller chercher sont déjà là.</p>',
            '<b>Cowlor\'s Sidebar</b> · gratuit, sans compte, sans pub'],
    apercu:['<span class="kicker">Aperçu au survol</span>' +
            '<h1>Regardez<br><em>avant</em> de cliquer.</h1>' +
            '<p>Une seconde de survol et le stream s\'ouvre en direct, avec son titre ' +
            'complet et le contexte : co-stream, sponsor, Hype Train.</p>',
            '<b>Cowlor\'s Sidebar</b> · l\'aperçu marche partout dans la sidebar'],
    top:   ['<span class="kicker">Top Chaînes</span>' +
            '<h1>Tout Twitch,<br>dans <em>votre</em> sidebar.</h1>' +
            '<p>Un onglet, et les 30 chaînes les plus regardées prennent la place. ' +
            'Par catégorie, par langue, recalculé en continu.</p>',
            '<b>Cowlor\'s Sidebar</b> · un clic pour y aller, un clic pour revenir'],
    filtre:['<span class="kicker">Filtres</span>' +
            '<h1>Trouvez<br>en <em>deux clics</em>.</h1>' +
            '<p>Par catégorie, par langue — avec les drapeaux. Seules les valeurs ' +
            'réellement présentes chez vos suivis sont proposées.</p>',
            '<b>Cowlor\'s Sidebar</b> · rien à configurer, jamais'],
    tri:   ['<span class="kicker">Six tris</span>' +
            '<h1>Votre liste,<br><em>votre</em> ordre.</h1>' +
            '<p>Spectateurs, abonnements, popularité perso, durée de stream, ' +
            'alphabétique — ou les co-streams regroupés en tête.</p>',
            '<b>Cowlor\'s Sidebar</b> · votre historique reste dans votre navigateur'],
    abo:   ['<span class="kicker">Abonnements</span>' +
            '<h1>La barre sait<br>qui vous <em>soutenez</em>.</h1>' +
            '<p>Vos abonnements reconnus, dorés, regroupés en tête. Au survol, ' +
            'depuis combien de mois vous êtes là — même pour les expirés.</p>',
            '<b>Cowlor\'s Sidebar</b> · lu dans votre navigateur, jamais envoyé ailleurs'] },

  en: { ui:'en', section:'en',
    titres:{ novaflux:"Putting the world to rights before tonight's subathon", kiraplays:'Road to Master before the month ends — day 12' },
    hero:  ['<span class="kicker">Twitch, but better</span>' +
            '<h1>Your sidebar<br><em>tells you</em> everything.</h1>' +
            '<p>Stream uptime, colour-coded co-streams, streams that just went live. ' +
            'The information you had to go looking for is already there.</p>',
            '<b>Cowlor\'s Sidebar</b> · free, no account, no ads'],
    apercu:['<span class="kicker">Hover preview</span>' +
            '<h1>Watch<br><em>before</em> you click.</h1>' +
            '<p>Hover for a second and the stream opens live, with its full title ' +
            'and the context: co-stream, sponsor, Hype Train.</p>',
            '<b>Cowlor\'s Sidebar</b> · the preview works everywhere in the sidebar'],
    top:   ['<span class="kicker">Top Channels</span>' +
            '<h1>All of Twitch,<br>in <em>your</em> sidebar.</h1>' +
            '<p>One tab, and the 30 most-watched channels take over. By category, ' +
            'by language, recomputed continuously.</p>',
            '<b>Cowlor\'s Sidebar</b> · one click there, one click back'],
    filtre:['<span class="kicker">Filters</span>' +
            '<h1>Find it<br>in <em>two clicks</em>.</h1>' +
            '<p>By category, by language — with flags. Only the values actually ' +
            'present among your followed channels are offered.</p>',
            '<b>Cowlor\'s Sidebar</b> · nothing to configure, ever'],
    tri:   ['<span class="kicker">Six sorts</span>' +
            '<h1>Your list,<br><em>your</em> order.</h1>' +
            '<p>Viewers, subscriptions, personal popularity, stream uptime, ' +
            'alphabetical — or co-streams grouped at the top.</p>',
            '<b>Cowlor\'s Sidebar</b> · your history stays in your browser'],
    abo:   ['<span class="kicker">Subscriptions</span>' +
            '<h1>Your sidebar knows<br>who you <em>support</em>.</h1>' +
            '<p>Your subscriptions recognised, gilded, grouped at the top. ' +
            'Hover for how many months you have been there — expired ones too.</p>',
            '<b>Cowlor\'s Sidebar</b> · read in your browser, never sent anywhere'] },

  de: { ui:'de', section:'de',
    titres:{ novaflux:'Wir lösen die Weltprobleme vor dem Subathon heute Abend', kiraplays:'Auf zu Master vor Monatsende — Tag 12' },
    hero:  ['<span class="kicker">Twitch, nur besser</span>' +
            '<h1>Deine Sidebar<br><em>sagt dir</em> alles.</h1>' +
            '<p>Stream-Dauer, farbige Co-Streams, gerade gestartete Streams. ' +
            'Was du sonst suchen musstest, steht schon da.</p>',
            '<b>Cowlor\'s Sidebar</b> · gratis, ohne Konto, ohne Werbung'],
    apercu:['<span class="kicker">Vorschau beim Überfahren</span>' +
            '<h1>Schau hin,<br><em>bevor</em> du klickst.</h1>' +
            '<p>Eine Sekunde überfahren, und der Stream läuft live — mit ganzem ' +
            'Titel und Kontext: Co-Stream, Sponsor, Hype Train.</p>',
            '<b>Cowlor\'s Sidebar</b> · die Vorschau läuft überall in der Sidebar'],
    top:   ['<span class="kicker">Top-Kanäle</span>' +
            '<h1>Ganz Twitch,<br>in <em>deiner</em> Sidebar.</h1>' +
            '<p>Ein Tab, und die 30 meistgesehenen Kanäle übernehmen. Nach ' +
            'Kategorie, nach Sprache, laufend neu berechnet.</p>',
            '<b>Cowlor\'s Sidebar</b> · ein Klick hin, ein Klick zurück'],
    filtre:['<span class="kicker">Filter</span>' +
            '<h1>Finden<br>in <em>zwei Klicks</em>.</h1>' +
            '<p>Nach Kategorie, nach Sprache — mit Flaggen. Angeboten wird nur, ' +
            'was bei deinen Kanälen wirklich vorkommt.</p>',
            '<b>Cowlor\'s Sidebar</b> · nichts einzustellen, nie'],
    tri:   ['<span class="kicker">Sechs Sortierungen</span>' +
            '<h1>Deine Liste,<br><em>deine</em> Reihenfolge.</h1>' +
            '<p>Zuschauer, Abos, eigene Beliebtheit, Stream-Dauer, alphabetisch — ' +
            'oder Co-Streams ganz oben gruppiert.</p>',
            '<b>Cowlor\'s Sidebar</b> · dein Verlauf bleibt in deinem Browser'],
    abo:   ['<span class="kicker">Abos</span>' +
            '<h1>Deine Sidebar<br>kennt deine <em>Abos</em>.</h1>' +
            '<p>Erkannt, golden hervorgehoben und nach oben gruppiert. Beim ' +
            'Überfahren: seit wie vielen Monaten du dabei bist.</p>',
            '<b>Cowlor\'s Sidebar</b> · im Browser gelesen, nie irgendwohin gesendet'] },

  es: { ui:'es', section:'es',
    titres:{ novaflux:'Arreglamos el mundo antes del subatón de esta noche', kiraplays:'Camino a Master antes de fin de mes — día 12' },
    hero:  ['<span class="kicker">Twitch, pero mejor</span>' +
            '<h1>Tu barra lateral<br><em>te lo cuenta</em> todo.</h1>' +
            '<p>Duración del directo, co-streams con color, streams recién ' +
            'empezados. Lo que había que ir a buscar ya está ahí.</p>',
            '<b>Cowlor\'s Sidebar</b> · gratis, sin cuenta, sin anuncios'],
    apercu:['<span class="kicker">Vista previa al pasar</span>' +
            '<h1>Mira<br><em>antes</em> de hacer clic.</h1>' +
            '<p>Un segundo encima y el directo se abre, con su título completo ' +
            'y el contexto: co-stream, patrocinio, Hype Train.</p>',
            '<b>Cowlor\'s Sidebar</b> · la vista previa funciona en toda la barra'],
    top:   ['<span class="kicker">Top Canales</span>' +
            '<h1>Todo Twitch,<br>en <em>tu</em> barra lateral.</h1>' +
            '<p>Una pestaña, y los 30 canales más vistos ocupan el sitio. Por ' +
            'categoría, por idioma, recalculado sin parar.</p>',
            '<b>Cowlor\'s Sidebar</b> · un clic para ir, un clic para volver'],
    filtre:['<span class="kicker">Filtros</span>' +
            '<h1>Encuentra<br>en <em>dos clics</em>.</h1>' +
            '<p>Por categoría, por idioma — con banderas. Solo se ofrecen los ' +
            'valores realmente presentes entre tus canales.</p>',
            '<b>Cowlor\'s Sidebar</b> · nada que configurar, nunca'],
    tri:   ['<span class="kicker">Seis órdenes</span>' +
            '<h1>Tu lista,<br><em>tu</em> orden.</h1>' +
            '<p>Espectadores, suscripciones, popularidad personal, duración, ' +
            'alfabético — o los co-streams agrupados arriba.</p>',
            '<b>Cowlor\'s Sidebar</b> · tu historial se queda en tu navegador'],
    abo:   ['<span class="kicker">Suscripciones</span>' +
            '<h1>Tu barra sabe<br>a quién <em>apoyas</em>.</h1>' +
            '<p>Tus suscripciones reconocidas, doradas, agrupadas arriba. Al ' +
            'pasar por encima, cuántos meses llevas — también las caducadas.</p>',
            '<b>Cowlor\'s Sidebar</b> · se lee en tu navegador, nunca se envía a ningún sitio'] },

  es419: { ui:'es', section:'es',
    titres:{ novaflux:'Arreglamos el mundo antes del subatón de esta noche', kiraplays:'Camino a Master antes de fin de mes — día 12' },
    hero:  ['<span class="kicker">Twitch, pero mejor</span>' +
            '<h1>Tu barra lateral<br><em>te lo cuenta</em> todo.</h1>' +
            '<p>Duración del vivo, co-streams con color, streams recién ' +
            'empezados. Lo que había que ir a buscar ya está ahí.</p>',
            '<b>Cowlor\'s Sidebar</b> · gratis, sin cuenta, sin anuncios'],
    apercu:['<span class="kicker">Vista previa al pasar</span>' +
            '<h1>Mira<br><em>antes</em> de hacer clic.</h1>' +
            '<p>Un segundo encima y el vivo se abre, con su título completo ' +
            'y el contexto: co-stream, patrocinio, Hype Train.</p>',
            '<b>Cowlor\'s Sidebar</b> · la vista previa funciona en toda la barra'],
    top:   ['<span class="kicker">Top Canales</span>' +
            '<h1>Todo Twitch,<br>en <em>tu</em> barra lateral.</h1>' +
            '<p>Una pestaña, y los 30 canales más vistos ocupan el lugar. Por ' +
            'categoría, por idioma, recalculado sin parar.</p>',
            '<b>Cowlor\'s Sidebar</b> · un clic para ir, un clic para volver'],
    filtre:['<span class="kicker">Filtros</span>' +
            '<h1>Encuentra<br>en <em>dos clics</em>.</h1>' +
            '<p>Por categoría, por idioma — con banderas. Solo se ofrecen los ' +
            'valores realmente presentes entre tus canales.</p>',
            '<b>Cowlor\'s Sidebar</b> · nada que configurar, nunca'],
    tri:   ['<span class="kicker">Seis órdenes</span>' +
            '<h1>Tu lista,<br><em>tu</em> orden.</h1>' +
            '<p>Espectadores, suscripciones, popularidad personal, duración, ' +
            'alfabético — o los co-streams agrupados arriba.</p>',
            '<b>Cowlor\'s Sidebar</b> · tu historial se queda en tu navegador'],
    abo:   ['<span class="kicker">Suscripciones</span>' +
            '<h1>Tu barra sabe<br>a quién <em>apoyas</em>.</h1>' +
            '<p>Tus suscripciones reconocidas, doradas, agrupadas arriba. Al ' +
            'pasar por encima, cuántos meses llevas — también las caducadas.</p>',
            '<b>Cowlor\'s Sidebar</b> · se lee en tu navegador, nunca se envía a ningún sitio'] },

  ptbr: { ui:'pt', section:'ptbr',
    titres:{ novaflux:'Resolvendo o mundo antes do subathon de hoje à noite', kiraplays:'Rumo ao Mestre antes do fim do mês — dia 12' },
    hero:  ['<span class="kicker">Twitch, só que melhor</span>' +
            '<h1>Sua barra lateral<br><em>te conta</em> tudo.</h1>' +
            '<p>Tempo de live, co-streams coloridos, lives que acabaram de ' +
            'começar. O que você tinha que ir procurar já está ali.</p>',
            '<b>Cowlor\'s Sidebar</b> · grátis, sem conta, sem anúncios'],
    apercu:['<span class="kicker">Prévia ao passar o mouse</span>' +
            '<h1>Veja<br><em>antes</em> de clicar.</h1>' +
            '<p>Um segundo em cima e a live abre ao vivo, com o título completo ' +
            'e o contexto: co-stream, patrocínio, Hype Train.</p>',
            '<b>Cowlor\'s Sidebar</b> · a prévia funciona na barra inteira'],
    top:   ['<span class="kicker">Top Canais</span>' +
            '<h1>A Twitch inteira,<br>na <em>sua</em> barra lateral.</h1>' +
            '<p>Uma aba, e os 30 canais mais assistidos assumem o lugar. Por ' +
            'categoria, por idioma, recalculado o tempo todo.</p>',
            '<b>Cowlor\'s Sidebar</b> · um clique para ir, um para voltar'],
    filtre:['<span class="kicker">Filtros</span>' +
            '<h1>Ache<br>em <em>dois cliques</em>.</h1>' +
            '<p>Por categoria, por idioma — com bandeiras. Só aparecem os valores ' +
            'realmente presentes entre os seus canais.</p>',
            '<b>Cowlor\'s Sidebar</b> · nada para configurar, nunca'],
    tri:   ['<span class="kicker">Seis ordens</span>' +
            '<h1>Sua lista,<br><em>sua</em> ordem.</h1>' +
            '<p>Espectadores, inscrições, popularidade pessoal, tempo de live, ' +
            'alfabética — ou os co-streams agrupados no topo.</p>',
            '<b>Cowlor\'s Sidebar</b> · seu histórico fica no seu navegador'],
    abo:   ['<span class="kicker">Inscrições</span>' +
            '<h1>Sua barra sabe<br>quem você <em>apoia</em>.</h1>' +
            '<p>Suas inscrições reconhecidas, douradas, agrupadas no topo. Ao ' +
            'passar o mouse, há quantos meses você está lá — e as que expiraram.</p>',
            '<b>Cowlor\'s Sidebar</b> · lido no seu navegador, nunca enviado a lugar nenhum'] },

  ptpt: { ui:'pt', section:'ptpt',
    titres:{ novaflux:'A resolver o mundo antes do subathon desta noite', kiraplays:'Rumo a Mestre antes do fim do mês — dia 12' },
    hero:  ['<span class="kicker">Twitch, mas melhor</span>' +
            '<h1>A tua barra lateral<br><em>diz-te</em> tudo.</h1>' +
            '<p>Duração da emissão, co-streams coloridos, emissões acabadas de ' +
            'começar. O que tinhas de ir procurar já está ali.</p>',
            '<b>Cowlor\'s Sidebar</b> · grátis, sem conta, sem anúncios'],
    apercu:['<span class="kicker">Pré-visualização ao passar</span>' +
            '<h1>Vê<br><em>antes</em> de clicares.</h1>' +
            '<p>Um segundo por cima e a emissão abre em direto, com o título ' +
            'completo e o contexto: co-stream, patrocínio, Hype Train.</p>',
            '<b>Cowlor\'s Sidebar</b> · funciona em toda a barra lateral'],
    top:   ['<span class="kicker">Top Canais</span>' +
            '<h1>A Twitch inteira,<br>na <em>tua</em> barra lateral.</h1>' +
            '<p>Um separador, e os 30 canais mais vistos ocupam o lugar. Por ' +
            'categoria, por idioma, recalculado sem parar.</p>',
            '<b>Cowlor\'s Sidebar</b> · um clique para ir, um para voltar'],
    filtre:['<span class="kicker">Filtros</span>' +
            '<h1>Encontra<br>em <em>dois cliques</em>.</h1>' +
            '<p>Por categoria, por idioma — com bandeiras. Só aparecem os valores ' +
            'realmente presentes entre os teus canais.</p>',
            '<b>Cowlor\'s Sidebar</b> · nada para configurar, nunca'],
    tri:   ['<span class="kicker">Seis ordens</span>' +
            '<h1>A tua lista,<br><em>a tua</em> ordem.</h1>' +
            '<p>Espectadores, subscrições, popularidade pessoal, duração, ' +
            'alfabética — ou os co-streams agrupados no topo.</p>',
            '<b>Cowlor\'s Sidebar</b> · o teu histórico fica no teu navegador'],
    abo:   ['<span class="kicker">Subscrições</span>' +
            '<h1>A tua barra sabe<br>quem <em>apoias</em>.</h1>' +
            '<p>As tuas subscrições reconhecidas, douradas, agrupadas no topo. ' +
            'Ao passares por cima, há quantos meses lá estás — e as expiradas.</p>',
            '<b>Cowlor\'s Sidebar</b> · lido no teu navegador, nunca enviado para lado nenhum'] },

  it: { ui:'it', section:'it',
    titres:{ novaflux:'Sistemiamo il mondo prima del subathon di stasera', kiraplays:'Obiettivo Master prima di fine mese — giorno 12' },
    hero:  ['<span class="kicker">Twitch, ma meglio</span>' +
            '<h1>La tua sidebar<br><em>ti dice</em> tutto.</h1>' +
            '<p>Durata della diretta, co-stream colorati, dirette appena iniziate. ' +
            'Le informazioni che dovevi cercare sono già lì.</p>',
            '<b>Cowlor\'s Sidebar</b> · gratis, senza account, senza pubblicità'],
    apercu:['<span class="kicker">Anteprima al passaggio</span>' +
            '<h1>Guarda<br><em>prima</em> di cliccare.</h1>' +
            '<p>Un secondo sopra e la diretta si apre dal vivo, con il titolo ' +
            'completo e il contesto: co-stream, sponsor, Hype Train.</p>',
            '<b>Cowlor\'s Sidebar</b> · l\'anteprima funziona in tutta la sidebar'],
    top:   ['<span class="kicker">Canali di punta</span>' +
            '<h1>Tutto Twitch,<br>nella <em>tua</em> sidebar.</h1>' +
            '<p>Una scheda, e i 30 canali più visti prendono il posto. Per ' +
            'categoria, per lingua, ricalcolato di continuo.</p>',
            '<b>Cowlor\'s Sidebar</b> · un clic per andare, un clic per tornare'],
    filtre:['<span class="kicker">Filtri</span>' +
            '<h1>Trova<br>in <em>due clic</em>.</h1>' +
            '<p>Per categoria, per lingua — con le bandiere. Vengono proposti ' +
            'solo i valori davvero presenti tra i tuoi canali.</p>',
            '<b>Cowlor\'s Sidebar</b> · niente da configurare, mai'],
    tri:   ['<span class="kicker">Sei ordinamenti</span>' +
            '<h1>La tua lista,<br><em>il tuo</em> ordine.</h1>' +
            '<p>Spettatori, abbonamenti, popolarità personale, durata della ' +
            'diretta, alfabetico — o i co-stream raggruppati in cima.</p>',
            '<b>Cowlor\'s Sidebar</b> · la tua cronologia resta nel tuo browser'],
    abo:   ['<span class="kicker">Abbonamenti</span>' +
            '<h1>La sidebar sa<br>chi <em>sostieni</em>.</h1>' +
            '<p>I tuoi abbonamenti riconosciuti, dorati, raggruppati in cima. Al ' +
            'passaggio, da quanti mesi ci sei — anche quelli scaduti.</p>',
            '<b>Cowlor\'s Sidebar</b> · letto nel tuo browser, mai inviato altrove'] },

  pl: { ui:'pl', section:'pl',
    titres:{ novaflux:'Naprawiamy świat przed dzisiejszym subathonem', kiraplays:'Droga do Mastera przed końcem miesiąca — dzień 12' },
    hero:  ['<span class="kicker">Twitch, tylko lepszy</span>' +
            '<h1>Twój pasek<br><em>mówi ci</em> wszystko.</h1>' +
            '<p>Czas transmisji, kolorowe co-streamy, transmisje, które dopiero ' +
            'ruszyły. To, czego trzeba było szukać, jest już tutaj.</p>',
            '<b>Cowlor\'s Sidebar</b> · za darmo, bez konta, bez reklam'],
    apercu:['<span class="kicker">Podgląd po najechaniu</span>' +
            '<h1>Zobacz,<br><em>zanim</em> klikniesz.</h1>' +
            '<p>Sekunda najechania i transmisja rusza na żywo, z pełnym tytułem ' +
            'i kontekstem: co-stream, sponsor, Hype Train.</p>',
            '<b>Cowlor\'s Sidebar</b> · podgląd działa w całym pasku'],
    top:   ['<span class="kicker">Najpopularniejsze kanały</span>' +
            '<h1>Cały Twitch<br>w <em>twoim</em> pasku.</h1>' +
            '<p>Jedna zakładka i 30 najczęściej oglądanych kanałów zajmuje ' +
            'miejsce. Według kategorii, według języka, przeliczane bez przerwy.</p>',
            '<b>Cowlor\'s Sidebar</b> · jedno kliknięcie tam, jedno z powrotem'],
    filtre:['<span class="kicker">Filtry</span>' +
            '<h1>Znajdź<br>w <em>dwa kliknięcia</em>.</h1>' +
            '<p>Według kategorii, według języka — z flagami. Proponowane są tylko ' +
            'wartości, które naprawdę występują u twoich kanałów.</p>',
            '<b>Cowlor\'s Sidebar</b> · nic do ustawiania, nigdy'],
    tri:   ['<span class="kicker">Sześć sortowań</span>' +
            '<h1>Twoja lista,<br><em>twoja</em> kolejność.</h1>' +
            '<p>Widzowie, subskrypcje, osobista popularność, czas transmisji, ' +
            'alfabetycznie — albo co-streamy zebrane na górze.</p>',
            '<b>Cowlor\'s Sidebar</b> · twoja historia zostaje w twojej przeglądarce'],
    abo:   ['<span class="kicker">Subskrypcje</span>' +
            '<h1>Pasek wie,<br>kogo <em>wspierasz</em>.</h1>' +
            '<p>Twoje subskrypcje rozpoznane, złote, zebrane na górze. Po ' +
            'najechaniu — od ilu miesięcy tam jesteś, także te wygasłe.</p>',
            '<b>Cowlor\'s Sidebar</b> · czytane w przeglądarce, nigdy nigdzie nie wysyłane'] },

  ru: { ui:'ru', section:'ru',
    titres:{ novaflux:'Решаем судьбы мира перед сегодняшним сабатоном', kiraplays:'Путь к Мастеру до конца месяца — день 12' },
    hero:  ['<span class="kicker">Twitch, только лучше</span>' +
            '<h1>Ваша панель<br><em>расскажет</em> всё.</h1>' +
            '<p>Время эфира, цветные ко-стримы, только что начавшиеся ' +
            'трансляции. То, что приходилось искать, уже здесь.</p>',
            '<b>Cowlor\'s Sidebar</b> · бесплатно, без аккаунта, без рекламы'],
    apercu:['<span class="kicker">Превью при наведении</span>' +
            '<h1>Смотрите<br><em>до</em> клика.</h1>' +
            '<p>Секунда наведения — и эфир открывается вживую, с полным ' +
            'названием и контекстом: ко-стрим, спонсор, Hype Train.</p>',
            '<b>Cowlor\'s Sidebar</b> · превью работает по всей панели'],
    top:   ['<span class="kicker">Топ каналов</span>' +
            '<h1>Весь Twitch<br>в <em>вашей</em> панели.</h1>' +
            '<p>Одна вкладка — и 30 самых просматриваемых каналов занимают ' +
            'место. По категории, по языку, пересчитывается непрерывно.</p>',
            '<b>Cowlor\'s Sidebar</b> · один клик туда, один обратно'],
    filtre:['<span class="kicker">Фильтры</span>' +
            '<h1>Найдите<br>в <em>два клика</em>.</h1>' +
            '<p>По категории, по языку — с флагами. Предлагаются только ' +
            'значения, которые действительно есть у ваших каналов.</p>',
            '<b>Cowlor\'s Sidebar</b> · ничего не нужно настраивать, никогда'],
    tri:   ['<span class="kicker">Шесть сортировок</span>' +
            '<h1>Ваш список,<br><em>ваш</em> порядок.</h1>' +
            '<p>Зрители, подписки, личная популярность, время эфира, по ' +
            'алфавиту — или ко-стримы, собранные вверху.</p>',
            '<b>Cowlor\'s Sidebar</b> · ваша история остаётся в вашем браузере'],
    abo:   ['<span class="kicker">Подписки</span>' +
            '<h1>Панель знает<br>ваши <em>подписки</em>.</h1>' +
            '<p>Подписки распознаны, отмечены золотом и собраны вверху. При ' +
            'наведении — сколько месяцев вы рядом, даже для истёкших.</p>',
            '<b>Cowlor\'s Sidebar</b> · читается в вашем браузере, никуда не отправляется'] },

  ja: { ui:'ja', section:'ja',
    titres:{ novaflux:'今夜のサブアソンの前に世界を語り尽くす', kiraplays:'月末までにマスター到達へ — 12日目' },
    hero:  ['<span class="kicker">Twitch をもっと便利に</span>' +
            '<h1>サイドバーが<br><em>すべて</em>教えます。</h1>' +
            '<p>配信時間、色分けされたコラボ配信、始まったばかりの配信。' +
            '探しに行っていた情報が、もうそこにあります。</p>',
            '<b>Cowlor\'s Sidebar</b> · 無料、アカウント不要、広告なし'],
    apercu:['<span class="kicker">ホバープレビュー</span>' +
            '<h1>クリックの<br><em>前に</em>見る。</h1>' +
            '<p>1秒ホバーするだけで配信がライブで開き、完全なタイトルと文脈が ' +
            '見えます。コラボ、スポンサー、Hype Train。</p>',
            '<b>Cowlor\'s Sidebar</b> · プレビューはサイドバーのどこでも動きます'],
    top:   ['<span class="kicker">トップチャンネル</span>' +
            // Trois vers, et non deux comme ailleurs : à 72 px, la colonne de
            // 690 px tient neuf idéogrammes, et « あなたのサイドバーに。 » en
            // fait onze. Le repli était donc écrit d'avance ; autant l'écrire.
            '<h1>Twitch のすべてを<br><em>あなたの</em><br>サイドバーに。</h1>' +
            '<p>タブひとつで、視聴者数の多い30チャンネルが並びます。' +
            'カテゴリー別、言語別、常に再計算。</p>',
            '<b>Cowlor\'s Sidebar</b> · 行くのも戻るのもワンクリック'],
    filtre:['<span class="kicker">フィルター</span>' +
            '<h1>2クリックで<br><em>見つかる</em>。</h1>' +
            '<p>カテゴリー別、言語別 — 国旗つき。フォロー中のチャンネルに' +
            '実際にある値だけが並びます。</p>',
            '<b>Cowlor\'s Sidebar</b> · 設定は一切不要'],
    tri:   ['<span class="kicker">6つの並べ替え</span>' +
            '<h1>あなたのリスト、<br><em>あなたの</em>順番。</h1>' +
            '<p>視聴者数、サブスク、個人的な人気度、配信時間、名前順 — ' +
            'コラボ配信を上にまとめることも。</p>',
            '<b>Cowlor\'s Sidebar</b> · 履歴はブラウザーの中だけ'],
    abo:   ['<span class="kicker">サブスク</span>' +
            '<h1>誰を<em>応援</em>して<br>いるか分かる。</h1>' +
            '<p>サブスクを認識して金色にし、上にまとめます。ホバーすれば' +
            '何か月続いているかも — 期限切れも含めて。</p>',
            '<b>Cowlor\'s Sidebar</b> · ブラウザーで読むだけ、どこにも送りません'] },

  zh: { ui:'zh', section:'zh',
    titres:{ novaflux:'今晚订阅马拉松开始前，先聊聊天下事', kiraplays:'月底前冲上大师 — 第 12 天' },
    hero:  ['<span class="kicker">Twitch，但更好用</span>' +
            '<h1>侧边栏<br><em>什么都</em>告诉你。</h1>' +
            '<p>开播时长、彩色联合直播、刚刚开播的频道。' +
            '以前要去找的信息，现在就在眼前。</p>',
            '<b>Cowlor\'s Sidebar</b> · 免费、无需账号、没有广告'],
    apercu:['<span class="kicker">悬停预览</span>' +
            '<h1>点击前<br>先<em>看一眼</em>。</h1>' +
            '<p>悬停一秒，直播就地播放，还带完整标题和上下文：' +
            '联合直播、赞助、Hype Train。</p>',
            '<b>Cowlor\'s Sidebar</b> · 预览在整个侧边栏都能用'],
    top:   ['<span class="kicker">热门频道</span>' +
            '<h1>整个 Twitch，<br>都在<em>你的</em>侧边栏。</h1>' +
            '<p>一个标签页，观看人数最多的 30 个频道就位。' +
            '按分类、按语言，持续重新计算。</p>',
            '<b>Cowlor\'s Sidebar</b> · 一键前往，一键返回'],
    filtre:['<span class="kicker">筛选</span>' +
            '<h1>两次点击<br>就能<em>找到</em>。</h1>' +
            '<p>按分类、按语言 — 带国旗。只提供你关注的频道中' +
            '真实存在的选项。</p>',
            '<b>Cowlor\'s Sidebar</b> · 无需任何设置'],
    tri:   ['<span class="kicker">六种排序</span>' +
            '<h1>你的列表，<br><em>你的</em>顺序。</h1>' +
            '<p>观众数、订阅、个人热度、开播时长、按名称 — ' +
            '也可以把联合直播集中在最上面。</p>',
            '<b>Cowlor\'s Sidebar</b> · 你的历史只留在你的浏览器里'],
    abo:   ['<span class="kicker">订阅</span>' +
            '<h1>侧边栏知道<br>你在<em>支持</em>谁。</h1>' +
            '<p>识别你的订阅，标成金色，集中在顶部。悬停就能看到' +
            '已经订阅了多少个月 — 过期的也算。</p>',
            '<b>Cowlor\'s Sidebar</b> · 在浏览器里读取，从不外发'] },
};
const LANGUES = process.env.PROMO_LANGS
  ? process.env.PROMO_LANGS.split(',')
  : Object.keys(T);
console.log('Captures 1280 x 800 :');

for (const L of LANGUES) {
  const S = T[L];
  if (!S) throw new Error('fiche inconnue : ' + L);
  console.log('— ' + L);

  await scene({ nom:`01-hero-${L}`, lang:S.ui, section:S.section, jeu:DECOR, jeuArg:S.titres, titre:S.hero[0], sousTitre:S.hero[1] });

  // La mémoire d'abonnements est posée ici AUSSI : kiraplays en fait partie,
  // et c'est ce qui met dans l'aperçu le badge « Abonné 9 mois ». Sans elle la
  // capture montrerait un aperçu amputé de sa ligne la plus personnelle.
  await scene({ nom:`02-apercu-${L}`, lang:S.ui, section:S.section, jeu:DECOR, jeuArg:S.titres, titre:S.apercu[0], sousTitre:S.apercu[1],
  echelleMax:1, texteEtroit:true, stockage:ABOS,
  apres: async (page) => {
    await page.evaluate(() => {
      const c = [...document.querySelectorAll('.side-nav-card')]
        .find(x => x.dataset.tseLogin === 'kiraplays');
      c.dispatchEvent(new MouseEvent('mouseenter', { bubbles:false }));
    });
    await page.waitForTimeout(2600);
    // L'aperçu se place normalement contre la carte survolée ; ici le cadre de
    // présentation est agrandi, donc on le repose à droite de la barre — là où
    // l'utilisateur le voit réellement sur Twitch.
    await page.evaluate(() => {
      const pop = document.querySelector('.tse-preview');
      if (!pop) return;
      // Calée au plus près du cadre — huit pixels de jeu — pour rendre à la
      // colonne de texte tout ce qui peut l'être : c'est elle qui manquait de
      // place, et le garde-fou de scene() vérifie que les deux ne se touchent
      // toujours pas.
      pop.style.left = '366px'; pop.style.top = '150px';
      pop.style.right = 'auto'; pop.style.bottom = 'auto';
    });
    await page.waitForTimeout(300);
  } });

  await scene({ nom:`03-top-${L}`, lang:S.ui, section:S.section, jeu:DECOR, jeuArg:S.titres, titre:S.top[0], sousTitre:S.top[1],
  apres: async (page) => {
    await page.evaluate(() =>
      document.querySelector('#tse-mode-row [data-tse-mode="global"]').click());
    await page.waitForTimeout(2600);
  } });

  await scene({ nom:`04-filtres-${L}`, lang:S.ui, section:S.section, jeu:DECOR, jeuArg:S.titres, titre:S.filtre[0], sousTitre:S.filtre[1],
  apres: async (page) => {
    await page.evaluate(() => document.querySelector('#tse-lang-dd .tse-dd-btn').click());
    await page.waitForTimeout(400);
  } });

  // Un historique de visites plausible : c'est lui qui donne son sens au tri
// « popularité perso », et il ne quitte jamais le navigateur.
  const J = 86_400_000, N = Date.now();
  const VISITES = {
  lumenkai:  [N-2*3600e3, N-J, N-2*J, N-3*J, N-4*J, N-6*J],
  duskraven: [N-5*3600e3, N-J, N-3*J, N-5*J],
  mirabelle: [N-J, N-4*J],
  novaflux:  [N-9*J],
};

  await scene({ nom:`05-tri-${L}`, lang:S.ui, section:S.section, jeu:DECOR, jeuArg:S.titres, titre:S.tri[0], sousTitre:S.tri[1],
  visites:VISITES,
  apres: async (page) => {
    await page.evaluate(() => {
      // Tri « popularité perso » : c'est celui qui montre le mieux qu'un ordre
      // AUTRE que celui de Twitch est possible. On amorce quelques visites pour
      // que le classement ait de quoi trier.
      const b = document.querySelector('#tse-sort-row [data-tse-sort-mode="popular"]');
      if (b) b.click();
    });
    await page.waitForTimeout(1200);
  } });

  // Abonnements. Le tri « mes abonnements en tête » est activé pour que l'or
  // se regroupe en haut de la liste — c'est là qu'on voit d'un coup d'œil ce
  // que la barre a reconnu — et la pastille du bouton porte le total connu,
  // douze, dont huit chaînes qui n'émettent pas en ce moment.
  await scene({ nom:`06-abonnes-${L}`, lang:S.ui, section:S.section, jeu:DECOR, jeuArg:S.titres, titre:S.abo[0], sousTitre:S.abo[1],
  stockage:ABOS,
  apres: async (page) => {
    await page.evaluate(() => {
      const b = document.querySelector('#tse-sort-row [data-tse-sort-mode="subs"]');
      if (!b) throw new Error('bouton de tri « abonnements » absent');
      if (b.disabled) throw new Error('bouton de tri « abonnements » grisé : aucun abonnement en direct');
      b.click();
    });
    await page.waitForTimeout(1200);
    // Garde-fous. Une capture qui ne montrerait aucune carte dorée serait une
    // capture mensongère, et rien dans la mise en page ne le signalerait. Le
    // TOTAL importe autant : s'il dépassait douze, c'est que le relevé aurait
    // tourné malgré tout et versé les pseudos de la page de test.
    const vu = await page.evaluate(() => ({
      dorees: document.querySelectorAll('.tse-sub').length,
      total: document.querySelector('#tse-sort-row .tse-sort-count')?.textContent || '',
    }));
    if (vu.dorees !== 4) throw new Error(`cartes dorées attendues : 4, vues : ${vu.dorees}`);
    if (vu.total !== '12') throw new Error(`pastille attendue : 12, vue : « ${vu.total} »`);
  } });

}

await browser.close();
