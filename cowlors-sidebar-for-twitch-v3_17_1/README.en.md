# Cowlor's Sidebar for Twitch

Version 3.17.1 · Chrome Extension (Manifest V3) · 🇫🇷 [Version française](README.md)

A browser extension that enhances Twitch's followed-channels sidebar: live
stream uptime, collaboration badge, hiding of Hype Trains and subscription
discount banners, hiding of offline channels and empty sections, auto-expansion
of the followed list, highlighting of recently started streams, detection and
coloring of co-streams (with host/participant role extracted from the Twitch
DOM), detection of the "Live with" (squad / multistream) system, visual
normalization of sponsored cards, category and language filters (with flags), five sort modes to choose
from, locally-stored visit history, and live video preview on hover (across all
sections) with title, contextual badges, and Content Classification Label
handling.

**New in 3.0.0+**: the hover preview is now free of pre-roll ads thanks to a
built-in anti-ad module (see the dedicated section below). The main stream is
**not** affected — only the preview iframe benefits from the blocking.

The extension works **regardless of your Twitch UI language**: it locates the
followed-channels section via language-independent structural markers (falling
back to the localized French/English/German/Spanish/Portuguese aria-label).
Its own labels are in French, English, German, Spanish or Portuguese
(Brazil and Portugal), auto-detected.

---

## Installation

The extension is published on the **Chrome Web Store**: open its listing
(search for "Cowlor's Sidebar for Twitch"), click **Add to Chrome**, then
reload a `https://www.twitch.tv/` tab — the sidebar is enhanced automatically.
Updates are then handled by the browser.

### Manual install (developer mode)

You can also install it by hand, from the `cowlors-sidebar-for-twitch` folder
(or from the decompressed `.zip`) — handy for testing a development build:

1. Open your browser's extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
   - (equivalent for Opera, Vivaldi, Arc…)
2. Enable **Developer mode** (toggle in the top right corner).
3. Click **Load unpacked**.
4. Select the `cowlors-sidebar-for-twitch` folder (the one that contains
   `manifest.json`). If you started from the `.zip`, unzip it first and point
   to the unzipped folder — **not** to the `.zip` itself.
5. Open (or reload) a `https://www.twitch.tv/` tab. The sidebar is enhanced
   automatically.

No extra permission is requested: the extension only operates on `twitch.tv`
and `player.twitch.tv` pages, and never communicates with any third-party
server beyond the calls Twitch already makes itself (Twitch's public GraphQL
API, thumbnails, `player.twitch.tv` for previews).

---

## Compatibility

- **Chrome 111 or higher** (and any recent Chromium-based browser: Edge, Brave,
  Opera, Vivaldi, Arc). Version 111 is the minimum because the content script
  uses `"world": "MAIN"`, introduced at that version.
- **Firefox**: recent Firefox MV3 supports `"world": "MAIN"`, but there can be
  subtle injection-timing differences. The port targets Chromium; on Firefox,
  the original userscript (via Violentmonkey) remains the safest option.

---

## Built-in anti-ad module (v3.0+)

