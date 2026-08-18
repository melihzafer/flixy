# Watchlist Scenarios & UX Brief

Status: implementation brief for the watchlist decision surface
Scope: mobile-first, production-ready MVP inside the existing Flixy stack

## Product problem

> A Flixy user with a large saved backlog needs a fast way to turn 115 saved
> titles into one confident choice, because a flat list creates the same
> decision fatigue that the Discover deck was designed to remove.

Success is observable when a returning user can enter the watchlist, narrow the
context, compare a small shortlist, and start a title in under two minutes
without manually scanning the full backlog.

## Provisional personas

### The Tonight Picker

- **Context:** alone on the couch, low attention, wants one answer now.
- **Need:** a small, explainable shortlist, not another catalogue.
- **Success:** chooses or rerolls a title in fewer than three interactions.

### The Backlog Gardener

- **Context:** has 50–500 saved titles and knows the list is stale.
- **Need:** a quick swipe pass to promote, keep, watch, or remove items.
- **Success:** clears or reshapes a backlog without opening every detail page.

### The Pair Decider

- **Context:** two people are sharing one phone or sitting together.
- **Need:** a fair shortlist where both people get an equal number of picks.
- **Success:** both participants make five picks and see the overlap ranked.

### The Friend Group Host

- **Context:** three or more friends want a shared choice on separate devices.
- **Need:** a joinable session and synchronized votes.
- **Success:** a shared match list appears without copying titles into chat.
- **Scope:** future network feature; the first implementation must not pretend
  to provide cross-device synchronization.

## Scenario matrix

| ID | Scenario | Entry | Core interaction | MVP decision |
|---|---|---|---|---|
| W1 | Pick tonight | Watchlist → Pick tonight | Set type/runtime context, review three candidates, choose or reroll | **Now** |
| W2 | Two friends decide | Watchlist → Together | Two participants, five picks each, pass-and-play swipe deck, ranked overlap | **Now, same device** |
| W3 | Small group decides | Watchlist → Together | Three to six participants, equal pick budget, ranked consensus | **Now, same device; 2–4 participants first** |
| W4 | Clean a stale backlog | Watchlist → Triage | Swipe right/left/down/up with explicit semantics | **Keep and improve existing route** |
| W5 | Immediate random choice | Watchlist → Surprise me | Roulette from the active unwatched pool | **Keep as secondary action** |
| W6 | Find a saved title again | Watchlist → Search/filter | Search, movie/series, top, watched, runtime and service filters | **Now, lightweight local filtering** |
| W7 | Mark a batch watched | Watchlist → Manage | Select several rows, mark watched or remove with undo | **Next, after selection model is stable** |
| W8 | Offline watchlist | Any watchlist mode | Use local projection, show sync status, preserve actions in outbox | **Now, no destructive data loss** |
| W9 | Empty watchlist | Watchlist | Explain how to add titles and link to Discover | **Now** |
| W10 | 100+ saved titles | Watchlist | Keep the list readable, summarize counts, avoid rendering a decision wall | **Now** |
| W11 | Separate-device co-watch | Watchlist → Together | Host code, guest join, synchronized deck, realtime match | **Future, Supabase Realtime** |
| W12 | Friends' taste overlap | Friends / profile | Compare watchlists or taste graphs | **Future, social graph** |

## Prioritized product shape

### Wave 1: Watchlist as a decision workspace

The watchlist screen remains the source of truth for saved items, but its first
viewport becomes a decision rail:

1. **Tonight** — a small shortlist from the current unwatched pool.
2. **Together** — pass-and-play group picker with five picks per person by
   default.
3. **Triage** — existing backlog swipe mode.
4. **Surprise me** — existing roulette, clearly secondary to intentional choice.

The list below remains available for recognition and maintenance. This follows
Hick's Law: the user sees four meaningful intents instead of a dozen row actions.

### Wave 2: Local group matching

The first group flow is deliberately same-device. It needs no new backend table:

- Choose 2–4 participants.
- Default to 5 picks per participant; allow 3 or 7 as alternatives.
- Apply shared filters before the deck begins.
- Each participant sees the same candidate pool in the same stable order.
- Right means “my pick”; left means “skip”.
- After everyone finishes, rank titles by vote count, then by priority and rating.
- Show `Match`, `Strong contender`, and `One-person pick` labels.
- Provide a reset/exit path before any watchlist mutation.

### Wave 3: Separate-device collaboration

Only after the local flow proves useful:

