/**
 * Research to Impact — Sheet guardrails (Google Apps Script).
 *
 * One click applies every dropdown AND all the conditional formatting across the
 * whole workbook, so the master sheet guides the content team instead of just
 * holding their data. Re-runnable any time the sheet changes.
 *
 * It targets columns BY HEADER NAME (row 1), not by position — so it doesn't matter
 * that `gated`/`note` are in a different order on Evidence & Impact / Stories, and the
 * per-tab `module` dropdown always points at that section's own list. Everything it
 * needs lives on the **Lists** tab (import docs/sheet-templates/Lists.csv first).
 *
 * SETUP (one time):
 *   1. Import the Lists tab if you haven't (File → Import → Lists.csv → new sheet "Lists").
 *   2. Extensions → Apps Script. Add this file alongside PublishFiles.gs. Save.
 *   3. Reload the Sheet → the "R2I" menu shows "Apply guardrails (formatting + dropdowns)".
 *   4. Click it. Authorize when prompted. Done — re-run any time.
 *
 * WHAT IT SETS, per resource tab (Co-Planning, Repeated Reading, Routine Data Cycles,
 * Leading Implementation, Stories & Spotlights, Evidence & Impact, R2I Library, Site Assets):
 *   • Dropdowns: format, link_type, status, audience, priority (from Lists), module
 *     (from that tab's Lists column), focal/published/gated (TRUE/FALSE), focal_order (1–4),
 *     date_published (valid date), and practice (Stories only).
 *   • Booleans forced to PLAIN TEXT so "TRUE" can't silently coerce (the old "Coming soon" bug).
 *   • Conditional formatting: TRUE→green / FALSE→gray; status traffic light; over-limit
 *     fields red; required-but-empty cells amber (only on started rows); a featured card
 *     with no summary; a published/gated row with no link; duplicate ids.
 *   • Header legend colors: required = dark, recommended = blue, optional = light,
 *     auto/leave-blank = gray; those auto columns get a soft gray fill too.
 * On the Sections and Modules tabs it sets the tier / nav_visible / section dropdowns.
 *
 * NOTE: this REPLACES the conditional-formatting rules on each tab it touches (the script
 * is the source of truth). It does not delete data or columns.
 *
 * Tweak the palette in G_COLORS below; tweak which columns count as required/recommended/
 * auto in the lists under it.
 */

// ---- Palette (edit here) ----
var G_COLORS = {
  trueBg: '#d9ead3', falseBg: '#f3f3f3',          // booleans
  ready: '#d9ead3', inProgress: '#fff2cc', planned: '#efefef', // status traffic light
  errorBg: '#f4cccc', warnBg: '#fce5cd',          // hard error vs. soft nudge
  reqHeader: '#1c4587', recHeader: '#3d85c6', autoHeader: '#999999', optHeader: '#cfe2f3',
  autoCol: '#f6f6f6'                              // soft gray for leave-blank columns
};

// Header name -> a fixed Lists column letter. Applied on ANY tab that has the header.
var G_LIST_BY_NAME = {
  format: 'A', link_type: 'B', status: 'C', audience: 'D', priority: 'E',
  tier: 'F', nav_visible: 'G', section: 'H', practice: 'I'
};
// Resource tab name -> its module list column on the Lists tab.
var G_MODULE_LIST_COL = {
  'Co-Planning': 'K', 'Repeated Reading': 'L', 'Routine Data Cycles': 'M',
  'Leading Implementation': 'N', 'Stories & Spotlights': 'O', 'Evidence & Impact': 'P',
  'R2I Library': 'Q', 'Site Assets': 'R'
};
var G_BOOL_COLS = ['focal', 'published', 'gated'];
var G_REQUIRED = ['id', 'module', 'title', 'format', 'status'];
var G_RECOMMENDED = ['summary', 'who_for', 'audience', 'priority', 'link_type', 'link_url'];
var G_AUTO_COLS = ['focal_order', 'r2i_attribution', 'source_file'];
var G_LIMITS = { title: 60, summary: 200, who_for: 120 };
var G_SKIP_TABS = { 'Instructions': 1, 'Column Guide': 1, 'Files': 1, 'Lists': 1, 'Dashboard': 1, 'Site': 1 };

