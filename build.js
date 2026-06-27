#!/usr/bin/env node
'use strict';
/*
 * Research to Impact — site build.
 * Pulls the master Google Sheet, assembles the page data, and writes dist/index.html
 * by injecting that data into template.html (replacing the __DATA__ placeholder).
 *
 * Run remotely (default; fetches the live sheet — requires the sheet shared as
 *   "anyone with the link: Viewer"):
 *     node build.js
 * Run against local CSV fixtures (no network):
 *     SHEET_SOURCE=local node build.js
 *
 * Override the sheet with: SHEET_ID=... node build.js
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- config
const SHEET_ID   = process.env.SHEET_ID   || '1IHC6eaWAtYomqPR08mrl7147-Zo_bq3Dz1pR1orZNxs';
const SOURCE     = process.env.SHEET_SOURCE || 'remote';   // 'remote' | 'local'
const FIXTURE_DIR= process.env.FIXTURE_DIR || 'fixtures';
const TEMPLATE   = process.env.TEMPLATE   || 'template.html';
const OUT_DIR    = process.env.OUT_DIR    || 'dist';

const SITE_TAB = 'Site', SECTIONS_TAB = 'Sections', MODULES_TAB = 'Modules';
// Resource tabs. The section a row belongs to is the TAB it sits on (resource
// rows carry no `section` column), so we map tab name -> section here.
const RESOURCE_TABS = [
  'Co-Planning', 'Repeated Reading', 'Routine Data Cycles',
  'Leading Implementation', 'R2I Library', 'Site Assets',
];
// The sheet labels the library differently across tabs; normalize to the
// canonical section_name from the Sections tab.
const SECTION_ALIASES = { 'R2I Library': 'Research-to-Impact Library' };
const canon = s => SECTION_ALIASES[(s || '').trim()] || (s || '').trim();

const warn = [], info = [], tabReport = [];

// ---------------------------------------------------------------- helpers
const TRUE = v => String(v == null ? '' : v).trim().toUpperCase() === 'TRUE';
const num  = v => { const n = parseInt(String(v == null ? '' : v).trim(), 10); return isNaN(n) ? 0 : n; };
function isRecent(dateStr, days = 30) {
  const s = String(dateStr || '').trim(); if (!s) return false;
  const d = new Date(s); if (isNaN(d)) return false;
  return (Date.now() - d.getTime()) / 86400000 <= days;
}
function group(arr, keyFn) {
  const out = {}; for (const x of arr) { const k = keyFn(x); (out[k] = out[k] || []).push(x); } return out;
}

// Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
// newlines, and "" escapes. Returns an array of row-arrays.
function parseCSV(text) {
  const rows = []; let row = [], field = '', i = 0, inQ = false;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  // flush last field/row (unless trailing newline already pushed an empty row)
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function toObjects(text, expectedKey) {
  const rows = parseCSV(text).filter(r => r.some(c => String(c).trim() !== ''));
  if (!rows.length) return [];
  // Find the header row: the first row that actually contains expectedKey as a cell.
  // This makes us robust to gviz mis-detecting the header (the bug that silently
  // dropped Co-Planning / Repeated Reading / Routine Data Cycles).
  let headerIdx = 0;
  if (expectedKey) {
    const want = expectedKey.trim().toLowerCase();
    const found = rows.findIndex(r => r.some(c => String(c).trim().toLowerCase() === want));
    if (found >= 0) headerIdx = found;
  }
  const headers = rows[headerIdx].map(h => h.trim());
  return rows.slice(headerIdx + 1).map(r => {
    const o = {}; headers.forEach((h, idx) => { o[h] = r[idx] != null ? r[idx] : ''; }); return o;
  });
}

async function loadTab(name, expectedKey) {
  let text;
  if (SOURCE === 'local') {
    const f = path.join(FIXTURE_DIR, name + '.csv');
    if (!fs.existsSync(f)) throw new Error(`Local fixture missing: ${f}`);
    text = fs.readFileSync(f, 'utf8');
  } else {
    // headers=1 pins the first row as the (single) header row instead of letting
    // gviz auto-detect, which it got wrong on the larger tabs.
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}` +
      `/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(name)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Could not fetch tab "${name}" (HTTP ${res.status}). ` +
        `Check the tab name is exact and the sheet is shared "anyone with the link: Viewer".`);
    }
    text = await res.text();
  }
  const objs = toObjects(text, expectedKey);
  // Loud, specific diagnostics so an empty/misread tab can never hide again.
  tabReport.push(`${name}: ${objs.length} rows`);
  if (expectedKey && objs.length && !(expectedKey in objs[0])) {
    warn.push(`Tab "${name}": header row has no "${expectedKey}" column (got: ${Object.keys(objs[0]).slice(0, 6).join(', ')}...). Rows will be dropped.`);
  }
  return objs;
}

// ---------------------------------------------------------------- build
async function main() {
  // ----- Site (key/value) -----
  const siteRows = await loadTab(SITE_TAB, 'setting');
  const S = {}; siteRows.forEach(r => { if ((r.setting || '').trim()) S[r.setting.trim()] = r.value; });
  const site = {
    name: (S.site_name || 'Research to Impact').split('|')[0].trim(),
    tagline: S.tagline, hero_headline: S.hero_headline, hero_subhead: S.hero_subhead,
    cta: S.hero_cta_label, footer: S.footer_attribution, license: S.license_line,
    about_story: S.about_story, about_ignite: S.about_ignite, about_practices: S.about_practices,
  };
  ['tagline','hero_headline','hero_subhead','cta','footer','license','about_story','about_ignite','about_practices']
    .forEach(k => { if (!String(site[k] || '').trim()) warn.push(`Site setting blank: "${k}" (page area may render empty).`); });

  // ----- Modules (joined to sections) -----
  const modRows = (await loadTab(MODULES_TAB, 'module_name')).map(m => ({
    section: canon(m.section), order: num(m.module_order),
    name: (m.module_name || '').trim(), intro: m.module_intro || '',
  })).filter(m => m.name);
  const modulesBySection = group(modRows, m => m.section);

  // ----- Sections -----
  const secRows = await loadTab(SECTIONS_TAB, 'section_name');
  const allSections = secRows.map(r => {
    const name = (r.section_name || '').trim();
    return {
      name, section_id: (r.section_id || '').trim(),
      header_label: (r.header_label || '').trim(), tier: (r.tier || '').trim(),
      order: num(r.order), nav_visible: (r.nav_visible || '').trim(),
      intro: r.landing_intro || '',
      modules: (modulesBySection[name] || []).slice().sort((a, b) => a.order - b.order),
    };
  }).filter(s => s.name);

  // Sections that render as homepage cards + browsable pages:
  // the practice toolkits (tier IGNITE) and Leading Implementation (tier Own),
  // unless explicitly held out of nav.
  const pageSections = allSections
    .filter(s => ['IGNITE', 'Own'].includes(s.tier) && s.nav_visible !== 'hidden-until-live')
    .sort((a, b) => a.order - b.order);
  const pageNames = new Set(pageSections.map(s => s.name));

  // ----- Resources (section injected from the tab) -----
  const resources = []; let dropped = 0;
  for (const tab of RESOURCE_TABS) {
    let rows;
    try { rows = await loadTab(tab, 'id'); }
    catch (e) { warn.push(e.message); continue; }
    if (!rows.length) warn.push(`Resource tab "${tab}" returned 0 rows — check the tab exists and its header row has an "id" column.`);
    const sectionName = canon(tab);
    for (const r of rows) {
      if (!(r.id || '').trim()) continue;
      const rec = {
        id: r.id.trim(), section: sectionName, module: (r.module || '').trim(),
        title: (r.title || '').trim(), format: (r.format || 'Other').trim(),
        focal: TRUE(r.focal), focal_order: num(r.focal_order) || '',
        published: TRUE(r.published), status: (r.status || '').trim(),
        summary: r.summary || '', who_for: r.who_for || '',
        isnew: isRecent(r.date_published),
        video: String(r.link_type || '').trim() === 'embed' || !!(r.video_url || '').trim(),
      };
      if (!pageNames.has(rec.section)) { dropped++; continue; }
      resources.push(rec);
    }
  }
  if (dropped) info.push(`${dropped} resources skipped — their section is not a live nav section yet (e.g. Research-to-Impact Library, Site Assets). They return automatically when that section's nav_visible = yes.`);

  // ----- data-quality checks (warn, don't fail) -----
  const modIndex = {}; pageSections.forEach(s => { modIndex[s.name] = new Set(s.modules.map(m => m.name)); });
  resources.forEach(r => {
    if (!modIndex[r.section] || !modIndex[r.section].has(r.module))
      warn.push(`Resource "${r.id}" -> module "${r.module}" not found in section "${r.section}" (won't appear on any module page).`);
  });
  resources.filter(r => r.published && r.focal && !String(r.summary).trim())
    .forEach(r => warn.push(`Published focal resource "${r.id}" has no summary (card shows no description).`));

  // ----- nav metadata (data-driven grouping + dividers) -----
  const groups = [];
  pageSections.forEach(s => {
    const g = groups.find(x => x.label === s.header_label);
    if (g) g.sections.push(s.name); else groups.push({ label: s.header_label, sections: [s.name] });
  });
  const libSec = allSections.find(s => s.tier === 'R2I');
  const aboutSec = allSections.find(s => s.tier === 'Site');
  const nav = {
    groups,
    library: libSec ? {
      name: libSec.name,
      visible: libSec.nav_visible !== 'hidden-until-live',
      collections: (modulesBySection[canon(libSec.name)] || []).slice().sort((a, b) => a.order - b.order).map(m => m.name),
    } : null,
    about: aboutSec ? { name: aboutSec.name } : { name: 'About' },
  };

  // ----- shape exactly what the page render expects -----
  const sections = pageSections.map(s => ({
    name: s.name, intro: s.intro,
    modules: s.modules.map(m => ({ name: m.name, order: m.order, intro: m.intro })),
  }));
  const DATA = { site, sections, nav, resources };

  // ----- inject + write -----
  if (!fs.existsSync(TEMPLATE)) throw new Error(`Template not found: ${TEMPLATE}`);
  const tpl = fs.readFileSync(TEMPLATE, 'utf8');
  if (!tpl.includes('__DATA__')) throw new Error('template.html is missing the __DATA__ placeholder.');
  const html = tpl.replace('__DATA__', JSON.stringify(DATA));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);

  // ----- report -----
  const live = resources.filter(r => r.published).length;
  console.log(`\nBuilt ${path.join(OUT_DIR, 'index.html')}  (source: ${SOURCE})`);
  console.log(`  nav sections: ${sections.map(s => s.name).join(', ')}`);
  console.log(`  resources:    ${resources.length} (${live} published)`);
  console.log(`  library:      ${nav.library ? nav.library.name + (nav.library.visible ? ' [visible]' : ' [hidden-until-live]') : 'none'}`);
  console.log(`\nTabs read:`); tabReport.forEach(m => console.log('  - ' + m));
  if (info.length) { console.log(`\nINFO:`); info.forEach(m => console.log('  - ' + m)); }
  if (warn.length) { console.log(`\nWARNINGS (${warn.length}):`); warn.forEach(m => console.log('  ! ' + m)); }
  else console.log('\nNo warnings.');
}

main().catch(e => { console.error('\nBUILD FAILED: ' + e.message); process.exit(1); });
