# Sheet guardrails — make it user-proof

A one-time setup that makes the master sheet safe for the content team: dropdowns,
number/date checks, "flag mistakes in red/green" formatting, and locking the one
dangerous column.

**Two ways to do it.** The script does everything in one click and is re-runnable; the
manual checklist below is the same rules done by hand if you ever want to tweak one.

---

## Option 1 (recommended): one-click script

The repo ships an Apps Script (`docs/apps-script/Guardrails.gs`) that applies **every**
dropdown and **all** the conditional formatting across the whole workbook at once —
green TRUEs, the status traffic light, amber "fill this in" nudges, red over-limit and
duplicate-id flags, the header color legend, and the per-tab `module` dropdown. It reads
its values from the **Lists** tab and targets columns **by header name**, so the
`gated`/`note` column-order difference on Evidence & Impact / Stories doesn't trip it up.

**Setup:**
1. Import the Lists tab if you haven't: **File → Import → Upload `docs/sheet-templates/Lists.csv` → Insert new sheet**, then rename the tab **`Lists`**.
2. **Extensions → Apps Script.** Add a file and paste in `Guardrails.gs` (keep `PublishFiles.gs` too). **Save.**
3. Reload the Sheet. The **R2I** menu now has **"Apply guardrails (formatting + dropdowns)."**
4. Click it, authorize once, done. Re-run any time you add tabs, modules, or rows.

It **replaces** the conditional-formatting rules on each tab it touches (the script is
the source of truth) and never deletes data. Tweak the colors in `G_COLORS` at the top of
the file, or which columns count as required/recommended/auto in the lists under it.

Still do **A5 (lock `published`)** by hand — protected ranges aren't set by the script.

### Letting the content team re-run it themselves

The script is bound to the spreadsheet, so the **R2I → Apply guardrails** menu shows up
for anyone working in the sheet — no Apps Script editor needed. To set them up once:

1. **Give them Editor access** to the spreadsheet (Share → Editor). Viewers and
   Commenters don't get the menu and can't run it.
2. Have each person **reload the sheet** so the `R2I` menu appears (it's added when the
   sheet opens).
3. The **first** time *each* editor runs it, Google shows an authorization prompt —
   this is per-person, one-time. They click **Advanced → "Go to R2I … (unsafe)" →
   Allow.** The "unsafe" wording is normal for an in-house script; it only asks for
   access to this sheet and its Drive files. After that first approval it's one click,
   every time.

That's the whole setup. Tell Stephanie and Kelly: *after you add or edit rows, click
**R2I → Apply guardrails** to refresh the dropdowns and colors.* It's safe to run as
often as they like — it never touches their data, only the validation and formatting.

> If you'd rather not have editors see the authorization prompt at all, the alternative
> is publishing the script as an internal Workspace add-on — more setup than it's worth
> for a two-person team. The shared-menu approach above is the simple path.

---

## Option 2: manual checklist

Work straight down this list. Most of it is dropdowns; the rest is number/date checks, a
few "flag mistakes in red" rules, and locking the one dangerous column.

## How to add a dropdown (the move you'll repeat)
1. Select the column range (e.g. click the column letter, or type the range).
2. **Data → Data validation → + Add rule.**
3. **Criteria → Dropdown.** Type the allowed values (one chip each).
4. *(Optional, for the green/colored pills)* **Advanced options → Display style → Chip.**
5. **Done.** Repeat per tab.

