---
version: 1
slug: "frontend-app-routes-home-tsx"
primary_target: "frontend/app/routes/home.tsx"
related_targets: []
---

# Surface brief: Cyber Security Awareness Month home (`/`)

Scope: the root page, National Cyber Security Awareness Month, October 2026. Visitor mode: Persuade.
- Audience: refinery staff who reach the root URL from a poster QR, the intranet or a lobby screen; mixed literacy, phones and shared desktops.
- Job: read today's lesson in seconds, come back daily, learn the STOP → THINK → VERIFY → REPORT habit, know how to take part (the link or QR the CISO Office shares) and where to report.
- Proof and content: the user-supplied aerial photo of the HRRL refinery (`public/banner.png`), the official HRRL and CISO Office logos, 31 daily lessons (7 attributed expert quotes, 24 CISO Office tips, each tagged to one mantra step), India's cyber-fraud helpline 1930 and cybercrime.gov.in.
- Constraints (user, 14 Oct 2026): no list of open activities and no API change; dates in Asia/Kolkata; SPA.

Memorable moment: the month drawn as the player's progress track, 31 cells across the refinery photo with today lit marker yellow, and the October sheet lying on the photo.

Unresolved: quote attributions to be confirmed by the CISO Office; the approved reporting channel's address (email, extension or button) is not known yet, so the page says "through the approved channel"; Hindi copy not in scope.

## Direction contract

THESIS: October as a sheet of 31 lessons laid on the refinery: one lesson a day, today lit, earlier days open, later days dashed "not yet". Refuses the campaign default: a photo hero with a centred headline over a row of equal quote cards.

OWN-WORLD: Evidence Room. The refinery photo under a graphite scrim is the table; the October sheet is a white plate (1px corners, plate shadow) lying across the photo's lower edge. Marker yellow only for today; a dashed hairline for locked days; manila step tags ("Step 2 · Think"); tent markers number the four mantra steps; Atkinson Hyperlegible throughout, mono for the helpline and addresses.

STORY: Staff see that HRRL is marking Cyber Security Awareness Month, read today's lesson, browse earlier days, learn the four-step habit and know where to report.

FIRST VIEWPORT: White co-brand header. Photo band (about 46vh): H1 "National Cyber Security Awareness Month" (display 800, white, two lines), meta "October 2026 · HRRL CISO Office", the 31-cell month track with "Day 14 of 31". The sheet overlaps the band's foot: left 1.4fr today's lesson (date, step tag, quote at 30 to 34px, attribution, previous and next day); right the Monday-first month grid, 44px+ cells, today yellow. Phone: band, lesson, grid.

FORM: "A lesson a day", rank 7 of 7 on the grounded list, dealt by surface concept seed c56300a1 (dealt 3, 7, 5) and chosen by the user. Declined challengers: nixie counter (kept: today's day number shown as a count), passport, ink basin, provenance ribbon, silk canopy, sampler.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
