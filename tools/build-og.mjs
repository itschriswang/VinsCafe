/* Developer tool. NOT part of the deployed site and NOT owner-editable.
 *
 *     npm i --no-save playwright        (once; the browser is not re-downloaded)
 *     node tools/build-og.mjs
 *
 * Writes the three social cards (art/og-home.jpg, art/og-menu.jpg,
 * art/og-find-us.jpg) by typesetting them in a real browser with the site's
 * own stylesheet. The palette, both faces, the squiggle rule and the paper
 * come from style.css; the words come from the pages, menu.json and
 * config.js. Nothing on a card is written down here, so the cards cannot
 * drift from the site: change a headline, a price, the hours or a colour and
 * one run of this script carries the change onto the cards.
 *
 * That is also the rule: REGENERATE THESE AFTER ANY UI OR COPY CHANGE and
 * commit the JPEGs. CLAUDE.md holds the same rule for agents.
 */

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const CAFE = new Function(read('config.js') + '\nreturn CAFE;')();
const MENU = JSON.parse(read('menu.json'));

/* ---- the words, lifted from where they already live ------------------------- */

const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/* The home page's headline, exactly as the hero says it. */
const HEADLINE = strip(
  (/<h1 class="hero-headline"[^>]*>([\s\S]*?)<\/h1>/.exec(read('index.html')) || [, ''])[1]
);

/* The menu page's own meta line: "Baked that morning / Matcha to order". */
const MENU_META = strip(
  (/<p class="page-meta">([\s\S]*?)<\/p>/.exec(read('menu.html')) || [, ''])[1]
    .replace(/<br\s*\/?>/g, ' · ')
);

/* The plan page's own meta line and the one sentence its verdict ends on. */
const PLAN_META = strip(
  (/<p class="page-meta">([\s\S]*?)<\/p>/.exec(read('plan.html')) || [, ''])[1]
);
const PLAN_LINE = strip(
  (/<p class="plan-verdict-sub">([\s\S]*?)<\/p>/.exec(read('plan.html')) || [, ''])[1]
);

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n) => String(n).padStart(2, '0');

/* Same collapsing as app.js and sync-static.mjs: open runs only. */
function hoursSummary() {
  const order = (() => {
    let start = 1;
    for (let i = 0; i < 7; i++) { const d = (1 + i) % 7; if (CAFE.hours[d]) { start = d; break; } }
    return Array.from({ length: 7 }, (_, j) => (start + j) % 7);
  })();
  const runs = [];
  for (const d of order) {
    const h = CAFE.hours[d] || null;
    const last = runs[runs.length - 1];
    if (last && ((!last.h && !h) || (last.h && h && last.h[0] === h[0] && last.h[1] === h[1]))) {
      last.days.push(d);
    } else runs.push({ h, days: [d] });
  }
  return runs.filter((r) => r.h).map((r) =>
    `${r.days.length > 1 ? `${DAY_SHORT[r.days[0]]}–${DAY_SHORT[r.days[r.days.length - 1]]}` : DAY_SHORT[r.days[0]]} ${pad(r.h[0])}–${pad(r.h[1])}`
  ).join(' · ');
}

const HOURS = hoursSummary();
const TOTAL = MENU.reduce((n, s) => n + (s.items || []).length, 0);
/* One item from each of the first three sections: a taste, not the board. */
const TASTE = MENU.slice(0, 3).map((s) => (s.items || [])[0]).filter(Boolean);

/* The lockup needs the two halves separately. The name comes out of
   config.js, so a one-word name simply stays one word. */