The extension bundles an ad-blocking module based on
**[vaft v37.0.0](https://github.com/pixeltris/TwitchAdSolutions)** by
**pixeltris** (TwitchAdSolutions project). Its sole purpose is to prevent
pre-roll ads from playing inside the hover-preview iframe, which made the
preview unusable on monetized channels.

### Execution scope

The module is intentionally **iframe-only** (concretely, the
`player.twitch.tv` iframe the extension mounts on hover). It does **not**
touch the main stream you watch on `twitch.tv`. If you want a global block
for the main stream too, install vaft separately (dedicated extension or
userscript); the bundled module detects an external version via
`window.twitchAdSolutionsVersion` and gracefully steps aside.

### Disabling

The very first non-comment line of `content.js` is:

```js
const TSE_ADBLOCK_ENABLED = true;
```

Flip it to `false`, reload the extension (`chrome://extensions` → ↻ icon on
the card), and the preview iframe becomes a plain Twitch iframe again with
no interception. The rest of the extension (stream uptime, sort, filter,
preview popup…) remains fully functional.

### Credit and license

The vaft code is licensed under **The Unlicense** (public domain). The only
modification relative to upstream is cosmetic: a `[TSE-AdBlock]` prefix
added to console logs to make them distinguishable in DevTools, and hiding
of the small "Blocking ads" banner that appeared inside the preview. The
vaft logic is intact, and the file explicitly documents every modification
in its intro comment.

The language-filter flags come from the **OpenMoji** set (CC BY-SA 4.0 licence). The **EN** (USA + UK) and **PT** (Portugal + Brazil) bi-flags, split down the vertical centre, are derived from it to represent both variants of a language with a single flag.

---

## Localization

The extension detects your Twitch UI language via the `lang` attribute Twitch
sets on `<html>`:

- A language starting with `fr` (e.g. `fr-fr`) → French interface.
- A language starting with `de` (e.g. `de-de`) → German interface.
- A language starting with `es` (e.g. `es-es` or `es-mx`) → Spanish interface (Spain and Latin America).
- A language starting with `pt` (e.g. `pt-br` or `pt-pt`) → Portuguese interface (Brazil and Portugal).
- Anything else → English interface (fallback).

All the extension's own strings (preview popup badges, filter and sort
buttons, console messages) are translated accordingly. Native Twitch labels
the extension looks for in the DOM ("Chaînes suivies" / "Followed Channels" /
"Kanäle, denen du folgst" / "Canales que sigues" / "Canais seguidos" (pt-BR) /
"Canais que segues" (pt-PT) section,
"Afficher plus" / "Show More" / "Mehr anzeigen" / "Mostrar más" / "Mostrar mais"
button, "X et N invités" / "X and N guests" / "X und N Gäste" / "X y N invitados"
/ "X e N convidados" accessibility text, etc.) are also supported across all five
languages, with a structural fallback for any other locale.

The viewer count is parsed independently of locale: decimal abbreviation +
suffix (`67,3 k` in fr, `67.3K` in en, `4.1 k` in es, `3,7 mil` / `1,2 mi` in
pt, identical in Brazil and Portugal) or a full thousands-separated number
(`29.339` in de) — viewer sorting stays correct everywhere.

If you switch languages from Twitch settings, the page reloads and the
extension picks up the new language automatically.

---

## Console API

The extension exposes a `tse` object in the Twitch page's DevTools console
(**Console** tab, `F12`). It lets you inspect the visit history used by the
"Most visited" sort:

- `tse.scores()` — prints the top-visited channels (top 10 by default).
- `tse.scores(20)` — same, with the top 20.
- `tse.scores.raw()` — returns raw data (object) instead of a formatted
  table, useful for programmatic processing.
- `tse.reset()` — wipes the entire visit history.
- `tse.diagnose()` — prints a health report of the DOM selectors the extension
  relies on (OK / broken / not applicable) and returns the raw report. A
  background auto-diagnostic also runs and warns in the console (`console.warn`)
  if Twitch changes its markup and a critical selector no longer matches —
  handy to diagnose a potential breakage.

Column labels printed by `tse.scores()` (login, score, visits, last visit)
are localized.

---

## Privacy

Visit history is **100 % local**. It lives in your browser's `localStorage`
under the `tse:visits` key, and is **never** sent anywhere. It is only used
to compute the "Most visited" sort. Use `tse.reset()` to wipe it at any
time, or clear `twitch.tv`'s site data from your browser settings.

The bundled vaft anti-ad module likewise never talks to third-party servers:
it intercepts Twitch requests inside the preview iframe and reroutes them to
other Twitch endpoints (popout player, embed) to fetch an ad-free stream.
No data leaves the Twitch circuit.

---

## Updating / modifying

If you change any of the extension files (e.g. to tweak a configuration
constant at the top of `content.js`, or to disable the anti-ad module via
`TSE_ADBLOCK_ENABLED`):

1. Save your changes.
2. Go back to `chrome://extensions`.
3. Click the reload icon (↻) on the extension card.
4. Reload your Twitch tab.

---

## File layout

