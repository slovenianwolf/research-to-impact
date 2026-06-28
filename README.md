# Research to Impact — sheet-driven site

The site is built from one Google Sheet. You edit the sheet; a build pulls it and
publishes the site. No hand-dragging, no editing HTML for content.

## How it fits together

```
Google Sheet  ──>  build.js  ──>  dist/index.html  ──>  Netlify  ──>  live site
 (your edits)      (template.html + sheet data)         (auto-deploy)
```

- **template.html** — the site shell (design, fonts, search, page logic). The data
  is a single placeholder, `__DATA__`, that the build fills in.
- **build.js** — pulls each sheet tab as CSV, assembles the page data, and writes
  `dist/index.html`. Prints a report plus warnings about any data problems.
- **netlify.toml** — tells Netlify to run `node build.js` and publish `dist/`.
- **.github/workflows/rebuild.yml** — rebuilds nightly and on demand.

## One-time setup

1. **Share the sheet for reading.** In the sheet: *Share → General access →
   Anyone with the link → Viewer.* (The content is public-goods anyway.) The build
   reads each tab as CSV; without this it can't fetch.

2. **Put these files in the GitHub repo** (the one already linked to Netlify):
   `template.html`, `build.js`, `netlify.toml`, `.gitignore`,
   `.github/workflows/rebuild.yml`, and the `fixtures/` folder (optional, for local
   preview). You can delete the old hand-dragged `index.html` — the build makes its
   own. `netlify.toml` changes the publish folder from the repo root to `dist/`.

3. **Create the Netlify build hook (the on-demand trigger).**
   In Netlify: *Project configuration → Build & deploy → Build hooks → Add build
   hook.* Name it "Sheet rebuild", branch = your default. Copy the URL it gives you.

4. **Add the hook to GitHub as a secret (powers the nightly + manual rebuild).**
   In GitHub: *Settings → Secrets and variables → Actions → New repository secret.*
   Name it `NETLIFY_BUILD_HOOK`, paste the URL from step 3.

That's it. Pushing these files makes Netlify run the build; from then on the sheet
drives the site.

## Day-to-day

- **Change content** → edit the sheet. It refreshes on the **nightly rebuild**.
- **Need it live now** → GitHub repo → *Actions → Scheduled rebuild → Run workflow*
  (or POST the build hook URL). Either way the site rebuilds in ~1 minute.
- **Change design/layout/logic** → edit `template.html`, commit. Netlify rebuilds on
  push automatically.

## Preview locally (optional, no network)

```
SHEET_SOURCE=local node build.js   # builds from the sample data in fixtures/
open dist/index.html
```

Build straight from the live sheet (after step 1):

```
node build.js
```

## What the build does with the sheet

- Reads tabs: `Site`, `Sections`, `Modules`, and one resource tab per section
  (`Co-Planning`, `Repeated Reading`, `Routine Data Cycles`,
  `Leading Implementation`, `Stories & Spotlights`, `Evidence & Impact`,
  `R2I Library`, `Site Assets`). Instructions and Column Guide tabs are ignored.
- A resource's **section is the tab it lives on** (resource rows have no `section`
  column).
- **Nav** is built from the Sections tab: `header_label` groups the items,
  `tier` and `order` place them, `nav_visible = hidden-until-live` keeps a section
  out of the public nav. Practice toolkits cluster, then Leading Implementation,
  then the secondary sections (Stories & Spotlights, Evidence & Impact) and the
  Library dropdown; About sits on the right.
- **Two prominence tiers.** `tier` controls how a section surfaces:
  - **Homepage tiers** (`IGNITE`, `Own`) — practice toolkits + Leading
    Implementation — appear as homepage cards *and* browsable pages, with intro
    videos. This is the practitioner-first front door.
  - **Secondary tiers** (`Stories`, `Evidence`) — Stories & Spotlights and
    Evidence & Impact — are browsable and in the nav, but deliberately *not* on
    the homepage and without video bars. This is where research/funder-facing
    goods (white papers, evaluation, annual reports, roadmap) live without
    cluttering the practitioner experience.
  - The Library and Site Assets resources are skipped until their section's
    `nav_visible` is set to `yes` — then they appear automatically, no code change.
- **Optional email ask on downloads.** Set `gated = TRUE` on a resource row to show
  a soft, *skippable* "email to download" prompt (the toolkits stay open; this is
  for the research tier). It routes to HubSpot once `hubspot_portal_id` and
  `hubspot_form_id` are filled in on the `Site` tab; until then a harmless
  placeholder shows and "just download" still works. No external script loads until
  those IDs are set.
- **Watch the warnings.** The build flags published focal cards with no summary,
  resources pointing at a module that doesn't exist, and blank Site settings. Fix
  these in the sheet.

## Known sheet cleanups (not launch-blocking)

- The Modules tab labels the library `R2I Library`; the Sections tab calls it
  `Research-to-Impact Library`. The build aliases one to the other so they join.
  Worth making them identical in the sheet before the library goes live.
- `Site Assets` appears in Modules but has no Sections row — treated as a home/impact
  asset pool, not a public section. Fine as-is.

## Custom domain (later)

When Summit IT points `researchtoimpact.marshallstreet.org` at this Netlify site via
one CNAME, nothing here changes — same repo, same build.
