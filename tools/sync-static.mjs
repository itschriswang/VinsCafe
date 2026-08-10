/* Developer tool — NOT part of the deployed site and NOT owner-editable.
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
const WEEK_ORDER = [3, 4, 5, 6, 0, 1, 2];
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
  'spot-cup':       { w: 206, h: 111, sizes: '(max-width:719px) 156px, (max-width:1179px) 168px, 206px',
    alt: 'Watercolour of a green and lilac cup, half full, a small red mark on its side.' },
  'spot-espresso':  { w: 134, h: 130, sizes: '(max-width:1179px) 112px, 134px',
    alt: 'Watercolour of a green espresso cup with a lilac shadow pooling under it.' },
  'spot-teapot':    { w: 168, h: 187, sizes: '(max-width:719px) 132px, (max-width:1179px) 138px, 168px',
    alt: 'Watercolour of a squat green teapot with a lilac handle, on a pale wash.' },
  'spot-beans':     { w: 132, h: 150, sizes: '(max-width:719px) 126px, (max-width:1179px) 110px, 132px',
    alt: 'Watercolour of a paper bag of coffee, the dark green showing through the sides.' },
  'spot-croissant': { w: 198, h: 198, sizes: '(max-width:719px) 168px, (max-width:1179px) 162px, 198px',
    alt: 'Watercolour of a croissant in olive and grey, one flake of it catching red.' },
  'spot-toast':     { w: 146, h: 166, sizes: '(max-width:1179px) 120px, 146px',
    alt: 'Watercolour of two thick slices of toast stacked, a red drop of jam below them.' },
  'spot-cake':      { w: 180, h: 205, sizes: '(max-width:719px) 156px, (max-width:1179px) 148px, 180px',
    alt: 'Watercolour of a slice of layer cake on a grey plate, a red cherry on top.' },
  'spot-coldbrew':  { w: 140, h: 160, sizes: '(max-width:719px) 140px, (max-width:1179px) 114px, 138px',
    alt: 'Watercolour of a tumbler of iced coffee, the ice drawn as gaps left in the wash.' },
  'spot-matcha':    { w: 170, h: 194, sizes: '(max-width:1179px) 140px, 170px',
    alt: 'Watercolour of a matcha bowl and a bamboo whisk, the green settling in the base.' },
  'spot-flatwhite': { w: 232, h: 232, sizes: '(max-width:719px) 200px, 232px',
    alt: 'Watercolour of a flat white seen from above, the crema drawn as one olive ring.' }
};

const LEFT = ['coffee', 'tea', 'take-home'];
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

function sectionHTML(sec) {
  let h = `<section class="sec" data-sec="${slug(sec.section)}">`;
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

/* The home page shows the two sections that have a standfirst — the owner's
   own signal for which part of the board matters — four items each. */
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
  items: (sec.items || []).slice(0, PREVIEW_ITEMS)
}));

function previewSectionHTML(sec) {
  let h = `<section class="sec" data-sec="${slug(sec.section)}">`;
  h += `<div class="sec-head"><h3 class="sec-name">${esc(sec.section)}</h3>`;
  if (sec.note) h += `<p class="sec-note">${esc(sec.note)}</p>`;
  h += '</div><ul class="items">';
  for (const it of sec.items || []) {
    h += `<li class="item"><span class="item-name">${esc(it.name)}</span>` +
      '<span class="item-lead" aria-hidden="true"></span>' +
      `<span class="item-price">${esc(it.price)}</span></li>`;
  }
  return h + '</ul></section>';
}

function previewHTML() {
  const slice = previewSlice(MENU);
  const sig = signature(JSON.stringify(slice));
  return [
    `    <div class="preview-cols" data-preview-sig="${sig}">`,
    ...slice.map((s) => '      ' + previewSectionHTML(s)),
    '    </div>'
  ].join('\n');
}

function signature(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function boardHTML() {
  const left = MENU.filter((s) => LEFT.includes(slug(s.section)));
  const right = MENU.filter((s) => !LEFT.includes(slug(s.section)));
  const sig = signature(JSON.stringify(MENU));
  return [
    `    <div class="board" data-menu-sig="${sig}">`,
    '      <div class="board-col">',
    ...left.map((s) => '        ' + sectionHTML(s)),
    '      </div>',
    '      <div class="board-col">',
    ...right.map((s) => '        ' + sectionHTML(s)),
    '      </div>',
    '    </div>'
  ].join('\n');
}

/* ---- page-level JSON-LD ----------------------------------------------------- */

function jsonLd(existing) {
  const data = JSON.parse(existing);
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

  after = region(after, 'jsonld', (body) => {
    const m = /<script[^>]*>([\s\S]*?)<\/script>/.exec(body);
    return m ? '\n' + jsonLd(m[1]) + '\n' : body;
  });

  after = region(after, 'hours', (body) => {
    const indent = (/\n([ \t]*)</.exec(body) || [, '          '])[1];
    return '\n' + hoursRows(indent) + '\n';
  });

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

if (check && stale) {
  console.error(`\n${stale} file(s) out of date — run: node tools/sync-static.mjs`);
  process.exit(1);
}
