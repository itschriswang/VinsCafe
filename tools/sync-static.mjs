/* Developer tool. NOT part of the deployed site and NOT owner-editable.
 *
 *     node tools/sync-static.mjs [--check]
 *
 * Rewrites the blocks in the HTML that are derived from config.js and
 * menu.json: the JSON-LD, the hours tables, the hours line in the footer, and
 * the board itself. app.js regenerates all of the same things at runtime from
 * the same two files, so a visitor with JavaScript always sees current data;
 * this exists so that a visitor without it, and a crawler that does not run
 * scripts, sees the same thing rather than something stale.
 *
 * --check exits non-zero if anything is out of date, for CI or a pre-commit
 * hook. The site itself still has no build step: nothing here runs on deploy.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

/* config.js is a classic script declaring `const CAFE`; evaluate it for the object. */
const CAFE = new Function(read('config.js') + '\nreturn CAFE;')();
const MENU = JSON.parse(read('menu.json'));

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_SCHEMA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/* Starts on the first day we are actually open, so the open days lead and the
   shut ones collapse behind them. Mirrors weekOrder() in app.js. */
const WEEK_ORDER = (() => {
  let start = 1;
  for (let i = 0; i < 7; i++) { const d = (1 + i) % 7; if (CAFE.hours[d]) { start = d; break; } }
  return Array.from({ length: 7 }, (_, j) => (start + j) % 7);
})();
const pad = (n) => String(n).padStart(2, '0');

/* ---- these four mirror app.js exactly; the Playwright run asserts they agree -- */

function hourRuns() {
  const runs = [];
  for (const d of WEEK_ORDER) {
    const h = CAFE.hours[d] || null;
    const last = runs[runs.length - 1];
    const same = last && ((!last.hours && !h) ||
      (last.hours && h && last.hours[0] === h[0] && last.hours[1] === h[1]));
    if (same) last.days.push(d);
    else runs.push({ hours: h, days: [d] });
  }
  return runs.map((r) => ({
    ...r,
    label: r.days.length > 1
      ? `${DAY_SHORT[r.days[0]]}–${DAY_SHORT[r.days[r.days.length - 1]]}`
      : DAY_SHORT[r.days[0]],
    value: r.hours ? `${pad(r.hours[0])} – ${pad(r.hours[1])}` : 'Closed'
  }));
}

function hoursRows(indent) {
  return hourRuns().map((r) => `${indent}<dt>${r.label}</dt><dd>${r.value}</dd>`).join('\n');
}

function hoursSummary() {
  return hourRuns()
    .filter((r) => r.hours)
    .map((r) => `${r.label} ${pad(r.hours[0])}–${pad(r.hours[1])}`)
    .join(' · ');
}

function schemaHours() {
  return hourRuns().filter((r) => r.hours).map((r) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: r.days.map((d) => DAY_SCHEMA[d]),
    opens: `${pad(r.hours[0])}:00`,
    closes: `${pad(r.hours[1])}:00`
  }));
}

/* ---- the board, byte-identical to what app.js would render ------------------ */

