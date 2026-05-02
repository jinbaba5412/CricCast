# CricCast Controller — UI Theme Design Brief

> Self-contained brief for **`Controller-offline.html` only**.
> Drop into ChatGPT / Claude / v0 / Lovable / Cursor.
> Pair with `DESIGN_BRIEF.md` for the rest of the app.

---

## 0. TL;DR

You are redesigning the **live cricket scoring controller**. It is the
single most-used screen in the entire product. A scorer holds a phone
in one hand at a cricket ground, in direct sun, sometimes wearing
gloves, and taps this interface 300+ times per match. **Every pixel of
ergonomic decision matters more here than in the rest of the app.**

---

## 1. Who Uses It & Where

- **Primary user:** a club scorer, often a volunteer, age 14 to 70.
- **Device:** phone (60%), tablet (30%), laptop (10%).
- **Environment:** outdoor cricket ground. Bright sun. Wind. Sometimes
  light rain. The screen is visible but glare-washed for hours.
- **Posture:** one hand holding the phone, the other thumb scoring, eyes
  flicking between the field and the screen between balls.
- **Time pressure:** 12–20 seconds between deliveries. Every ball must
  be entered before the next one is bowled.
- **Cognitive load:** they are also watching the field, listening to the
  umpire, and sometimes calling the action live on a mic.

**Design implication:** Calm > clever. Big > pretty. Predictable >
delightful. Every action needs a confirmation that doesn't slow the
flow.

---

## 2. The File

**`Controller-offline.html`** — a single 240 KB HTML file with inline
`<style>` and inline `<script>`. Vanilla JS, no framework. It already
imports the Pitch design system at the top:

```html
<script src="/assets/cc-theme.js"></script>
<link rel="stylesheet" href="/assets/cc-tokens.css">
<link rel="stylesheet" href="/assets/cc-bridge.css">
<link rel="stylesheet" href="/assets/cc-base.css">
```

Use those tokens (`var(--cc-accent-primary)`, `var(--cc-bg-elevated)`,
etc.). If you need a token that doesn't exist, add it to
`cc-tokens.css` for both `[data-theme="dark"]` and `[data-theme="light"]`.

---

## 3. The Four Screens

Switched via top-bar tabs. Only one visible at a time
(`.screen.active`).

### 3.1 `#screen-teams` — Tournament Teams (read-only)
- Browse teams already imported from the dashboard.
- A grid of team cards: logo, name, player count, primary/secondary color swatches.
- "Refresh from server" button. No edit actions here.

### 3.2 `#screen-setup` — Match Setup
- Pick two teams, pick the match template (T10 / T20 / 50-over / Test / Custom),
  set overs, set super-over rules, toss winner, batting first.
- A multi-step but single-page form. Don't make it a wizard with
  forced "next" buttons — let the scorer scan and edit any field.
- A **prominent "Start Match"** CTA at the bottom right (emerald,
  large). Disabled until validation passes, with inline reasons.
- Show a live preview of the match name as the form fills in.

### 3.3 `#screen-live` — **Live Controller** (the heart)
- See section 4 below.

### 3.4 `#screen-records` — Match Records
- A list of past matches. Each row: teams, result, date, scorecard link.
- Filter by tournament, season, date range.
- Tap a row → expand to show full scorecard (innings, batters, bowlers,
  fall of wickets).

---

## 4. Anatomy of `#screen-live` (the most important screen)

The Live screen has six zones. Redesign chrome and layout, **never**
the broadcast preview.

```
┌─────────────────────────────────────────────────────────────┐
│  [A] Broadcast Preview region (LOCKED — DO NOT TOUCH)       │
│      Mirrors the live TV scoreboard. Stays dark always.     │
│      Classes: .bb-*, .mp-*, .broadcast-*, .cc-logo-*,       │
│               .mini-player, .overlay-*                      │
├─────────────────────────────────────────────────────────────┤
│  [B] Match Status Strip                                     │
│      Innings | Score | Overs | RR | Target | Req RR         │
├──────────────────────────┬──────────────────────────────────┤
│  [C] Striker Card        │  [D] Bowler Card                 │
│      Name, runs, balls   │      Name, overs, runs, wkts,    │
│      strike rate         │      econ, current spell         │
│  [C] Non-striker Card    │                                  │
├──────────────────────────┴──────────────────────────────────┤
│  [E] Scoring Action Grid (MOST IMPORTANT)                   │
│      Run buttons, dot, extras, wicket, free-hit             │
├─────────────────────────────────────────────────────────────┤
│  [F] Over Timeline                                          │
│      Last 6 balls, this over only, with annotations         │
└─────────────────────────────────────────────────────────────┘
```

