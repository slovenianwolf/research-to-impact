# Syncing the Google Sheet to the current site structure

The site code is ahead of the live sheet: there are two new sections, a couple of
new columns, and some updated Site text. This is a **one-time** migration to bring
the master sheet up to date. After this, day-to-day editing is just the
[Editor's Guide](editor-guide.md).

> **Golden rule:** only *import* the two brand-new tabs. For tabs that already have
> real content, **add** columns/rows by hand — never re-import, or you'll overwrite
> the team's work.

Estimated time: ~15–20 minutes.

---

## 1. Add the two new tabs (import — fastest)

These tabs don't exist yet, so importing is safe.

For each of `Evidence & Impact` and `Stories & Spotlights`:
1. **File → Import → Upload** the matching CSV from `docs/sheet-templates/`.
2. Import location: **Insert new sheet(s)**. Import type: keep as-is (no conversion
   needed).
3. **Rename the new tab to exactly** `Evidence & Impact` / `Stories & Spotlights` —
   spaces and the `&` must match exactly, because the build fetches tabs by name.

The rows are starter content (the committed public goods). They're all
`published = FALSE` with no links, so nothing goes live until the team adds a
`link_url` and flips `published` to `TRUE`.

## 2. Sections tab — add 2 rows

Add these two rows (the `header_image` column already exists; leave it blank or set
a banner later):

| section_id | section_name | header_label | tier | order | nav_visible | landing_intro |
| --- | --- | --- | --- | --- | --- | --- |
| stories-spotlights | Stories & Spotlights | Stories & Spotlights | **Stories** | 7 | yes | *(see template.csv / editor guide)* |
| evidence-impact | Evidence & Impact | Evidence & Impact | **Evidence** | 8 | yes | *(see template.csv / editor guide)* |

The new `tier` values **Stories** and **Evidence** make these browsable + in the nav
but kept off the homepage (the practitioner-first rule).

## 3. Modules tab — add 7 rows

| section | module_order | module_name |
| --- | --- | --- |
| Stories & Spotlights | 1 | Partner Spotlights |
| Stories & Spotlights | 2 | School Case Studies |
| Stories & Spotlights | 3 | From the Field |
| Evidence & Impact | 1 | White Papers |
| Evidence & Impact | 2 | External Evaluation |
| Evidence & Impact | 3 | Annual Reports |
| Evidence & Impact | 4 | Equity-Gap Roadmap |

## 4. Existing resource tabs — add a `gated` column

On each of `Co-Planning`, `Repeated Reading`, `Routine Data Cycles`,
`Leading Implementation`, `R2I Library`, `Site Assets`: add one new column header
**`gated`** at the end. Leave it blank (= not gated) for the practitioner toolkits.
Only set `TRUE` for research/funder downloads you want behind the soft email ask.

*(The `Stories & Spotlights` tab also has a `practice` column — already included in
its import template. Use it to tie a case study to a toolkit, e.g. `Co-Planning`.)*

## 5. Site tab — update 5 values, add 4 rows

**Update** these existing settings (current values shown for clarity):

| setting | new value |
| --- | --- |
| tagline | Field-built practices for closing gaps — free for every school. |
| hero_headline | Practices that help every student reach grade-level work — built with a focus on students with disabilities. |
| hero_subhead | Co-planning, repeated reading, and routine data cycles: classroom practices developed with schools to better serve students with disabilities and others furthest from opportunity. Free guides, templates, and videos to put them to work. |
| license_default | CC BY 4.0 |
| license_line | © 2026 Marshall Street at Summit Public Schools. Shared with permission from partner schools. Free to use, share, and adapt with attribution. (CC BY 4.0) |

**Add** these new rows:

| setting | value |
| --- | --- |
| about_network | *(partner + funder credits — see fixtures/Site.csv; confirm public-naming clearance + Gates wording)* |
| hubspot_portal_id | *(blank until you have it)* |
| hubspot_form_id | *(blank until you have it)* |
| hubspot_region | na1 |

## 6. Add the dropdowns (prevents bad data)

Set up the **Data → Data validation** dropdowns listed in the
[Editor's Guide](editor-guide.md#recommended-google-sheets-data-validation-dropdowns):
`format`, `focal/published/gated` (TRUE/FALSE), `status`, `tier`, `nav_visible`, and
`practice`. This is the single best thing for keeping the team's future edits clean.

---

## 7. Verify it synced

1. Make sure the sheet is still shared **Anyone with the link → Viewer**.
2. Trigger a rebuild: **GitHub → Actions → Scheduled rebuild → Run workflow**
   (or push the Netlify build hook).
3. Read the build report. Every problem is named — a mismatched module, a blank
   summary, an unknown tier. **Aim for "No warnings."** The new tabs should show up
   under "Tabs read," and the two new sections in "nav sections."

You can also run it locally against the live sheet before publishing:
`node build.js` (prints the same report without deploying).

---

## Tip: preview before it's public

Turn on **Netlify deploy previews** (Netlify → Project configuration → Build &
deploy → Deploy previews) so every pull request gets its own temporary URL. Combined
with the `published` flag (drafts render as "coming soon"), the team can see exactly
how a change looks before it reaches the live site.