const SPOTS = {
  'spot-cup':       { w: 330, h: 177, sizes: '(max-width:719px) 240px, (max-width:1179px) 260px, 330px',
    alt: 'Watercolour of a green and lilac cup, half full, a small red mark on its side.' },
  'spot-espresso':  { w: 200, h: 194, sizes: '(max-width:719px) 150px, (max-width:1179px) 160px, 200px',
    alt: 'Watercolour of a green espresso cup with a lilac shadow pooling under it.' },
  'spot-teapot':    { w: 270, h: 300, sizes: '(max-width:719px) 200px, (max-width:1179px) 215px, 270px',
    alt: 'Watercolour of a squat green teapot with a lilac handle, on a pale wash.' },
  'spot-beans':     { w: 200, h: 228, sizes: '(max-width:719px) 170px, (max-width:1179px) 160px, 200px',
    alt: 'Watercolour of a paper bag of coffee, the dark green showing through the sides.' },
  'spot-croissant': { w: 320, h: 320, sizes: '(max-width:719px) 250px, (max-width:1179px) 255px, 320px',
    alt: 'Watercolour of a croissant in olive and grey, one flake of it catching red.' },
  'spot-toast':     { w: 220, h: 252, sizes: '(max-width:719px) 170px, (max-width:1179px) 175px, 220px',
    alt: 'Watercolour of two thick slices of toast stacked, a red drop of jam below them.' },
  'spot-cake':      { w: 300, h: 342, sizes: '(max-width:719px) 230px, (max-width:1179px) 240px, 300px',
    alt: 'Watercolour of a slice of layer cake on a grey plate, a red cherry on top.' },
  'spot-coldbrew':  { w: 220, h: 251, sizes: '(max-width:719px) 190px, (max-width:1179px) 175px, 220px',
    alt: 'Watercolour of a tumbler of iced coffee, the ice drawn as gaps left in the wash.' },
  'spot-matcha':    { w: 280, h: 319, sizes: '(max-width:719px) 210px, (max-width:1179px) 225px, 280px',
    alt: 'Watercolour of a matcha bowl and a bamboo whisk, the green settling in the base.' },
  'spot-flatwhite': { w: 380, h: 380, sizes: '(max-width:719px) 280px, (max-width:1179px) 300px, 380px',
    alt: 'Watercolour of a flat white seen from above, the crema drawn as one olive ring.' }
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function spotHTML(id) {
  const s = SPOTS[id];
  if (!s) return '';
  return `<img class="spot spot--${id.replace('spot-', '')}"` +
    ` width="${s.w}" height="${s.h}" alt="${esc(s.alt)}" loading="lazy" decoding="async"` +
    ` sizes="${s.sizes}"` +
    ` srcset="art/${id}-${s.w}w.avif ${s.w}w, art/${id}-${s.w * 2}w.avif ${s.w * 2}w"` +
    ` src="art/${id}-${s.w * 2}w.webp">`;
}

/* --i is the section's place in menu.json. The phone board is one column and
   needs the file's reading order, but the desktop board splits the sections
   across two columns, so DOM order is not reading order. This used to be a
   hardcoded list of slugs in the stylesheet; rename a section or add one and
   it silently jumped to the top of the phone board with order:0. The flip
   class alternates the head alignment the same way, from the same number. */
function sectionHTML(sec, i) {
  let h = `<section class="sec${i % 2 ? ' sec--flip' : ''}" data-sec="${slug(sec.section)}"` +
    ` style="--i:${i}">`;
  for (const id of sec.spots || []) h += spotHTML(id);
  h += `<div class="sec-head"><h2 class="sec-name">${esc(sec.section)}</h2>`;
  if (sec.note) h += `<p class="sec-note">${esc(sec.note)}</p>`;
  h += '</div><ul class="items">';
  for (const it of sec.items || []) {
    h += `<li class="item"><span class="item-name">${esc(it.name)}</span>` +
      '<span class="item-lead" aria-hidden="true"></span>' +
      `<span class="item-price">${esc(it.price)}</span></li>`;
  }
  h += '</ul>';
  if (sec.standfirst) h += `<p class="standfirst">${esc(sec.standfirst)}</p>`;
  return h + '</section>';
}

/* The home page shows the two sections that have a standfirst (the owner's
   own signal for which part of the board matters), four items each. */
const PREVIEW_SECTIONS = 2;
const PREVIEW_ITEMS = 4;

function previewPick(data) {
  const picked = data.filter((s) => s.standfirst);
  for (const s of data) {
    if (picked.length >= PREVIEW_SECTIONS) break;
    if (!picked.includes(s)) picked.push(s);
  }
  return picked.slice(0, PREVIEW_SECTIONS);
}

const previewSlice = (data) => previewPick(data).map((sec) => ({
  section: sec.section,
  note: sec.note,
  /* One spot per column, not the section's whole set: the preview columns are
     narrower than the board's and a second spot would land on the type. */
  spot: (sec.spots || [])[0] || null,
  items: (sec.items || []).slice(0, PREVIEW_ITEMS),
  of: (sec.items || []).length
}));

/* What the preview is NOT showing. Without this the four items under each
   heading read as the entire menu, which is the one thing a cafe site must
   never get wrong. Both numbers come from menu.json, so they cannot drift. */
function previewRest(data) {
  const shown = previewPick(data);
  return {
    others: data.filter((s) => !shown.includes(s)).map((s) => s.section),
    total: data.reduce((n, s) => n + (s.items || []).length, 0)
  };
}

function previewSectionHTML(sec, i) {
  let h = `<section class="sec${i % 2 ? ' sec--flip' : ''}" data-sec="${slug(sec.section)}"` +
    ` style="--i:${i}">`;
  if (sec.spot) h += spotHTML(sec.spot);
  h += `<div class="sec-head"><h3 class="sec-name">${esc(sec.section)}</h3>`;
  if (sec.note) h += `<p class="sec-note">${esc(sec.note)}</p>`;
  h += '</div><ul class="items">';
  for (const it of sec.items || []) {
    h += `<li class="item"><span class="item-name">${esc(it.name)}</span>` +
      '<span class="item-lead" aria-hidden="true"></span>' +
      `<span class="item-price">${esc(it.price)}</span></li>`;
  }
  h += '</ul>';
  if (sec.of > sec.items.length) h += `<p class="sec-more">and ${sec.of - sec.items.length} more</p>`;
  return h + '</section>';
}

function previewHTML() {
  const slice = previewSlice(MENU);
  const rest = previewRest(MENU);
  const sig = signature(JSON.stringify([slice, rest]));
  return [
    `    <div class="preview-cols" data-preview-sig="${sig}">`,
    ...slice.map((s, i) => '      ' + previewSectionHTML(s, i)),
    '    </div>',
    '    <div class="preview-tail">',
    `      <p class="preview-rest">Also on the menu: ${rest.others.map(esc).join(', ')}.</p>`,
    '      <a class="hero-onward preview-more" href="menu.html#menu">',
    `        The whole menu, ${rest.total} things`,
    '        <span class="mark mark--onward" aria-hidden="true"></span>',
    '      </a>',
    '    </div>'
  ].join('\n');
}

function signature(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/* Alternating, not a named list: sections go left, right, left, right down
   menu.json. Any set of sections lands somewhere sensible and stays balanced. */
const columns = (data) => [
  data.map((s, i) => [s, i]).filter(([, i]) => i % 2 === 0),
  data.map((s, i) => [s, i]).filter(([, i]) => i % 2 === 1)
];

function boardHTML() {
  const [left, right] = columns(MENU);
  const sig = signature(JSON.stringify(MENU));
  return [
    `    <div class="board" data-menu-sig="${sig}">`,
    '      <div class="board-col">',
    ...left.map(([s, i]) => '        ' + sectionHTML(s, i)),
    '      </div>',
    '      <div class="board-col">',
    ...right.map(([s, i]) => '        ' + sectionHTML(s, i)),
    '      </div>',
    '    </div>'
  ].join('\n');
}

/* ---- page-level JSON-LD ----------------------------------------------------- */

/* Every absolute URL on the site is built here from CAFE.url, so the domain is
   written down exactly once. It was written down 22 times across three heads,
   sitemap.xml and robots.txt, and renaming the repository silently pointed all
   of them at a 404: canonicals, social cards and the search-engine data. */
const SITE = CAFE.url.replace(/\/*$/, '/');
const OG = { 'index.html': 'og-home', 'menu.html': 'og-menu', 'find-us.html': 'og-find-us' };
const pageUrl = (page) => SITE + (page === 'index.html' ? '' : page);

function siteUrls(src, page) {
  let out = src
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${pageUrl(page)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${pageUrl(page)}$2`)
    /* 404.html carries a <base> so its assets survive being served at any
       depth; it has to follow the site everywhere the canonicals do. */
    .replace(/(<base href=")[^"]*(")/, `$1${SITE}$2`);
  if (OG[page]) {
    out = out.replace(/(<meta property="og:image" content=")[^"]*(")/,
      `$1${SITE}art/${OG[page]}.jpg$2`);
  }
  return out;
}

/* The two steps of each inner page's trail, mirrored as BreadcrumbList so a
   result page can show Home › The menu instead of a bare URL. */
const CRUMB = { 'menu.html': 'The menu', 'find-us.html': 'Find us' };

function breadcrumbLd(page) {
  return '<script type="application/ld+json">\n' + JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: CRUMB[page], item: pageUrl(page) }
    ]
  }, null, 2) + '\n</' + 'script>';
}

function jsonLd(existing, page) {
  const data = JSON.parse(existing);
  data['@id'] = SITE + '#cafe';
  data.url = pageUrl(page);
  data.hasMenu = SITE + 'menu.html';
  if (OG[page]) data.image = SITE + `art/${OG[page]}.jpg`;
  data.name = CAFE.name;
  data.telephone = CAFE.telephone;
  data.email = CAFE.email;
  data.address = {
    '@type': 'PostalAddress',
    streetAddress: CAFE.address.street,
    addressLocality: CAFE.address.locality,
    postalCode: CAFE.address.postcode,
    addressCountry: CAFE.address.country
  };
  data.geo = { '@type': 'GeoCoordinates', latitude: CAFE.geo.lat, longitude: CAFE.geo.lon };
  data.openingHoursSpecification = schemaHours();
  return '<script type="application/ld+json" data-generated>\n' +
    JSON.stringify(data, null, 2) + '\n</' + 'script>';
}

/* ---- rewrite ---------------------------------------------------------------- */

function region(src, name, make) {
  const re = new RegExp(`(<!--gen:${name}-->)([\\s\\S]*?)(<!--/gen-->)`, 'g');
  return src.replace(re, (_m, open, body, close) => open + make(body) + close);
}

const PAGES = ['index.html', 'menu.html', 'find-us.html', '404.html'];
const check = process.argv.includes('--check');
let stale = 0;

for (const page of PAGES) {
  const before = read(page);
  let after = before;

  after = siteUrls(after, page);

  after = region(after, 'jsonld', (body) => {
    const m = /<script[^>]*>([\s\S]*?)<\/script>/.exec(body);
    return m ? '\n' + jsonLd(m[1], page) + '\n' : body;
  });

  after = region(after, 'hours', (body) => {
    const indent = (/\n([ \t]*)</.exec(body) || [, '          '])[1];
    return '\n' + hoursRows(indent) + '\n';
  });

  if (CRUMB[page]) {
    after = region(after, 'breadcrumb', () => '\n' + breadcrumbLd(page) + '\n');
  }

  after = region(after, 'hours-summary', () => hoursSummary());
  after = region(after, 'board', () => '\n' + boardHTML() + '\n');
  after = region(after, 'preview', () => '\n' + previewHTML() + '\n');

  if (after === before) {
    console.log(`  ${page} up to date`);
    continue;
  }
  if (check) { console.error(`  ${page} OUT OF DATE`); stale++; continue; }
  writeFileSync(join(ROOT, page), after);
  console.log(`  ${page} rewritten`);
}

/* sitemap.xml and robots.txt carry the same absolute URLs, so they are written
   from the same constant rather than kept in step by hand. */
const LASTMOD = (/<lastmod>([^<]+)<\/lastmod>/.exec(read('sitemap.xml')) || [, '2026-08-10'])[1];
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  ['index.html', 'menu.html', 'find-us.html'].map((p, i) =>
    '  <url>\n' +
    `    <loc>${pageUrl(p)}</loc>\n` +
    `    <lastmod>${LASTMOD}</lastmod>\n` +
    `    <priority>${['1.0', '0.8', '0.8'][i]}</priority>\n` +
    '  </url>').join('\n') +
  '\n</urlset>\n';

const robots = '# Sundays only. The rest of the week, this file has the place to itself.\n' +
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`;

for (const [file, body] of [['sitemap.xml', sitemap], ['robots.txt', robots]]) {
  if (read(file) === body) { console.log(`  ${file} up to date`); continue; }
  if (check) { console.error(`  ${file} OUT OF DATE`); stale++; continue; }
  writeFileSync(join(ROOT, file), body);
  console.log(`  ${file} rewritten`);
}

if (check && stale) {
  console.error(`\n${stale} file(s) out of date. Run: node tools/sync-static.mjs`);
  process.exit(1);
}