function applyGuardrails() {
  var report = applyGuardrails_();
  if (report === null) return; // already alerted (no Lists tab)
  var ui = SpreadsheetApp.getUi();
  ui.alert('Guardrails applied', report, ui.ButtonSet.OK);
}

// Core: applies every dropdown + all conditional formatting and returns a summary
// string (no dialog). Returns null if it can't run (e.g. no Lists tab) after alerting.
function applyGuardrails_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var lists = ss.getSheetByName('Lists');
  if (!lists) {
    ui.alert('No "Lists" tab found', 'Import docs/sheet-templates/Lists.csv as a tab named "Lists", then run this again.', ui.ButtonSet.OK);
    return null;
  }
  var report = [];
  ss.getSheets().forEach(function (sh) {
    var name = sh.getName();
    if (G_SKIP_TABS[name]) return;
    var lastCol = sh.getLastColumn();
    if (lastCol < 1) return;
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
    var idx = {};
    headers.forEach(function (h, i) { if (h) idx[h] = i; });

    var drops = applyListDropdowns_(sh, idx, lists);
    var isResource = (idx['id'] !== undefined && idx['title'] !== undefined && idx['status'] !== undefined);
    if (isResource) {
      drops += applyModuleDropdown_(sh, idx, lists, name, report);
      applyTypedValidation_(sh, idx);
      styleHeader_(sh, headers);
      grayAutoCols_(sh, idx);
      applyConditionalFormatting_(sh, idx);
    }
    report.push((isResource ? '✓ ' : '· ') + name + ': ' + drops + ' dropdown column(s)' + (isResource ? ' + formatting' : ''));
  });
  return report.join('\n');
}

// ---- column-letter helpers ----
function colNum_(letter) {
  var s = 0; letter = letter.toUpperCase();
  for (var i = 0; i < letter.length; i++) s = s * 26 + (letter.charCodeAt(i) - 64);
  return s;
}
function colLetter_(n) { // n is 1-based
  var s = '';
  while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// ---- data validation ----
function listRule_(lists, colLetter) {
  var c = colNum_(colLetter);
  var range = lists.getRange(2, c, lists.getMaxRows() - 1, 1);
  return SpreadsheetApp.newDataValidation()
    .requireValueInRange(range, true)
    .setAllowInvalid(false)
    .build();
}

function applyListDropdowns_(sh, idx, lists) {
  var n = 0, max = sh.getMaxRows();
  for (var name in G_LIST_BY_NAME) {
    if (idx[name] === undefined) continue;
    sh.getRange(2, idx[name] + 1, max - 1, 1).setDataValidation(listRule_(lists, G_LIST_BY_NAME[name]));
    n++;
  }
  return n;
}

function applyModuleDropdown_(sh, idx, lists, tabName, report) {
  if (idx['module'] === undefined) return 0;
  var letter = G_MODULE_LIST_COL[tabName];
  if (!letter) { report.push('    (note: "' + tabName + '" has no module list — module dropdown skipped)'); return 0; }
  sh.getRange(2, idx['module'] + 1, sh.getMaxRows() - 1, 1).setDataValidation(listRule_(lists, letter));
  return 1;
}

function applyTypedValidation_(sh, idx) {
  var max = sh.getMaxRows();
  // booleans as plain-text TRUE/FALSE (plain text guards against the gviz coercion bug)
  G_BOOL_COLS.forEach(function (name) {
    if (idx[name] === undefined) return;
    var rng = sh.getRange(2, idx[name] + 1, max - 1, 1);
    rng.setNumberFormat('@');
    rng.setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(['TRUE', 'FALSE'], true).setAllowInvalid(false).build());
  });
  // focal_order 1–4
  if (idx['focal_order'] !== undefined) {
    sh.getRange(2, idx['focal_order'] + 1, max - 1, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['1', '2', '3', '4'], true).setAllowInvalid(false).build());
  }
  // date_published must be a valid date (warn, don't block)
  if (idx['date_published'] !== undefined) {
    sh.getRange(2, idx['date_published'] + 1, max - 1, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build());
  }
}

