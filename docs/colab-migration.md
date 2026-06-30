# CoLab → R2I site migration: the five practice collections

Migrating the five Research-to-Impact **practice collections** from the (sunsetting)
marshall.org CoLab site into this site's **Collections** area (the Research-to-Impact
Library section). Source:
<https://www.marshall.org/initiative/marshall-colab/research-to-impact/>

## What's moving

Each old collection becomes a **module** of the `Research-to-Impact Library` section;
each chapter/practice/case-study becomes a **focal resource** with a Download button.
**31 PDFs total**, all of which already lived as public Google Drive files on the old site.

| Collection (old page) | New module | Resources |
|---|---|---|
| Opening Doors to Collaboration | Collaboration | 7 (1 full + 6) |
| Turning the Page to Secondary Literacy | Secondary Literacy | 6 (1 full + 5) |
| Navigating Data for MTSS | Data for MTSS | 7 (1 full + 6) |
| Igniting Postsecondary Aspirations | Postsecondary | 6 (1 full + 5) |
| Anchoring Emotions | Emotional Support | 5 (1 full + 4) |

Resource ids are prefixed `collab- / lit- / mtss- / post- / emot-`. Every row is
`focal=TRUE`, `published=TRUE`, `link_type=download` (so the file resolves via the
**Files** manifest, not a pasted URL). `gated=FALSE` — open downloads, like the toolkits.

### Full on-page content is preserved (not just the PDF)

The old practice pages carried a **narrative**, a **"Why it Works"** list, an **impact
pull-quote**, and a **captioned photo** — richer than a download link. All of it was
scraped verbatim before the sunset and now renders on the new site. New optional columns
on the resource tab carry it:

| Column | Holds |
|---|---|
| `image` | repo path to the practice photo (e.g. `collections/collab-01.png`) |
| `image_caption` | the photo caption (e.g. "Ednovate, Los Angeles, CA") |
| `body` | the full narrative (paragraphs separated by a blank line) |
| `why_it_works` | the "Why it Works" bullets, separated by ` \|\| ` |
| `quote` | the impact pull-quote |
| `overview` | `TRUE` on the 5 full-collection rows → renders the standout "Full collection" hero card |

The **26 practice photos** are committed to `assets/collections/` (id-ordered, e.g.
`collab-01.png`) so they survive independent of marshall.org. They are **content-cropped**
from the original CoLab PNGs — the source files were transparent compositions with a
decorative dot motif and white padding; `scratchpad/crop.py` detects the opaque photo via
the alpha channel and crops to a clean edge-to-edge image (uniform 323×314). A verbatim
text archive of every collection lives in the delivered `archive/*.md` (preservation copy).

Practice cards render the photo + caption on a soft blue tile (left) with the narrative,
"Why it Works," and pull-quote alongside (right); the full-collection row renders as an
orange-accented download CTA. See `template.html` `card()` and the `.rcard.rich` /
`.rcard.collhero` styles.

Code: `build.js` parses these fields onto each resource; `template.html` `card()` renders
the photo + caption, narrative, "Why it Works" list, and pull-quote, and gives `overview`
rows the orange hero treatment (echoing the old brown banner, `--orange #AB4D00`).

## Done in code (this branch)

- `build.js`: added `R2I` to `PAGE_TIERS`, so the Library renders as a browsable page
  (its modules = the Collections) once its section `nav_visible` is off `hidden-until-live`.
  Also passes the Library's section name to `nav.collections` so dropdown items deep-link.
- `template.html`: Collections dropdown items now deep-link to each collection's module
  page; the Library's section page labels its cards "Collection" instead of "Module N".
- `fixtures/`: `R2I Library.csv` (31 rows), `Modules.csv` (5 modules, ordered + intros),
  `Files.csv` (preview links), `Sections.csv` (Library set to `nav_visible=yes`).
- Verified: `SHEET_SOURCE=local STRICT=1 node build.js` is clean (no warnings/errors);
  all 31 resources publish with resolving Download buttons.