function wordmark() {
  const parts = String(CAFE.name).trim().split(/\s+/);
  if (parts.length < 2) return esc(CAFE.name);
  const tail = parts.pop();
  return `<span class="wm-a">${esc(parts.join(' '))}</span><span class="wm-b">${esc(tail)}</span>`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/* The caps lines break where the sense breaks, never mid-phrase. */
const caps = (lines) => lines.map(esc).join('<br>');

/* ---- the three cards -------------------------------------------------------- */

const CARD_CSS = `
  html { background: var(--paper); }
  body { width: 1200px; height: 630px; overflow: hidden; position: relative; }
  body::before {
    content: ''; position: absolute; inset: 0;
    background-image: image-set(
      url('art/tex-paper-1376w.avif') type('image/avif'),
      url('art/tex-paper-1376w.webp') type('image/webp'));
    background-size: cover; background-position: center;
    opacity: 0.9; mix-blend-mode: multiply;
  }
  .card { position: absolute; inset: 0; }
  .card-plate {
    position: absolute; top: 0; right: 0; height: 100%; width: 62%;
    object-fit: cover; object-position: 62% 100%;
    mix-blend-mode: multiply;
    -webkit-mask-image: linear-gradient(to right, transparent, #000 34%);
            mask-image: linear-gradient(to right, transparent, #000 34%);
  }
  .card-spot {
    position: absolute; mix-blend-mode: multiply;
  }
  .card-type {
    position: absolute; inset: 0; z-index: 1;
    display: flex; flex-direction: column; justify-content: center;
    align-items: flex-start; gap: 26px;
    padding: 0 90px;
  }
  /* The wordmark lockup, at the one size where it can be as large as it likes:
     "gam" built, "sia" written and sliding back under the m. */
  .card-word { font: 400 132px/0.95 var(--display); letter-spacing: -0.05em; color: var(--ink); }
  .card-word .wm-b {
    font: italic 400 1.04em var(--serif); letter-spacing: 0;
    margin-left: -0.08em; display: inline-block; transform: translateY(0.11em);
  }
  .card-word--small { font-size: 54px; color: var(--sun-deep); }
  .card-title { font: 400 120px/0.92 var(--display); letter-spacing: -0.035em; color: var(--ink); margin-top: -10px; }
  /* Painted along its length, like the rule on the site. The card is set at
     midday, so it picks up that hour's three pigments and a share card carries
     the same stroke a midday visitor sees. */
  .card-rule {
    width: 288px; height: 12px;
    background-color: var(--rule-2, var(--sun));
    background-image: linear-gradient(in oklch 90deg,
      var(--rule-1, var(--sun)) 4%,
      var(--rule-2, var(--sun)) 48%,
      var(--rule-3, var(--sun)) 92%);
    -webkit-mask: var(--squiggle) left center / 96px 10px repeat-x;
            mask: var(--squiggle) left center / 96px 10px repeat-x;
  }
  /* The site's headlines are Epoch; a share card that set them in the italic
     would be the one place the two faces swapped jobs. */
  .card-line { font: 400 52px/1.06 var(--display); letter-spacing: -0.03em;
    color: var(--ink); max-width: 15ch; }
  .card-caps {
    font: 800 27px/1.5 var(--sans);
    letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--moss-text);
  }
  .card-items { display: flex; flex-direction: column; gap: 10px; width: 560px; }
  .card-items li { display: flex; align-items: baseline; gap: 16px; font: 600 33px/1.25 var(--sans); color: var(--ink); }
  /* The dot leader retired with the board's; the price sits in its own column. */
  .card-items .lead { flex: 1; }
  .card-items .price { font-variant-numeric: tabular-nums; }
  .card-items .price { font: 400 26px/1 var(--mono); color: var(--pine); }
  .card-addr { font: italic 400 58px/1.15 var(--serif); color: var(--ink); max-width: 15ch; }
  .card-sub { font: 600 32px/1.35 var(--sans); color: var(--ink-75); max-width: 22ch; }
`;

const CARDS = {
  'og-home.jpg': `
    <div class="card">
      <img class="card-plate" src="art/hero-midday-1376w.webp" alt="">
      <div class="card-type">
        <p class="card-word">${wordmark()}</p>
        <div class="card-rule"></div>
        <p class="card-line">${esc(HEADLINE)}</p>
        <p class="card-caps">${caps([HOURS, `${CAFE.address.street}, ${CAFE.address.locality}`])}</p>
      </div>
    </div>`,

  'og-menu.jpg': `
    <div class="card">
      <img class="card-spot" src="art/spot-cake-600w.webp" alt=""
           style="width: 430px; right: 64px; top: 40px; transform: rotate(2deg);">
      <img class="card-spot" src="art/spot-coldbrew-440w.webp" alt=""
           style="width: 260px; right: 180px; bottom: -84px; transform: rotate(-2.4deg);">
      <div class="card-type" style="gap: 22px;">
        <p class="card-word card-word--small">${wordmark()}</p>
        <p class="card-title">The menu</p>
        <div class="card-rule"></div>
        <ul class="card-items">${TASTE.map((it) =>
          `<li><span>${esc(it.name)}</span><span class="lead"></span><span class="price">${esc(it.price)}</span></li>`
        ).join('')}</ul>
        <p class="card-caps">${caps([`${TOTAL} things`, MENU_META])}</p>
      </div>
    </div>`,

  'og-find-us.jpg': `
    <div class="card">
      <img class="card-spot" src="art/spot-flatwhite-760w.webp" alt=""
           style="width: 520px; right: 30px; top: 60px; transform: rotate(-1.8deg);">
      <div class="card-type" style="gap: 22px;">
        <p class="card-word card-word--small">${wordmark()}</p>
        <p class="card-title">Find us</p>
        <div class="card-rule"></div>
        <p class="card-addr">${esc(`${CAFE.address.street}, ${CAFE.address.locality}`)}</p>
        <p class="card-caps">${caps([HOURS])}</p>
      </div>
    </div>`,

  'og-plan.jpg': `
    <div class="card">
      <img class="card-spot" src="art/spot-beans-400w.webp" alt=""
           style="width: 330px; right: 130px; top: 96px; transform: rotate(1.6deg);">
      <div class="card-type" style="gap: 22px;">
        <p class="card-word card-word--small">${wordmark()}</p>
        <p class="card-title">The plan</p>
        <div class="card-rule"></div>
        <p class="card-line">${esc(PLAN_LINE)}</p>
        <p class="card-caps">${caps([PLAN_META, HOURS])}</p>
      </div>
    </div>`
};

/* ---- render ----------------------------------------------------------------- */

const page_html = (body) => `<!doctype html>
<html lang="en-AU" data-state="midday">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="style.css">
<style>${CARD_CSS}</style>
</head>
<body>${body}</body>
</html>`;

const TMP = 'og-card.tmp.html';

const { chromium } = await import('playwright');

let browser;
try {
  browser = await chromium.launch();
} catch {
  /* A pinned playwright version without its own download can still drive the
     system chromium. */
  browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
}

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const [file, body] of Object.entries(CARDS)) {
    writeFileSync(join(ROOT, TMP), page_html(body));
    await page.goto(pathToFileURL(join(ROOT, TMP)).href);
    /* font-display: optional never blocks, so ask for the faces outright and the
       card is set in Oskon and Darker Grotesque, not the fallbacks. */
    await page.evaluate(() => Promise.all([
      document.fonts.load('italic 400 100px Oskon'),
      document.fonts.load('400 100px Oskon'),
      document.fonts.load('800 30px "Darker Grotesque"'),
      document.fonts.load('600 30px "Darker Grotesque"'),
      document.fonts.load('400 26px "Fragment Mono"'),
    ]).then(() => document.fonts.ready));
    await page.screenshot({
      path: join(ROOT, 'art', file), type: 'jpeg', quality: 82
    });
    console.log(`  art/${file} written`);
  }
} finally {
  await browser.close();
  try { unlinkSync(join(ROOT, TMP)); } catch { /* already gone */ }
}