// ---- formatting ----
function styleHeader_(sh, headers) {
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  for (var i = 0; i < headers.length; i++) {
    var name = headers[i], cell = sh.getRange(1, i + 1);
    if (G_REQUIRED.indexOf(name) >= 0) cell.setBackground(G_COLORS.reqHeader).setFontColor('#ffffff');
    else if (G_RECOMMENDED.indexOf(name) >= 0) cell.setBackground(G_COLORS.recHeader).setFontColor('#ffffff');
    else if (G_AUTO_COLS.indexOf(name) >= 0) cell.setBackground(G_COLORS.autoHeader).setFontColor('#ffffff');
    else cell.setBackground(G_COLORS.optHeader).setFontColor('#000000');
  }
}

function grayAutoCols_(sh, idx) {
  var max = sh.getMaxRows();
  G_AUTO_COLS.forEach(function (name) {
    if (idx[name] === undefined) return;
    sh.getRange(2, idx[name] + 1, max - 1, 1).setBackground(G_COLORS.autoCol);
  });
}

function applyConditionalFormatting_(sh, idx) {
  var rules = [], max = sh.getMaxRows();
  function rng(name) { return sh.getRange(2, idx[name] + 1, max - 1, 1); }
  function L(name) { return colLetter_(idx[name] + 1); }
  function has(name) { return idx[name] !== undefined; }

  // booleans: TRUE green, FALSE gray
  G_BOOL_COLS.forEach(function (name) {
    if (!has(name)) return;
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('TRUE').setBackground(G_COLORS.trueBg).setRanges([rng(name)]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('FALSE').setBackground(G_COLORS.falseBg).setRanges([rng(name)]).build());
  });

  // status traffic light
  if (has('status')) {
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('ready').setBackground(G_COLORS.ready).setRanges([rng('status')]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('in_progress').setBackground(G_COLORS.inProgress).setRanges([rng('status')]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('planned').setBackground(G_COLORS.planned).setRanges([rng('status')]).build());
  }

  // over character limit -> red
  for (var name in G_LIMITS) {
    if (!has(name)) continue;
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=LEN($' + L(name) + '2)>' + G_LIMITS[name])
      .setBackground(G_COLORS.errorBg).setRanges([rng(name)]).build());
  }

  // required-but-empty on started rows -> amber (id uses title as the "started" signal; others use id)
  G_REQUIRED.forEach(function (name) {
    if (!has(name)) return;
    var started = (name === 'id') ? (has('title') ? '$' + L('title') + '2<>""' : 'FALSE')
                                  : (has('id') ? '$' + L('id') + '2<>""' : 'FALSE');
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(' + started + ',$' + L(name) + '2="")')
      .setBackground(G_COLORS.warnBg).setRanges([rng(name)]).build());
  });

  // featured card with no summary -> amber
  if (has('focal') && has('summary')) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($' + L('focal') + '2="TRUE",$' + L('summary') + '2="")')
      .setBackground(G_COLORS.warnBg).setRanges([rng('summary')]).build());
  }

  // published/gated but no external link -> amber on link_url (download files come from the Files manifest, can't check here)
  if (has('link_url') && has('link_type')) {
    var pub = has('published') ? '$' + L('published') + '2="TRUE"' : 'FALSE';
    var gat = has('gated') ? '$' + L('gated') + '2="TRUE"' : 'FALSE';
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND(OR(' + pub + ',' + gat + '),$' + L('link_type') + '2<>"download",$' + L('link_url') + '2="")')
      .setBackground(G_COLORS.warnBg).setRanges([rng('link_url')]).build());
  }

  // duplicate id -> red
  if (has('id')) {
    var idL = L('id');
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($' + idL + '2<>"",COUNTIF($' + idL + '$2:$' + idL + ',$' + idL + '2)>1)')
      .setBackground(G_COLORS.errorBg).setRanges([rng('id')]).build());
  }

  sh.setConditionalFormatRules(rules);
}
