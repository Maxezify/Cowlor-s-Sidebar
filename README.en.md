# Cowlor's Sidebar for Twitch

Version 3.46.0 · Chrome Extension (Manifest V3) · 🇫🇷 [Version française](README.md)

A browser extension that enhances Twitch's followed-channels sidebar: live
stream uptime, collaboration badge, hiding of Hype Trains and subscription
discount banners, hiding of offline channels and empty sections, auto-expansion
of the followed list, highlighting of recently started streams, detection and
coloring of co-streams (with host/participant role extracted from the Twitch
DOM), detection of the "Live with" (squad / multistream) system, visual
normalization of sponsored cards, category and language filters (with flags), six sort modes to choose
from, locally-stored visit history, and live video preview on hover (across all
sections) with title, contextual badges, and Content Classification Label
handling.

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

### The styling of a subscribed channel (v3.45)

A thread of gold runs around the card, with a comet travelling along it
endlessly. The avatar wears the same gold as a fixed ring — that is what stays
visible in collapsed mode, where the card is nothing but a dot.

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
- a **badge** in the button's bottom-right corner counts the live
  subscriptions — the same number that decides the greying, otherwise a dead
  button would carry a count. It flips to white on the active button, and
  disappears with the greyed-out state;
- cards hidden by a **filter** still count: a filter is a passing display
  choice, and flickering the sort's availability on every category change would
  make the control unstable;
- the **non**-subscription is stored too, so a later visit corrects an entry
  that has gone stale — including after unsubscribing;
- past 120 days an observation is no longer believed, otherwise a monthly
  subscription left to lapse would stay true forever.

`tse.subs()` lists what has been spotted; `tse.reset()` wipes it with the rest.

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
| `tse:subs` | subscriptions spotted (visits + `/subscriptions` scan) | "My subscriptions first" sort |
| `tse:substs` | date of the last full scan | spacing scans 6 h apart |

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
├── promo-run.mjs          the scenes and their copy
├── tests/
│   ├── run.mjs              the harness: ~353 assertions across 41 scenarios
│   ├── page.html            fake Twitch (real DOM + GraphQL network stub)
│   ├── build.mjs            copies content.js with the timings accelerated
│   └── parity.mjs           translation-key parity across the 5 languages
├── README.md              French version of this file
└── README.en.md           this file
```

**What ships to the browser** is `manifest.json`, `content.js`, `adblock.js`,
`_locales/` and `icons/` — nothing else. The extension has no dependencies:
`package.json` and `tests/` exist only to verify it, and are never packaged.

---

## Verification

```bash
npm install                        # eslint + playwright
npx playwright install chromium    # once
npm run check                      # lint + locale parity + harness
```

Three independent checks:

| Command | What it checks |
|---|---|
| `npm run lint` | `content.js` and `adblock.js` — no-undef, `require-atomic-updates`, etc. |
| `npm run parity` | all five translation blocks carry exactly the same keys |
| `npm test` | the Playwright harness: 41 scenarios, ~353 assertions |

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
npm run promo        # → promo/*.png, exactly 1280×800
```

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
