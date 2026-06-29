# Research to Impact — project guide for AI sessions

Sheet-driven static website publishing Marshall Street's **Research to Impact (R2I)**
practices as public goods, fulfilling a Bill & Melinda Gates Foundation **Ignite grant**
(Global Access / open access). Practitioner-first, but also hosts research/funder content
without cluttering the practitioner experience. Licensed **CC BY 4.0**.

## Architecture

Google Sheet → `build.js` (fetches each tab as CSV via the gviz endpoint) → injects data +
SEO into `template.html` → writes `dist/index.html` → **Netlify auto-deploys on push to
`main`** (plus a nightly rebuild). **Content is edited in the Sheet, never in HTML.**

- **`build.js`** — fetch tabs, assemble page data + nav, normalize Drive/Vimeo links, inject
  SEO/OG meta, write `dist/`. `STRICT=1` exits non-zero on errors (duplicate ids); used by CI.
- **`template.html`** — the single-page shell; a `DATA` JSON blob is injected at build time.
  Client-side renders home/section/module views, hash deep-links, search, the gated email
  modal, and inline video players.
- **`fixtures/`** — sample CSVs mirroring the sheet. `SHEET_SOURCE=local node build.js` builds
  from them with no network. CI builds strict from fixtures.
- **`docs/`** — `editor-guide.md`, `sheet-guardrails.md`, `file-hosting.md`, `dashboard.md`,
  `sheet-sync.md`, `aaae-public-goods-crosswalk.md`. **`docs/apps-script/`** holds two
  container-bound scripts surfaced via an **"R2I" menu** in the sheet: `PublishFiles.gs`
  (builds the Files manifest) and `Guardrails.gs` (applies dropdowns + conditional formatting).
  The menu's top item, **Update everything**, runs both.

## Build / test locally

```
SHEET_SOURCE=local STRICT=1 node build.js   # build from fixtures, strict (what CI runs)
```

CI (`.github/workflows/ci.yml`) runs this and smoke-checks the rendered page on every push/PR.

## Key concepts & gotchas

- **Tiers** (`tier` on the Sections tab) drive prominence: `IGNITE` (practice toolkits) +
  `Own` (Leading Implementation) = homepage cards + top nav; `Stories` + `Evidence` =
  secondary, shown in the **"Evidence & Stories"** dropdown; `R2I` = the **"Collections"**
  dropdown (cross-cutting topics, shown as "soon" chips until that section's `nav_visible=yes`);
  `Site` = the About page. The two dropdown labels are constants in `build.js`
  (`SECONDARY_NAV_LABEL`, `COLLECTIONS_NAV_LABEL`); their **contents stay sheet-driven**.
- **Nav grouping**: top-nav items group by `header_label` — sections sharing a label cluster
  with no divider between them.
- **gviz type coercion (IMPORTANT)**: if a column looks boolean to gviz, a stray text cell can
  be dropped/nulled on read. Booleans (`focal`/`published`/`gated`) must be **plain-text**
  `TRUE`/`FALSE`. `Guardrails.gs` enforces this; getting it wrong once caused a "Coming soon" bug.
- **Files manifest**: editors name a file starting with the resource `id` and drop it in the
  Drive "01 - Published" folder; `PublishFiles.gs` writes a `Files` tab mapping id→URL; the
  build wires the Download button. No URL pasting.
- **Videos play inline (Vimeo)**: `video_url` (resource Watch button → modal player),
  `landing_video` (Sections) and `module_video` (Modules) → embedded intro players. The parser
  handles share / unlisted (`vimeo.com/ID/HASH`, keeps the privacy hash) / player / channel
  links; non-Vimeo links fall back to opening in a new tab.
- **Gated email ask**: `gated=TRUE` shows a skippable HubSpot email prompt (a harmless
  placeholder until `hubspot_portal_id` / `hubspot_form_id` are set on the Site tab).
- **Lists tab + guardrails**: the `Lists` tab centralizes every dropdown's values; `Guardrails.gs`
  applies all dropdowns + conditional formatting **by header name** (so column-order quirks like
  the `gated`/`note` swap on a couple of tabs don't matter).

## Conventions & constraints

- `dist/` is generated — never edit by hand. Never hardcode content in `template.html`; it
  comes from the sheet.
- Deploys to Netlify (project `ignite-public-goods`); custom-domain target is
  `researchtoimpact.marshallstreet.org`.
- An AI session **cannot edit the Google Sheet or its container-bound Apps Script directly**
  (Drive access is effectively read-only for this); sheet/script changes are done by a human
  following the docs — provide exact steps rather than attempting them.
