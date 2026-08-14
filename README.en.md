# Cowlor's Sidebar for Twitch

Version 3.22.2 · Chrome Extension (Manifest V3) · 🇫🇷 [Version française](README.md)

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

**New in 3.21.0**: the extension **gets ahead of Twitch**. Measured: Twitch takes
2 to 4 minutes to show a followed channel that goes live; the extension now
posts the card itself within 30 seconds. See "Getting ahead of Twitch" below.

**New in 3.18.0**: the extension no longer just displays Twitch's data, it
**refreshes it itself every 30 seconds** — viewer count, category, language,
stream uptime, and above all the hiding of channels that just went offline
(30 to 60 s instead of 5 to 10 min). See the "Near-live refresh" section below.

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

## Near-live refresh (v3.18+)

Twitch updates its sidebar infrequently: a channel that just went offline often
lingers there for several minutes, and the viewer counts shown are stale for
just as long. **The extension no longer merely reads that data — it refreshes it
itself, every 30 seconds.**

On sidebar cards, concretely:

| Data | Before | Now |
| --- | --- | --- |
| Viewer count | never refreshed (Twitch's value) | **30 s** |
| Category | never refreshed (Twitch's value) | **30 s** |
| Channel goes offline → hidden | 5 to 10 min | **30 to 60 s** |
| Channel goes live → shown | 2 to 4 min (Twitch) | **30 s** |
| Channel comes back → shown again | up to 5 min | **30 s** |
| Language (tags) | 5 min | **30 s** |
| Stream duration | 5 min | **30 s** |

Hiding an offline channel requires **two consecutive responses** confirming the
stream ended, so a one-off hiccup on Twitch's side never makes a channel vanish
by mistake. Hovering a card also forces an immediate check.

And since 3.21, the extension no longer merely waits for Twitch to post its
cards: it **posts its own** when Twitch lags (see "Getting ahead of Twitch"
below).

### Network cost

A **single** GraphQL operation (`TseChannels`) covers the whole sidebar at once:
it takes a list of channels and returns, for each, stream duration, viewers,
category and languages. Where three operations *per channel* were needed before,
an entire sidebar now fits in one.

The result: **refreshing ten times more often costs three times fewer requests
than before**.

| Version | Operations per minute (~30-channel sidebar) |
| --- | --- |
| 3.17.1 — refresh every 5 min | ~14 |
| 3.18 — 30 s, one operation per channel | ~62 |
| 3.20 — 30 s, one operation per batch | **~4** |

Lists are split into slices of at most 50 channels, sent in parallel: a rejected
slice only affects the channels it carried.

If the network drops, the extension **keeps the last known state** — it never
shows a false "Ended" — and pauses its requests for 30 seconds rather than
hammering the API.

### When Twitch's API answers wrongly

Twitch's API occasionally answers without any apparent error while reporting
channels as offline that are not. Taken at face value, that would empty your
sidebar in one go — which happened once before 3.22.2.

The extension now **refuses to believe a mass shutdown**: if a large share of the
channels it knew to be live are reported offline within the same cycle, it keeps
the current display, reports it in the console (`console.warn`) and retries 30
seconds later. A one-minute-stale sidebar beats an empty one.

That refusal is **bounded**: if the anomaly persists across several cycles it is
real (a Twitch outage, the end of a large event) and the extension eventually
accepts it. The safeguard delays, it does not censor. A single channel going
offline is handled normally.

Nothing changes regarding privacy or permissions: these calls stay **anonymous**
(no session token, `credentials: 'omit'`), on public data, against the same
GraphQL API Twitch already queries itself.

### Getting ahead of Twitch (v3.21+)

Measured on real usage (`tse.lag()`): **Twitch takes 2 to 4 minutes** to make the
card of a followed channel appear once it goes live. Since the extension knows
your followed channels (see "Roster") and their status is public data, it knows
before Twitch does — and posts the card itself, within 30 seconds.

**The card is a clone.** It is not hand-written: the extension duplicates an
existing card from your sidebar and rewrites its contents (name, avatar,
category, viewers, uptime). It is therefore visually indistinguishable from a
Twitch card, and everything else works on it without exception: sorting,
filters, hover preview, co-stream coloring, "fresh stream" highlighting.

As soon as Twitch finally posts its own card, ours disappears — there is never a
duplicate. It also disappears if the channel goes offline.

**Two deliberate limits:**

- If **no followed channel is live** in your sidebar, there is nothing to clone
  and the extension builds nothing. Better to show nothing than a card rendered
  approximately.
- A channel must have been **seen at least once** in your sidebar to enter the
  roster. A streamer you have just followed is therefore only anticipated from
  their second time going live.

On built cards, the viewer count is not announced by screen readers: Twitch's
exact wording varies by language and cannot be reproduced faithfully — announcing
nothing beats announcing a wrong figure. The name and category are read normally.

**Disabling.** A constant near the top of `content.js`:

```js
AHEAD_ENABLED:        true,   // false → only ever show Twitch's own cards
```

At `false`, the extension keeps learning the roster and measuring Twitch's lag,
but displays only what Twitch posts.

### Backgrounded tab

Refreshing is **suspended** while the tab is not visible: browsers heavily
throttle timers and requests there, and truncated responses would produce false
"Ended" labels. On returning to the tab, the sidebar is fully repopulated behind
the loading veil.

### Tuning the cadence

Everything is driven by a single constant near the top of `content.js`:

```js
LIVE_TTL:       30_000,   // ms — freshness of stream data
REFRESH_TICK:    5_000,   // ms — refresh wake-up
```

`LIVE_TTL` is the only one to tune: raise it to lighten traffic, lower it to get
even closer to live.

**Do not raise `REFRESH_TICK` to match `LIVE_TTL`** — counter-intuitively, that
*doubles* the real period. An entry is only written after the wake-up that asked
for it (network round-trip included), so it expires just after the *next*
wake-up, which still considers it fresh; it then has to wait for the one after.
Measured in-browser: a real period of **2.00 ×** `LIVE_TTL` with an aligned
wake-up, versus **1.17 ×** with the current setting. A wake-up that finds nothing
stale issues no request at all, so making it finer costs nothing.

Then reload the extension (`chrome://extensions` → ↻) and the Twitch tab.

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

The viewer count the extension renders (see "Near-live refresh") is **formatted
in your locale**, matching Twitch's own rendering: decimal abbreviation + suffix
(`67,3 k` in fr, `67.3K` in en, `4.1 k` in es, `3,7 mil` / `1,2 mi` in pt,
identical in Brazil and Portugal), or a full thousands-separated number
(`29.339` in de). Twitch's native counter is still parsed independently of
locale, which serves as the fallback until a channel has been resolved.

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
- `tse.reset()` — wipes the visit history, the roster and the lag measurements.
- `tse.diagnose()` — prints a health report of the DOM selectors the extension
  relies on (OK / broken / not applicable) and returns the raw report. A
  background auto-diagnostic also runs and warns in the console (`console.warn`)
  if Twitch changes its markup and a critical selector no longer matches —
  handy to diagnose a potential breakage.
- `tse.lag()` — **measures Twitch's lag** on channels going live: how long
  passes between a stream starting and its card appearing in the sidebar (see
  below).
- `tse.roster()` — lists the followed channels the extension has memorised by
  watching the sidebar (see below).

Column labels printed by these commands are localized.

### Measuring Twitch's lag (v3.19+)

The extension knows when a stream started (`createdAt`) and when **a Twitch
card** showed it as live. The gap between the two is Twitch's lag, and
`tse.lag()` reports it: median, 90th percentile, and the most recent samples in
detail.

Since 3.22, a **"gained by extension"** column additionally reports, for each
stream, the head start the extension actually took by posting its card before
Twitch. That is the figure that says whether the feature earns its keep.

A sample is only kept if the stream started **while you were watching** — after
a one-minute settling window from page load, and after your last return to the
tab. A stream that started before the extension was observing is discarded: its
card may well have been there already, so nothing can be concluded. Samples
therefore accumulate slowly, through normal usage.

Two points on what counts. Only **Twitch's own** cards are evidence: the ones
the extension builds are excluded, otherwise it would be measuring its own
speed. And a sample covers **one stream**, identified by its stream id, not a
channel: a streamer who goes offline and back within the same session is
measured each time.

This measurement is what justified the "Getting ahead of Twitch" feature: the
first samples showed 2 to 4.5 minutes of lag, without a single one under two
minutes. It keeps running, and lets you check for yourself what the extension
gains you.

### Followed-channel roster (v3.19+)

Twitch renders **offline** followed channels in the sidebar just as it does live
ones (the extension then hides them). So the extension memorises, across page
loads, the list of channels you follow — without ever authenticating or touching
a session token.

This list is what lets the extension poll beyond what Twitch displays, and so
post a card before it does (see "Getting ahead of Twitch"). A channel not seen in
the sidebar for 60 days is forgotten — which is what prevents holding on to a
channel you have unfollowed.

---

## Privacy

Everything the extension memorises is **100 % local**, stored in your browser's
`localStorage` and **never** sent anywhere:

| Key | Contents | Used for |
| --- | --- | --- |
| `tse:visits` | your visit dates per channel | "Most visited" sort |
| `tse:roster` | followed channels seen in the sidebar | posting a card before Twitch |
| `tse:livelag` | measured Twitch lag samples | `tse.lag()` |

`tse.reset()` wipes all three at any time; clearing `twitch.tv`'s site data from
your browser settings does the same.

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

5. **Autonomous data refresh (v3.18.0)**. The only deliberate functional
   departure from the userscript. The userscript, like earlier 3.x releases,
   relied on whatever data Twitch put in the DOM and re-checked live status only
   every 5 minutes. The extension now queries the public GraphQL API itself
   every 30 seconds, through a single operation (`TseChannels`) that replaced the
   three previous ones (`UseLive`, `TseLang`, and the overlapping part of
   `TsePreview`):

   - the `UseLive` persisted query and its hash were **removed** — the fields
     needed (`viewersCount`, `game`, `freeformTags`) go beyond what it returns.
     That drops a dependency on a hash Twitch may rotate, along with the inline
     fallback it required;
   - the viewer count is **rendered by the extension** into its own element,
     inserted next to the native counter, which is hidden by CSS only on cards
     that are already resolved;
   - `TseChannels` takes a **list** of logins (`users(logins:)`): an entire
     sidebar fits in one operation instead of one per channel. Lists are split
     into slices of 50 channels, evaluated independently. Corollary: since the
     response guarantees neither the order nor the completeness of the array,
     it is indexed **by login** and never by position, and a login missing from
     the response is treated as "unknown" — never as "offline".

   See the "Near-live refresh" section for the functional details and the tuning
   constants.

6. **Built cards (v3.21.0)**. The second deliberate functional departure from
   the userscript, and the only one that makes the sidebar show anything other
   than what Twitch put there. Three pieces:

   - a **roster** of followed channels, learned by watching the sidebar — Twitch
     renders offline followed channels there as well as live ones, which makes
     the list recoverable without ever authenticating;
   - **polling** that roster at the same cadence as everything else, made
     affordable by `users(logins:)`;
   - **building by cloning** a native card rather than hand-written markup: that
     is what guarantees the rendering and compatibility with sorting, filters
     and preview. The clone is scrubbed of everything belonging to the source
     card — our own injections, extra rows, `id`s (which would be duplicated in
     the document) and ARIA labels (which would announce the wrong streamer).

   Built cards are excluded from the internal counters that gauge Twitch's own
   activity (the "Show More" auto-expansion, loading-veil stability, original
   Twitch order, auto-diagnostic): including them would mean mistaking our own
   work for Twitch's.

   Disable with `AHEAD_ENABLED: false`.

No other behavior change was introduced relative to userscript v2.22.3.

Internal identifiers (CSS prefix `.tse-`, `data-tse-*` attributes,
localStorage key `tse:visits`) are kept as-is despite the extension rename so
that the visit history of existing users upgrading from a previous version
remains valid.
