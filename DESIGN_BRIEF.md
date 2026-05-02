# CricCast — UI Theme Design Brief

> Drop this whole file into ChatGPT / Claude / Gemini / v0 / Lovable / Cursor /
> any AI design tool. It is self-contained. The AI will know the product,
> the constraints, what to touch, what NOT to touch, and what to deliver.

---

## 1. The Product

**CricCast** is a multi-tenant SaaS for cricket clubs and tournaments.
Clubs sign up, create teams, run matches, and broadcast a live scoreboard
to TV / OBS / web. Real users: cricket scorers (often on phones, in the
sun, on a ground), club admins (laptops), platform owners (super admin).

Stack: Express.js + MySQL + Socket.IO + vanilla HTML/JS (no React).
Pages are server-rendered HTML files with inline `<style>` and `<script>`.

---

## 2. The Six Surfaces You're Designing

| File | Role | Used by |
|------|------|---------|
| `views/login.html` | Club user login | Scorers, club admins |
| `views/signup.html` | New club signup | Cricket clubs |
| `views/dashboard.html` | Club admin dashboard (teams, players, tournaments, matches, users) | Club admins, scorers |
| `Controller-offline.html` | Live scoring controller (touch-first, runs on phone at the ground) | Scorers |
| `views/saas-admin-login.html` | Platform owner login | You |
| `views/saas-admin.html` | Platform super-admin (all tenants, plans, quotas, billing) | You |

Optional bonus if you have time:
- `views/landing.html` — public marketing
- `index.html` — old landing redirect

---

## 3. DO NOT TOUCH

These are **TV broadcast graphics** that go on screen during a live match.
They are pixel-locked, motion-tuned, and integrated with team colors via JS.
Changing them will break broadcasts.

- `Scoreboard.html`, `Scoreboard1.html` … `Scoreboard20.html` (21 files total)
- `scoreboard-core-offline.js`
- `BroadcastEvents.js`
- The broadcast preview region inside `Controller-offline.html` — any element
  whose class starts with `.bb-`, `.mp-`, `.broadcast-`, `.cc-logo-`,
  `.overlay-`, or `.mini-player`. These mirror the live scoreboard
  pixel-for-pixel and **must stay dark even in light mode**.

Also DO NOT change:
- Any HTML element `id` attribute
- Any `onclick="..."` / `addEventListener` JS handler
- Any `<script>` block content
- Any data attribute (`data-*`)
- The `--bat-color` / `--bowl-color` CSS variables (set at runtime per match)
- Server routes, API contracts, Socket.IO events, SSE event names

You may freely change: layout CSS, typography, spacing, colors, shadows,
animations, component structure, decorative HTML wrappers, icons.

---

## 4. Brand & Aesthetic Direction

**Inspiration:** Sentry.io, Cohere, Linear, Vercel, Stripe Dashboard.
Modern data-dashboard SaaS. Calm, dense, confident, fast.

**Hard rules:**
- **NO purple. NO violet. NO indigo.** Anywhere. Ever.
- Dark mode + light mode + system (3-state toggle).
- Default = dark.
- Scoreboard preview region = always dark (see §3).
- Cricket should feel implied, not gimmicky. No bat / ball / stump
  emoji as primary brand mark. Subtle is better.

**Suggested palette** (you may refine):
- Primary accent: **emerald** `#10B981` (CTA, "live", success)
- Secondary accent: **amber** `#F59E0B` (warnings, highlights, captain badge)
- Tertiary: **cyan** `#06B6D4` (info, secondary CTA, links)
- Danger: **coral** `#F43F5E` (destructive, red ball)
- Dark surfaces: graphite `#0B0F14` / `#11161E` / `#1A2230`
- Light surfaces: cool whites / `#F7F8FA` / `#FFFFFF` with `#E5E7EB` borders

**Typography stack** (suggested):
- Display: **Bebas Neue** (already loaded — used by scoreboards, keep for chrome titles)
- UI: **Inter** (variable, with `cv11` + `ss01` features)
- Numerics: **JetBrains Mono** or `font-variant-numeric: tabular-nums`
- Mobile reading body: 14–15 px. Headings 1.5–2 rem max.

**Motion:**
- 120 ms easing for hovers (`cubic-bezier(0.16, 1, 0.3, 1)`)
- 220 ms for modal in/out
- No bouncy springs. No parallax. No hero auto-play.
- Respect `prefers-reduced-motion`.

---

## 5. Per-Surface Requirements

### 5.1 `views/login.html`

- Split layout on desktop: left = login form, right = brand panel with
  subtle pattern (cricket field abstract, contour lines, or data viz mock).
- Single column on mobile.
- Email + password + "remember me" + "forgot password" + "create account" link.
- Inline error messaging (red, polite).
- One CTA, emerald, full-width on form panel.
- Theme toggle floating top-right.

### 5.2 `views/signup.html`

- Same shell as login. Two columns desktop, one column mobile.
- Fields: club name, your name, email, password, plan (radio cards: Free / Pro / Enterprise).
- Plan cards: emerald accent on the recommended one.
- Reassurance microcopy: "No credit card. Cancel anytime."
- Privacy/terms links in tiny muted text under CTA.

### 5.3 `views/dashboard.html`

Already has: sidebar nav, KPI tiles, tables, modals.
Redesign it to feel like a real SaaS console.

