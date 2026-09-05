# Cowlor's Sidebar for Twitch

Version 3.57.0 · **Firefox** Extension (Manifest V3) · 🇫🇷 [Version française](README.md)

> **Firefox branch.** This repository has two release lines. `claude/chrome`
> carries the Chrome / Chromium build; this branch carries the Firefox build.
> The **only** shipped file that differs between them is `manifest.json` —
> `content.js` and `adblock.js` are byte-for-byte identical, and a checker
> guarantees it (see "[The Firefox port](#the-firefox-port-v3553)").

A browser extension that enhances Twitch's followed-channels sidebar: live
stream uptime, collaboration badge, hiding of Hype Trains and subscription
discount banners, hiding of offline channels and empty sections, auto-expansion
of the followed list, highlighting of recently started streams, detection and
coloring of co-streams (with host/participant role extracted from the Twitch
DOM), detection of the "Live with" (squad / multistream) system, visual
normalization of sponsored cards, category and language filters (with flags), six sort modes to choose
from, locally-stored visit history, and live video preview on hover (across all
sections) with title, contextual badges, and lifting of the content
classification gate that used to block video on labelled channels.

**New in 3.32.0**: a second mode, **"Top Channels"**, shows the most-watched
channels on Twitch — globally, within a category, or in a given language.
Twitch does not hand out that ranking: its API claims to sort and does not. The
extension **rebuilds** it, and says so when it cannot prove the result. See
"Top Channels" below.

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

The extension is published on **addons.mozilla.org**: open its listing
(search for "Cowlor's Sidebar for Twitch"), click **Add to Firefox**, then
reload a `https://www.twitch.tv/` tab — the sidebar is enhanced automatically.
Updates are then handled by the browser.

### Manual install (temporary)

You can also load it by hand, from the `cowlors-sidebar-for-twitch` folder
(or from the decompressed `.zip`) — handy for testing a development build:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select the folder's **`manifest.json`** — not the folder itself. That is the
   difference from Chrome, which expects the folder. If you started from the
   `.zip`, unzip it first.
4. Open (or reload) a `https://www.twitch.tv/` tab. The sidebar is enhanced
   automatically.

An add-on loaded this way is **temporary**: Firefox forgets it on shutdown. An
install that survives a restart needs a signed package — so, AMO.

No extra permission is requested: the extension only operates on `twitch.tv`
and `player.twitch.tv` pages, and never communicates with any third-party
server beyond the calls Twitch already makes itself (Twitch's public GraphQL
API, thumbnails, `player.twitch.tv` for previews).

---

## Compatibility

- **Firefox 140 or higher.** The floor is not picked, it is **derived** from
  two manifest keys, and the more recent one wins:

  | What we declare | Since |
  | --- | --- |
  | `"world": "MAIN"` in `content_scripts` | Firefox **128** |
  | `browser_specific_settings.gecko.data_collection_permissions` | Firefox **140** |

  Hence 140. Dropping to 128 would make the manifest inconsistent with itself,
  and Mozilla's `addons-linter` says so in as many words. The cost is nil: ESR
  128 went out of support on 16 September 2025 and the active ESR is 140 — the
  128-139 range is no longer inhabited by any maintained build.
- **Firefox for Android 142 or higher** (`gecko_android`), the data-collection
  key having landed there two versions later. Note that the followed-channels
  sidebar does not exist on mobile Twitch: compatibility is declared there for
  consistency, not for usefulness.
- For **Chrome, Edge, Brave, Opera, Vivaldi, Arc**, see the `claude/chrome`
  branch: same code, manifest without the `browser_specific_settings` block.

---

## The Firefox port (v3.55.3)

### What changes, and it is little

**Exactly one shipped file differs: `manifest.json`.** `content.js` and
`adblock.js` are byte-for-byte identical across the two branches, and the
`content_scripts` block is identical too — a checker compares it against a
constant and fails if it drifts (`npm run addon`). That is the port's promise,
and it is kept by a machine rather than by an intention.

That narrowness is no accident: the extension **calls no extension API at
all**. No `chrome.*`, no `browser.*`, no runtime, no storage, no background, no
popup, no options page, not a single permission. It is only a content script.
So there is no dialect to translate — the port reduces to the manifest.

What the manifest gains:

```json
"browser_specific_settings": {
  "gecko": {
    "id": "cowlors-sidebar@maxezify.github.io",
    "strict_min_version": "140.0",
    "data_collection_permissions": { "required": ["none"] }
  },
  "gecko_android": { "strict_min_version": "142.0" }
}
```

- **The ID is mandatory under MV3**: AMO no longer assigns one. Without it the
  submission is rejected — it was the only *error* the Chrome manifest drew
  from Mozilla's linter.
- **`data_collection_permissions` is mandatory** for every new extension since
  **3 November 2025**. The honest value here is `"none"`: the extension neither
  collects nor transmits anything, which the rest of this document details and
  which the total absence of permissions makes checkable.

### Two APIs Chrome has and Firefox does not

The code needed no change, but it had to be established that it **degrades
correctly**. Only two calls are involved, both already guarded:

| API | Firefox | What the code does without it |
| --- | --- | --- |
| `location.ancestorOrigins` | absent before ~148 | the preview bridge falls back to the two manifest-declared origins to target its `postMessage` |
| `requestVideoFrameCallback` | since 132 (so present at the floor) | the three-signal race runs on the remaining two — `playing` and `readyState` |

The first is **the** divergence of the port. If its fallback were broken, the
preview would never reveal on Firefox, and nothing in the code would say so:
the bridge would simply stay silent.

### What is verified, and by what

Precision matters here, because the difference does.

**Verified.** The manifest passes Mozilla's `addons-linter` — the very one AMO
runs on submission — with **zero errors**. Bench scenario 61 replays Firefox's
behaviour: `requestVideoFrameCallback` is genuinely removed from the page, and
the `ancestorOrigins` read is neutralised at build time on a copy
(`content.firefox.test.js`), because it cannot be neutralised any other way —
the property is `[LegacyUnforgeable]`, own and non-configurable. Measured, not
assumed: `delete location.ancestorOrigins` returns `false`, the prototype
variant returns `true` **while removing nothing**, and redefining throws a
`TypeError`. The first draft of that scenario believed it was deleting the
property and was deleting nothing; its assertions were green and were testing
no one. A guard on the fixture itself is what said so.

