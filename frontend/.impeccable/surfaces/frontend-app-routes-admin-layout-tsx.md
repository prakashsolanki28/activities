---
version: 1
slug: "frontend-app-routes-admin-layout-tsx"
primary_target: "frontend/app/routes/admin/layout.tsx"
related_targets: []
---

# Surface brief: admin console

Scope: every `/admin/*` route (home, activity workspace: Questions, Responses, Settings, Share; Admins; sign-in). Visitor mode: Operate.
Audience: CISO-office staff on Windows office desktops who live in Outlook, Teams and Microsoft Forms. Job: build an activity like a form, share it, read responses, publish results when ready.
Not in scope: employee-facing screens (they keep the Evidence Room world); the Preview dialog renders that world on purpose (scoped by `.evidence-ui`).

## Direction contract

THESIS: The console is a sibling of Microsoft Forms and Microsoft 365: one column of question cards, plain words, nothing to learn. It refuses the previous admin look (dark graphite rail, yellow buttons, CASE codes, S1·Q01 chips, manila tags, three-pane builder).

OWN-WORLD: White cards on a #f5f5f5 page; a brand-blue app bar (#0f6cbd) with the product name; brand blue only for primary actions, selection and the active tab underline; Fluent-style neutrals (#242424 text, #424242 / #616161 secondary, #e0e0e0 / #d1d1d1 strokes); Segoe UI Variable / Segoe UI stack; 4px control radius, 8px card radius, soft two-layer card shadow; status green #107c10, red #c50f1f, amber #bc4b09. No Microsoft logos or names.

STORY: Admins make an activity the way they make a form: title, questions as cards, preview, share a link. They read Responses as a summary with simple bars, open individual responses when needed, and press Publish results when they are ready.

FIRST VIEWPORT: Home: blue app bar with "HRRL Activities" and the account menu; page title "Activities" with a blue "New activity" button; status filter pills and search; a white list of activities (title, questions, status, responses, results, last edited). Activity: app bar; a header row with back link, title, status, Preview and Share on the right; centred tabs Questions | Responses | Settings; the Questions tab is a 760px column whose first line is the autosave state ("All changes saved", right-aligned, because only that tab saves on its own), then the title card, numbered question cards and "Add new question". On a phone, every list (activities, admins) becomes stacked rows with the ⋯ menu visible; no admin page scrolls sideways.

FORM: The category standard (Microsoft Forms / Microsoft 365), chosen by the user as the standing exit; no roll.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