The fixtures reflect the **launched** state so CI exercises the live Collections path.
The real go-live is the Sheet flip in step 4 below.

## Make the links work — backend runbook (Sheet + Drive)

An AI session can't touch the Sheet, Drive, or the container-bound Apps Script — these
are human steps. **Order matters:** the rows must be in the sheet *before* the Files
manifest runs, because `PublishFiles.gs` matches uploaded files against the resource ids
it reads from the tabs. Do them in this order.

### 0. One-time prerequisites (skip if already done)
- **Apps Script installed.** The Sheet has `PublishFiles.gs` + `Guardrails.gs` bound via
  *Extensions → Apps Script*, surfacing the **R2I** menu. `PUBLISHED_FOLDER_ID` is already
  set to the "01 - Published" folder.
- **Re-paste `Guardrails.gs`.** This migration added the `overview` boolean column; the
  updated `Guardrails.gs` lists it in `G_BOOL_COLS` so it's forced to plain-text TRUE/FALSE.
  Copy the current `docs/apps-script/Guardrails.gs` over the bound script and save.
- **Lists tab present** (`docs/sheet-templates/Lists.csv` imported as "Lists"). Its
  R2I Library module column already offers the five collection names.

### 1. Load the rows (ids must exist before the manifest runs)
- **R2I Library tab — import, don't paste.** Some narratives span multiple paragraphs,
  whose line breaks corrupt a plain copy-paste. Open the **R2I Library** tab →
  *File → Import → Upload* `R2I-Library-IMPORT.csv` → **Replace current sheet**,
  separator *comma*, and leave **"Convert text to numbers/dates" OFF** (keeps `TRUE`/`FALSE`
  as plain text). This sets the headers (including the new `image_caption`, `body`,
  `why_it_works`, `quote`, `overview` columns) and all 31 rows in one shot, replacing the
  placeholder stubs.
- **Modules tab — paste/edit by hand (only 5 short rows).** Using `Modules.rows.tsv` as the
  reference, set the five `R2I Library` module rows to order 1–5 with their intros (update
  the existing rows, don't duplicate).

### 2. Upload the PDFs
- Drop the 31 files from `R2I-collections-PDFs.zip` into the **"01 - Published"** Drive
  folder. They're already named `<id>.pdf`, which is exactly what `PublishFiles.gs`
  matches — no renaming. (Photos need no Drive work — they're committed in
  `assets/collections/` and referenced by the `image` column.)

### 3. Build the manifest + apply guardrails
- **R2I menu → Update everything.** This runs `PublishFiles.gs` (writes the `Files` tab
  mapping each id → its new Drive URL, and sets each PDF to "anyone with link: Viewer")
  then `Guardrails.gs`.
- **Read the dialog:** it should report **31 file(s) mapped to ids** with nothing under
  "Skipped". A skipped file means its name doesn't start with a known id — fix the name
  or the row, and re-run.

### 4. Go live + rebuild
- On the **Sections** tab, set the `Research-to-Impact Library` row's `nav_visible` from
  `hidden-until-live` to `yes`.
- Trigger a rebuild (GitHub *Actions → Scheduled rebuild → Run workflow*, or POST the
  Netlify build hook). The Collections dropdown activates and the pages publish in ~1 min.

### 5. Verify the links resolve
- **Build report:** the run log should show `R2I Library: 31 rows`, the Collections nav as
  `[visible]`, and **no** `Published resource "…" resolves to no file` warnings (that
  warning fires for any published download the manifest couldn't resolve).
- **On the live site:** open **Collections → Collaboration**, click a **Download** — it
  should open the re-hosted PDF from the R2I Drive. Spot-check one per collection.

## Backup / provenance

`rename-map.csv` maps each resource id → target filename → the **source Drive id + URL**
on the old site, so the lineage back to the originals is recorded. A local copy of all
31 PDFs (plus a verbatim `archive/*.md` of every collection's on-page text) was pulled
during migration as insurance against the sunset.