**Verified on a real Firefox — the open question is closed.** The development
environment cannot launch Firefox: its network policy blocks the download of
Playwright's binary, so the whole bench runs under Chromium, including the
scenarios that simulate Firefox. What remained was the thing no simulation can
give: does `MAIN`-world injection at `document_start` land before Twitch's own
scripts in Mozilla's engine? The documentation says it does — *"content scripts
at `document_start` always run before page scripts"*
([bug 1388429](https://bugzilla.mozilla.org/show_bug.cgi?id=1388429)) — but
documentation is not a measurement.

The measurement was taken, on Firefox, with the procedure below. Reading:

| Check | Result |
| --- | --- |
| `MAIN` world — `window.tse` visible from the page's console | ✅ `object` |
| extension CSS in place | ✅ |
| boot ran to completion — `history.pushState` wrapped | ✅ |
| **`adblock.js` captured the NATIVE `fetch` inside the player iframe** | ✅ `true` |

The last line is the one that settles it: the value captured before replacement
is the native `fetch`, so **nobody had wrapped it before us**. `document_start`
in the `MAIN` world behaves the same under Gecko as under Chromium.

**What still rests on the bench rather than on Firefox.** The functional
behaviour — previews, gate lifting, sorting, filters — remains proven under
Chromium, plus scenario 61 which replays Firefox's gaps. The platform risk is
cleared; the rendering risk only by transitivity.

### How to check `document_start` on Firefox

Load the extension via `about:debugging#/runtime/this-firefox` → **Load
Temporary Add-on…** → the `manifest.json`. Firefox does **not** inject into
already-open tabs: open `https://www.twitch.tv/` *afterwards*, or reload.

#### 1. Is the script running, and in the right world?

Console (**F12**), then:

```js
(() => {
  const s = document.getElementById('tse-css');
  const native = (f) => { try { return /\[native code\]/.test(Function.prototype.toString.call(f)); }
                          catch { return false; } };
  const out = [];
  const say = (c, ok, d) => out.push({ check: c, verdict: ok ? '✅' : '❌', detail: String(d) });
  say('1. MAIN world — window.tse visible from the page',
      window.tse != null && typeof window.tse === 'object', typeof window.tse);
  say('2. the extension CSS is in place', !!s, s ? 'yes' : 'missing');
  say('3. boot ran to completion — history.pushState wrapped',
      !native(history.pushState), native(history.pushState) ? 'native' : 'wrapped');
  console.table(out);
  return out;
})();
```

All three must be green. Check 1 is the one that proves the `MAIN` world: in an
isolated world, `window.tse` would be invisible from the page's console. They
say **nothing**, however, about when the injection happened.

#### 2. Ordering: why the DOM cannot answer it

An earlier version of this page suggested looking at **where** the
`<style id="tse-css">` had landed: first child of its container, ahead of every
`<script>`. On a static page the measurement is sound and discriminates cleanly
— verified under Chromium, varying nothing but `run_at`.

On the real Twitch it is worthless, and the reading shows it: the `<style>` sits
as the **76th** child of `<head>`. Twitch rewrites its `<head>` continuously
while its SPA boots — preloads, component stylesheets, bundle chunks — and some
of those nodes are inserted **at the front**, pushing ours back. The position
you observe is today's, not the injection's. It proves neither earliness nor
lateness.

The container also differs between engines, without that being a defect:
Chromium has created only `documentElement` when it injects, where Gecko has
already built a full skeleton. Mozilla documents it: *"the parser sets up the
initial skeleton DOM before unblocking scripts and allowing the
`document-element-inserted` event to be dispatched, so more than just the
document element exists when the event is fired"*
([bug 1333990](https://bugzilla.mozilla.org/show_bug.cgi?id=1333990)).

#### 3. Ordering: the only measurement that holds

What is needed is a fact **captured at injection time** that the page cannot
rewrite afterwards. The ad blocker provides one: `adblock.js` captures
`window.fetch` before replacing it, and keeps what it captured. If that value is
**native**, nobody had wrapped it before us — the race is won, and that is
precisely the guarantee `document_start` is supposed to offer.

`adblock.js` only works inside the player iframe (it stands down on the main
stream, see its `window.top === window` guard). But the preview iframe dies the
moment you leave the hovered card — before you could switch context in the
tools. So we build one that stays. On `https://www.twitch.tv/`, in the console:

```js
const f = document.createElement('iframe');
f.id = 'tse-sonde';
f.src = 'https://player.twitch.tv/?channel=twitch&parent=www.twitch.tv&muted=true';
f.style.cssText = 'position:fixed;bottom:0;right:0;width:400px;height:225px;z-index:99999';
document.body.appendChild(f);
```

Then, **in the DevTools toolbar, the context picker** — the frame-shaped icon on
the right; if it is not visible it sits in the `»` overflow menu. Pick the
`player.twitch.tv` entry. The console now works inside the iframe. Type:

```js
/\[native code\]/.test(String(window.__vaft2RealFetch))   // → expect true
```

- **`true`** → `adblock.js` captured the native `fetch`: it got in ahead of every
  page script. `document_start` is confirmed and the port is sound.
- **`false`** → someone had already wrapped `fetch`: we came second.
- **`undefined`** → either the console is still on the top frame (`adblock.js`
  deliberately stands down there), or the content script was not injected into
  the iframe.

When done, switch back to the page context and remove the probe:

```js
document.getElementById('tse-sonde').remove();
```

Finally, **watch the console for errors on load**. A precise canary:
`detectLanguage()` reads `document.documentElement.lang` with no guard. If Gecko
injected even earlier than Chromium — before `documentElement` itself — the error
would be `can't access property "lang", document.documentElement is null`, and it
would be loud. Its absence is information.

### The package, and the warnings that remain

The first submission to AMO returned **17 warnings**, where the local check
showed only 12. The gap was no accident: the `.zip` contained **the whole
repository** — `promo.mjs`, `promo-marquee.mjs`, the `tests/run.mjs` harness and
its `tests/page.html` with inline scripts — and the validator was judging five
files that never run on anyone's machine.

The local check, for its part, passed `--ignore-files` to the linter: it
validated a **hypothetical** package, the one we would have liked to send. That
is the kind of check that reassures without guaranteeing anything.

So `npm run addon` now assembles the package into `dist/paquet/` from an
**allowlist** — `manifest.json`, `content.js`, `adblock.js`, `icons/`,
`_locales/` — then runs the linter on **the package**, with no exclusions. A
denylist ("ignore this, ignore that") would have recreated the flaw with the
first file added: what you forget to exclude ships. The allowlist has the
opposite failure mode, which is the right one: what you forget to include is
**missing**, and a check sees it — every file the manifest names must be
present, and nothing may come from outside the list. `npm run package` turns it
into the `.zip` to submit.

### The package ships without its comments (v3.59)

This repository comments a lot, and deliberately so: half of what is known
about this product is written in its margins. But that half lives **here**, in
a public repository — it has no business travelling into every installation, or
through the review queue. `npm run addon` therefore strips the comments from
the assembled code:

| File | Before | After | Comments |
| --- | --- | --- | --- |
| `content.js` | 568 KB | 263 KB | 2,743 JS + 77 CSS → **2** |
| `adblock.js` | 124 KB | 100 KB | 290 → **2** |
| **both** | **692 KB** | **363 KB** | **−47 %** |

These figures are **checked against the measurement** on every assembly, here
as in `README.md` and `store/README.md`. They are not computed, they are
copied — and a copied number goes stale in silence: the store listing claimed
a 391 KB package for two versions, which was the JavaScript saving **alone**,
while the CSS was being stripped too. So `npm run addon` re-reads all three
documents and compares what they claim against what it has just weighed,
within 3 %: wide enough for a version's ordinary growth, too narrow for a
sentence describing the previous product.

**The stripping affects the package ONLY.** It applies to the copy assembled in
`dist/paquet/`, never to the repository's files: `content.js` keeps its 2,743
comments on the development branches, and `npm run addon` re-reads the sources
after assembly to confirm it — a write aimed at the root instead of the package
would fail the check. The `claude/firefox-prod` and `claude/chrome-prod`
branches are the artefact: they exist only to be downloaded and submitted.

What the package does **not** become: minified, or obfuscated. Names, line
breaks and indentation are the repository's, line for line — the "full source
code readable" promise on all twelve listings stays true to the word.

**Legal notices stay**, and that is not politeness: `adblock.js` is third-party
code under the MIT licence, which requires its notice to accompany "all copies
or substantial portions of the Software"; the flags and globe in `content.js`
come from OpenMoji under CC BY-SA 4.0, which requires attribution. Removing
them would have been an infringement, not a saving. Every comment carrying
`Copyright`, `Licence` or `License` is therefore kept verbatim — exactly the
four that remain.

#### Two guards, and they do not prove the same thing

A naive split would break the file silently, and there is no silence more
complete than an extension that no longer starts. The sequence `//` appears in
every URL in the file; a block opener can live inside a string. The split is
therefore done by **acorn**, never by a regular expression.

1. **The token stream**, checked at every assembly: both texts must produce the
   same tokens, same values, same order. Nothing other than a comment can then
   have gone.
2. **Execution**, because the first is not enough. Automatic semicolon
   insertion is **invisible** in a token stream: `return` followed by a
   multi-line block and then `5` yields `undefined`, while the same tokens
   without the line break yield `5`. A block comment containing a line break is
   therefore replaced by a line break, and bench scenario 66 runs six trap
   snippets before and after to prove it.

#### CSS is not JavaScript

The stylesheet lives in a template literal — `const CSS = \`…\`` — and to acorn
that is a **string**. Its 77 comments are therefore not JavaScript comments,
and the first pass never sees them. A second pass removes them, and it has
traps of its own:

- a `/*` inside a CSS string (`content: "/*"`) opens nothing;
- a comment **glued to a token on both sides** cannot be removed without
  changing the rule: `foo/*x*/bar` is two identifiers and would become
  `foobar`, one; replacing it with a space saves nothing either, since in a
  selector `.a/*x*/.b` is `.a.b` and a space would make it `.a .b`. Neither
  replacement is right everywhere, so only comments with **whitespace on at
  least one side** are removed — all 77 qualify;
- a comment that would straddle a `${…}` interpolation is left alone, for want
  of a way to decide.

The pass is **targeted by variable name**. Sweeping every template literal
would break the day one of them held SVG or HTML containing `/*` — there it is
not a comment, and removing it would change what is displayed. Exactly one
literal in the file contains that sequence today, and it is the CSS.

**The proof is not made in Node**: the browser is what reads this CSS, so the
browser is what gets asked. The bench takes the sheet the extension actually
injected — interpolations resolved — strips it, has Chromium parse both, and
compares its object model: **139 rules, same order, same declarations**.

That comparison failed at first, and the failure was worth having: Chromium
**normalises** what it hands back — `#fff` becomes `rgb(255, 255, 255)`,
shorthands are expanded — **except values containing a `var()`**, which it
returns as written, mid-value comment included. One rule in the file has one in
its `background`. Rules are therefore compared with comments removed from both
sides — which costs nothing, since the one genuinely dangerous case (a comment
removed between two tokens of a value) falls exactly where Chromium normalises,
and so stays visible.

Finally, `npm run prod` — which publishes the PROD READY branches — replays the
**whole bench on the file as it ships**, comment-free. A release is rare; the
five minutes it costs are the best bargain in the repository.
`npm run test-livre` does the same on demand.

#### What this changes at submission time

The submitted file is no longer, byte for byte, the repository's: it is a file
**produced** by a build step. AMO then asks to be able to get back to the
source, which is immediate here — the repository is public, the development
branch carries the commented `content.js`, and `tests/degraisser.mjs` is the
only transformation applied. Nothing is minified or obfuscated, so the rule
that actually matters for review ("readable code") is untouched. If the form
asks for a source archive, hand it the `claude/firefox` — or `claude/chrome` —
branch.

### The rendering no longer builds markup (v3.56.0)

The twelve remaining warnings were all of one code —
`UNSAFE_VAR_ASSIGNMENT` — on the rendering's `innerHTML`, `insertAdjacentHTML`
and `outerHTML` writes. They are at zero.

The linter accepts only **static** markup: a literal passes, a variable does
not — not even a constant holding nothing but a literal, which was measured and
which closes the door on any trick. So the only honest way out was to build the
DOM instead of assembling strings.

This is not a safety fix: the escaping was in place, and the twelve sites had
been read one by one. It is a **fragility** fix. The safety depended on no call
ever forgetting `escapeHtml`, and no code review guarantees that for the
future. From now on the values that come from Twitch — channel names,
categories, titles, brands — go through `textContent` or `setAttribute`, which
cannot interpret anything.

**`escapeHtml` has disappeared from the file for want of a caller.** That is the
shortest proof the conversion is complete: there is no escaping left to forget.

Three things moved:

- **`badgeHtml` returns a node** (`badgeNoeud`), and the six badge sites insert
  through `replaceWith`, `prepend`, `before`, `appendChild`.
- **HTML has been lifted out of the locale tables.** `uiBadgeCostreamOf`
  returned `Co-stream of <strong>${name}</strong>`; it now returns plain text
  where the name's place is marked by a `\u0000`, and the renderer inserts a
  DOM-built `<strong>` there. Twenty functions, five languages — **not one word
  of the wording changed**, only the markup came out.
- **`noeudStatique` is the one door left to an HTML parser**, and it is reserved
  for markup written inside `content.js`: SVG icons, flags, skeletons. The
  addons-linter does not watch `DOMParser` — pushing external data through it
  would silence the warning without fixing anything, which would be worse than
  the warning. The rule is written in the code, next to the function.

The bench covered neither those badges' content nor this property: the rewrite
could have lost the names' `<strong>` without breaking anything visible.
Scenario 62 now checks it on both paths by which Twitch text reaches the DOM —
a squad guest's name and a category — with the same payload:
`<img src=x onerror="…">`. It is displayed character for character, no element
is created, nothing runs. The mutation that puts an `innerHTML` back at either
place makes it fall.

The count is still held by a **ratchet**: `content.js` is allowed zero
warnings, like every other file. The first one to appear fails `npm run addon`.

---

## The category switch (v3.57)

Twitch announces nowhere that a channel has just changed category. The
information **is not in its API**: it is born from comparing two readings — and
the pipeline makes one every 30 seconds, for every channel you follow, since
3.18. It was thrown away on every round.

Yet that is the moment a "variety" streamer becomes interesting to someone who
follows one specific game. The hover preview therefore carries a lime badge,
**"Just switched to X"**, which lives ten minutes and clears itself.

### What the register does not do

**It does not report a stream start.** Going from "offline" to "live on X" is
not a switch: it is a channel beginning, which the card already says. The
distinction is read from `stream.id`, which changes with every new session — a
field the `TseChannels` query already returned and nothing used. Same
identifier **and** a different category: only then has something happened.

**It does not survive a reload**, and that is not a limitation we suffer. After
a reload the extension has observed nothing; producing a badge then would be
inventing it. It reports only what it saw — the same rule as the subscription
badge, which stays quiet when the tenure is unknown.

### The badge expires, and that is half its behaviour

Ten minutes. Past that, the category shown on the card is enough, and the badge
would lie by omission by suggesting the switch just happened. The bench tests
expiry with the same mechanism as every other production duration:
`tests/build.mjs` brings `CATEGORY_SWITCH_TTL` down to 2.5 s, so it is the real
code and the real clock that expire the entry.

### The colour, by arithmetic

The eight hues already taken left one wide slot. The optimum is at **93°**, 54°
from the nearest neighbour; turquoise or cyan would have offered only 26 to 27°
from sponsor and co-stream. We settle at 91° — 52° from ex-sub, 54° from sub —
for 7.15:1 of contrast, inside the family's range (6.38 to 7.67).

### A guard doing two jobs

The first draft had the session guard also protecting access to the previous
category. Removing it to put it to the test therefore did not fail a test: it
**crashed the page**. A guard doing two jobs breaks silently the moment you
touch it. They are now separated, one per question, and mutating the session
guard alone produces exactly the error we want to see — "Just switched to
Minecraft" on a channel that has merely started.

---

## Ten languages (v3.57)

The interface speaks Italian, Polish, Russian, Japanese and Simplified Chinese,
on top of the original five. That is **630 strings** across ten tables, which
`npm run parity` keeps rigorously aligned: a key forgotten in a single language
used to crash `tse.lag()` for its users with nothing to signal it — which is
what happened to Portuguese.

### The Slavic plural

French and English have two forms; **Polish and Russian have three**, and the
third takes over on 11 to 14 despite their units digit:

| n | Polish | Russian |
| --- | --- | --- |
| 1, 21, 31… | miesiąc | месяц |
| 2-4, 22-24… | miesiące | месяца |
| 5-20, 25-30, **11-14** | miesięcy | месяцев |

The rule is written **once** (`plurielSlave`) rather than copied into six
functions, where a single wrong branch would have gone unnoticed by any
non-Slavic reader. Scenario 64 checks it against a table of values written by
hand from the grammar — never copied from the code's output, which would only
have confirmed its own bug. The mutation that forgets the 11-14 exception makes
it fall, naming both offending values.

### What those five languages do not have, and why

The five new languages **have no native Twitch label** in the detection table.
That step compares exact strings captured from Twitch's DOM ("Chaînes suivies",
"Followed Channels"…); inventing one would mean writing code that will never
match while looking like it covers the language.

They are therefore detected through `html.lang` then `navigator.language`,
which require no knowledge of Twitch's interface, and the sidebar holds on its
**structural anchors** (`followed-side-nav-header`) — exactly the fallback
designed from the start for any unlisted language. Scenario 64 removes the
French label from the harness to reproduce that situation: both fallbacks are
exercised together.

`zh-TW` falls back to the `zh` table through the two-letter prefix rather than
to English — Simplified Chinese beats English for a reader in Taiwan.

### Two labels that did not follow the language

The work surfaced an old defect. `refreshLanguage()` runs on every scan and the
module header advertises self-correction, but the mode tabs and the sort
buttons set their label **at creation** and never moved it again. A language
switch after boot — Twitch is an SPA, you can change language without reloading
— therefore left tabs frozen in the old language while their `aria-label` did
follow: the interface was saying two things at once. Both are now refreshed,
by conditional write as everywhere else in this module.

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

### The "Streaming together" case (v3.23)

On a co-stream card, Twitch does not display the streamer's own audience but
**the session's combined audience**. The gap is not cosmetic: for one guest,
1,166 viewers of their own against 11,821 for the session — a factor of ten.
Naively refreshing the counter with the streamer's own audience therefore meant
showing `1.2K` where Twitch shows `11.8K`.

The extension now picks up the combined counter and displays that one, in
agreement with Twitch. It comes from the **Guest Star response already
requested** to group co-streams: no extra request.

That combined counter is what **sorting** uses too (v3.24.1). Sorting on a
number other than the one displayed produces a list the eye reads as broken: two
co-streamers both marked "11.5K" ended up one at the top of the ranking and the
other in the middle of the "1.7K"s, each filed under its own audience. Sorting
therefore follows what you read, as Twitch does.

Corollary for the "co-streams first" sort: a group's audience is the **largest**
counter among its members, not their sum. Every member already displays the
session's combined figure, so adding them up would count the same audience N
times and mechanically push large groups to the top.

### The second of black between thumbnail and video (v3.27)

The preview first shows a **JPEG thumbnail**, then switches to the Twitch player.
Between the two there was about a second of black.

The fade already existed. The problem was the **timing**: the switch fired on the
iframe's `load` event, which signals the end of the player *document* loading —
not the arrival of a picture. So a still-black player was faded in over the
thumbnail, and then the video was awaited. Lengthening the fade would only have
softened the arrival of the black.

The iframe being on another origin, the page cannot observe anything inside it.
So the iframe speaks instead: a tiny module in it watches for the **first frame
actually presented** (`requestVideoFrameCallback`, falling back to the `playing`
event and to `readyState`) and posts a message to the parent, which then runs its
fade — lengthened
to 0.35 s, now that it has two pictures to cross-fade rather than a picture and
black.

If that signal never arrives — player reworked by Twitch, video refused — a
safety net reveals the iframe anyway 1.5 s after `load`. At worst that is the old
behaviour; never a preview stuck on its thumbnail.

### The black BEFORE the thumbnail (v3.28)

The previous fix handled the thumbnail → video switch. A second black remained
upstream of it: on some channels the preview opened on a black rectangle, the
thumbnail arrived one to two seconds later, then the video.

The cause was the thumbnail URL. It ended in a parameter timestamped **to the
millisecond**, meant to defeat the browser cache — Twitch regenerates these
images every few minutes, and without it the same one would be served forever.
But at that precision **every hover produced a unique URL**: the cache could
never serve anything back, not even when returning to the channel two seconds
later. Every hover was a download. That also explains the "sometimes it works":
only the CDN-side cache decided.

The parameter is now rounded to a **2 min 30 bucket**, aligned with the rate at
which Twitch regenerates these images rather than finer than it — which would
only buy extra downloads. The URL stays stable for the whole bucket, so a repeat
hover displays instantly. The thumbnail may be a few minutes old — irrelevant for
a picture shown for one second before the live stream takes over.

A channel's first display still depends on the network. Two details make it less
abrupt: the thumbnail **fades in** as well, and the waiting background is no
longer black but the panel's own shade — a black rectangle reads as a failure,
the panel colour reads as loading.

### Warming thumbnails ahead of time (v3.30)

Measured: the thumbnail of a never-hovered channel takes anywhere from **89 ms
to 1.8 s** to arrive — a factor of 20, a property of Twitch's CDN for that
channel at that moment, over which the extension has no lever. Once in the
browser cache, the same hover costs **~40 ms**.

So the extension warms them in advance, and the rule is the opposite of the
intuitive one: **it does not preload when the pointer enters the sidebar**.
Entering the sidebar means landing on a card, hence opening a preview — the
moment the network is busiest. It preloads when the pointer is **elsewhere**,
and the pass is long finished by the time you come back.

The cadence follows the **cache bucket**, not a period: the URL is
`floor(now / 2 min 30)`, so a free-running timer would land at an arbitrary
offset from the boundary and throw away half its work on average. The refresh
tick, being finer, sees the flip within 5 seconds.

**What it costs.** About 25 to 40 requests per bucket for an ordinary sidebar, i.e.
~15 MB/hour — 5% of a 360p stream, 1.4% of a 1080p one. At most three requests
in flight, at low network priority: a hundred channels warm up in a dozen
seconds within a 150-second bucket. Nothing is sent when the tab is in the
background, nor in data-saver mode. Toggle with `PREVIEW_PRELOAD_ENABLED`.

**A hover is never slower than before.** Either the thumbnail is already there,
or its request is in flight and the popup's image joins it — same URL, the
browser does not duplicate it — or it was never requested and that is the old
path, at normal priority, hence ahead of any leftover pass. Interrupting means
*stop issuing*, never cancel: cutting an in-flight request could cut precisely
the one just hovered.

**Memory.** A thumbnail weighs ~25 KB encoded but **~506 KB decoded**. No
reference is kept on preloaded images: the browser keeps the encoded bytes in
its cache — what we want — and frees the decoded bitmap. Without that care, a
hundred channels would pin ~50 MB of invisible bitmaps.

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

- The extension only clones a **plain** card: not sponsored, not in a
  co-stream, carrying no collaboration badge or banner. Whatever the template
  card carries would be copied onto the built channel. If your sidebar holds no
  plain live card, the extension builds nothing — better to show nothing than a
  card bearing another channel's markings.
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

### Backgrounded tab (revisited in v3.61)

Refreshing is **suspended** while the tab is not visible: browsers heavily
throttle timers and requests there, and truncated responses would produce false
"Ended" labels.

That sentence was true of the **periodic wake-up**, and of nothing else. Twitch
keeps mutating its DOM in a hidden tab — chat above all, but also the sidebar
when a stream ends — and every one of those mutations triggered a full sweep,
and therefore requests, in a tab nobody is looking at. The gate was missing on
that path. It is there now.

**What stops, tab hidden:**

| | Before | After |
| --- | --- | --- |
| Refresh wake-up (5 s) | already stopped | stopped |
| Mutation-driven sweep | **every mutation** | noted, not run |
| GraphQL requests | **yes** | none |
| Local display refresh (60 s) | ran for nothing | stopped |
| Observer cost, per mutation batch | **149 µs** | **0.35 µs** |

**What comes back, and how.** The return distinguishes two cases. An absence of
a minute or more counts as a restart: veil, cache purge, full repopulation —
the state has become too uncertain to patch. A shorter absence simply replays
the **withheld sweep**: everything Twitch changed while away is caught up in one
pass, with no veil. And the local display — stream uptime, "fresh stream" — is
refreshed along with it, since its own wake-up had stopped too.

One case was missing, and nothing covered it: **the tab that is born hidden** —
a link opened in the background, a session restored at browser startup. The code
asked "did I see this tab go hidden?"; the answer was no, and the return
therefore did nothing at all. The catch-up now applies to that first look too.

Bench scenario 67 exercises all five cases, and the last one simulates nothing:
it **actually freezes the page** through the DevTools protocol — timers
suspended, nothing running — then wakes it, and checks the sidebar comes back
whole.

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

**Lowering `LIVE_TTL` below 30 s gains nothing for the viewer count.** Measured
against the public API (polled every 5 s for 5 min, large channels):
`viewersCount` only changes about **once every 60 seconds**, with a cache of its
own per channel — counters do not move in step. At 30 s the extension is
therefore never more than half a period behind the value Twitch exposes: the
floor is not in the extension, it is at Twitch. Detection of channels going live
or offline, on the other hand, does depend on this constant.

Then reload the extension (`chrome://extensions` → ↻) and the Twitch tab.

---

## My subscriptions first (v3.43+)

A sixth sort mode, sitting between "viewers" and "personal popularity": the
channels you are subscribed to rise to the top of the list.

### Why this is not a request

"Which channels am I subscribed to" is **private** data, and Twitch's GraphQL
schema says so plainly:

> `UserSelfConnection.subscriptionBenefit` — *The subscription benefit
> relationship between **the authenticated user** and another user. Null if the
> authenticated user is not subscribed to the other user.*

Measured, not assumed: an anonymous request for that field comes back with
`self: null`. Getting it would mean sending your session token — that is,
giving up what this extension promises everywhere else.

### What it does instead

It **reads what the page already shows**. On a channel page, the subscribe
button changes its `data-a-target` according to your state — not merely its
label, which would have made the reading language-dependent:

| | `data-a-target` |
| --- | --- |
| subscribed | `manage-sub-button` |
| not subscribed | `subscribe-button` |

Captured on two real channels, one in each state. It is the same kind of
structural hook the extension already uses to find the followed section or the
cards: independent of the UI language, and stable until Twitch reworks its
markup.

**No request, no token, no extra permission.** The status is noted in passing,
when you open a channel, and stored in `tse:subs`.

### The full list, without ever touching your token (v3.44)

Reading as you browse only knows the channels you opened. Twitch, however,
publishes the complete list at `/subscriptions` — a page of **your** account,
which your browser already knows how to render.

So the extension loads it in a **hidden iframe**, reads it, and removes it.
Three facts measured before a line was written:

- `www.twitch.tv` allows itself to be framed. Many sites forbid it
  (`X-Frame-Options`); this one does not;
- the iframe being **same-origin**, its document is readable;
- each subscription there is a `[data-a-target="subscription-card"]` holding
  the channel's link. Captured: 3 cards in the "paid" tab, 1 in "gifts" —
  exactly what the page shows.

**The extension has no access to your token and sends none.** It asks for a
page; the browser authenticates it with its cookies, exactly as if you had
clicked the link. Nothing leaves your machine.

The cost is real, though: a whole React application boots in the background.
Hence a **rare** scan — once every 6 hours — once per page, and never two at
once. `tse.subs.refresh()` forces one on demand.

An **empty** tab — no gifted subscription, no mobile one — renders no card, and
nothing tells it apart from a slow page. It therefore cost the guard rail's
full 25 seconds, twice, for an account holding only paid subscriptions. The
`/subscriptions` page also renders Twitch's **sidebar**: as soon as it appears
the application is up, and if no card follows within 5 seconds, the tab is
empty rather than slow (v3.47). Measured on the bench: 12.7 s for two empty
tabs without that shortcut, under 7 s with it.

### During the load, not after it (v3.45)

Up to 3.44 the scan started 25 seconds after boot. The sidebar was therefore
already there, visible and sorted, when the subscriptions arrived: the styling
of subscribed channels appeared as an afterthought.

The trigger is no longer a timer but a **fact**: the first scan that sees a
followed card. That is the exact moment Twitch has finished populating the bar
— the loading veil still covers it, so the scan has time to land before you see
anything at all.

That trigger carries a second property, for free: **a signed-out session has no
followed channels.** It therefore never requests the authenticated page. The
one case where the scan would find nothing is also the one where it costs
nothing.

And on the very first boot — extension freshly installed, nothing in memory —
the veil **waits** for the scan, for at most 4 seconds. On later boots it waits
for nothing: known subscriptions are read back from disk before the first scan,
the styling lands with the first card, and the scan merely refreshes in the
background.

### "Subscribed 4 months" in the preview (v3.48)

The hover preview carries one more badge, beside "Live with" and hype trains:
**Subscribed N months**, or **Formerly subscribed N months** for a channel you
have left. The `?tab=expired` tab is read for that — but it feeds tenure and
the former-subscriber flag only: it **never** touches subscription state. A
channel can sit in the expired list for a lapsed period while being
resubscribed today; inferring "not subscribed" from it would depend on the
order the tabs are read in.

#### Reading a number without reading the language

The month count is on the page, but **no `data-*` designates it**. And a paid
card carries four lookalikes:

| label | value |
| --- | --- |
| Next subscription anniversary in: | 9 **days** |
| **Total** months subscribed: | 4 months |
| **Consecutive** months: | 3 months |
| Your benefits expire on | 9 Sept 2026 |

Taking "the first number" gives **9**. Taking "the last N months" gives **3**.
Reading the label gives 4 — in French only, and the extension serves six
languages.

An **expired** card carries just one, once the blocks with known hooks are set
aside (`.sub-badge-progress`, `.expired-sub-message`, the channel name, the
buttons). Its structure names it unambiguously.

Hence the detour: the extension **learns** the label where structure names it
on its own, then finds it verbatim on the paid cards, where the text is
identical. **No string is hardcoded.** Should Twitch change that wording, the
match fails and the badge disappears — it does not lie. That is also why the
expired tab is read **first**.

The badge only appears when tenure is **known**: "Subscribed" without a
duration would say nothing the card's gold thread does not already say.

#### Under the veil, not after it (v3.49)

Fixing the wait described below had a side effect: the scan went from roughly
5 to 20 seconds, while the loading veil only holds for a few. The veil no
longer covered what it was meant to cover, and subscriptions showed up after
it.

Two changes put it right:

- **tabs are visited together**, no longer one after another. The scan's
  duration is no longer their sum but that of the slowest. Measured on the
  bench: **5.2 s instead of 8.3 s**, and the ratio is far better in
  production, where empty tabs cost 5 seconds each. Their starts are
  **staggered by 400 ms**: four React applications booting on the same
  millisecond make a compute spike sharp enough to delay the sidebar itself —
  observed on the bench, where the veil could no longer settle. Each lasting
  several seconds, that stagger costs almost nothing overall;
- **an empty tab never holds the veil.** It brings nothing to look at, and its
  settle delay is the longest of all. The veil lifts as soon as the first tab
  has returned channels, plus a short grace to let its neighbours land — and
  the sidebar decorates itself tab by tab, instead of waiting for the whole
  volley;
- **the learned label is remembered** (`tse:submois`). It was the reason the
  expired tab had to be read first; once known, order no longer matters and
  everything starts at once. Only the very first install keeps a preliminary
  pass.

The veil's hold rises to 7 seconds, and above all it no longer depends on the
absence of **subscriptions** but on the absence of a **completed scan**. That
was the reported case: subscriptions already known — hence no hold — but
tenure still missing, arriving a few seconds after the veil.

A routine refresh still holds nothing: what it refreshes is already on screen.

#### Waiting for the page to finish writing itself (v3.48.1)

A React list is not written in one go: a card's link is rendered **before**
its tenure. The scan concluded on the first pass where it saw a card — so it
collected the channels and lost the months, never learned the label on the
expired tab, and displayed no badge anywhere. The symptom was misleading: the
sort, the badge count and the gold thread all worked, only the preview badge
was missing.

The scan now waits for the content to **stop moving** for 1.5 s. Stability is
measured as a duration, not a number of passes: the gap between a card's
skeleton and its body far exceeds one polling period, and two identical passes
in a row would prove nothing.

The `tse:substs` timestamp now carries the **reader version** that produced it
(`2:<date>`). Without that, this fix would have reached nobody for six hours:
the fresh timestamp left by 3.48.0 forbade precisely the scan that would have
repaired the data. And `tse.reset()` now takes that timestamp with it —
wiping the subscriptions then forbidding yourself to go and fetch them again
was not a reset.

### The styling of a subscribed channel (v3.45, reworked in v3.51)

The **channel name turns gold**, with a brighter sheen travelling through it on
a loop — the colour is a gradient clipped to the shape of the letters. The
**category** gets the same treatment, muted: champagne, a sheen nearly twice as
slow, and no halo. The two ranks must stay distinct — giving them the same
shine would have flattened the hierarchy Twitch establishes through size and
colour.

In the **card's background**, a glow circulates: three coloured washes each
drifting at its own speed, and a light veil sweeping the card diagonally now
and then.

The avatar wears a **turning gold ring** whose halo breathes. The element to
decorate is **named from JS** by `avatarOf()`, the function that already has
authority elsewhere in the code: Twitch renders five different avatar shapes,
and the stylesheet only copied three of them — hence a ring present on one card
and missing on its neighbour, for no visible reason. Copying a cascade is
condemning it to drift.

The **category** is named the same way, by `cardCategoryEl()` (v3.54). The
defect slept there identically and had been reported nowhere: the function
covers five locations, two of which have a `<p>` carrying **no** `title`
attribute — which the stylesheet's selectors demanded.

It is the only element left in collapsed mode, where there is neither
background nor text to colour — and it is **gold for every subscription**, whichever tab it came from.
A tint per origin (gold, rose gold, platinum) was tried and dropped: the
"subscribed" signal is binary, and splitting it into three colours asked the
reader to memorise a code for a distinction that does not matter there.

The originating tab is still **kept in memory**, readable via `tse.subs()`: it
is collected with no extra request and answers a question one does ask — "that
one, did I pay for it or was it gifted?".

**How this coexists** with the purple of "fresh stream" and a co-stream's
colour, which already own the background: the animated layer sits at a
**negative** `z-index` within the card's stacking context. It therefore paints
after the card's background — whose hue shows through, being very transparent —
but before the content, and beneath the left bar. All three signals stay
readable together: the background says "fresh" or "co-stream", the glow and the
gold say "subscribed", the bar says which group.

The cost is measured, not asserted: across thirty decorated cards — twice what
an ordinary account shows — **16.75 ms average frame interval against
16.76 ms** without the decoration.

This styling **does not touch the card's background**, deliberately. The
background already belongs to "fresh stream" (purple) and to co-streams (the
group's colour), and the left bar belongs to them too. By occupying only the
outline, the subscriber decoration layers over both without erasing either: a
card can be fresh, co-streaming **and** subscribed, all three signals stay
readable, without a single tie-breaking rule.

The animation's phase is derived from the **login**, not the rank. The light
therefore does not travel around every card at the same instant — it cascades
across them — and it does not restart from zero when a change of sort reorders
the list. `prefers-reduced-motion` stops the comet and keeps the thread: the
movement goes, the information stays.

Three tabs are read (v3.46): `?tab=paid`, `?tab=gifts` and `?tab=mobile` —
the three that list subscriptions **to channels**. Turbo and "other
subscriptions" are not about channels. **Expired** subscriptions are left out
for a stronger reason: an expired subscription is not one, and the scan being
additive, reading it would mark as "subscribed" for 120 days someone you no
longer are.

Because the scan is **additive**: it marks as subscribed what it finds, never
"not subscribed" on an absence. Concluding from an absence would wrongly strip
the styling from a genuine subscription. Correcting an unsubscribe stays with
the visit-time reading, which observes the channel itself.

### Practical consequences

- the button is **greyed out** as long as no subscribed channel is **on air**
  (v3.46). What counts is not what is known but what can be sorted: being
  subscribed to fifteen channels, none of them streaming, gives nothing to
  raise. The tooltip gives the right reason of the two — "no subscription
  spotted" when memory is empty, "none of your subscriptions is live" when it
  is not. Sending someone off to open a channel when their scan is already
  complete would be nonsense;
- the button's **tooltip** spells the total out ("My subscriptions first — 12
  subscriptions in total"): the badge truncates past 99 and does not say what
  it counts;
- a **badge** in the button's bottom-right corner gives the **total** number of
  your subscriptions, whether they stream or not (v3.47). The two numbers
  answer different questions: the greying says "nothing to sort right now", the
  badge says "you have N subscriptions". It therefore stays **readable on a
  greyed-out button** — the greying's opacity is carried by the icon, not by
  the whole button, which would take the badge down with it. It flips to white
  on the active button;
- the **chosen** sort mode comes back when it becomes possible again (v3.47).
  A fallback is suffered, not wanted: if your last on-air subscription goes
  offline the sort drops to "viewers", but your choice is remembered and
  returns as soon as one comes back. Same for co-streams;
- cards hidden by a **filter** still count: a filter is a passing display
  choice, and flickering the sort's availability on every category change would
  make the control unstable;
- the **non**-subscription is stored too, so a later visit corrects an entry
  that has gone stale — including after unsubscribing;
- past 120 days an observation is no longer believed, otherwise a monthly
  subscription left to lapse would stay true forever;
- when memory overflows its bound, a **current subscription outranks a lapsed
  one** (v3.54); the date only breaks ties. Since the expired tab started
  being read, dozens of entries land in the same millisecond as the active
  ones, and sorting on date alone lost them: on the bench, **not one of the
  five active subscriptions survived**. The two are not worth the same — a
  current subscription drives the sort, the badge and the card styling, a
  lapsed one only feeds a hover badge.

`tse.subs()` lists what has been spotted; `tse.reset()` wipes it with the rest.
`tse.rescan()` forces a full sweep — flush the channel cache, then re-scan:
exactly the path already taken when returning to a tab after a long absence.

---

## Top Channels (v3.32+)

Twitch's native sort button — the ↕ arrows to the right of "Followed Channels" —
is hidden, and a segmented control replaces it at the top of the filter block:

    ┌───────────────────┬───────────────┐
    │ Followed Channels │ Top Channels  │
    └───────────────────┴───────────────┘

A single track, sharing the surfaces of the dropdowns right below it and matching
their height exactly, with a purple thumb that moves from one segment to the
other. The mode is an **exclusive** choice: two detached pills, as up to 3.41,
read as two independent actions. The label is never truncated — in a language
longer than English the second segment drops below the first rather than
abbreviating to "Followed Chan…", which would inform nobody.

In **Top Channels**, the sidebar stops showing your subscriptions and shows the
30 most-watched channels on Twitch instead. The cards inherit everything else:
stream uptime, hover preview, thumbnail warming, filters. The extension builds
them by cloning — **except** for a channel you already follow, whose card Twitch
already placed and the extension borrows (see "The mode leaves nothing behind").

### Why it has to be rebuilt

Twitch's schema states:

> *Fetch live streams, ordered by the number of viewers descending.*

Measured: **that is false**. The list comes back unsorted — including on
Twitch's own request, carrying its `Authorization` and `Client-Integrity`:

    189916, 142955, 1164, 61117, 9893, 9073, 32517, 42340, …

So the sorting happens in the browser, at Twitch as much as here. But sorting
the 30 received would not be enough: that set is not the top 30 (it contains
channels with 1,164 viewers). It has to be built differently.

### How: an inequality, not an estimate

A category's audience is the **sum** of its streams. So for any stream S in
category C:

    viewers(S) ≤ viewers(C)

And `games(first: 100, options: {sort: VIEWER_COUNT})` *is* genuinely sorted
(verified: 100 decreasing values). It is therefore enough to walk down the
categories while their audience exceeds **T**, the 30th score found so far:
below T, no category *can* still hold a member of the top 30. The walk stops
knowing it is done.

Measured in production: **64 operations, 1.6 second**, a pool of roughly 1,600
channels harvested across some fifty categories.

### What is proven, and what is not

The extension claims no more than it knows:

| | proven? |
| --- | --- |
| The walk between categories | **yes** — that is the inequality above |
| The window depth (100 categories) | **checked on every walk** — if the 100th category still outweighs T, the ranking is not declared complete |
| The top of a single category | **a measured assumption** — see below |

On that last point: `game(name:){ streams(first: 30) }` does return the top of
the category — measured coverage ranges from 44% to 96% of its audience for 30
streams picked among thousands. But the selection is **not strictly ordered**,
and it intermittently omits channels that belong there. Six identical calls to
Fortnite, same category, same viewer count:

    rubius 23608 ●○●○●●

Rebuilding the ranking from scratch on every pass would therefore make such a
channel flicker one pass in three. The extension no longer believes a single
absence: it takes **three in a row** to drop a channel — the same reasoning it
already applies to channels going offline. Flicker falls below 4%, without one
extra request.

When the ranking is not proven complete, a banner says so. It is never hidden.

### Category: not a filter

Filtering the global top 30 by "VALORANT" would leave one or two channels — and
certainly not the most-watched ones in VALORANT. Picking a category therefore
changes what is **asked**: a single operation, refreshed every 30 seconds.

The list offers the **top 100 categories with their real audience**
("122k | VALORANT"), sorted. The label is the canonical name — the one Twitch
itself prints on its cards, even in French ("Just Chatting", not "Discussions")
— so the list, the query and the cards all speak the same language.

Going back to "all categories" is **instant**: the global ranking is never
purged.

### Language: a walk, not a filter (v3.41)

Picking a language does not narrow the display — **it changes what is asked**,
exactly like a category does.

| situation | what happens | exact? |
| --- | --- | --- |
| **Category + language** | dedicated `broadcasterLanguages` query → the 30 biggest of that language **within that category** | **yes** |
| **Global + language** | the whole walk is run IN THAT LANGUAGE: every visited category is queried with the filter | **yes** |
| Language whose code the API rejects | falls back to tag-filtering the already-harvested pool | **no**, and the banner says so |

The guarantee survives untouched: `viewers(stream) ≤ viewers(category)` holds
language by language, since a category's total bounds its French channels just
as well as the rest.

What this changes in practice: the 30-per-category cap hid every channel of a
minority language as soon as a category was dominated by another one. A French
channel with 800 viewers in Just Chatting was invisible — that category's
all-language top 30 stops far higher. It now shows up.

Measured across four categories, both queries at the same instant: the filtered
query loses **no** French channel from the unfiltered top 30, and reveals 23 to
29 that this top did not contain.

The language walk **replaces** the all-language walk rather than adding to it:
~101 operations instead of ~64, i.e. two more batched HTTP requests per walk,
and only while a language is selected. The last all-language ranking is kept,
so going back to "all languages" is **instant**.

One precaution that matters: the code the API expects is ISO 639-1 (`JA`, `KO`,
`CS`, `EL`…) and **not** the flag code (`JP`, `KR`, `CZ`, `GR`…) — eleven of the
twenty-six differ. Should Twitch reject one, the extension learns it on the
first attempt, falls back to tag filtering and stops claiming exactness. A
network cut, on the other hand, condemns nothing: it teaches nothing about the
code's validity.

**Measured on 2026-08-21**: all twenty-six codes are accepted by the API. One
request, twenty-six operations, one per language — no errors, and twenty-three
came back with a sample stream.

That does **not** make the fallback useless, and it is not going anywhere. Two
reasons. The measurement says what was true that day, not what Twitch will
accept tomorrow — this is a private API with no compatibility commitment. And
more to the point: the `broadcasterLanguages` field **does not appear** in the
public GraphQL schema Twitch publishes, where `GameStreamOptions` only declares
a `languages: [String!]` marked deprecated. The live API accepts it, the schema
ignores it: the only authority on this field is the API itself, queried at
runtime. Which is precisely what the fallback does.

### The cap of 30 comes from the API

`streams(first:)` is capped at 30, and Twitch says so plainly:

    argument 'first' value must be between 1 and 30.

This holds for **every** category. No exception is possible.

### Cost and cadence

| | frequency | cost |
| --- | --- | --- |
| Viewer counts of displayed channels | 30 s | **no request** — they ride the `TseChannels` batch that is already leaving |
| Light structural pass | 30 s | ~11 operations, **one** batched request |
| Full walk (drift safety net) | 2 min 30 | ~64 operations |
| Category selected | 30 s | **1** operation |
| Language selected (no category) | 2 min 30 | ~101 operations instead of ~64 |

The module has its **own** cooldown, separate from the sidebar's: if Twitch
throttles the global mode, "Followed Channels" does not go down with it. Past
three consecutive failures the cadence backs off on its own and says so in the
console, in all five languages.

### The mode leaves nothing behind (v3.42)

Two guarantees, learned by fixing two real defects.

**One card per channel.** If you follow a channel that appears in the ranking,
there used to be two: Twitch's own, hidden, and a counterfeit placed next to it.
The extension now **borrows** the native card — more faithful than a clone, and
without the duplicate that co-stream detection took for two distinct
participants. On leaving the mode, a fabricated card is removed and a borrowed
card is **given back**: removing it would erase from the sidebar a channel you
actually follow.

**The ranking does not write into the followed list's cache.** So that a freshly
placed card does not spend a second showing the numbers of the channel used as a
template, the mode seeds it with what the structural walk already knows. That
seed used to live in the **shared** cache — the one read by the language filter,
the ahead-of-Twitch cards and the mass-extinction guard — and it survived leaving
the mode. The symptom was visible: a followed channel appearing in the French
ranking came back carrying a "Français" tag the walk had stamped on it, and the
followed list's language filter then offered that language for a channel that
never declared it. The seed now has its own memory, read only by ranking cards
and emptied on the way out.

Nor does it carry a stream id. The old one fabricated one (`g:login`), which
could end up in the get-ahead-of-Twitch statistics. A ranking is not the
observation of a stream; it has no business claiming a stream's identity.

### What the mode does not do

- The "Open stories" row is hidden, as are the "Live channels" and "Viewers of…"
  sections: they no longer relate to what is displayed.
- Sort modes are hidden: the ranking **is** the sort.
- The mode is not remembered across page loads.
- Everything goes through the **same anonymous calls** as the rest of the
  extension — `credentials: 'omit'`, public Client-ID, no token, no extra
  permission.

---

## Built-in anti-ad module (v3.0+, replaced in v3.25)

The extension bundles an ad-blocking module. Its only job is to keep a pre-roll
ad from playing inside the hover preview iframe, which made previews unusable on
monetized channels.

Since **v3.25** that module is **[vaft v2.0.4](https://github.com/scamorza/TwitchAdBlock)**,
replacing the vaft v37.0.0 by **pixeltris** used until then. It is not an update
but a **rewrite**: it started from that project and little of the original code
remains. What changes in practice:

- server-side ads are worked around by requesting the stream under a different
  `playerType`. The old chain led with `embed` then `popout`; the new one leads
  with `mobile_feed` asked as `android`, the one combination that is both ad-free
  and uncapped. It carries the source codec, so a break costs no rendition change
  at all — which is exactly what the player used to stall on;
- **client-side ads** (the pod above chat, banners, pause ads) are refused
  upstream, through Twitch's own decline path. The old module simply never saw
  them;
- where no clean stream exists, the player is stepped down to the best rung of a
  different codec instead of stalling.

### Execution scope

Unchanged: the module is deliberately restricted to **iframes** (concretely, the
`player.twitch.tv` iframe the extension mounts on hover). It **does not touch**
the main stream you watch on `twitch.tv` — someone actually watching a stream
accepts Twitch's business model. For global blocking, install vaft separately;
the two recognise each other via `window.twitchAdSolutionsVersion` and exactly
one of them runs.

### A file of its own

The module now lives in **`adblock.js`** rather than at the top of `content.js`.
It is third-party code that updates upstream: isolating it makes the next update
mechanical — swap the file, replay the eight adaptations listed in its header —
instead of a hand merge. The manifest loads `adblock.js` **before** `content.js`,
reproducing exactly the order the two modules had when they shared a file. Do not
invert it.

### Disabling it

At the very top of `adblock.js`, the first non-comment line is:

```js
const TSE_ADBLOCK_ENABLED = true;
```

Set it to `false`, reload the extension (`chrome://extensions` → ↻ icon on the
card) and the preview iframe becomes a plain Twitch iframe with no interception.
The rest of the extension (uptime, sorting, filters, hover preview…) keeps
working fully.

### Credit and licence

The code is licensed **MIT** — Copyright (c) 2020-present TwitchAdSolutions
Contributors. Only eight adaptations separate it from upstream, each marked
`ADAPTATION` in the file and summarised in its header: the `[TSE-AdBlock]` log
prefix, the kill switch, the iframe-only guard, a hardcoded version in place of
`GM_info` (a userscript-manager API absent from an extension), removal of the
startup banner — upstream it prints once per page, here the iframe is recreated
on every hover and the console would drown — and two settings ill-suited to a
thumbnail (see "Preview quality" below).

### Preview quality (v3.26)

The preview popup is **480 × 270**. The sidebar therefore asks
`player.twitch.tv` for `360p30`: 640 × 360, just enough to fill the box without
oversampling it. Going lower (`160p30` = 284 × 160) would fall below the display
size and show.

The anti-ad module, however, shipped with `PinHighestQuality: true`, which writes
"highest available quality" into `player.twitch.tv`'s local storage and therefore
works **against** that choice. Upstream the setting is right — it serves a
full-screen viewing session; it stops being right for a hover thumbnail. It is
set to `false` (adaptation f), as is `ShowBanner` (adaptation g), whose
diagnostic box ate the corner of the picture.

That was not enough on its own: quality still **climbed** by itself after a few
seconds. The URL's `quality=360p30` is only a preference, which the player is
free to exceed through adaptive bitrate. The real lever is elsewhere — in the
**player type carried by the access-token request**, which decides the quality
ladder Twitch returns. The module rewrote it as `popout`, whose ladder goes all
the way to source.

It is now rewritten as **`autoplay`**, whose ladder Twitch caps at 640 × 360
(adaptation h). That is a **server-side** ceiling: adaptive bitrate cannot climb
past it, and 640 × 360 is exactly the right size for a 480 × 270 thumbnail.
`autoplay` is ad-free by the fork's own account, and stripping `parent_domains`
does not depend on this value.


### The content classification gate (v3.55)

Since Content Classification Labels, a labelled stream makes the player show an
acknowledgement screen — "X's content is intended for certain audiences", with a
**Start Watching** button. In a hover preview that button will never be clicked:
nobody clicks inside a thumbnail they are brushing past. Up to 3.54 the
extension drew the opposite conclusion from the right one: it **did not inject
the iframe** as soon as `hasCCL` was true, and the preview stayed frozen on its
JPEG.

Nothing in the embed URL avoids it; Twitch says so itself on its developer forum
— a non-interactive embed cannot play a labelled stream. The only path is to
click, and clicking requires being **inside** the player frame. Which the
manifest gives us: `player.twitch.tv` is declared there, with `all_frames: true`.

That is exactly what FrankerFaceZ does, under the setting
`player.disable-content-warnings`:

```js
const btn = cont.querySelector('button[data-a-target=' +
    '"content-classification-gate-overlay-start-watching-button"]');
if (btn) btn.click();
```
<sub>FrankerFaceZ, `src/sites/shared/player.jsx`, `skipContentWarnings()`</sub>

The preview bridge does the same, with three differences:

- **No React.** FFZ walks up to the instance to find the host node; here the
  iframe *is* the player, so a `querySelector` on the document is enough.
- **One click per button, five in total.** A click that fails to close the gate
  causes mutations, which the observer re-reads, which click again: without a
  bound that is a loop feeding itself.
- **The fallback is narrow.** Should Twitch rename the button, we look for any
  `button` — but **only** inside the `[data-a-target^="content-classification-gate"]`
  subtree. Clicking an arbitrary player button would mute the sound or open the
  settings.

#### The watch stopped just before what it was waiting for (v3.55.1)

3.55 shipped with a flaw the bench could not see. Its observer disconnected as
soon as **two** conditions held — a `<video>` under watch, no gate on screen —
and that "no gate" rested on a false premise, written down in the code: *"on a
labelled stream the `<video>` only exists once the screen is acknowledged"*.

Twitch creates its `<video>` element **with the player**, before the gate
renders. So the watch saw a video, no gate yet, concluded there was nothing left
to do, and withdrew. The gate then appeared in a frame nobody was watching any
more: neither clicked nor reported. The parent's ordinary net revealed it across
the preview — the worst of the three possible outcomes.

The harness could not catch it: it rendered its gate immediately, therefore
**before** the video. The opposite order from production. A scenario now
reproduces it — a stream-less `<video>` from the start, the gate 400 ms later —
and the mutation that restores 3.55's condition makes it fall, with exactly the
journal observed in production: `iframe, pont, devoilee`, no `modale`.

The observer now withdraws only on the **first frame announced**. And that
first-frame signal is held back while a gate is visible: without that hold, a
generous `readyState` on an empty video would be enough to reveal the
acknowledgement screen.

The button itself must be **visible** to count — non-zero width and height.
A container left in the DOM afterwards would otherwise look like an eternal
gate, and the preview would never reveal again: one flaw traded for its mirror.

#### The `<video>` node is not always the same one (v3.55.2)

The bridge watched "a video, the first one found", and remembered that fact in a
**boolean**. So it assumed a player keeps its video element from start to
finish. Twitch replaces it — notably when the source restarts, which is
precisely what acknowledging the gate causes. The bridge then stayed attached to
a detached node, where `playing` never arrives: no first frame announced, and
the gate net handed the floor back to the thumbnail **at the very moment** the
video was playing, in the other node.

The boolean became the node itself: we re-watch as soon as
`querySelector('video')` returns something other than what we were looking at.
Found on review, not in production — the flaw needed a node replacement nothing
at the bench provoked. A scenario now forces one on click, and the mutation that
restores the boolean makes it fall with the full symptom: no iframe at all,
thumbnail forever.

The same review tightened `lever()`, which redid two `querySelector` calls on
every batch of player mutations — and there are many — while the gate had
already been reported and the click quota was spent. It now returns before that.

#### Two nets, and why a second one was needed

The preview is revealed on its first frame. When that signal never arrives, a
net reveals anyway after 1.5 s: a black player for a moment beats a thumbnail
frozen forever. That reasoning **inverts** in the presence of a gate — what we
would reveal is not a black frame, it is a modal across the preview.

So the bridge tells the parent, by `postMessage`, that it has seen a gate. The
parent then disarms the ordinary net and arms another: if the video has not
started after `PREVIEW_GATE_TIMEOUT_MS`, the iframe is removed and **the
thumbnail takes over again**. The worst case lands exactly on 3.54's behaviour.

#### The flag, and the trap it first was

`TSE_GATE_ENABLED` switches the lift off. It first switched the **reporting**
off with it — and "going back to the old behaviour" then gave worse than the old
behaviour: the parent knew nothing of the gate, its ordinary net fired, and the
preview revealed the modal. The bench said so under mutation; review had not
seen it. Reporting is now unconditional; only the click depends on the flag.

#### The labels change role

They no longer decide, they are displayed. The query no longer returns a boolean
but the identifiers (`MatureGame`, `Gambling`…), and the preview turns them into
an amber badge placed **first** among the others: a warning is read before the
context. That badge is what makes the lift take nothing away from anyone — what
the gate said, the preview says, and sooner.

The translated wording lives in the locale table, not in the query: asking
GraphQL for `localizedName` would fail the **whole** query if the field does not
exist under that name, and the preview's title would go down with it. Seven
labels, five languages, plus a generic wording — «Classified content» — for the
identifier Twitch may add tomorrow: `DebatedSocialIssuesAndPolitics` shown raw
in a French interface would be worse than nothing.

The keys are **flat** (`uiCclMatureGame`, `uiCclGambling`…) rather than grouped
into a nested table: `tests/parity.mjs` only counts the first level, and a
language could have lost a label without anything saying so.

#### The badge palette (v3.55.3)

The labels badge was born **amber**, on sound reasoning — a warning tint,
distinct from the subscriptions' gold — and a number nobody had worked out. Once
measured: its text sat **2° of hue** from the hype train's, 26° against 24°. The
same colour to the eye, on two badges that can perfectly well coexist — a
labelled channel running a hype train is nothing exotic. It is the flaw 3.25
already fixed on the co-stream colours, made again elsewhere.

It has gone **red**. The slot is narrow — wedged between the hype orange at 24°
and the discount pink at 311°, the theoretical optimum is 348° — and we settle at
357°, plainly red rather than crimson: 27° from hype on the text, 31° on the fill.

Contrast dictated the rest. Red is the darkest hue at equal luminance — its
channel carries only 0.2126 in the formula — and the first attempts fell to
4.9:1 where the whole family sits between 6.4 and 7.7. Hence a deliberately dark
fill: the bright red lives in the text, not in the pill.

The fills are translucent; the "composited" column is what they give over the
popup's `#18181b`, and contrast is measured text against that composite.

| Type | Declared fill | Composited | Text | Hue | Contrast |
| --- | --- | --- | --- | --- | --- |
| `--ccl` | `rgba(200, 25, 42, .26)` | `#46181f` | `#ff868c` | 357° | 6.41:1 |
| `--hype` | `rgba(255, 105, 5, .25)` | `#522c16` | `#ffb380` | 24° | 6.94:1 |
| `--sub` | `rgba(255, 201, 102, .22)` | `#4b3f2c` | `#ffd591` | 37° | 7.43:1 |
| `--exsub` | `rgba(255, 201, 102, .10)` | `#2f2a23` | `#c9b48c` | 39° | 7.06:1 |
| `--switch` | `rgba(120, 215, 60, .24)` | `#2f4623` | `#a8e86b` | 91° | 7.15:1 |
| `--sponsor` | `rgba(0, 184, 90, .22)` | `#133b29` | `#6bdb9d` | 147° | 7.25:1 |
| `--costream` | `rgba(31, 105, 255, .25)` | `#1a2c54` | `#7fb3ff` | 216° | 6.38:1 |
| `--squad` | `rgba(145, 71, 255, .25)` | `#362454` | `#d1b3ff` | 264° | 7.56:1 |
| `--discount` | `rgba(255, 56, 219, .20)` | `#461e41` | `#ffa3ee` | 311° | 7.67:1 |
| *(no modifier)* | `rgba(255, 255, 255, .08)` | `#2a2a2d` | `#efeff1` | — | 12.38:1 |

The last row is not an oversight: an extra row `markExtraRows` can classify as
neither hype train nor discount comes out as `type: 'other'` and falls on the
base grey. That is its colour, defined, and scenario 60 treats it as such.

Three pairs stay under 20°, and **do so on purpose**. `sub` and `exsub` are the
same gold by design — the same signal, one desaturated. `hype` ↔ `sub` (13°) and
`hype` ↔ `exsub` (15°) are the price of two anchors outside the palette: the hype
orange is Twitch's own, and the subscription badge's gold is the gold of the
subscribed cards' rail (`--tse-sub-or`, 38°), which exists precisely so the
signal is recognised from one surface to the next. Pulling them apart would mean
breaking one of the two anchors — a product call, not a fix.

That is the whole difference with the amber: it was anchored to nothing. It was
free, and it had landed 2° from the hype train.

A ⚠️ pictogram frames the text on **both sides** (v3.55.2). On the left alone it
would read as a list bullet; on either side it makes a sign. Both are
`aria-hidden`: a screen reader must say "Mature-rated game", not "warning
Mature-rated game warning". Their `line-height: 1` keeps the emoji — which
overflows its em box — from raising the pill a pixel above its neighbours. And
because seven stacked labels come to 456 px in a 482 px-wide preview, the pill
**wraps** onto two lines instead of being clipped (`max-width: 100%`), with the
pictograms staying centred on either side of the block.


### Co-stream colours

Each simultaneous collaboration gets a colour from the palette. The constraint is
simple: two colours must stay distinguishable at a glance on cards that may touch
— which a **hue** gap guarantees, saturation and lightness being close across the
whole palette.

Until 3.25 three warm tones were stacked within a 16° arc: orange 31°, soft
yellow 42°, yellow 47°. The two yellows sat **5°** apart, which is the same colour
to the naked eye. Both the orange **and** the soft yellow were removed, a violet
takes their place, and green and blue were moved further apart:

| Colour | Hue |
| --- | --- |
| yellow `#f5c518` | 47° |
| green `#7ee081` | 122° |
| turquoise `#26d4c8` | 176° |
| blue `#4d8cff` | 219° |
| violet `#c77dff` | 274° |
| pink `#ff7a8a` | 353° |

Minimum gap: **43°**, against 5° before. The test harness rejects any pair below
40° and checks along the way that each `rgba` matches its hex — a typo there
would give a border of one colour and a glow of another.

#### A hidden card is not a member (v3.41.1)

The bars of two adjacent members **join up**, and the extension measures the
actual gap between the two cards to do it — the join is therefore exact whatever
the spacing, notably in collapsed mode where avatars sit further apart.

That assumes both cards exist on screen. There are **three** ways to hide one:
the offline attribute, an inline `display` set by a filter, and — since "Top
Channels" — a CSS **class** rule. The third sets neither attribute nor inline
style: a followed card kept all its markers while no longer having a box.
Measuring a gap against it meant measuring against a null rectangle, that is,
extending its partner's bar by half the page. The symptom was a continuous
vertical line across a dozen unrelated channels, measured at **653 px on a
148 px card**.

Two fixes, deliberately independent. A single predicate enumerates the three
ways of hiding and serves both the grouping and the adjacency computation — a
group is a visual statement, and colouring a card whose other half is not shown
makes none. On top of it sits a purely geometric guard that believes only the
layout: no join between two boxes when one has no height, nor across a gap
larger than the cards themselves.

**What could not be verified.** Ad blocking itself requires a real stream serving
real ads: it is not testable from the development environment. What *is* verified
automatically: that the module loads, that it stays **strictly inert outside an
iframe** (neither `fetch` nor `Worker` hooked, no marker claimed, no console API
installed), and that it does not disturb the sidebar in any way.

The language-filter flags come from the **OpenMoji** set (CC BY-SA 4.0 licence). The **EN** (USA + UK) and **PT** (Portugal + Brazil) bi-flags, split down the vertical centre, are derived from it to represent both variants of a language with a single flag.

---

## Localization

The extension detects your Twitch UI language: first from the native labels it
recognises in the DOM, then from the `lang` attribute Twitch sets on `<html>`,
then from `navigator.language`. Ten interfaces are served — `fr`, `en`, `de`,
`es` (Spain and Latin America), `pt` (Brazil and Portugal), `it`, `pl`, `ru`,
`ja`, `zh` — and anything else falls back to English.

All the extension's own strings (preview popup badges, filter and sort
buttons, console messages) are translated accordingly. Native Twitch labels
the extension looks for in the DOM ("Chaînes suivies" / "Followed Channels" /
"Kanäle, denen du folgst" / "Canales que sigues" / "Canais seguidos" (pt-BR) /
"Canais que segues" (pt-PT) section,
"Afficher plus" / "Show More" / "Mehr anzeigen" / "Mostrar más" / "Mostrar mais"
button, "X et N invités" / "X and N guests" / "X und N Gäste" / "X y N invitados"
/ "X e N convidados" accessibility text, etc.) are known in those **six**
languages only: they are strings collected word for word from Twitch's DOM, and
inventing some for the other four would mean writing a comparison that could
never match. Italian, Polish, Russian, Japanese and Chinese are therefore
detected from `lang`, and the whole sidebar rides on its structural anchors —
which is what it does for any other locale anyway.

The viewer count the extension renders (see "Near-live refresh") is **formatted
in your locale**, matching Twitch's own rendering: decimal abbreviation + suffix
(`67,3 k` in fr, `67.3K` in en, `4.1 k` in es, `3,7 mil` / `1,2 mi` in pt,
identical in Brazil and Portugal), or a full thousands-separated number
(`29.339` in de). Twitch's native counter is still parsed independently of
locale, which serves as the fallback until a channel has been resolved.

If you switch languages from Twitch settings, the page reloads and the
extension picks up the new language automatically.

### Category names (v3.58)

Under a French interface, the sidebar showed **"Just Chatting"** where Twitch
writes **"Discussions"**. That was not a missing translation: the extension was
overwriting the French label Twitch had already put there.

A category has **two names** at Twitch, and they do different jobs:

| Field | What it is | What it is for |
| --- | --- | --- |
| `game.name` | the **canonical** English name — the one in `/directory/game/…` URLs | **identity**: category-filter key, co-stream grouping key, comparison term for category switching, and the only value `game(name:)` accepts |
| `game.displayName` | the same name, **translated** | **display**, and nothing else |

The extension asked for the first only, and wrote it onto the cards. It now asks
for both and no longer confuses them: what is displayed — the card, its tooltip,
the dropdown, the "Just switched to …" badge — carries the translated name;
what compares or filters keeps working on the canonical one. The dropdown
therefore shows "Discussions" while filtering on "Just Chatting", and a click
gives the same result as before.

The separation is not cosmetic. If the switch register compared labels,
**changing Twitch's language would announce a category change on every channel
at once** — "Discussions" would become "Nur Chatten" with nobody having done
anything. Bench scenario 65 mutates that exact line to prove it.

Finally, it is the **`Accept-Language`** header that decides which language
`displayName` comes back in, and the extension puts the language of the
**interface it decorates** there, not the browser's. Without that, an
English-language browser in front of a French Twitch got English categories
under a French interface. The header is CORS-safelisted — it does not join the
preflight — and reveals nothing more about you than what the browser was already
sending on its own: the request stays anonymous, no token, no cookie.

A category Twitch does not translate — most game titles — returns a
`displayName` equal to the canonical name, and therefore renders exactly as
before.

#### Checking what Twitch returns, language by language

The bench proves **our** half of the path in all ten languages: each one asks
for its own locale, and displays what the server returns for it (scenario 65).
It cannot prove Twitch's half — it never calls Twitch. To see the real
translations, paste this into the console of a Twitch tab (`F12`):

```js
(async () => {
  const LOCALES = ['fr-FR','en-US','de-DE','es-MX','pt-BR',
                   'it-IT','pl-PL','ru-RU','ja-JP','zh-CN'];
  const rows = [];
  for (const l of LOCALES) {
    const r = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST', credentials: 'omit',
      headers: { 'Content-Type': 'application/json',
                 'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
                 'Accept-Language': l },
      body: JSON.stringify([{ operationName: 'T', variables: {},
        query: 'query T { game(name: "Just Chatting") { name displayName } }' }]),
    });
    const g = (await r.json())[0]?.data?.game;
    rows.push({ locale: l, canonical: g?.name, displayed: g?.displayName });
  }
  console.table(rows);
})();
```

That is exactly the request the extension makes — same public Client-ID, same
`credentials: 'omit'`, same header — except it loops over the ten locales
instead of sending the interface's own. The "displayed" column is what the
sidebar will write in each of those languages. A locale that returns the
canonical name means **Twitch** does not translate that category, not that the
extension missed something.

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
- `tse.subs()` — lists the subscriptions spotted, with the date of the
  observation.
- `tse.subs.refresh()` — forces a full `/subscriptions` scan without waiting
  the six hours, and returns the channels found. The column is also `false` for visited channels
  you are *not* subscribed to: that is what lets a later visit correct a stale
  entry.
- `tse.cycles()` — log of the **loading veils**: when each one went up, why
  ("startup", "sidebar remount", "collapsed/expanded toggle", "tab return",
  "entering Top Channels", "category change"…) and what brought it down
  (stability or hard timeout). Useful to diagnose a sidebar that appears to
  initialise twice.
- `tse.global.*` — inspection surface for **Top Channels**:
  `await tse.global.on()` turns the mode on and waits for the full walk,
  `tse.global.top(30)` prints the computed ranking, `tse.global.cats(25)` the
  sorted categories, `tse.global.report()` the internal state (threshold T,
  window floor, completeness, cost, cadence, tolerated absences) and
  `tse.global.off()` turns it off and clears.

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
| `tse:subs` | subscriptions spotted (visits + `/subscriptions` scan), their tenure in months and the former-subscriber flag | "My subscriptions first" sort, card styling, preview badge |
| `tse:substs` | date of the last full scan, prefixed by the reader version that produced it | spacing scans 6 h apart, and expiring those of an earlier version outright |
| `tse:submois` | the tenure label, learned from the page | reading the month count without depending on the language |

`tse.reset()` wipes them all at any time; clearing `twitch.tv`'s site data from
your browser settings does the same.

**Top Channels** adds nothing to that list: it stores nothing, does not even
persist the selected mode, and its requests take exactly the same anonymous path
as the rest of the extension — `credentials: 'omit'`, public Client-ID, no
session token, no extra permission.

**One exception, and only one.** Since 3.44 the subscription scan loads
`https://www.twitch.tv/subscriptions` in a hidden iframe, once every six hours.
That page is **authenticated** — it is a page of your account. The nuance
matters: the extension neither reads nor transmits your token; it asks for a
page and the browser authenticates it with its cookies, just as for any link
you would click. Nothing is sent to a third party, and the result never leaves
`localStorage`. Disable with `SUBS_PAGE_ENABLED: false`.

Since 3.45 that load happens **during** the sidebar's own, and only if the bar
holds at least one followed channel — that is, never on a signed-out session.

The bundled anti-ad module likewise never talks to third-party servers: it
intercepts Twitch requests inside the preview iframe and re-asks Twitch for the
stream under a different `playerType` to get an ad-free version. No data leaves
the Twitch circuit.

---

## Updating / modifying

If you change any of the extension files (e.g. to tweak a configuration
constant at the top of `content.js`, or to disable the anti-ad module via
`TSE_ADBLOCK_ENABLED` at the top of `adblock.js`):

1. Save your changes.
2. Go back to `chrome://extensions`.
3. Click the reload icon (↻) on the extension card.
4. Reload your Twitch tab.

---

## File layout

```
cowlors-sidebar-for-twitch/
├── manifest.json          MV3 declaration (content script MAIN world, all_frames true)
├── adblock.js             anti-ad module (vendored third-party code, see its header)
├── content.js             all the sidebar logic
├── _locales/
│   ├── en/messages.json     English name + description (default_locale)
│   ├── fr/messages.json     French name + description
│   ├── de/messages.json     German name + description
│   ├── es/messages.json       Spanish name + description (Spain)
│   ├── es_419/messages.json   Spanish name + description (Latin America)
│   ├── pt_BR/messages.json    Brazilian Portuguese name + description
│   └── pt_PT/messages.json    European Portuguese name + description
├── icons/                 16 / 48 / 128 px icons
├── package.json           verification tooling ONLY (see below)
├── eslint.config.mjs      lint rules
├── promo.mjs              1280×800 captures for the Chrome Web Store
├── promo-run.mjs          the scenes and their copy, in all twelve languages
├── promo-marquee.mjs      1400×560 marquee at the head of the listing
├── promo-tile.mjs         440×280 promo tiles (variants A–D)
├── promo-tile-produit.mjs 440×280 tile showing the extension at work
├── promo-polices.mjs      cuts the CJK subsets the captures need
├── promo-fonts/           Inter and Noto embedded in the images (OFL 1.1)
├── store/                 the copy of the twelve Chrome Web Store listings
├── tests/
│   ├── run.mjs              the Playwright harness (counted below)
│   ├── page.html            fake Twitch (real DOM + GraphQL network stub)
│   ├── build.mjs            copies content.js with the timings accelerated
│   ├── degraisser.mjs       strips comments from the shipped code (acorn)
│   ├── addon.mjs            assembles the package and runs the addons-linter
│   ├── prod.mjs             publishes a branch whose tree IS the package
│   ├── store.mjs            twelve-listing skeleton + image coverage
│   └── parity.mjs           translation-key parity across the 10 languages
├── README.md              French version of this file
└── README.en.md           this file
```

**What ships to the browser** is `manifest.json`, `content.js`, `adblock.js`,
`_locales/` and `icons/` — nothing else. The extension has no dependencies:
`package.json` and `tests/` exist only to verify it, and are never packaged.

---

## Verification

```bash
npm install                        # eslint + playwright + web-ext
npx playwright install chromium    # once
npm run check                      # lint + parity + Firefox manifest + harness
```

Four independent checks:

| Command | What it checks |
|---|---|
| `npm run lint` | `content.js` and `adblock.js` — no-undef, `require-atomic-updates`, etc. |
| `npm run parity` | all five translation blocks carry exactly the same keys |
| `npm run addon` | the Firefox manifest: this repository's invariants, **then** Mozilla's `addons-linter` — the one AMO runs on submission |
| `npm test` | the Playwright harness: 67 scenarios, 581 assertions |

Those two numbers are not decoration: `run.mjs` checks them against what it has
just counted, and fails if the table lies. A bench whose size is advertised
eventually advertises it wrong — this line said 544 when there were 579, and
the tree above said 561 two pages away. The scenario count was wrong too, for a
reason no amount of proofreading catches: the numbering **skips 52**, so what
was being read was the highest label rather than a count of the blocks.

`npm run addon` deserves a note: its six manifest assertions are the ones the
linter cannot know, because they belong to this repository — the version tracks
`package.json`, the Firefox floor stays consistent with the manifest's most
recent key, and the `content_scripts` block is **word for word** the Chrome
branch's. A manifest can be perfectly acceptable to AMO and have silently
drifted from the other branch; the linter would see nothing.

**The harness runs the extension for real**, in Chromium, against a fake
Twitch: `tests/page.html` reproduces the sidebar's actual DOM (captured from
the live site, traps included — the section heading lives *inside* the sort
button, the stories row lives *next to* `#side-nav`, the CSS root is at 62.5%)
and serves a `gql.twitch.tv` stub driven by fixtures. Several scenarios go
further and serve the page under `https://www.twitch.tv` via request
interception: without a real origin, a `postMessage` aimed at the player
iframe has nowhere to land.

`tests/build.mjs` transforms exactly one thing: the timing constants
(`LIVE_TTL`, `GLOBAL_STRUCT_TICK`, `GLOBAL_FULL_WALK_MS`…), divided by a
constant factor so several cycles fit inside a test. The *ratios* between them
are preserved — those, not the absolute values, are what drive the behaviour.
The logic under test is the repository's, line for line.

The stub also reproduces the API's measured defects, because a lenient harness
lets bugs through: `games` comes back sorted but `streams` does not, a channel
can go missing from one response to the next (sampling), and a stream's
broadcast language is independent of the tags it displays.

### Chrome Web Store captures

```bash
npm run promo           # → promo/*.png, exactly 1280×800, six scenes × twelve languages
npm run banniere        # → promo/00-banniere-*.png, 1400×560, twelve languages
npm run tuile-produit   # → promo/tuile-E-produit.png, 440×280
npm run polices         # → promo-fonts/noto-sans-{jp,sc}-cjk.woff2 (see below)
```

Three Store formats, one shared constraint: **JPEG or 24-bit PNG, no alpha**.
None of them honoured it — a Playwright screenshot is an RGBA PNG, opaque but
carrying an alpha channel all the same, so the images were coming out as colour
type 6. JPEG would be the easy answer; its chroma subsampling damages precisely
what matters here, the coloured edges of the gilded and purple text. So
`promo.mjs` encodes type 2 (truecolor) itself, with the per-row filter choice
the specification recommends — and re-reads the header it just produced before
handing the file back. `file` confirms it from the outside: *PNG image data,
8-bit/color RGB*.

Same principle as the harness, for the same reason: **the extension actually
runs** and we photograph what it produces. Nothing is redrawn. Rendering happens
at 2× and is then downscaled to 1280×800 — the exact size the Chrome Web Store
requires — by Chromium itself, which yields much crisper text than rendering
directly at 1×.

Two limits, worth knowing before publishing. Twitch's card styling is a
**reconstruction**: `tests/page.html` reproduces the DOM structure, not the
appearance, so `promo.mjs` rewrites the card layout (30 px avatar, 13 px name,
red dot). Everything the extension adds is authentic; the surface it adds it to
is an approximation. And the data are fixtures: the channels are **invented** so
no real identity is borrowed, avatars are generated, and the preview's video
area is an abstract gradient — a fake gameplay still would suggest content that
does not exist.

### The typeface, and why it lives in the repository

The container has neither Inter, nor Helvetica, nor Arial: everything fell back
to DejaVu Sans, a typeface that is nobody's. The flaw showed twice — on Twitch's
markup, and on the extension itself, whose CSS asks for
`var(--font-base, "Inter", sans-serif)` and was not getting Inter either.

So **Inter** is embedded, in `promo-fonts/`: four subsets (latin, latin-ext,
cyrillic and cyrillic-ext) as **variable** files, one file per subset covering
every weight. Versioned rather than fetched on demand — a capture must not
depend on a CDN to be reproducible — and inlined as base64 into the stylesheet,
with Twitch's exact stack declared where Twitch declares it: `--font-base` on
the root. The extension therefore takes the **real** path, not a fallback that
would exist only in the harness.

Cyrillic only arrived with the Russian listing, and it had to be hunted down:
the font guard measured a **latin** string, served by Inter as it should be, and
therefore reported the font loaded while Russian was coming out in DejaVu. A
guard that measures one case only proves that case.

Inter has no ideographs at all, and that is not a gap: neither has Twitch. Its
stack — `Inter, Roobert, "Helvetica Neue", Helvetica, Arial, sans-serif` — holds
nothing CJK, and on a real Japanese machine the browser walks down to the system
font. The captures reproduce that: **Noto Sans JP** and **Noto Sans SC** are
appended **last**, and only for the document's language (`:root:lang(ja)`,
`:root:lang(zh)`) — otherwise Chinese would come out in Japanese glyph forms. A
complete Japanese face weighs several megabytes; these are **cut** by
`npm run polices` to the characters these images write, collected from the `ja`
and `zh` tables of `content.js` and from the scene copy, and weigh under two
hundred kilobytes each.

A subset goes stale: an ideograph added elsewhere and missing here would come
out as an empty box, with nothing to say so. Before every shutter,
`glyphesManquants()` therefore draws **every character the page actually
writes** twice — once with the page's stack, once with a family that does not
exist — and compares pixels. Two identical renders mean the stack contributed
nothing, and the capture stops instead of shipping. The *width* comparison used
until then could not do this job: an ideograph is exactly one em wide in every
font, so it would have called a present glyph missing.

SIL Open Font License 1.1 for all three families, full texts in
`promo-fonts/OFL.txt` and `promo-fonts/OFL-noto.txt`; per-file provenance in
`promo-fonts/README.md`.

The avatars no longer carry the channel's initial either: on a real sidebar
those thirty pixels carry a photo, and a letter said "test capture". They are
now abstract compositions, deterministic per handle — two hues, one light
focus, one dark one. At the size they are seen they read as photographs you
cannot make out, and nobody is depicted in them.

Two scenes — the preview and the subscriptions one — need a subscription memory.
It is **seeded** into `localStorage` before the script starts (`ABOS`, in
`promo.mjs`), and the `/subscriptions` sweep is switched off for every capture.
The reason is not convenience: `tests/page.html` serves that tab with **real**
handles — which is what it takes to exercise the module, and exactly what a
published image must never carry. The subscriptions scene checks what it
photographs, too: four gilded cards, and a badge reading twelve. Were the sweep
to run anyway, the badge would count thirteen or more and the capture would fail
instead of shipping.

Six guards measure every scene before the shot and complain on the console
rather than let a crooked image out: the headline must not be clipped, the text
column must never come within twenty-four pixels of the frame (a floor
**derived** from the frame, whose scale varies from scene to scene), the hover
preview must not bite into the text, Inter must really be loaded, the kicker
must hold on one line, and the headline must count exactly the lines it was
written with.

The last two cover the same blind spot: **a line break overflows nothing**, so
no overflow measurement can see it. That is how "PRÉ-VISUALIZAÇÃO AO PASSAR"
got through, eleven pixels too wide for its pill; and that is how thirteen
scenes at once were caught with a headline taking one line more than written,
ever since Inter — whose 800 weight is real, where the fallback synthesised its
bold — replaced the default typeface. Headline size is therefore no longer
chosen but **measured**: 72 px is the last notch at which "tells you
everything.", the longest latin line across the twelve languages, fits the
column's 690 px. Japanese and Chinese read differently — an ideograph is one em
wide, so 690 px hold nine of them and not one more — and it is that count which
pushed the Japanese Top Channels headline to three lines: the wrap was written
in advance, so it may as well be written down. In the narrow variant the wrap is
wanted too — no legible size fits "avant de cliquer" in one go inside 378 px —
and the guard tolerates one extra
line there, and only there.

That 72 was found in the real pipeline, and it took that: a standalone
measuring bench, rendering the same string in the same typeface at the same
size, reported that 74 fit. It was off by 5% — enough to push a word onto the
next line, not enough to notice. A text width cannot be modelled beside the
page that displays it; it has to be measured in it.

### The 440 × 280 tile

It first carried two panels in perspective — the sidebar at 0.78 and the preview
at 0.52. It was pretty and illegible: channel names fell to 10 px, on an image
the Store renders smaller still. The preview alone is 480 px wide, more than the
whole tile; there is no scale at which it is legible there. So it was dropped,
and the room given back to the sidebar.

Scaling up is paid for in height: the top of the list sits 152 px below the
sidebar's top, and each card is 43 px. At scale 1, three cards fit and the name
is 13 px; at 1.22, two fit and it is 16. The second setting wins, and the
"subscriptions first" sort is switched on so that those two cards are precisely
the gilded ones. The script measures what it produces — whole cards, gilded
cards, the **rendered** name size — and fails rather than ship an illegible
tile.

### The listing itself

The copy of the twelve Chrome Web Store listings lives in **`store/`** — one per
published locale. The dashboard keeps no readable history: without a versioned
copy here, the only trace of a wording would be the live listing. See
`store/README.md` for the locale mapping, the recommended capture order (the
Store accepts only five, six are produced), and the answers to the privacy
practices form.

`npm run store` holds what twelve two-hundred-line listings make impossible to
proofread, and it holds their **images** too. Twelve listings want twelve sets
of images; the five languages of 3.57 got their copy first, and nothing would
have said so — `promo/` is an artefact directory, git-ignored, whose files
nobody counts. The check therefore compares the languages of the three copy
tables (`promo-run.mjs`, `promo-marquee.mjs`, and `SECTION` in `promo.mjs`)
against the listings present, and verifies that every section label exists in
`content.js`.

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

3. **Bundled anti-ad module** (see the dedicated section above). Since v3.25 the
   code is vendored as-is from [scamorza/TwitchAdBlock](https://github.com/scamorza/TwitchAdBlock)
   into its own file, `adblock.js`, with eight marked adaptations — kill switch,
   iframe-only guard, `[TSE-AdBlock]` log prefix, hardcoded version instead of
   `GM_info`, and no startup banner.

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

7. **No persisted query left** (v3.24). After `UseLive` was removed, the Guest
   Star query remained the only operation identified by a **hash** — that is, the
   only thing Twitch could expire unilaterally. It had all the less right to,
   being the reliable source of co-stream grouping: without it, colouring fell
   back on a heuristic the code itself describes as flickering, and **with
   nothing to signal it**.

   It is now sent **inline**, like `TseChannels`: the query carries its own text,
   so there is no hash left to keep up to date. The sidebar module therefore no
   longer depends on any persisted query. (The ad-block module still keeps one —
   `PlaybackAccessToken` — but that is third-party code taken as-is, outside the
   sidebar's scope.)

   The choice was **verified against the live API**, anonymously, before being
   made: the query is accepted as-is and even answers **faster** than the
   persisted one (24 ms against 43-49), because it selects four fields instead of
   the full payload (`canJoinStatus`, descriptions, profile colours, and a second
   root field duplicating the first).

   A conditional fallback was written first (hash first, inline as backup). It
   was removed: **a backup path that never runs is a path you cannot rely on**,
   and it would only have been called upon at the exact moment everything
   depended on it. Inline as the primary path runs every cycle — if it broke, it
   would show immediately.

   If the API refuses anyway, nothing breaks: a 30 s cooldown, the display is
   kept, and colouring falls back on the heuristic until it recovers.

No other behavior change was introduced relative to userscript v2.22.3.

Internal identifiers (CSS prefix `.tse-`, `data-tse-*` attributes,
localStorage key `tse:visits`) are kept as-is despite the extension rename so
that the visit history of existing users upgrading from a previous version
remains valid.