- Host creates a short-lived session code.
- Guest joins on another device.
- Host broadcasts the candidate IDs and shared filters.
- Each device sends title votes through a Realtime channel.
- The server/session layer owns participant presence and deduplication.
- The final match list includes streaming availability and a direct title link.

## Information architecture

```text
Watchlist
├─ Decision rail
│  ├─ Tonight
│  ├─ Together
│  ├─ Triage backlog
│  └─ Surprise me
├─ Context filters
│  ├─ All / Top / Watched
│  ├─ Movies / Series
│  ├─ Runtime
│  └─ Available service (when data exists)
├─ Saved titles
│  ├─ Top picks
│  ├─ Saved
│  └─ Watched
└─ Title detail
```

Primary navigation remains the existing tab bar. Decision modes are secondary
watchlist actions, not new permanent tabs, to avoid fragmenting the one-card
discovery model.

## Annotated screen specification

### Watchlist home

- **Header:** Watchlist title, live saved count, compact secondary actions.
- **Decision rail:** one sentence explaining the current state, then four
  intent buttons. The first two are visually primary because they solve choice;
  triage and roulette are maintenance/escape hatches.
- **Context row:** filter chips with visible selected state and current result
  count. Keep controls in the thumb zone and each target at least 44px.
- **Sections:** Top, Saved, Watched. Rows preserve title recognition and expose
  one overflow action rather than competing inline buttons.
- **Feedback:** after a row action, update optimistically and show an Undo path
  where removal is reversible.

### Tonight mode

- **Header:** back, `Tonight`, active pool count.
- **Context controls:** movies/series, runtime, watched exclusion, service when
  availability data exists.
- **Shortlist:** three large poster-first candidates, each with one decisive
  `Choose this` action and a concise reason such as `Top pick · 96 min`.
- **Secondary action:** `Reroll three`, preserving the active context.
- **Success:** chosen title opens detail or streaming availability; the user can
  return to the shortlist without losing filters.

### Together mode

- **Setup:** participant count 2–4 and pick budget 3/5/7, with 5 selected by
  default. Show a live candidate count before starting.
- **Pass-and-play:** show participant name/number, picks remaining, and one card
  at a time. Right/left gestures have visible button alternatives.
- **Reveal:** do not show interim votes to the next participant. This prevents
  anchoring and keeps the result fair.
- **Result:** ranked list with vote count, match label, service availability,
  `Open title`, and `Start again`.
- **Exit:** confirm before abandoning an active round; no watchlist mutation is
  required to complete a round.

## Edge states and guardrails

- **Empty:** show an explanation plus `Discover titles`; no blank list.
- **Too narrow:** explain which context removed the candidates and offer
  `Reset filters`; disable `Start` when the pool is empty.
- **Loading:** reserve list/card geometry with skeletons; never show an endless
  spinner. Query timeout falls back to a named retry state.
- **Offline:** use the local watchlist projection. Mark queued mutations as
  `Waiting to sync` and preserve them through the existing outbox.
- **Error:** identify `Watchlist` or `Title details`, keep the current local
  result, and offer Retry.
- **Long titles:** wrap or truncate with an accessible full-title route; no row
  overlap.
- **Destructive removal:** use optimistic local removal plus Undo, not an
  irreversible one-tap delete.
- **Abandoned group round:** do not write votes to the durable watchlist; allow
  Cancel and Start again.
- **Accessibility:** every gesture has a labeled button alternative; selected
  filters expose `accessibilityState.selected`; targets stay at least 44px.

## Acceptance criteria

1. A 100+ title watchlist presents a decision rail before the full list.
2. Tonight mode produces a small, filterable shortlist without mutating saved
   items until the user chooses a title.
3. Together mode works on one device for 2–4 participants with five picks each,
   produces ranked overlap, and supports reset/cancel.
4. Existing triage, roulette, title detail, watched state, and local-first sync
   continue to work.
5. Empty, loading, offline, error, narrow-filter, and long-title states are
   explicit and recoverable.
6. Tests cover shortlist ranking, group vote aggregation, pick limits, and
   filter behavior; browser QA verifies the rendered mobile and desktop layouts.

## Assumptions

- Same-device group mode is the highest-value shippable version because it
  requires no schema or realtime migration.
- Separate-device collaboration remains a documented next wave, not a fake
  local implementation presented as synchronized social behavior.
- Existing `top` priority, watched state, title availability, and local-first
  watchlist queue are authoritative inputs.
- The current Flixy dark editorial design system remains unchanged; this feature
  adds hierarchy and interaction, not a new visual language.
