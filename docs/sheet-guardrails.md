# Sheet guardrails — make it user-proof (setup checklist)

A one-time setup that makes the master sheet safe for the content team. Work straight
down this list. Most of it is dropdowns; the rest is number/date checks, a few
"flag mistakes in red" rules, and locking the one dangerous column.

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
