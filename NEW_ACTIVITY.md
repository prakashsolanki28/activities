# New activity: Cyber Survivor (live team game)

**Cyber Survivor: Trust Your Instincts.** 4 teams, 1 mission: can you survive the cyber traps?
A facilitator-led team game for HRRL Cybersecurity Awareness Month: 3–4 teams of 4–6 people, 30–40 minutes, R1 Conference Room, 100 points per team.

This document describes what was added to HRRL Activities, where it lives, and how it was built in phases.

---

## 1. How it plays

| Who | Uses | Route |
|---|---|---|
| Facilitator | **Host console** on the laptop: moves through stages, reveals answers, runs the countdown and records each team's answers | `/admin/games/:id` |
| The room | **Projector display**, read-only: shows the scenario, countdown, answers after Reveal, and the scoreboard | `/g/:code` |
| Teams | Printed **SAFE / DANGER / VERIFY FIRST** cards, paper and markers. No phones needed. | `/admin/games/:id/print` |

Admins create a game from **Team games** on the admin home page. It starts from the Cyber Survivor template with the four default teams (Firewall 🔥, Cyber Ninjas 🥷, Hackbusters 🕵️, Digital Defenders 🛡️). Team names and emoji can be edited, and 2–6 teams are allowed.

### Rounds and scoring

| Round | Format | Points |
|---|---|---:|
| 1. Trust Your Instincts | 4 situations, 15 s each; teams hold up a card. 5 points per correct card. | 20 |
| 2. The Human Firewall | One volunteer per team acts out a secret card (A–D). 10 points each for naming the scenario, the warning signs and the response. | 30 |
| 3. The Cyber Auction | 100 Cyber Coins to spend on actions, then a twist. +10 each for report, secure and preserve; −5 each for ignore or delete; the round is kept between 0 and 30. | 30 |
| 4. The Final Survival Challenge | 4 situations at once, 3 minutes. 5 points per correct action. | 20 |
| Tie-breaker | Only if the top teams are level. The host picks the clearest, safest answer. No points; it breaks the tie. | — |

**Stage order:** Welcome → R1 intro → Challenges 1–4 → Scores → R2 intro → one stage per team → Scores → R3 intro → Auction → Twist → Auction results → Scores → R4 intro → Mission → Mission results → (Tie-breaker) → Champions.

**No answer leaks:** the projector gets only the current stage. Answers appear only after the host presses **Reveal**. Points that depend on an answer appear after its Reveal, or once the host moves past that stage. Round 2 card text never reaches the projector before its reveal. Every stage change, Reveal or timer action names the stage the host was looking at, so a second window that has fallen behind is refused instead of revealing the wrong stage.

---

## 2. What changed in the codebase

The existing activities, attempts, grading, player, leaderboard and seed data are **not changed or removed**. The game has its own `games` collection and module.

### New files

| Area | Files |
|---|---|
| Shared contract | `packages/shared/src/game.ts`: template content, Zod inputs, stages, scoring, `visibleScores`, `buildPublicDisplay` |
| API | `backend/src/games/*` (schema, service, admin and public controllers, module, scoring tests), `backend/test/games.e2e-spec.ts` |
| Web data | `frontend/app/lib/game-api.ts`, `frontend/app/lib/game-timer.ts` |
| Host console | `frontend/app/routes/admin/game/host.tsx`, `frontend/app/components/admin/game/*`, `frontend/app/components/admin/team-games.tsx` |
| Projector and print | `frontend/app/routes/game/display.tsx`, `frontend/app/components/game/*`, `frontend/app/lib/game-sound.ts`, `frontend/app/routes/admin/game/print.tsx` |
| Browser check | `e2e/survivor.mjs` |

### Existing files: additive lines only

| File | Added |
|---|---|
| `packages/shared/src/index.ts` | `export * from './game'` |
| `backend/src/common/models.module.ts` | `Game` model registration |
| `backend/src/app.module.ts` | `GamesModule` import |
| `backend/src/seed/seed.ts` | a demo game, created only if none exists |
| `frontend/app/routes.ts` | `g/:code`, `admin/games/:id`, `admin/games/:id/print` |
| `frontend/app/routes/admin/home.tsx` | `<TeamGamesCard />` under the activities list |
| `README.md` | feature and check notes |

### API

```
GET    /api/admin/games                      list (summaries)
POST   /api/admin/games                      create from the template  {title?, teams?}
GET    /api/admin/games/:id                  full game with totals
PATCH  /api/admin/games/:id                  {title?, teams?}  (renames any time; add, remove or reorder only before the game starts)
POST   /api/admin/games/:id/state            {expectedStageId?, stageId?, revealed?, timer?: start|pause|resume|clear}  (409 if the game moved on)
PUT    /api/admin/games/:id/scores/:teamId   one scoring change (r1 | r2 | r3 | r4 | tiebreak)
POST   /api/admin/games/:id/reset            clear scores, back to Welcome
DELETE /api/admin/games/:id
GET    /api/public/games/:code               projector payload (answer-safe)
```

---

## 3. Build phases

```
Phase 0  Contract + scaffolding ─────── Opus    (main session, sequential)
   │
   ├─▶ Phase 1A  Backend API ────────── Sonnet  ┐
   ├─▶ Phase 1B  Host console ───────── Opus    ├─ in parallel, disjoint files
   └─▶ Phase 1C  Projector + print ──── Sonnet  ┘
   │
Phase 2  Integrate + verify ─────────── Opus    (main session) ‖ code review agent in parallel
```

| Phase | Model | Why this model | Runs | Owns |
|---|---|---|---|---|
| **0. Contract** | Opus | Everything depends on it: the types, the scoring rules, the leak-safe display builder and the game content | first, alone | `packages/shared/src/game.ts`, `game-api.ts`, `game-timer.ts`, routes, stubs, this file |
| **1A. Backend** | Sonnet | NestJS CRUD that mirrors the existing activities module | parallel | `backend/src/games/**`, `backend/test/games.e2e-spec.ts`, the additive lines in the models and app modules and the seed |
| **1B. Host console** | Opus | The most stateful UI: stage machine, timers, per-round scoring, shortcuts | parallel | `routes/admin/game/host.tsx`, `components/admin/game/**`, `components/admin/team-games.tsx` |
| **1C. Projector + print** | Sonnet | Presentational, with a clear reference in the leaderboard's projector view | parallel | `routes/game/display.tsx`, `components/game/**`, `lib/game-sound.ts`, `routes/admin/game/print.tsx`, `e2e/survivor.mjs` |
| **2. Integrate** | Opus | Cross-cutting fixes and final verification | last | any fix, README |

Phase 0 creates every shared or contested file first (types, API client, routes, stub pages, the admin home line). That keeps the three Phase 1 agents from ever editing the same file.

---

## 4. Verify

```bash
pnpm typecheck
pnpm --filter backend test          # existing grading tests + game scoring
pnpm --filter backend test:e2e      # existing attempt lifecycle + games API (incl. answer-leak checks)
docker compose -f docker-compose.dev.yml up -d && pnpm dev
pnpm seed                           # existing sample activities untouched; adds a demo game
node e2e/survivor.mjs               # full game walk in the browser
node e2e/smoke.mjs                  # existing flows still work
```

**Running it on the day:** open `/admin`, then Team games, then the game. Press **Open projector** and drag that window to the projector (press F for full screen, and click once to enable sound). Print the cards from **Print** beforehand. Keyboard on the Host console: **→** next, **←** back, **R** reveal, **T** start the timer, **P** pause or resume (Space also works when no button has focus).
