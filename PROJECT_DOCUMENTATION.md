# CricCast — Complete Project Documentation

> Multi-tenant SaaS for live cricket scoring, broadcasting, and tournament management.
> Version: 4.0.0 | Stack: Express.js + MySQL + Socket.IO + vanilla HTML/JS

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [File Structure](#3-file-structure)
4. [Database Schema](#4-database-schema)
5. [API Routes](#5-api-routes)
6. [Frontend Components](#6-frontend-components)
7. [Tech Stack](#7-tech-stack)
8. [Configuration](#8-configuration)
9. [Design System](#9-design-system)
10. [Recent Changes (2026-05-02)](#10-recent-changes-2026-05-02)
11. [Important Constraints](#11-important-constraints)
12. [Development Notes](#12-development-notes)

---

## 1. Project Overview

**CricCast** is a multi-tenant SaaS platform for:
- Cricket clubs to manage teams, players, tournaments, and matches
- Scorers to live-score matches from mobile devices
- Broadcasting live scoreboards to TV/OBS/web viewers
- Tournament organizers to manage leagues, knockout stages, and fixtures

**User Roles:**
- **SaaS Admin**: Platform owner (manages tenants, plans, quotas)
- **Club Admin**: Manages teams, players, tournaments, matches, users
- **Scorer**: Live-scores matches via mobile-first controller

**Key Features:**
- Real-time scoreboard broadcasting via SSE (Server-Sent Events)
- 21 scoreboard template variations (Scoreboard.html, Scoreboard1-20.html)
- Tournament management with seasons, groups, and fixture generation
- Team/player management with photos, roles, and stats
- Match state persistence with undo support
- Mobile-responsive scoring controller
- Theme-aware dashboard (dark/light mode)

---

## 2. Architecture

### Multi-Tenant Model
- Each tenant (cricket club) has isolated data via `tenant_id` foreign keys
- Tenant resolution via subdomain or path prefix (middleware/tenantResolver.js)
- SaaS admin panel manages tenant plans (free/pro) and quotas (max_matches, max_teams)

### Real-Time Communication
- **Primary**: SSE (`/api/events`) for scoreboard updates (instant push)
- **Fallback**: Polling (`/api/state` every 3s) when SSE unavailable
- **Legacy**: Socket.IO retained for some features but SSE is primary

### State Management
- `lib/stateManager.js` manages match state (runs, wickets, overs, etc.)
- State stored in `match_state` table as JSON
- Undo support via state snapshots
- Server-side validation for all scoring actions

### Frontend Architecture
- Server-rendered HTML with inline `<style>` and `<script>` (no React/Vue)
- Shared JS library: `scoreboard-core-offline.js` (used by all scoreboards)
- Controller: `Controller-offline.html` (self-contained, ~326KB)
- Dashboard: `views/dashboard.html` (admin interface)

---

## 3. File Structure

```
criccasttt tuesday/
├── server.js                    # Express app entry point
├── package.json                 # Dependencies
├── .env.example                 # Environment variables template
├── DESIGN_BRIEF.md              # UI design guidelines
├── DESIGN_BRIEF_CONTROLLER.md   # Controller-specific design
├── Controller-offline.html      # Live scoring controller (~326KB)
├── Scoreboard.html              # Primary scoreboard template
├── Scoreboard1-20.html         # Alternate scoreboard templates
├── scoreboard-core-offline.js   # Shared scoreboard logic (~91KB)
├── BroadcastEvents.js          # Broadcast event handlers
├── index.html                   # Landing redirect
│
├── db/                          # Database schema and migrations
│   ├── schema.sql              # Full schema (tenants, users, teams, matches, etc.)
│   ├── schema_complete.sql     # Additional tables
│   ├── schema_phase4.sql       # Phase 4 additions
│   ├── patch_*.sql             # Incremental migrations
│   ├── seed.sql                 # Seed data
│   └── connection.js           # MySQL connection pool
│
├── routes/                      # Express route handlers
│   ├── admin.js                 # SaaS admin (tenants, plans)
│   ├── auth.js                  # Login/logout, session management
│   ├── club.js                  # Club data (teams, players, settings)
│   ├── match.js                 # Match CRUD, scoring actions
│   ├── tournaments.js           # Tournament/season/group management
│   ├── settings.js              # Tenant settings
│   └── stats.js                 # Statistics aggregation
│
├── views/                       # Server-rendered HTML templates
│   ├── dashboard.html           # Club admin dashboard
│   ├── login.html               # Club login
│   ├── signup.html              # Club signup
│   ├── saas-admin.html          # SaaS admin panel
│   └── saas-admin-login.html    # SaaS admin login
│
├── lib/                         # Shared libraries
│   ├── stateManager.js          # Match state management
│   ├── statsAggregator.js       # Stats calculation
│   ├── fixtureGenerator.js      # Tournament fixture generation
│   ├── logger.js                # Logging utility
│   └── mailer.js                # Email notifications
│
├── middleware/                  # Express middleware
│   ├── auth.js                  # Passport auth, role checks
│   └── tenantResolver.js        # Multi-tenant resolution
│
├── config/                      # Configuration
│   └── passport.js              # Passport strategies
│
├── assets/                      # Static assets
│   ├── cc-theme.js              # Theme toggle (dark/light)
│   ├── cc-tokens.css            # CSS variables (design tokens)
│   ├── cc-bridge.css            # Legacy token mapping
│   └── cc-base.css              # Base component styles
│
├── scripts/                     # Utility scripts
├── criccast_data/               # Runtime data directory
├── criccast_uploads/            # File uploads (team logos, player photos)
└── vendor/                      # Third-party libraries
```

---

## 4. Database Schema

### Core Tables

#### `tenants`
Multi-tenant isolation base.
- `id` (UUID PK), `slug` (unique subdomain), `name`, `plan` (free/pro)
- `max_matches`, `max_teams` (plan quotas)

#### `users`
User accounts per tenant.
- `id`, `tenant_id`, `email`, `password_hash`
- `role` (scorer, admin, saas_admin), `name`

#### `teams`
Cricket teams per tenant.
- `id`, `tenant_id`, `short_id` (unique per tenant), `name`, `short_name`
- `logo_type` (url/emoji/none), `logo_value`, `color`
- `captain_photo`, `bar_logo_mode` (auto/logo/captain/both)

#### `players`
Players per team.
- `id`, `tenant_id`, `team_id`, `name`, `display_name` (broadcast-friendly)
- `role` (BAT/BOWL/SPIN/AR/WK/C/VC), `batting_order`
- `photo`, `tags` (JSON), `stats_json` (JSON)

#### `tournaments`
Tournament structures.
- `id`, `tenant_id`, `name`, `format` (league/knockout/hybrid)
- `current_season`

#### `seasons`
Seasons within tournaments.
- `id`, `tenant_id`, `tournament_id`, `season_number`
- `name`, `status` (upcoming/active/completed/archived)
- `starts_on`, `ends_on`

#### `groups`
Groups within seasons.
- `id`, `tenant_id`, `season_id`, `name`

#### `group_teams`
Teams assigned to groups.
- `group_id`, `team_id`, `seed`

#### `matches`
Core match entity.
- `id`, `tenant_id`, `tournament_id`, `season_id`, `group_id`
- `stage` (custom/group/round_of_16/quarter/semi/final/3rd_place)
- `scheduled_date`, `scheduled_time`, `round_num`, `is_bye`
- `next_match_id`, `next_slot` (for bracket progression)
- `winner_team_id`, `result_type` (normal/tie/no_result/bye/super_over)
- `bat_team_id`, `bowl_team_id`, `max_overs`
- `status` (scheduled/ready/setup/live/completed/finished)
- `overlay_template` (Scoreboard, Scoreboard1-20)
- `toss_winner`, `toss_election`

#### `match_settings`
Per-match settings override.
- `match_id`, `tenant_id`
- `super_ball_enabled`, `powerplay_enabled`, `powerplay_mode`
- `free_hit_enabled`, `penalty_runs_enabled`, `tie_allowed`
- `custom_overs`, `extra_json`

#### `match_state`
Live match state (JSON).
- `match_id`, `tenant_id`, `state_json` (runs, wickets, overs, etc.)
- Updated on every scoring action

#### `player_match_stats`
Per-player per-match stats.
- `match_id`, `player_id`, `team_id`
- `runs_scored`, `balls_faced`, `fours`, `sixes`, `is_out`
- `overs_bowled`, `runs_conceded`, `wickets_taken`, `maidens`
- `catches`, `run_outs`, `stumpings`

#### `points_table`
Season standings.
- `tenant_id`, `season_id`, `team_short_id`
- `matches_played`, `wins`, `losses`, `ties`, `no_result`, `points`
- `runs_for`, `overs_faced`, `runs_against`, `overs_bowled`, `nrr`

#### `tenant_settings`
Global tenant settings.
- `tenant_id`
- `super_ball_enabled`, `powerplay_enabled`, `powerplay_mode`
- `free_hit_enabled`, `penalty_runs_enabled`, `tie_allowed`
- `custom_overs_default`, `extra_json`

---

## 5. API Routes

### `/api/auth/*` (routes/auth.js)
- `POST /api/auth/login` — User login (email/password)
- `POST /api/auth/logout` — User logout
- `GET /api/me` — Current user info

### `/api/club/*` (routes/club.js)
- `GET /api/club/teams` — List tenant teams
- `POST /api/club/teams` — Create team
- `PATCH /api/club/teams/:id` — Update team
- `DELETE /api/club/teams/:id` — Delete team
- `GET /api/club/players/:teamId` — List team players
- `POST /api/club/players` — Create player
- `PATCH /api/club/players/:id` — Update player (inline edit)
- `DELETE /api/club/players/:id` — Delete player
- `GET /api/club/settings` — Get tenant settings
- `PATCH /api/club/settings` — Update tenant settings

### `/api/club/matches` (routes/club.js)
- `GET /api/club/matches` — List tenant matches
- `POST /api/club/matches` — Create match
- `PATCH /api/club/matches/:id/status` — Set match status
- `DELETE /api/club/matches/:id` — Delete match
- `GET /api/club/matches/:id/links` — Get match broadcast links

### `/api/match/:id/*` (routes/match.js)
- `GET /api/match/:id/state` — Get match state (for scoreboards)
- `POST /api/match/:id/score` — Scoring action (add ball, wicket, etc.)
- `POST /api/match/:id/undo` — Undo last action
- `POST /api/match/:id/end-inning` — End current innings
- `POST /api/match/:id/finish` — Finish match
- `POST /api/match/:id/toss` — Record toss result
- `GET /api/events` — SSE endpoint for real-time updates

### `/api/tournaments/*` (routes/tournaments.js)
- `GET /api/tournaments` — List tenant tournaments
- `POST /api/tournaments` — Create tournament
- `DELETE /api/tournaments/:id` — Delete tournament
- `GET /api/tournaments/:id/seasons` — List seasons
- `POST /api/tournaments/:id/seasons` — Create season
- `DELETE /api/tournaments/:id/seasons/:seasonId` — Delete season
- `GET /api/tournaments/:id/seasons/:seasonId/groups` — List groups
- `POST /api/tournaments/:id/seasons/:seasonId/groups` — Create group
- `DELETE /api/tournaments/:id/seasons/:seasonId/groups/:groupId` — Delete group
- `POST /api/tournaments/:id/seasons/:seasonId/generate-fixtures` — Generate fixtures
- `GET /api/tournaments/:id/seasons/:seasonId/points-table` — Get standings

### `/api/saas/*` (routes/admin.js)
- `POST /api/saas/login` — SaaS admin login
- `POST /api/saas/logout` — SaaS admin logout
- `GET /api/saas/tenants` — List all tenants
- `POST /api/saas/tenants` — Create tenant
- `PATCH /api/saas/tenants/:id` — Update tenant (plan, quotas)
- `DELETE /api/saas/tenants/:id` — Delete tenant

### `/api/stats/*` (routes/stats.js)
- `GET /api/stats/season/:seasonId` — Season stats (top run-scorers, wicket-takers)

---

## 6. Frontend Components

### Controller-offline.html
**Purpose**: Live scoring controller (mobile-first, touch-optimized)
**Key Features**:
- Runs on phones at the ground (offline-capable)
- Real-time scoreboard preview (broadcast bar mirrors TV output)
- Runs button grid (0-4, 6, wides, extras)
- Expanded uncommon runs (5, 7-16) via toggle
- Wicket handling with dismissal modal (fielder, catch zone, how-out)
- Powerplay toggle (auto/manual modes)
- Super ball, penalty runs, retire player toggles
- Player selection gate at innings start
- Settings persistence via localStorage (per match)
- Undo support
- Theme toggle (dark/light)

**Key Functions**:
- `addBall(runs)` — Add ball to current over
- `handleWicket()` — Open dismissal flow
- `openDismissalModal()` — Multi-step dismissal input
- `openHowOutSheet()` — Quick one-tap dismissal sheet
- `renderLive()` — Update broadcast preview
- `endInning()` — End current innings
- `finishMatch()` — Finish match with winner
- `_persistSettings()` / `_restoreSettings()` — LocalStorage persistence
- `toggleRunsExpand()` — Show/hide uncommon runs

### Scoreboard Templates (Scoreboard.html, Scoreboard1-20.html)
**Purpose**: TV broadcast graphics (pixel-locked, motion-tuned)
**Key Features**:
- 21 template variations (different layouts, styles)
- Real-time updates via SSE
- Team logos/captain photos with pop-above effect
- Winner state panel (match end)
- Toss banner gate (before innings start)
- Innings card overlay
- Match summary overlay
- Theme-aware colors (bat_color, bowl_color set at runtime)

**Shared Logic** (scoreboard-core-offline.js):
- `logoElBar(team)` — Render team logo/captain (auto/logo/captain/both modes)
- `applyWinnerLogoState(matchData, teamsData)` — Hide losing team logo on match end
- `applyColorVars(matchData, teamsData)` — Set CSS color variables
- `renderInningsCard()` — Show innings stats overlay
- `renderMatchSummary()` — Show match summary overlay
- `processState(data)` — Handle incoming SSE/poll state
- `initCore()` — Initialize SSE connection

### Dashboard (views/dashboard.html)
**Purpose**: Club admin interface
**Key Features**:
- Teams management (create, edit, delete, players)
- Tournaments management (seasons, groups, fixtures)
- Matches management (create, start, finish, delete)
- Users management (invite scorers/admins)
- Mobile-responsive with sidebar drawer toggle
- Theme-aware (dark/light mode)
- Stroke-based SVG icons (Lucide-style)

**Key Functions**:
- `showPage(name)` — Navigate between sections
- `loadSummary()` — Load dashboard stats
- `loadTeams()` — Load teams grid
- `loadTournaments()` — Load tournaments list
- `loadMatches()` — Load matches table
- `loadUsers()` — Load users list
- `toggleSidebar()` — Mobile sidebar toggle
- `openNewMatchModal()` — Create match modal
- `showMatchLinks(matchId)` — Show broadcast links panel

### SaaS Admin (views/saas-admin.html)
**Purpose**: Platform owner interface
**Key Features**:
- List all tenants (clubs)
- Edit tenant plans (free/pro)
- Set quotas (max_matches, max_teams)
- Create/delete tenants
- Validation for numeric inputs

---

## 7. Tech Stack

### Backend
- **Node.js** (>=18.0.0)
- **Express.js** — Web framework
- **MySQL2** — Database driver
- **Socket.IO** — WebSocket (legacy, SSE primary)
- **Passport.js** — Authentication
- **Express-session** — Session management
- **Multer** — File uploads
- **Helmet** — Security headers
- **Express-rate-limit** — Rate limiting
- **Express-validator** — Input validation
- **Nodemailer** — Email notifications
- **Bcryptjs** — Password hashing

### Frontend
- **Vanilla HTML/JS** — No React/Vue
- **GSAP** — Animations
- **Canvas-confetti** — Celebration effects
- **TSParticles** — Particle effects

### Design System
- **CSS Variables** (cc-tokens.css)
- **Theme Toggle** (cc-theme.js) — dark/light/system
- **Font**: Bebas Neue (display), Inter (UI), JetBrains Mono (numerics)
- **Icons**: Lucide-style stroke SVGs

---

## 8. Configuration

### Environment Variables (.env)
```
PORT=3000
NODE_ENV=development
TRUST_PROXY=1
ALLOW_LEGACY_ENDPOINTS=0

# MySQL
DB_HOST=localhost
DB_USER=root
DB_PASS=password
DB_NAME=criccast

# Session
SESSION_SECRET=your-secret-key

# Email (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@criccast.com
SMTP_PASS=your-smtp-password

# SaaS Admin
SAAS_ADMIN_EMAIL=admin@criccast.com
SAAS_ADMIN_PASS=your-admin-password
```

### Tenant Resolution
- Via subdomain: `tenant-slug.criccast.com`
- Via path prefix: `criccast.com/tenant-slug/...`
- Middleware: `middleware/tenantResolver.js`

---

## 9. Design System

### Color Palette (from DESIGN_BRIEF.md)
- **Primary accent**: Emerald `#10B981` (CTA, "live", success)
- **Secondary accent**: Amber `#F59E0B` (warnings, highlights)
- **Tertiary**: Cyan `#06B6D4` (info, secondary CTA)
- **Danger**: Coral `#F43F5E` (destructive)
- **Dark surfaces**: Graphite `#0B0F14` / `#11161E` / `#1A2230`
- **Light surfaces**: Cool whites `#F7F8FA` / `#FFFFFF` with `#E5E7EB` borders

### Typography
- **Display**: Bebas Neue (scoreboard titles)
- **UI**: Inter (variable, cv11 + ss01 features)
- **Numerics**: JetBrains Mono or `font-variant-numeric: tabular-nums`

### Motion
- **Hovers**: 120ms easing (`cubic-bezier(0.16, 1, 0.3, 1)`)
- **Modals**: 220ms ease
- **No**: Bouncy springs, parallax, hero auto-play

### DO NOT TOUCH (Broadcast Graphics)
- `Scoreboard.html`, `Scoreboard1-20.html` (21 files)
- `scoreboard-core-offline.js`
- `BroadcastEvents.js`
- Any element with class: `.bb-`, `.mp-`, `.broadcast-`, `.cc-logo-`, `.overlay-`, `.mini-player`
- These are pixel-locked TV graphics that must stay dark even in light mode

---

## 10. Recent Changes (2026-05-02)

### W1: Winner State UI Fix (scoreboard-core-offline.js)
**Problem**: Losing team logo/captain remained visible on match end in scoreboard templates.

**Fix**: Added `applyWinnerLogoState(matchData, teamsData)` function in `scoreboard-core-offline.js` (lines 310-360). Called after every `renderBroadcastBar()` via `processState()`.

**Logic**:
- If batting team won → hide right logo, show left
- If bowling team won → hide left logo, show right
- Tie/draw → show both with neutral blue background
- Hides batting/score/bowling UI panels, shows winner panel
- Sets winner name/description text
- Restores all elements when match not finished

**Impact**: All 20 scoreboard templates (Scoreboard1-20) now get correct winner visuals automatically.

### W2: Dashboard Mobile Responsiveness (views/dashboard.html)
**Problem**: Dashboard overscaled on mobile, sidebar always visible, no toggle.

**Fix**: 
- Sidebar becomes fixed left-edge drawer on mobile (≤760px), hidden by default
- Hamburger button (☰) in topbar to toggle sidebar
- Overlay backdrop (tap to close)
- `toggleSidebar()` / `closeSidebar()` JS functions
- Nav clicks auto-close sidebar
- Responsive grid overrides (modals full-width, inline grids stack, tables scroll)
- Cache version bumped to `v=20260502b`

### Icon Replacement (views/dashboard.html)
**Change**: All emojis replaced with Lucide-style stroke SVG icons (stroke-width 1.8-2, round caps/joins, `currentColor`).

**Static HTML icons**:
- Nav buttons: 📊→bar-chart, 🏏→users, 🏆→trophy, 📋→file-text, 👥→user-circle, 🎙→mic
- Logout: ⬅→log-out
- Hamburger: ☰→3-line menu
- Close: ✕→X
- Generate: ⚙→settings gear

**JS-generated icons** (via `IC.*` constants):
- Match actions: ▶→play, 🎙→mic, ✓→check, 🔗→link, 🗑→trash
- Match Links: 🏏→link, 🎙→mic, 🌐→globe, 📺→tv
- Player table: ⤴→upload, ✕→X
- Tournament: 🏆→trophy, ✕→X
- Group delete: ✕→X
- Toss coin: 🪙→circle-plus

**CSS added**: `.nav-btn svg` and `.logout-btn svg` for consistent sizing/alignment.

---

## 11. Important Constraints

### Broadcast Graphics (DO NOT MODIFY)
- Scoreboard templates are pixel-locked TV graphics
- Any class starting with `.bb-`, `.mp-`, `.broadcast-`, `.cc-logo-`, `.overlay-`, `.mini-player` must stay dark
- Do not change HTML `id` attributes, `onclick` handlers, or `<script>` blocks
- Do not change `--bat-color` / `--bowl-color` CSS variables (set at runtime)

### Multi-Tenant Isolation
- All queries must include `tenant_id` filter
- Tenant resolution happens before route handlers
- SaaS admin bypasses tenant filter

### State Management
- Match state stored as JSON in `match_state` table
- Undo support via state snapshots
- Server-side validation for all scoring actions

### No Frameworks
- Frontend uses vanilla HTML/JS (no React/Vue)
- Server-rendered HTML with inline scripts/styles
- Shared logic via `scoreboard-core-offline.js`

---

## 12. Development Notes

### Adding New Scoreboard Templates
1. Copy `Scoreboard.html` as `ScoreboardXX.html`
2. Modify HTML/CSS for desired layout
3. Include `scoreboard-core-offline.js` via `<script src="/scoreboard-core-offline.js"></script>`
4. Call `renderBroadcastBar(matchData, teamsData)` in your render function
5. Winner state handled automatically by `applyWinnerLogoState()`

### Adding New Settings
1. Add column to `tenant_settings` or `match_settings` table
2. Add UI toggle in Controller-offline.html settings section
3. Add `onSettingChange('key', value)` handler
4. Add to `CRICCAST_MATCH_SETTINGS` object
5. Persist via `_persistSettings()` if needed

### Adding New API Routes
1. Create handler in appropriate `routes/*.js` file
2. Add authentication middleware (`requireClubAuth` or `requireSaasAdmin`)
3. Add tenant filtering if needed
4. Validate inputs via `express-validator`
5. Return JSON responses

### Database Migrations
1. Create new SQL file in `db/patch_*.sql`
2. Use `IF NOT EXISTS` for safe re-runs
3. Test on development database first
4. Document changes in this file

---

## Quick Reference

### Key File Locations
- **Controller**: `Controller-offline.html`
- **Scoreboards**: `Scoreboard.html`, `Scoreboard1-20.html`
- **Shared JS**: `scoreboard-core-offline.js`
- **Dashboard**: `views/dashboard.html`
- **Server**: `server.js`
- **Schema**: `db/schema.sql`
- **Routes**: `routes/*.js`

### Common Commands
```bash
npm start                    # Start server
node scripts/seed.js         # Seed database
mysql -u root -p criccast < db/schema.sql  # Apply schema
```

### Debugging
- Check `stderr.log` for server errors
- Browser console for frontend errors
- Network tab for SSE connection status

---

**Last Updated**: 2026-05-02
**Version**: 4.0.0
