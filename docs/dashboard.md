# Project dashboard (Dashboard tab)

A live progress view: one row per section, auto-updating from the resource tabs.
Numbers move the moment anyone changes a `status` or `published`.

## Build it (5 minutes)
1. **File → Import → Upload `Dashboard-scaffold.csv` → Insert new sheet(s).** Rename
   the tab **`Dashboard`**. (It's just labels — imports clean. Formulas come next.)
2. Click **B2** and paste these into **B2:H2** (one per cell, left to right):

   | Cell | Formula |
   | --- | --- |
   | B2 (Total) | `=COUNTA(INDIRECT("'"&$A2&"'!A2:A"))` |
   | C2 (Planned) | `=COUNTIF(INDIRECT("'"&$A2&"'!H2:H"),"planned")` |
   | D2 (In Progress) | `=COUNTIF(INDIRECT("'"&$A2&"'!H2:H"),"in_progress")` |
   | E2 (Ready) | `=COUNTIF(INDIRECT("'"&$A2&"'!H2:H"),"ready")` |
   | F2 (Published) | `=COUNTIF(INDIRECT("'"&$A2&"'!I2:I"),"TRUE")` |
   | G2 (% Done) | `=IFERROR((D2*0.5+E2)/B2,0)` |
   | H2 (% Live) | `=IFERROR(F2/B2,0)` |

3. **Select B2:H2 → copy → select B3:H9 → paste.** (Fills the formulas down for all
   8 sections. `INDIRECT` reads whichever tab is named in column A, so every row is
   identical.)
4. **TOTAL row (row 10):** in B10 `=SUM(B2:B9)`, drag across to F10. Then
   G10 `=IFERROR((D10*0.5+E10)/B10,0)` and H10 `=IFERROR(F10/B10,0)`.
5. Select **G2:H10 → Format → Number → Percent.**

That's it — it's now live.

## How the numbers are defined
- **Total** = number of resource rows on that section's tab.
- **Planned / In Progress / Ready** = counts of the `status` column.
- **Published** = count of `published = TRUE` (the dropdown keeps this as text "TRUE").
- **% Done** = weighted progress: `planned = 0`, `in_progress = 0.5`, `ready/published = 1`,
  divided by total. ("20% done" = mostly still planned.)
- **% Live** = published ÷ total.

> Column A must hold the **tab names exactly** (Co-Planning, …, R2I Library, Site Assets)
> — `INDIRECT` uses them to find each tab.

## Sort / filter
Select **A2:H9 → Data → Sort range** (e.g. by **% Done**, descending) to see what's
furthest along or furthest behind. Or add a **Filter** for interactive sorting.

## Optional add-ons (say the word and I'll spec them)
- **Bar chart** of % Done per section (Insert → Chart on A1:H9).
- **"By owner"** table — who has the most unfinished resources.
- **"Needs attention"** list — published rows missing a file, or featured cards with no summary.
- **Per-module drill-down** for a chosen section.
