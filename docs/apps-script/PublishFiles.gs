/**
 * Research to Impact — Files manifest builder (Google Apps Script).
 *
 * Indexes the published-files Drive folder (and all its subfolders) and writes a
 * 'Files' tab that maps each resource id -> its public file URL. This lets editors
 * attach a file simply by naming it after the resource id and dropping it in the
 * right section subfolder — no URL pasting. The website build reads the 'Files'
 * tab to wire up every Download button.
 *
 * SETUP (one time):
 *   1. In the Sheet: Extensions -> Apps Script. Paste this whole file. Save.
 *   2. PUBLISHED_FOLDER_ID below is already set to this project's "01 - Published"
 *      folder. (If it ever moves, it's the long string in the folder URL:
 *      https://drive.google.com/drive/folders/<THIS_PART>.) The script walks this
 *      folder AND every subfolder inside it, so point it at the top "01 - Published".
 *   3. Reload the Sheet. A new "R2I" menu appears.
 *   4. Run R2I -> Rebuild Files manifest. Authorize when prompted (it needs Drive
 *      + Sheet access). It writes/updates the 'Files' tab.
 *   5. (Optional) Triggers -> add a daily time-driven trigger on
 *      rebuildFilesManifest so the manifest stays fresh automatically.
 *
 * NAMING RULE: a published file must be named STARTING WITH the resource id, e.g.
 *   cp-2-enabling-conditions-guide-and-self-assessment Enabling Conditions.pdf
 * Files that don't start with a known id are skipped and listed back to you.
 */

var PUBLISHED_FOLDER_ID = '1MdfLG7U1AafL4so8dRh1EIsdyjvjyYdp'; // "01 - Published"

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('R2I')
    .addItem('Rebuild Files manifest', 'rebuildFilesManifest')
    .addItem('Apply guardrails (formatting + dropdowns)', 'applyGuardrails')
    .addToUi();
}

function rebuildFilesManifest() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ids = collectResourceIds_(ss);
  var folder = DriveApp.getFolderById(PUBLISHED_FOLDER_ID);
  var all = listFilesRecursive_(folder, []);
  var rows = [['id', 'url', 'mime', 'filename']];
  var unmatched = [];
  for (var i = 0; i < all.length; i++) {
    var f = all[i];
    var name = f.getName();
    var id = bestIdPrefix_(name, ids);
    if (!id) { unmatched.push(name); continue; }
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    rows.push([id, 'https://drive.google.com/file/d/' + f.getId() + '/view', f.getMimeType(), name]);
  }
  writeSheet_(ss, 'Files', rows);
  var msg = (rows.length - 1) + ' file(s) mapped to ids.';
  if (unmatched.length) msg += '\n\nSkipped (filename did not start with a known id):\n- ' + unmatched.join('\n- ');
  SpreadsheetApp.getUi().alert('Files manifest rebuilt', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

// Walk a folder and every subfolder, collecting all files.
function listFilesRecursive_(folder, out) {
  var files = folder.getFiles();
  while (files.hasNext()) out.push(files.next());
  var subs = folder.getFolders();
  while (subs.hasNext()) listFilesRecursive_(subs.next(), out);
  return out;
}

// The longest resource id that the filename starts with, at a word boundary,
// so cp-2-enabling-... wins and partial matches are rejected.
function bestIdPrefix_(filename, ids) {
  var best = '';
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    if (filename.indexOf(id) === 0 && id.length > best.length) {
      var next = filename.charAt(id.length); // boundary after the id
      if (next === '' || next === ' ' || next === '.') best = id;
    }
  }
  return best;
}

function collectResourceIds_(ss) {
  var skip = { 'Instructions': 1, 'Column Guide': 1, 'Site': 1, 'Sections': 1, 'Modules': 1, 'Files': 1 };
  var ids = [];
  ss.getSheets().forEach(function (sh) {
    if (skip[sh.getName()]) return;
    var values = sh.getDataRange().getValues();
    if (!values.length) return;
    var header = values[0].map(String);
    var idCol = header.indexOf('id');
    if (idCol < 0) return;
    for (var i = 1; i < values.length; i++) {
      var v = String(values[i][idCol] || '').trim();
      if (v) ids.push(v);
    }
  });
  return ids;
}

function writeSheet_(ss, name, rows) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clearContents();
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}