### 4.1 [A] Broadcast Preview — LOCKED
- Do not change anything inside `.bb-*`, `.mp-*`, `.broadcast-*`,
  `.cc-logo-*`, `.mini-player`, `.overlay-*`.
- Bridge CSS already pins this region to dark. Leave it.

### 4.2 [B] Match Status Strip
- One horizontal row, sticky under the broadcast preview.
- Tabular numerals everywhere. Score in display font (Bebas Neue),
  metadata in UI font (Inter).
- Highlight the most-glanced metric: **score** (largest), then **overs**.
- On mobile, collapse to two lines: score line, then small metadata line.

### 4.3 [C] Batsman Cards (Striker + Non-striker)
- Background uses `var(--bat-color)` (JS sets per-team color at runtime
  — DO NOT hardcode this).
- Striker has a small dot indicator and slightly stronger emphasis.
- Show: name, runs (R), balls (B), 4s, 6s, strike rate (SR).
- Tap card → menu: Retire, Swap strike, Replace.

### 4.4 [D] Bowler Card
- Background uses `var(--bowl-color)`.
- Show: name, overs (O), maidens (M), runs (R), wickets (W), economy (Econ).
- Tap card → menu: Change bowler (only at over end), View spell.

### 4.5 [E] Scoring Action Grid — THE BIG ONE

This is where 90% of taps happen. Design it like a synth pad, not a form.

**Run row** (large, primary tap targets, **minimum 56 px tall, 80 px wide**):
- `0` (dot — neutral grey)
- `1` (emerald)
- `2` (emerald)
- `3` (emerald, slightly less common — same color, OK)
- `4` (cyan, distinct — boundary)
- `6` (amber, distinct — six)

**Modifier row** (secondary, **minimum 48 px**):
- `Wide` (coral outline)
- `No Ball` (coral outline)
- `Bye`
- `Leg Bye`
- `Free Hit` toggle (amber when active)

**Critical row** (destructive, **minimum 48 px, separated visually**):
- `Wicket` (coral solid) — opens dismissal modal
- `Undo` (ghost, with a subtle warning) — reverts last ball
- `End Over` (only enabled at 6 legal balls)

**Visual hierarchy rules:**
- Runs are the loudest, biggest, most colorful row.
- Modifiers are quieter.
- Wicket / Undo are visually separated by a divider or padding.
- Free Hit, when active, glows amber across the entire grid border to
  remind the scorer the next ball cannot be a normal dismissal.

**Touch ergonomics:**
- 12 px gap between buttons minimum (no accidental taps).
- Active state: scale 0.97 + brief flash of accent ring.
- Disabled state: 30% opacity + cursor not-allowed.
- Haptic feedback (`navigator.vibrate(10)`) on every successful score
  if API available.

### 4.6 [F] Over Timeline
- Show last 6 legal balls of the current over as small chips.
- Each chip: ball number + outcome (`•`, `1`, `4`, `W`, `Wd`, `Nb+1`).
- Color-coded: dot = grey, runs = emerald, boundary = cyan, six = amber,
  wicket = coral, extras = outline coral.
- Tap a chip → preview that ball's full record (commentary + score state).

---

## 5. Modals (Critical — redesign these)

Match the dashboard modal style: `var(--cc-bg-elevated)` background,
16 px radius, blurred dark overlay, fade + 8 px translateY animation,
Escape closes, focus trapped inside, focus returns to triggering button
on close.

### 5.1 `#modal-dismissal` — Dismissal Type
After tapping Wicket, present:
- Bowled
- Caught (then sub-modal: who caught?)
- LBW
- Run Out (redirects to `#modal-runout`)
- Stumped
- Hit Wicket
- Retired Out / Retired Not Out
- Obstructing the Field
- Hit the Ball Twice
- Timed Out

Big buttons (60 px tall, two columns on phone, three on tablet),
each with a 1-line plain-English subtitle.

### 5.2 `#modal-runout` — Who Was Run Out?
- Two big buttons: striker | non-striker.
- Then a "How many runs completed?" stepper (0 / 1 / 2 / 3).
- Then "Who fielded? (optional)".

### 5.3 `#modal-batsman` — New Batsman
- Searchable dropdown of remaining XI not yet out.
- Big "Set as striker" / "Set as non-striker" toggle.

### 5.4 `#modal-bowler` — New Bowler (start of over)
- Searchable dropdown of bowlers, with eligibility highlighted (no
  consecutive overs, max overs, etc.).
- Show recent spell summary inline.

### 5.5 Free-hit, Retired-out, End-of-innings prompts
- Use small confirmation toasts where possible, only escalate to full
  modal when an irreversible decision is needed.

---

## 6. DO NOT TOUCH

- `.bb-*`, `.mp-*`, `.broadcast-*`, `.cc-logo-*`, `.mini-player`,
  `.overlay-*` (broadcast preview region — pixel-locked to scoreboards)
