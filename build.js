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
const CACHE_BUST = Date.now();   // unique per build; defeats gviz CSV caching

const SITE_TAB = 'Site', SECTIONS_TAB = 'Sections', MODULES_TAB = 'Modules';
// Resource tabs. The section a row belongs to is the TAB it sits on (resource
// rows carry no `section` column), so we map tab name -> section here.
const RESOURCE_TABS = [
  'Co-Planning', 'Repeated Reading', 'Routine Data Cycles',
  'Leading Implementation', 'Stories & Spotlights', 'Evidence & Impact',
  'R2I Library', 'Site Assets',
];
// Tiers that render as browsable section + module pages (and appear in the nav).
// R2I is the Research-to-Impact Library: it renders as a browsable page (its
// modules are the cross-cutting "Collections") only once its section's
// nav_visible flips off 'hidden-until-live'; until then it shows as soon-chips.
const PAGE_TIERS = ['IGNITE', 'Own', 'Stories', 'Evidence', 'R2I'];
// Of those, the tiers that also get a card on the homepage. Practitioner-first:
// the practice toolkits and Leading Implementation are featured; Stories and
// Evidence are browsable + in nav, but deliberately NOT on the homepage.
const HOMEPAGE_TIERS = ['IGNITE', 'Own'];
// The sheet labels the library differently across tabs; normalize to the
// canonical section_name from the Sections tab.
const SECTION_ALIASES = { 'R2I Library': 'Research-to-Impact Library' };
const canon = s => SECTION_ALIASES[(s || '').trim()] || (s || '').trim();

const warn = [], info = [], tabReport = [], err = [];
// STRICT=1 makes the build fail (exit 1) when there are hard errors. CI runs
// strict so mistakes can't merge; the Netlify/nightly build stays lenient so a
// single bad row never takes the whole site offline.
const STRICT = String(process.env.STRICT || '').trim() === '1';

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