```
cowlors-sidebar-for-twitch/
├── manifest.json          MV3 declaration (content script MAIN world, all_frames true)
├── content.js             all the logic: vaft anti-ad module + sidebar module
├── _locales/
│   ├── en/messages.json     English name + description (default_locale)
│   ├── fr/messages.json     French name + description
│   ├── de/messages.json     German name + description
│   ├── es/messages.json       Spanish name + description (Spain)
│   ├── es_419/messages.json   Spanish name + description (Latin America)
│   ├── pt_BR/messages.json    Brazilian Portuguese name + description
│   └── pt_PT/messages.json    European Portuguese name + description
├── icons/                 16 / 48 / 128 px icons
├── README.md              French version of this file
└── README.en.md           this file
```

---

## Porting notes (technical)

The application code mirrors the Violentmonkey userscript "Twitch Sidebar
Enhancer ADBLOCK 4" v2.22.3. Three adaptations are required by the extension
context, and a fourth transformation adds localization.

1. **`"world": "MAIN"`, `"run_at": "document_start"`, `"all_frames": true`**
   (manifest). All three directives are necessary:

   - **`MAIN`**: to expose `window.tse` to the page console, intercept
     `history.pushState`/`replaceState` from Twitch's React router, and hook
     `window.fetch`/`window.Worker` (required by the anti-ad module). Without
     MAIN world the script would run in the extension's isolated world and
     these mechanisms would be invisible to the page.
   - **`document_start`**: to intercept before any other Twitch script (vaft
     hooks, sidebar CSS, capture of the initial order).
   - **`all_frames: true`**: so the anti-ad module can inject into the
     `player.twitch.tv` iframe (MV3 equivalent of the Violentmonkey
     `@allFrames true` directive). The sidebar (TSE) module has a top-level
     guard that neutralizes it inside iframes — so in any given frame,
     **exactly one** of the two modules is active.

   The matches now include `https://player.twitch.tv/*` in addition to
   `www.twitch.tv` and `twitch.tv` to allow injection into the preview
   iframe.

2. **Inline `onerror` → `addEventListener('error', …)`** (preview popup's
   `renderPopup`, in `content.js`). Twitch's CSP (`script-src` without
   `'unsafe-inline'`) silently blocks inline event handlers parsed from
   `innerHTML` when the script comes from an extension. The userscript bypassed
   this thanks to Violentmonkey's injection privilege. The thumbnail-fallback
   semantics are strictly preserved.

3. **Bundled vaft anti-ad module** (see the dedicated section above). The code
   is imported as-is from [pixeltris/TwitchAdSolutions](https://github.com/pixeltris/TwitchAdSolutions),
   wrapped in a conditional IIFE (`if (TSE_ADBLOCK_ENABLED) (...)()`) with an
   iframe-only guard and a `[TSE-AdBlock]` prefix on console logs.

4. **Multi-language localization (FR / EN / DE / ES / PT)**. The i18n architecture is
   designed to decouple features from the detected language:

   - **Multi-language DOM matchers** (the `DOM` object at the top of the
     sidebar module): CSS selectors, regexes and label lists recognize FR,
     EN, DE, ES and PT simultaneously, with a structural fallback (language-independent
     anchors) for any other locale. That's what the extension uses to match the
     Twitch sidebar — features therefore run independently of detected
     language, and stay robust even if detection is wrong or late.

   - **Per-language UI strings** (the `S` object, a mutable alias of
     `STRINGS[LANG]`): used only for what the extension *displays* to the
     user (filter, popup badges, sort tooltips, console).

   - **Robust language detection** (`detectLanguage`) tries, in order: 1) a
     native Twitch label present in the DOM (ground truth); 2)
     `document.documentElement.lang`; 3) `navigator.language` (fr / de / es / pt
     recognized); 4) English fallback.

   - **Auto-correction** via `refreshLanguage()` called at the beginning of
     every sidebar scan. If the first detection (at `document_start`,
     before Twitch has populated the DOM) is wrong, it is corrected on the
     first scan; the root title and the filter re-translate automatically.

No other behavior change was introduced relative to userscript v2.22.3.

Internal identifiers (CSS prefix `.tse-`, `data-tse-*` attributes,
localStorage key `tse:visits`) are kept as-is despite the extension rename so
that the visit history of existing users upgrading from a previous version
remains valid.
