# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Pinned by user: Node, React, MongoDB, Docker, shadcn/ui, TanStack (Query, Table, Form).
- API: NestJS 11 in `backend/` (user scaffold), Mongoose, Zod validation.
- Web: React Router 8 framework mode in SPA mode (`ssr: false`) in `frontend/` (user scaffold), Tailwind v4, shadcn/ui.
- Shared Zod schemas in `packages/shared`; pnpm workspace; one root git repo; docker-compose (mongo, api, web via nginx).

## Users

- **Admins (CISO office / IT security team at HRRL).** On office desktops, they author awareness activities (quizzes, scenario drills, treasure hunts), schedule them, share links/QR codes, and read the results to see which threats employees miss.
- **Employees (refinery staff, mixed technical literacy).** They open a shared link on a phone or desktop, often during Cybersecurity Awareness Month events, type their name and employee ID (no login), and complete an activity. Some take part in a physical treasure hunt where clues lead to locations.

## Product Purpose

Turn the CISO office's awareness material into interactive activities that employees actually complete, and that teach them to recognise phishing, social engineering, malware vectors and reporting duties. Success: high participation, employees finishing with the learning points read, and admins knowing which red flags the workforce misses.

## Positioning

Built around real-looking evidence: each scenario carries a screenshot (fake email, fake login page, WhatsApp/Teams message, macro document). Employees inspect it, answer, and see the red flags highlighted on the evidence itself. Treasure-hunt flows reveal the "next clue" after each answer.

## Operating Context

- Activities are run per campaign (e.g. Cyber Month) with an open/close window; links go out via email, Teams, WhatsApp, and printed QR codes.
- Identity is free entry: name + employee ID, one attempt per ID per activity; admins can reset attempts. Progress resumes after a closed tab; resuming on another device uses a resume code.
- Feedback mode is chosen per activity: instant (reveal + learning point + next clue after each answer), end review, or hidden.
- Optional time limit with auto-submit; leaderboard (with a projector display for live events); question/option shuffling; completion certificate.
- The refinery likely reaches the server from a shared corporate IP.

## Capabilities and Constraints

- Question types: single select, multi select, yes/no, short text (auto-graded with synonyms), list of N answers (keyword groups), long text (manual/unscored), number, ordering, hotspot on image, rating.
- Images on sections (scenario evidence), questions, and options; zoomable for reading URLs in screenshots.
- Answer keys never reach the browser before an answer is locked.
- Exports to XLSX/CSV; per-question insights.
- Times shown in Asia/Kolkata.
- Fake phishing screens are shown only as images, never as live HTML.

## Brand Commitments

- **Admin console follows Microsoft 365 / Microsoft Forms conventions** (chosen by the user, 13 Oct 2026). HRRL admins work in Outlook, Teams and Forms all day; the console should feel like a sibling of those tools: white workspace, one-column question cards, plain words, no internal codes. Use the design language only; never Microsoft logos, product names or trademarks. The app bar is white and carries the HRRL and CISO Office logos (chosen by the user, 14 Oct 2026). The employee-facing screens keep their own "Evidence Room" look.
- **Results are held by default.** Employees see "Submitted" until an admin publishes results; per activity, results can instead show right away or never (admins only).

- Organisation: **HPCL Rajasthan Refinery Limited (HRRL)**, as set in its official logo (the source material's "Hindustan Refinery Limited" is wrong). The CISO Office runs the programme.
- Campaign mantra from the source material: STOP → THINK → VERIFY → REPORT.
- **Official logos** (provided 14 Oct 2026): the HRRL bilingual lockup `frontend/public/logo/hrrl.png` and the CISO Office lockup `frontend/public/logo/ciso-office.png`. Derived cuts sit beside them: `hrrl-emblem.png` (the arch emblem alone, its frame filled white), `hrrl-lockup.png` and `ciso-office-lockup.png` (trimmed). Use them as supplied; never redraw, recolour or re-letter them. Both have black lettering on transparency, so they sit on white. Wherever HRRL appears on white it is the full logo, emblem and bilingual name together, exactly as supplied (asked for by the user, 14 Oct 2026); the emblem alone appears only on the graphite player bar, where the black lettering cannot sit.

## Evidence on Hand

- `Activity 1.pdf`: five phishing scenarios with screenshots and questions (seed content).
- `Acitivy 2.pdf`: Cybersecurity Treasure Hunt, 10 challenges + Caesar bonus (seed content).
- Some "select all that apply" answer keys are absent from the PDFs; inferred keys are flagged for review.
- No participation statistics, testimonials, or real employee data exist; never fabricate them outside clearly-labelled seed/demo data.

## Product Principles

1. The evidence is the lesson: put the suspicious artifact in front of the employee and teach on it.
2. Never leak the answer: integrity of scoring and leaderboard matters to a security team.
3. Zero-friction entry: name + ID and go, on any device, with progress never lost.
4. Admins see what the workforce misses, not just who scored what.

## Accessibility & Inclusion

Mixed-literacy workforce on phones and shared desktops: WCAG 2.2 AA contrast, 44px touch targets, full keyboard operation, reduced-motion support, plain-language copy.
