---
version: 1
slug: "frontend-app-routes-play-tsx"
primary_target: "frontend/app/routes/play.tsx"
related_targets: ["frontend/app/routes/admin.tsx"]
---

# Surface brief: HRRL Activities (employee player + admin console)

Scope: the whole web app, one world. Visitor mode: Operate (both surfaces).
- Employee player (`/a/:slug/*`): refinery staff on phones/desktops complete an activity after typing name + employee ID. Task: inspect the evidence, answer, learn the red flags.
- Admin console (`/admin/*`): CISO office builds activities, places red-flag markers on evidence, publishes, reads results.

Memorable moment: on reveal, numbered yellow evidence markers drop onto the screenshot at each red flag, and the evidence log beside it lists what each marker shows.

Unresolved: no HRRL logo provided (wordmark only); Hindi localisation not in scope yet.

## Direction contract

THESIS: Each scenario is an exhibit; red flags are numbered evidence markers placed on the screenshot itself. Refuses the category default: a centred quiz card with a progress bar, confetti and a blue SaaS shell.

OWN-WORLD: Graphite shell #1A1C1E (admin rail, player top bar) over a cool concrete ground #F4F5F2 and white work surfaces. Marker yellow #F2C230 for primary action, selection and markers only; manila #E8D5A8 tags carry exhibit and question codes; evidence red #C0392B and ledger green #1E7F4F for state. Atkinson Hyperlegible Next for everything, Atkinson Hyperlegible Mono for codes, IDs and URLs (it separates l/I/1 and O/0, which matters for spotting spoofed domains). 2px radii, 1px hairlines, tent-shaped numbered markers.

STORY: The employee inspects an exhibit, decides, and sees exactly where the red flags were, leaving able to spot them alone. The admin sees which markers the workforce misses.

FIRST VIEWPORT: Player (desktop): graphite bar with the exhibit tag "EXHIBIT B · Login page", guide words "Q4–Q10" and the timer at right; left two-thirds the screenshot on a plate with zoom; right column the question, option rows, yellow Check. On a phone the plate collapses to a tappable strip above the question. Admin: graphite rail nav; title row with yellow "New activity"; live activities and today's submissions above a recent-submissions table.

FORM: Evidence Room, Impeccable's pick card (rank 1 of 7 in re-roll round 1), chosen by the user over the rolled Ajrakh direction; seed key 1d955548.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