> Ranges below use `2:1000` so they cover current **and** future rows (row 1 is the
> header — don't include it). Column letters assume the standard resource-tab layout.

---

## A. Resource tabs (Co-Planning, Repeated Reading, Routine Data Cycles, Leading Implementation, Stories & Spotlights, Evidence & Impact, R2I Library, Site Assets)

Apply these on **every** resource tab. Column letters: A id · B module · C title ·
D format · E priority · F focal · G focal_order · H status · I published · J summary ·
K who_for · L audience · M link_type · … · Z gated · (AA practice — Stories tab only).

### A1. Dropdowns
| Range | Column | Values |
| --- | --- | --- |
| `D2:D1000` | format | `Document, Deck, Tool, Protocol, Template, Case Study, Infographic, Video, Other` |
| `M2:M1000` | link_type | `download, external_link, embed` |
| `H2:H1000` | status | `planned, in_progress, ready` |
| `F2:F1000` | focal | `TRUE, FALSE` |
| `I2:I1000` | published | `TRUE, FALSE` |
| `Z2:Z1000` | gated | `TRUE, FALSE` |
| `L2:L1000` | audience | `Teacher, School Leader, Network Leader, All` |
| `E2:E1000` | priority | `Must Have, Should Have, Nice to Have, Nonessential` |
| `AA2:AA1000` *(Stories tab only)* | practice | `Co-Planning, Repeated Reading, Routine Data Cycles` |

### A2. The module dropdown (per tab — highest value)
The `module` column (**`B2:B1000`**) should list only **that tab's** modules. Use these
values per tab:

- **Co-Planning:** Overview, Enabling Conditions, Getting Started, Detailed Practice in Action, Measurement & Progress Monitoring, Common Pitfalls & Barriers, Learning More
- **Repeated Reading:** Overview, Infrastructure & Enabling Conditions, Getting Started, Detailed Practice in Action, Measurement & Progress Monitoring, Common Pitfalls & Barriers, Learning More
- **Routine Data Cycles:** Overview, Infrastructure & Enabling Conditions, Getting Started, Detailed Practice in Action, Measurement & Progress Monitoring, Common Pitfalls & Barriers, Learning More
- **Leading Implementation:** Core Content, Coaching & Team Tools, Field Resources, Stories
- **Stories & Spotlights:** Partner Spotlights, School Case Studies, From the Field
- **Evidence & Impact:** White Papers, External Evaluation, Annual Reports, Equity-Gap Roadmap
- **R2I Library:** Collaboration, Data for MTSS, Emotional Support, Postsecondary, Secondary Literacy
- **Site Assets:** Home & Impact

### A3. Number / date checks
| Range | Column | Data validation criteria |
| --- | --- | --- |
| `G2:G1000` | focal_order | *Greater than or equal to 1* **and** add a 2nd rule *Less than or equal to 4* (or a dropdown `1, 2, 3, 4`) |
| `S2:S1000` | date_published | *Is valid date* |

### A4. Flag mistakes in red (Format → Conditional formatting → Custom formula)
| Range | Custom formula | Catches |
| --- | --- | --- |
| `C2:C1000` (title) | `=LEN(C2)>60` | title too long |
| `J2:J1000` (summary) | `=LEN(J2)>200` | summary too long |
| `K2:K1000` (who_for) | `=LEN(K2)>120` | who_for too long |
| `J2:J1000` (summary) | `=AND($F2="TRUE",$J2="")` | featured card with no description |
| `A2:A1000` (id) | `=AND(A2<>"",COUNTIF($A$2:$A,A2)>1)` | duplicate id |

(Set the format to a red fill for each.)

### A5. Lock the dangerous column
**Data → Protect sheets and ranges → Range `I2:I1000` (published) → Set permissions →
Restrict who can edit → only you + Stephanie.** Now content folks literally can't flip
something live; an approver does. (Optional: do the same for `date_published`.)

---

## B. Sections tab
Columns: A section_id · B section_name · C header_label · D tier · E order · F nav_visible …
| Range | Column | Values |
| --- | --- | --- |
| `D2:D1000` | tier | `IGNITE, Own, Stories, Evidence, R2I, Site` |
| `F2:F1000` | nav_visible | `yes, hidden-until-live` |

## C. Modules tab
Columns: A section · B module_order · C module_name …
| Range | Column | Guardrail |
| --- | --- | --- |
| `A2:A1000` | section | Dropdown: `Co-Planning, Repeated Reading, Routine Data Cycles, Leading Implementation, Stories & Spotlights, Evidence & Impact, R2I Library, Site Assets` |
| `B2:B1000` | module_order | Number: *Greater than 0* |

---

## Suggested order (highest value first)
1. **`module` dropdown** on every tab (A2) — kills the #1 silent failure.
2. **`published` / `focal` / `gated`** TRUE/FALSE dropdowns (A1) — kills the type bug.
3. **Protect `published`** (A5) — enforces approver-only publishing.
4. **`format`, `link_type`, `status`** dropdowns (A1) — consistency where it matters.
5. **Conditional formatting** (A4) — your safety net for summaries + duplicate ids.
6. Everything else when you have time.

## Leave free (no guardrail needed)
title (beyond the length flag), summary, who_for, link_url, video_url, image,
extra_files, license, r2i_attribution, owner, source_file, tags, related, note.
(Tags are open-ended keywords and unused at launch — skip a dropdown there.)

## Tip: set it up once, copy it everywhere
Set all the rules on **one** resource tab first, then select those columns, **Copy**,
select the same columns on the next tab, and **Edit → Paste special → Paste data
validation only**. That clones every dropdown/rule in one shot (you'll still set the
per-tab `module` list and conditional formatting per tab).
