# HRRL Activities

Cybersecurity awareness activities for the HRRL CISO Office. Admins build quizzes, scenario drills and treasure hunts. Employees open a link or QR code, type their name and employee ID, and work through the activity.

- **Evidence-first questions.** A scenario puts a screenshot in front of the employee: a fake email, a login page, a chat. After the answer, numbered markers land on the red flags.
- **Eleven question types:** single choice, multiple choice, yes/no, short answer (synonyms and typo tolerance), list of answers ("name five red flags"), written answer (marked by hand), number, put in order, spot-on-the-image, rating, and **spot the red flags**.
- **Spot the red flags:** employees drag a box around everything suspicious on a screenshot, adjust it by its corners, then press Check. A plain tap marks nothing.
  - When results show right away, each box is judged live on the server: a find drops a numbered marker with the flag's name, and a miss uses up one of a few wrong guesses. While results are held, boxes are recorded quietly (with a cap) and scored the same way.
  - Admins box and name the flags in the builder and can play the question in the preview.
  - The Responses tab shows which flags the workforce misses.
- **Results are held by default.** Employees see "Submitted" until an admin presses **Publish results** on the Responses tab (and can hide them again). Per activity, results can instead show **right away** (optionally with right or wrong after every question, the learning point and the next clue) or **never** (admins only). Treasure-hunt clues still appear after each answer while results are held.
- **Admin console in the Microsoft 365 / Forms style:** a plain list of activities, then three tabs per activity: **Questions** (one-column question cards that save automatically), **Responses** (summary or individual responses) and **Settings** (plain-language switches).
- **Fair attempts:**
  - one attempt per employee ID, which an admin can reset;
  - progress survives a closed tab, and continuing on another device takes a resume code;
  - an optional time limit with auto-submit;
  - answer keys never reach the browser before an answer locks.
- **Results:**
  - a leaderboard, with a projector view for events;
  - printable certificates with a verification code;
  - Excel/CSV export;
  - a per-question summary showing which answers the workforce picks.
- **Live team game: Cyber Survivor.** A facilitator-led game for a room with a projector: 2–6 teams, four rounds (Trust Your Instincts, The Human Firewall, The Cyber Auction, The Final Survival Challenge), a tie-breaker and a champion. Teams answer on printed cards and the host records their answers.
  - **Team games** on the admin home: create a game, edit team names, open the **Host console** (stages, Reveal, countdown, scoring, keyboard shortcuts).
  - **Projector display** at `/g/<code>`: big-screen scenario, countdown with sound, live scoreboard. Answers appear only after the host presses Reveal; the points that depend on them appear after Reveal, or once the host moves past that stage.
  - **Print** sheets: SAFE / DANGER / VERIFY FIRST cards per team, the Round 2 secret cards, a scoring sheet and a champion certificate.
  - Games live in their own `games` collection; the design and build phases are in `NEW_ACTIVITY.md`.

## Run it with Docker

```bash
cp .env.example .env        # then change every secret in .env
docker compose up -d --build
docker compose run --rm api node dist/seed/seed   # optional: load the three sample activities
```

- **Address:** http://localhost:8080. Admins sign in at `/admin` with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`. The owner account is created on first start.
- **Services:** `mongo` (not published to the host), `api` (NestJS on :3000, internal only) and `web` (nginx: serves the app and proxies `/api` and `/uploads`).
- **Uploads:** images live in the `uploads` volume; the database lives in `mongo-data`.
- **HTTPS:** behind a TLS-terminating proxy, set `COOKIE_SECURE=true`.

Backups:

```bash
docker compose exec mongo sh -c 'mongodump --archive --gzip -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' > backup-$(date +%F).gz
docker run --rm -v hrrl-activities_uploads:/u -v "$PWD":/b alpine tar czf /b/uploads-$(date +%F).tgz -C /u .
```

## Develop

Requirements: Node 22+, pnpm 10 (`corepack enable`), and Docker for MongoDB.

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d     # MongoDB on 127.0.0.1:27017
pnpm dev                                          # shared (watch) + API :3000 + web :5173
pnpm seed                                         # sample activities
```

The Vite dev server proxies `/api` and `/uploads` to the API, so it works like production (same origin, httpOnly cookie). In development the admin login is `admin@hrrl.local` / `ChangeMe-2026!` unless you set `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

### Checks

```bash
pnpm typecheck                         # shared, backend, frontend
pnpm --filter backend test             # grading rules (unit)
pnpm --filter backend test:e2e         # attempt lifecycle against in-memory MongoDB
node e2e/smoke.mjs  [baseUrl]          # browser walk: both seeded activities + every admin page
node e2e/builder.mjs [baseUrl]         # build, publish and play an activity, including the timer
node e2e/spot.mjs [baseUrl]            # play "Spot Every Red Flag": draw, tap, miss, repeat, give up; admin preview
node e2e/survivor.mjs [baseUrl]        # Cyber Survivor: host drives every stage; the projector never shows an answer before Reveal
```

The browser scripts use Playwright (`npx playwright install chromium-headless-shell` once). They default to `http://127.0.0.1:5173`. For the Docker stack, pass `http://127.0.0.1:8080` and set `ADMIN_PASSWORD`.

## Layout

```
packages/shared   Zod schemas and types shared by API and web; the public (answer-free) shapes live here
backend           NestJS API: auth, activities, attempts (grading, lifecycle, export, insights), uploads, seed
frontend          React Router (SPA mode), shadcn/ui, TanStack Query / Table / Form
docker            nginx config
e2e               Playwright walks
seed-assets       the source PDFs (git-ignored); extracted screenshots are in backend/src/seed/images
```

Key rules live in:
- `backend/src/attempts/grading.ts`: scoring for every question type.
- `backend/src/attempts/attempts.service.ts`: entry, resume, race-safe answer saves, timers, submission.
- `backend/src/attempts/serialize.ts`: the allowlist that keeps answer keys out of employee responses.

## Things to confirm

- The PDFs give no answer key for the "select all that apply" questions. The seed treats every option as correct except the "automatically proves/means…" distractors.
- Some treasure-hunt answers are prose in the PDF (the USB and OTP challenges). They became single-choice questions with authored distractors.

Both are marked `REVIEW` in `backend/src/seed/content.ts` and can be edited in the builder.

No official HRRL logo file was provided, so the product sets its name in type.