- Sidebar: 240 px desktop, collapses to top bar on `< 760px`.
- Brand mark: small gradient tile, no emoji.
- Active nav item: emerald soft background + emerald text (no solid fill).
- KPI cards: accent rail on left edge (3 px), large tabular number,
  uppercase tiny label, optional sparkline placeholder.
- Tables: zebra rows, hover highlight, sticky header, tabular numerals.
- Status pills: emerald (live, with pulse dot), cyan (setup), grey (done).
- Empty states: friendly icon + one-line guidance + primary CTA.
- All dialogs: blurred dark overlay, 16 px radius, 480 px max width,
  fade + 8 px translateY animation in.

### 5.4 `Controller-offline.html`

This is the **scorer's tool**. They use it on a phone, with one thumb,
in bright sun, sometimes with sweaty hands. Touch targets are sacred.

- Top app header: brand mark, server status pill, screen tabs
  (Teams / Match Setup / Live / Records), theme toggle.
- Stay touch-first: minimum 44×44 px tap targets on all action buttons.
- Live screen has a "broadcast preview" region — **DO NOT redesign it**,
  just make the surrounding chrome (cards, tab strip, action grid) feel
  modern.
- Run buttons (`+1 / +2 / +3 / +4 / +6`) — keep large, high-contrast,
  clear visual difference between safe runs and dot/extra/wicket.
- Wicket modal, free-hit modal, retired-out modal — match the dashboard
  modal style (dark overlay + blur + radius 16).
- Scheduled matches dropdown — feels like a Linear command palette.

### 5.5 `views/saas-admin-login.html`

Same shell as user login but with a subtle "Operations" / "Console" label.
Indicate elevated-privilege context without scaring. Maybe a small
amber stripe at the top, not a screaming red banner.

### 5.6 `views/saas-admin.html`

Platform-owner cockpit. Lists all tenants, their plans, MRR, quota
usage, live match counts, suspend / impersonate / billing actions.

- Same sidebar pattern as club dashboard but with different nav items:
  Tenants, Plans, Subscriptions, Audit Log, System Health, Settings.
- Top bar shows global system health (DB, Redis if any, queue, error rate).
- Tenant table: sortable, filterable, with a quick "actions" overflow
  menu per row. Status pills for plan tier (Free / Pro / Enterprise).
- A "Danger Zone" section per tenant for suspend / delete, separated
  visually with a coral border.
- Charts (placeholders are fine): MRR over time, signups, active matches.

---

## 6. Existing Design System (Use it, don't reinvent)

The project already has a token + base CSS layer. **Build on top of it, don't replace it:**

```
assets/cc-tokens.css      ← color, spacing, radii, shadow, type tokens
assets/cc-bridge.css      ← maps legacy var names → new tokens
assets/cc-base.css        ← buttons, cards, inputs, modals, badges
assets/cc-theme.js        ← dark/light/system toggle (auto-mounts)
```

To add the toggle to any page, just include all four files in `<head>` and put `<div data-cc-theme-mount></div>` somewhere visible.

If you need a token that doesn't exist, add it to `cc-tokens.css` for both
`[data-theme="dark"]` and `[data-theme="light"]` selectors.

---

## 7. Accessibility (non-negotiable)

- Color contrast: **WCAG AA minimum**. Body text 4.5:1, large text 3:1.
  Don't rely on color alone for status (always pair with icon or label).
- Focus rings: visible on every interactive element (use the existing
  `--cc-accent-primary-ring` token).
- Keyboard: every modal closes on Escape, every form submits on Enter,
  every dropdown is arrow-key navigable.
- Touch: 44×44 px minimum on Controller live-scoring buttons.
- Motion: respect `prefers-reduced-motion: reduce`.
- ARIA: label every icon-only button, every nav landmark, every modal.

---

## 8. Deliverables

For each of the six surfaces:

1. **Updated HTML file** with the new chrome + components, preserving every
   existing `id`, `onclick`, `<script>`, and `data-*` attribute.
2. **Inline `<style>` block updated** to use the existing tokens
   (`var(--cc-accent-primary)`, `var(--cc-bg-elevated)`, etc.).
3. **Visual diff notes** (1 paragraph per page, what changed, why).
4. If new tokens are needed, **patch `assets/cc-tokens.css`** with them,
   added to both dark and light blocks.
5. **One screenshot** per surface in dark mode and one in light mode.
6. **Smoke test checklist** (login → dashboard → controller → log out works
   in both themes, no console errors, no layout breakage at 360 px / 768 px / 1440 px).

Output the HTML files as **complete files** (not diffs), so they can be
copy-pasted directly. Keep file size under 250 KB each.

---

## 9. What "Done" Looks Like

- A scorer at a cricket ground in the sun pulls out their phone, opens
  the controller, and the contrast is good enough to read.
- A club admin opens the dashboard on a laptop and the KPI tiles feel
  like a real product, not a school project.
- A platform owner opens the super admin and instantly sees system
  health and the highest-revenue tenant.
- Toggling dark / light / system feels instant. No flash. No purple
  anywhere. The broadcast preview stays dark always.
- Nothing in the live scoreboard pipeline broke.

---

## 10. Tone

Confident. Spacious. Quiet. Like a tool that knows what it is.
Not playful. Not gamified. Not a startup landing page.
A console for people who care about cricket data.

**Now go build it.**
