/* Developer tool — NOT part of the deployed site and NOT owner-editable.
 *
 *     npm i --no-save playwright && node tools/check-contrast.mjs
 *     (serve the site on http://127.0.0.1:8099 first, or pass a base URL)
 *
 * The brief asks for contrast to be checked against every state ground, and
 * the grounds here are paintings — no static value can tell you what is under
 * a word. So this measures it: for each state it renders the page, hides only
 * the glyphs, screenshots the box each piece of type occupies, and computes
 * the WCAG ratio of that type's own colour against every pixel behind it.
 *
 * The number that matters is the worst pixel, not the average: type is only as
 * legible as its darkest patch of ground. Run it after touching the paper
 * strip, the plate positions, or the pigment layer's mix strengths.
 */

import { chromium } from 'playwright';
import zlib from 'node:zlib';

const BASE = process.argv[2] || 'http://127.0.0.1:8099';
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* selector, WCAG threshold, label. 3:1 is the large-text bar, 4.5:1 the rest. */
const TARGETS = [
  ['.hero-headline', 3.0, 'headline'],
  ['.hero-body', 4.5, 'body 13px'],
  ['.hero-eyebrow-text', 4.5, 'eyebrow 10px'],
  ['.stamp', 4.5, 'timestamp 10px'],
];
const STATES = ['morning', 'midday', 'late', 'closed'];
/* 1024 is not decoration. The hero headlines are clamp()ed and their columns
   are percentages, so the line count changes between the two extremes — a
   headline that sits on the paper strip at 1440 and in flow at 390 can wrap
   onto bare painting somewhere in the middle. Testing only the ends misses it. */
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 800 },
  { width: 390, height: 844 }
];

/* Minimal PNG -> RGBA decoder, so this stays a single file with one dependency. */
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}
const PNG = {
  decodeRGBA(buf) {
    let off = 8, w=0, h=0, depth=8, ctype=6; const idat=[];
    while (off < buf.length) {
      const len = buf.readUInt32BE(off); const type = buf.toString('ascii', off+4, off+8);
      const data = buf.subarray(off+8, off+8+len);
      if (type==='IHDR'){ w=data.readUInt32BE(0); h=data.readUInt32BE(4); depth=data[8]; ctype=data[9]; }
      else if (type==='IDAT') idat.push(data);
      else if (type==='IEND') break;
      off += 12 + len;
    }
    if (depth!==8) throw new Error('bit depth '+depth+' unsupported');
    const ch = ({0:1,2:3,4:2,6:4})[ctype]; if(!ch) throw new Error('colour type '+ctype);
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = w*ch; const out = Buffer.alloc(w*h*4); const cur = Buffer.alloc(stride); const prev = Buffer.alloc(stride);
    let p = 0;
    for (let y=0;y<h;y++){
      const f = raw[p++]; raw.copy(cur, 0, p, p+stride); p += stride;
      for (let x=0;x<stride;x++){
        const a = x>=ch?cur[x-ch]:0, b = prev[x], c = x>=ch?prev[x-ch]:0;
        let v = cur[x];
        if(f===1)v+=a; else if(f===2)v+=b; else if(f===3)v+=((a+b)>>1); else if(f===4)v+=paeth(a,b,c);
        cur[x]=v&0xff;
      }
      for (let x=0;x<w;x++){
        const s=x*ch, d=(y*w+x)*4;
        if(ch===4){out[d]=cur[s];out[d+1]=cur[s+1];out[d+2]=cur[s+2];out[d+3]=cur[s+3];}
        else if(ch===3){out[d]=cur[s];out[d+1]=cur[s+1];out[d+2]=cur[s+2];out[d+3]=255;}
        else if(ch===2){out[d]=out[d+1]=out[d+2]=cur[s];out[d+3]=cur[s+1];}
        else {out[d]=out[d+1]=out[d+2]=cur[s];out[d+3]=255;}
      }
      cur.copy(prev);
    }
    return { width:w, height:h, data: out };
  }
};

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const relL = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const [x, y] = [relL(a), relL(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });

const rows = [];
for (const state of STATES) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?state=${state}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);

    const probes = await page.evaluate((sels) => sels.map((s) => {
      const el = document.querySelector(s);
      if (!el || !el.offsetParent && getComputedStyle(el).position !== 'absolute') return null;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return null;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return null;
      const m = cs.color.match(/[\d.]+/g).map(Number);
      return { sel: s, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), fg: [m[0], m[1], m[2]] };
    }), TARGETS.map((t) => t[0]));

    // hide only the glyphs, keeping every layer beneath exactly as it was
    await page.addStyleTag({ content: TARGETS.map((t) => t[0] + '{color:transparent !important}').join('') });
    await page.waitForTimeout(250);

    for (let i = 0; i < TARGETS.length; i++) {
      const [sel, need, label] = TARGETS[i];
      const b = probes[i];
      if (!b) { rows.push({ state, vp: vp.width, element: label, note: 'not shown in this state' }); continue; }
      const clip = {
        x: Math.max(0, b.x), y: Math.max(0, b.y),
        width: Math.max(1, Math.min(b.w, vp.width - Math.max(0, b.x))),
        height: Math.max(1, Math.min(b.h, vp.height - Math.max(0, b.y))),
      };
      const px = PNG.decodeRGBA(await page.screenshot({ clip }));
      let worst = Infinity, sum = 0, n = 0;
      for (let k = 0; k < px.data.length; k += 4) {
        const c = ratio(b.fg, [px.data[k], px.data[k + 1], px.data[k + 2]]);
        if (c < worst) worst = c;
        sum += c; n++;
      }
      rows.push({
        state, vp: vp.width, element: label,
        box: `${clip.width}x${clip.height}`,
        worst: worst.toFixed(2), mean: (sum / n).toFixed(2),
        need: need.toFixed(1),
        verdict: worst >= need ? 'PASS' : 'FAIL',
      });
    }
    await ctx.close();
  }
}
await browser.close();
console.table(rows);
const bad = rows.filter((r) => r.verdict === 'FAIL');
if (bad.length) {
  console.error(`\n${bad.length} below the WCAG AA bar`);
  process.exit(1);
}
console.log('\nall hero type clears WCAG AA on every state ground');