// ---- link/asset normalization ----
// Editors paste a Google Drive "share" link (or any URL) into the sheet. Pull the
// file id out of the common Drive URL shapes so we can build a clean direct link.
function driveId(url) {
  const s = String(url || '');
  const m = s.match(/\/file\/d\/([-\w]{20,})/) || s.match(/[?&]id=([-\w]{20,})/);
  return m ? m[1] : null;
}
// A link to open/download a file. Drive -> the file's view page (lets the user
// preview or download); any other URL passes through; a bare filename is treated
// as a path in the repo's assets/ folder. Blank stays blank.
function fileUrl(url) {
  const s = String(url || '').trim(); if (!s) return '';
  const id = driveId(s); if (id) return `https://drive.google.com/file/d/${id}/view`;
  if (/^https?:\/\//i.test(s)) return s;
  return 'assets/' + s.replace(/^\/+/, '');
}
// An image src. Drive -> a sized thumbnail (renders inline); other URLs/paths as above.
function imageUrl(url) {
  const s = String(url || '').trim(); if (!s) return '';
  const id = driveId(s); if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
  if (/^https?:\/\//i.test(s)) return s;
  return 'assets/' + s.replace(/^\/+/, '');
}
// A video link. Editors sometimes paste Vimeo's full "Embed" snippet (iframe +
// script tag) instead of the page link; pull the video id back out so the inline
// player still works. Vimeo "share" links (vimeo.com/share/<uuid>) carry no
// video id — resolveShareLinks() swaps them for the numeric URL after all tabs load.
function videoUrl(url, where) {
  const s = String(url || '').trim(); if (!s) return '';
  if (s.includes('<')) {
    const m = s.match(/player\.vimeo\.com\/video\/(\d+)(?:[^"'\s]*[?&]h=([0-9a-zA-Z]+))?/);
    if (m) {
      const clean = `https://vimeo.com/${m[1]}${m[2] ? '/' + m[2] : ''}`;
      warn.push(`${where}: cell contains pasted Vimeo embed code, not a link. Rescued it as ${clean} — please put that link in the cell.`);
      return clean;
    }
    warn.push(`${where}: cell contains HTML (looks like pasted embed code) with no recognizable Vimeo link — ignored. Paste the video's page link instead.`);
    return '';
  }
  return fileUrl(s);
}
// Vimeo "share" links (what the Share dialog's Copy link gives you) look like
// vimeo.com/share/<uuid> — no video id, so the inline player can't embed them.
// The share page itself carries the canonical numeric URL (plus the ?h= embed
// hash for unlisted videos); fetch it once per unique link and swap the numeric
// URL in. On any failure the share link stays as-is, which still works — the
// video just opens in a new tab instead of playing inline.
async function resolveShareLinks(holders) {
  const isShare = h => /^https:\/\/vimeo\.com\/share\//i.test(h.obj[h.key] || '');
  const pending = holders.filter(isShare);
  const resolved = {};
  for (const u of [...new Set(pending.map(h => h.obj[h.key].split('?')[0]))]) {
    try {
      const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = res.ok ? await res.text() : '';
      const m = html.match(/player\.vimeo\.com\/video\/(\d+)(?:\?h=([0-9a-zA-Z]+))?/)
             || html.match(/rel="canonical" href="https:\/\/vimeo\.com\/(\d+)/);
      resolved[u] = m ? `https://vimeo.com/${m[1]}${m[2] ? '/' + m[2] : ''}` : null;
    } catch { resolved[u] = null; }
  }
  for (const h of pending) {
    const clean = resolved[h.obj[h.key].split('?')[0]];
    if (clean) {
      info.push(`${h.where}: resolved Vimeo share link -> ${clean} (consider putting that link in the cell).`);
      h.obj[h.key] = clean;
    } else {
      warn.push(`${h.where}: could not resolve the vimeo.com/share/... link to a video id — the video will open in a new tab instead of playing inline. Put the numeric URL (e.g. https://vimeo.com/123456789) in the cell.`);
    }
  }
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
    // _cb is a unique-per-build cache-buster: gviz/Google CDN otherwise serves a
    // stale CSV snapshot for several minutes, so a "publish now" rebuild can read
    // old data. A unique query param forces a fresh export every build.
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}` +
      `/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(name)}&_cb=${CACHE_BUST}`;
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
    about_network: S.about_network,
    // Optional HubSpot capture (soft email ask on gated resources). Blank = a
    // placeholder shows instead of a live form, so nothing breaks before setup.
    hubspot_portal: (S.hubspot_portal_id || '').trim(),
    hubspot_form: (S.hubspot_form_id || '').trim(),
    hubspot_region: (S.hubspot_region || 'na1').trim(),
  };
  ['tagline','hero_headline','hero_subhead','cta','footer','license','about_story','about_ignite','about_practices']
    .forEach(k => { if (!String(site[k] || '').trim()) warn.push(`Site setting blank: "${k}" (page area may render empty).`); });

  // ----- Modules (joined to sections) -----
  const modRows = (await loadTab(MODULES_TAB, 'module_name')).map(m => ({
    section: canon(m.section), order: num(m.module_order),
    name: (m.module_name || '').trim(), intro: m.module_intro || '',
    video: videoUrl(m.module_video, `Modules tab, module "${(m.module_name || '').trim()}" module_video`),
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
      intro: r.landing_intro || '', header_image: imageUrl(r.header_image),
      landing_video: videoUrl(r.landing_video, `Sections tab, "${name}" landing_video`),
      modules: (modulesBySection[name] || []).slice().sort((a, b) => a.order - b.order),
    };
  }).filter(s => s.name);

  // Sections that render as homepage cards + browsable pages:
  // the practice toolkits (tier IGNITE) and Leading Implementation (tier Own),
  // unless explicitly held out of nav.
  const pageSections = allSections
    .filter(s => PAGE_TIERS.includes(s.tier) && s.nav_visible !== 'hidden-until-live')
    .sort((a, b) => a.order - b.order);
  const pageNames = new Set(pageSections.map(s => s.name));

  // ----- Files manifest (optional): id -> published file URL -----
  // Maintained by the Apps Script that indexes the Drive published-files folder,
  // so editors attach a file just by naming it after the id — no URL pasting.
  // See docs/file-hosting.md. The tab is optional; without it, downloads simply
  // don't resolve (and a warning is emitted per published item).
  const filesMap = {};
  try {
    const fileRows = await loadTab('Files', 'id');
    fileRows.forEach(r => {
      const id = (r.id || '').trim();
      if (id) filesMap[id] = { url: fileUrl(r.url), mime: (r.mime || '').trim() };
    });
  } catch (e) { /* Files tab is optional */ }
  // Resolve a resource's link: an explicit link_url wins (external_link); otherwise
  // a 'download' resolves to its file in the manifest by id.
  const linkFor = r => {
    const explicit = fileUrl(r.link_url);
    if (explicit) return explicit;
    const id = (r.id || '').trim();
    if (String(r.link_type || '').trim() === 'download' && filesMap[id]) return filesMap[id].url;
    return '';
  };

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
      const video_url = videoUrl(r.video_url, `${tab} row "${r.id.trim()}" video_url`);
      const rec = {
        id: r.id.trim(), section: sectionName, module: (r.module || '').trim(),
        title: (r.title || '').trim(), format: (r.format || 'Other').trim(),
        focal: TRUE(r.focal), focal_order: num(r.focal_order) || '',
        published: TRUE(r.published), status: (r.status || '').trim(),
        gated: TRUE(r.gated),
        practice: (r.practice || '').trim(),
        summary: r.summary || '', who_for: r.who_for || '',
        isnew: isRecent(r.date_published),
        video: String(r.link_type || '').trim() === 'embed' || !!video_url,
        link: linkFor(r),
        video_url,
        image: imageUrl(r.image),
        // Rich practice content carried over from the CoLab pages (Collections).
        // Optional everywhere else; blank = unchanged card.
        image_caption: (r.image_caption || '').trim(),
        body: r.body || '',
        why: String(r.why_it_works || '').split('||').map(s => s.trim()).filter(Boolean),
        quote: (r.quote || '').trim(),
        overview: TRUE(r.overview),
      };
      if (!pageNames.has(rec.section)) { dropped++; continue; }
      resources.push(rec);
    }
  }
  if (dropped) info.push(`${dropped} resources skipped — their section is not a live nav section yet (e.g. Site Assets, or the Research-to-Impact Library while it is still hidden-until-live). They return automatically when that section's nav_visible = yes.`);

  // ----- data-quality checks (warn, don't fail) -----
  const modIndex = {}; pageSections.forEach(s => { modIndex[s.name] = new Set(s.modules.map(m => m.name)); });
  resources.forEach(r => {
    if (!modIndex[r.section] || !modIndex[r.section].has(r.module))
      warn.push(`Resource "${r.id}" -> module "${r.module}" not found in section "${r.section}" (won't appear on any module page).`);
  });
  resources.filter(r => r.published && r.focal && !String(r.summary).trim())
    .forEach(r => warn.push(`Published focal resource "${r.id}" has no summary (card shows no description).`));

  // Hard errors (fail the build under STRICT): duplicate ids break rendering.
  const seenId = new Set();
  resources.forEach(r => {
    if (seenId.has(r.id)) err.push(`Duplicate resource id "${r.id}" — ids must be unique across the whole site.`);
    else seenId.add(r.id);
  });

  // Soft warnings: invalid enumerations degrade gracefully but signal a typo.
  const FORMATS = new Set(['Document', 'Deck', 'Tool', 'Protocol', 'Template', 'Case Study', 'Infographic', 'Video', 'Other']);
  resources.forEach(r => {
    if (r.format && !FORMATS.has(r.format))
      warn.push(`Resource "${r.id}" has unknown format "${r.format}" (uses a generic icon). Allowed: ${[...FORMATS].join(', ')}.`);
  });
  const TIERS = new Set(['IGNITE', 'Own', 'Stories', 'Evidence', 'R2I', 'Site']);
  allSections.forEach(s => {
    if (s.tier && !TIERS.has(s.tier))
      warn.push(`Section "${s.name}" has unknown tier "${s.tier}" (won't surface anywhere). Allowed: ${[...TIERS].join(', ')}.`);
  });
  resources.filter(r => r.published && r.gated && !r.link)
    .forEach(r => warn.push(`Gated resource "${r.id}" resolves to no file (the email ask leads nowhere).`));
  // Once a Files manifest exists, flag any published item that resolves to nothing.
  if (Object.keys(filesMap).length) {
    resources.filter(r => r.published && !r.video && !r.link)
      .forEach(r => warn.push(`Published resource "${r.id}" resolves to no file — name a file after this id in the published folder, or set a link_url.`));
  }

  // ----- nav metadata (data-driven grouping + dividers) -----
  // Top-level nav stays practitioner-first: only the toolkits (IGNITE) and Leading
  // Implementation (Own). Stories & Spotlights and Evidence & Impact live in an
  // "Evidence & Stories" dropdown; the cross-cutting R2I collections get their own.
  const TOP_NAV_TIERS = ['IGNITE', 'Own'];
  const SECONDARY_NAV_LABEL = 'Evidence & Stories';
  const COLLECTIONS_NAV_LABEL = 'R2I Practices';
  const groups = [];
  pageSections.filter(s => TOP_NAV_TIERS.includes(s.tier)).forEach(s => {
    const g = groups.find(x => x.label === s.header_label);
    if (g) g.sections.push(s.name); else groups.push({ label: s.header_label, sections: [s.name] });
  });
  const libSec = allSections.find(s => s.tier === 'R2I');
  const aboutSec = allSections.find(s => s.tier === 'Site');
  // The Stories section is woven into the toolkit pages: a story tagged with a
  // `practice` surfaces on that practice's page. We pass its name so the template
  // can find those resources without hardcoding the section title.
  const storiesSec = allSections.find(s => s.tier === 'Stories');
  // Two secondary nav dropdowns, kept out of the practitioner-first front row:
  //   • Evidence & Stories — the proof + the people (Stories & Evidence, live now)
  //   • R2I Collections — cross-cutting topics (the R2I Library section's modules);
  //     they show as "soon" chips until that section's nav_visible flips to yes.
  // These labels are presentation only; the contents stay sheet-driven.
  const secondarySections = pageSections
    .filter(s => ['Stories', 'Evidence'].includes(s.tier))
    .sort((a, b) => a.order - b.order)
    .map(s => ({ name: s.name }));
  const collectionItems = libSec
    ? (modulesBySection[canon(libSec.name)] || []).slice().sort((a, b) => a.order - b.order).map(m => m.name)
    : [];
  const nav = {
    groups,
    secondary: secondarySections.length
      ? { name: SECONDARY_NAV_LABEL, sections: secondarySections }
      : null,
    collections: (libSec && collectionItems.length)
      ? { name: COLLECTIONS_NAV_LABEL, section: libSec.name, items: collectionItems, visible: libSec.nav_visible !== 'hidden-until-live' }
      : null,
    about: aboutSec ? { name: aboutSec.name } : { name: 'About' },
  };

  // ----- R2I Practices landing page (the Collections "home", recreated from the
  // old CoLab landing). Prose lives on the Site tab (editable); the five practice
  // cards come from the R2I Library modules; testimonials + journey are read from
  // indexed Site keys (r2i_quote1.., r2i_journey1..). -----
  const seq = (base, suffixes) => {
    const out = [];
    for (let n = 1; n <= 12; n++) {
      const o = {}; let any = false;
      for (const s of suffixes) { const v = (S[base + n + s.key] || '').trim(); o[s.as] = v; if (v) any = true; }
      if (!any) break; out.push(o);
    }
    return out;
  };
  // Each collection's character illustration (committed under assets/practices/),
  // mapped by module name. Update here if a collection is renamed.
  const P_IMG = {
    'Collaboration': 'collaboration', 'Secondary Literacy': 'literacy', 'Data for MTSS': 'mtss',
    'Postsecondary': 'postsecondary', 'Emotional Support': 'emotional',
  };
  const r2iPractices = libSec
    ? (modulesBySection[canon(libSec.name)] || []).slice().sort((a, b) => a.order - b.order)
        .map(m => ({ name: m.name, intro: m.intro, image: P_IMG[m.name] ? imageUrl('practices/' + P_IMG[m.name] + '.png') : '' }))
    : [];
  const quotes = seq('r2i_quote', [{ key: '', as: 'quote' }, { key: '_by', as: 'by' }, { key: '_role', as: 'role' }, { key: '_img', as: 'img' }])
    .map(q => ({ ...q, img: q.img ? imageUrl(q.img) : '' }));
  const partners = seq('r2i_partner', [{ key: '_img', as: 'img' }, { key: '_name', as: 'name' }])
    .map(p => ({ ...p, img: p.img ? imageUrl(p.img) : '' }));
  const r2iHome = (libSec && nav.collections && nav.collections.visible) ? {
    heading: (S.r2i_heading || 'Research to Impact Practices').trim(),
    headline: (S.r2i_headline || '').trim(),
    intro: (S.r2i_intro || '').trim(),
    intro2: (S.r2i_intro2 || '').trim(),
    heroImage: imageUrl((S.r2i_hero_image || '').trim()),
    section: libSec.name,
    practices: r2iPractices,
    quotes,
    journey: seq('r2i_journey', [{ key: '_label', as: 'label' }, { key: '_text', as: 'text' }]),
    map: (S.r2i_map_image || '').trim()
      ? { image: imageUrl(S.r2i_map_image), heading: (S.r2i_map_heading || '').trim(), text: (S.r2i_map_text || '').trim() }
      : null,
    partners: partners.length ? { heading: (S.r2i_partners_heading || 'Our Partners').trim(), logos: partners } : null,
  } : null;

  // ----- resolve Vimeo share links to numeric URLs (before shaping copies the values) -----
  await resolveShareLinks([
    ...resources.map(r => ({ obj: r, key: 'video_url', where: `${r.section} row "${r.id}" video_url` })),
    ...allSections.map(s => ({ obj: s, key: 'landing_video', where: `Sections tab, "${s.name}" landing_video` })),
    ...modRows.map(m => ({ obj: m, key: 'video', where: `Modules tab, module "${m.name}" module_video` })),
  ]);

  // ----- shape exactly what the page render expects -----
  const sections = pageSections.map(s => ({
    name: s.name, intro: s.intro, header_image: s.header_image,
    homepage: HOMEPAGE_TIERS.includes(s.tier), video: s.landing_video,
    modules: s.modules.map(m => ({ name: m.name, order: m.order, intro: m.intro, video: m.video })),
  }));
  const DATA = { site, sections, nav, resources, r2iHome, storiesSection: storiesSec ? storiesSec.name : null };

  // ----- SEO / social metadata (build-time so crawlers and link unfurlers,
  // which don't run our JS, see real title/description/image) -----
  const escHtml = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const domain = (S.domain || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const baseUrl = domain ? `https://${domain}` : '';
  const heroImg = (S.hero_image || '').trim();
  let seoImage = '';
  if (/^https?:\/\//i.test(heroImg)) seoImage = heroImg;
  else if (driveId(heroImg)) seoImage = imageUrl(heroImg);
  else if (heroImg && baseUrl) seoImage = `${baseUrl}/assets/${heroImg.replace(/^\/+/, '')}`;
  const seo = {
    '__SEO_TITLE__': escHtml((S.site_name || site.name || 'Research to Impact').trim()),
    '__SEO_DESC__': escHtml((site.tagline || site.hero_subhead || '').trim()),
    '__SEO_URL__': escHtml(baseUrl),
    '__SEO_IMAGE__': escHtml(seoImage),
    // The site logo (Marshall CoLab mark), served from assets/ as the tab icon.
    '__FAVICON__': 'assets/favicon.png',
  };

  // ----- inject + write -----
  if (!fs.existsSync(TEMPLATE)) throw new Error(`Template not found: ${TEMPLATE}`);
  const tpl = fs.readFileSync(TEMPLATE, 'utf8');
  if (!tpl.includes('__DATA__')) throw new Error('template.html is missing the __DATA__ placeholder.');
  // The data lands inside an inline <script>: escape "<" so no sheet content
  // (e.g. a pasted "</script>" in an embed snippet) can terminate the script
  // block early, and use a function replacement so "$"-sequences in content
  // aren't treated as replace() substitution patterns.
  let html = tpl.replace('__DATA__', () => JSON.stringify(DATA).replace(/</g, '\\u003c'));
  for (const [k, v] of Object.entries(seo)) html = html.split(k).join(v);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);

  // Copy committed static assets (images, etc.) into the publish dir, so links
  // like assets/foo.jpg resolve. Netlify publishes dist/, so assets must land
  // there too. Editors who use Google Drive links don't need this at all.
  const ASSET_DIR = process.env.ASSET_DIR || 'assets';
  if (fs.existsSync(ASSET_DIR)) {
    fs.cpSync(ASSET_DIR, path.join(OUT_DIR, 'assets'), { recursive: true });
    info.push(`Copied ${ASSET_DIR}/ into ${path.join(OUT_DIR, 'assets')}.`);
  }

  // ----- report -----
  const live = resources.filter(r => r.published).length;
  console.log(`\nBuilt ${path.join(OUT_DIR, 'index.html')}  (source: ${SOURCE})`);
  console.log(`  nav sections: ${sections.map(s => s.name).join(', ')}`);
  console.log(`  resources:    ${resources.length} (${live} published)`);
  console.log(`  secondary:    ${nav.secondary ? nav.secondary.name + ' (' + nav.secondary.sections.map(s => s.name).join(', ') + ')' : 'none'}`);
  console.log(`  collections:  ${nav.collections ? nav.collections.name + (nav.collections.visible ? ' [visible]' : ' [' + nav.collections.items.length + ' soon]') : 'none'}`);
  console.log(`\nTabs read:`); tabReport.forEach(m => console.log('  - ' + m));
  if (info.length) { console.log(`\nINFO:`); info.forEach(m => console.log('  - ' + m)); }
  if (warn.length) { console.log(`\nWARNINGS (${warn.length}):`); warn.forEach(m => console.log('  ! ' + m)); }
  else console.log('\nNo warnings.');
  if (err.length) { console.log(`\nERRORS (${err.length}):`); err.forEach(m => console.log('  X ' + m)); }

  if (STRICT && err.length) {
    console.error(`\nSTRICT mode: ${err.length} error(s) — failing build.`);
    process.exit(1);
  }
}

main().catch(e => { console.error('\nBUILD FAILED: ' + e.message); process.exit(1); });