- `--bat-color`, `--bowl-color` CSS variables (set by JS per match)
- Any `id` attribute on any element
- Any `onclick=` handler
- Any inline `<script>` block
- The `goScreen('teams' | 'setup' | 'live' | 'records')` function
- The `superballMode` property and its references
- Socket.IO event names, SSE endpoints, `/api/state`, `/api/records`

You may freely change layout, padding, color (within palette), shadows,
border radii, animation, decorative wrappers, icons, font choices.

---

## 7. Theme & Palette

**No purple. Ever.**

- **Emerald** `#10B981` — runs, "live", success, primary CTA
- **Amber** `#F59E0B` — six, free-hit, warnings, captain badge
- **Cyan** `#06B6D4` — boundary (4), info, secondary
- **Coral** `#F43F5E` — wicket, undo, destructive
- **Graphite** `#0B0F14` / `#11161E` / `#1A2230` — dark surfaces
- **Cool whites** with `#E5E7EB` borders — light surfaces

Default theme: **dark**. Light mode must work but most scorers will
stay in dark for outdoor visibility (yes, counter-intuitive — dark
backgrounds with high-saturation accents read better in glare than
white backgrounds with washed-out text).

Theme toggle: top-right of app header, already wired
(`<div data-cc-theme-mount></div>`).

---

## 8. Typography

- **Display** (score, runs counter, big numbers): Bebas Neue, already
  loaded. Tabular numerals via `font-variant-numeric: tabular-nums`.
- **UI** (buttons, labels, body): Inter or system stack.
- **Numerics** in tables: JetBrains Mono or Inter with tabular figures.

Sizes (mobile baseline):
- Score (`128/4`) — 2.25 rem, 700 weight
- Overs / RR — 1 rem, 600 weight
- Run buttons — 1.5 rem, 700 weight, tabular
- Player names — 1 rem, 600 weight
- Body / labels — 0.85 rem, 500 weight

---

## 9. Accessibility (non-negotiable)

- **Touch targets: 56×56 px minimum on run buttons**, 48×48 elsewhere.
- WCAG AA contrast (4.5:1 body, 3:1 large).
- Visible focus rings using `--cc-accent-primary-ring`.
- Escape closes every modal. Enter submits forms.
- All icon-only buttons have `aria-label`.
- Status changes (wicket, end of over) announce via `aria-live="polite"`
  region.
- Color is never the only differentiator — pair with icon or text.
- Respect `prefers-reduced-motion`.

---

## 10. Performance Targets

- Initial render under 1.5 s on a mid-tier Android (Pixel 4a class).
- No layout shift after first paint.
- Score-button tap → visual feedback in under 50 ms.
- Score-button tap → server confirmation in under 300 ms (already
  handled by Socket.IO; just don't block the UI on it).
- Bundle: file stays under 250 KB.

---

## 11. Multi-Match Mode (advanced)

The controller can score multiple concurrent matches (one tab per
match, switched via the scheduled-matches dropdown in the top bar).

- The dropdown belongs in the top bar near the screen tabs.
- Style it like a Linear / VSCode command palette: search, keyboard
  navigation, recent matches at the top.
- The current match's name shows in the page title and a small chip
  next to the brand mark.
- Switching matches is instant — no reload — JS swaps state.

---

## 12. Deliverables

1. **Updated `Controller-offline.html`** as a complete file, preserving
   every `id`, `onclick`, `<script>`, and `data-*` attribute.
2. **Visual diff notes** — what changed in each of the six zones (A–F)
   and each of the modals.
3. **Screenshots** — Live screen at 360 px, 768 px, 1280 px, in both
   dark and light mode.
4. **Token additions** patched into `assets/cc-tokens.css` if any.
5. **Smoke test results**: log in → setup match → score 1 over including
   a wide, no-ball, four, six, and wicket → end over → switch matches →
   no console errors, no broken broadcast preview.

Output the HTML as a complete file (not a diff), copy-paste ready.

---

## 13. What "Done" Looks Like

- A scorer in direct sun can read the score from arm's length.
- They can score a six-ball over without ever scrolling.
- They never tap the wrong button by accident.
- The Wicket flow takes at most 3 taps for the most common dismissals.
- Free-hit visually screams at them so they don't forget.
- Switching themes is instant and the broadcast preview stays exactly
  as it was on the live scoreboard.
- A new scorer can walk up to the controller and figure out the run
  buttons, wicket flow, and over timeline within 60 seconds without
  reading docs.

---

## 14. Tone

Confident. Quiet. Built for someone doing real work under pressure.
No animations that delay anything. No decorative illustrations. No
gradients on score numbers. No glassmorphism on tap targets.

It is a tool. Make it feel like one.

**Now go build it.**
