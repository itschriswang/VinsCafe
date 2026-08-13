/* wash.js: developer territory. Loaded asynchronously by app.js, never on its
 * own.
 *
 * One 2D canvas over the page, multiplied into it the way pigment sits on
 * paper. Four things happen on it and no others:
 *
 *   the wet edge   a damp trail under the pointer on the paper surfaces,
 *                  carrying the darker rim wet paper pulls, drying back to
 *                  cream in about two seconds
 *   the pour       the matcha bowl fills as its section rises into view
 *   the whisk      circling the pointer over the bowl raises a foam on it,
 *                  which settles again when you stop
 *   the steam      plumes off the paintings of hot things, thick in the
 *                  morning and thin while the room is shut, shouldered aside
 *                  by the pointer
 *
 * Steam is painted, not lit: a pale cool wash multiplied into the paper, the
 * way it is put down in watercolour, rather than white laid over the top.
 * That is also what makes it safe over type, because multiplying by a colour
 * this pale cannot lift dark ink off the page.
 *
 * Every box is measured off the live painting, never off the CSS that places
 * it, so the responsive rules and the hover tilt are followed instead of
 * duplicated here. No text is ever drawn on this canvas.
 */

const DPR_CAP = 1.75;
const SCALE = 0.55;          /* render small and upsample; a wash hides it */

/* The same two ways of noticing this is too expensive as pigment.js uses, and
   the same verdict: take the layer off the page and leave the site as it was.
   SLOW_MS is our own cost, PERIOD_MS the gap between frames, which is the only
   one that can see work the GPU has not finished yet.

   With one difference. The pour is driven by the scroll, so unlike the pigment
   layer this one is at its busiest exactly while the browser is doing the most
   work that is nothing to do with us. Frames arriving late during a scroll are
   not evidence against us, so the gap is not counted for a moment afterwards;
   without that, a second of hard scrolling on any machine took the layer off
   the page for the rest of the visit. */
const SLOW_MS = 9;
const PERIOD_MS = 28;
const SLOW_FRAMES = 30;
const SCROLL_GRACE = 260;
const WARMUP_FRAMES = 12;
const IDLE_FRAMES = 45;      /* nothing wet, nothing hot on screen: stop */

/* Paper. The wet edge only happens on these; never on a painting, never on
   the dark hero, never on the footer. */
const PAPER = '.page, .preview';

/* The paintings that are hot, and where on each one the heat leaves. The
   mouths are fractions of the painting's own box, read off the art:
   [cx, cy, rx, ry]. The flat white is not here on purpose; it is seen from
   directly above, and steam rising towards the reader reads as nothing. */
const SOURCES = [
  { sel: '.spot--matcha', mouth: [0.604, 0.432, 0.214, 0.081], bowl: true,  heat: 0.90, plumes: 3 },
  { sel: '.spot--cup',    mouth: [0.500, 0.300, 0.145, 0.098], bowl: false, heat: 1.00, plumes: 3 },
  { sel: '.spot--toast',  mouth: [0.495, 0.350, 0.230, 0.045], bowl: false, heat: 0.72, plumes: 2 }
];

/* How much is steaming, by the hour the site is already resolving. Nothing is
   ever quite off: the broth goes on days before the door opens, which is the
   whole point of the place. */
const HEAT = { morning: 1.0, midday: 0.78, late: 0.52, closed: 0.30 };

const PINE = '64, 74, 46';
const MOSS = '117, 130, 58';
const SKY = '169, 189, 206';
const FROTH = '243, 246, 226';   /* whisked usucha: pale, and still green */

const STAMP_GAP = 9;         /* px of pointer travel between damp stamps */
const STAMP_MAX = 64;
const STAMP_LIFE = 2200;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/* Deterministic, so the bubbles in a bowl are the same bubbles every visit
   and nothing flickers when the board is rebuilt from menu.json. */
function lcg(seed) {
  let s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* One sprite per kind of mark, drawn once and then only ever stamped. A
   gradient built per blob is the whole cost of a layer like this; a bitmap
   scaled into place is not. */
function sprite(size, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size);
  return c;
}

function radial(ctx, size, rgb, stops) {
  const h = size / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  for (const [at, a] of stops) g.addColorStop(at, 'rgba(' + rgb + ',' + a + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

function layer(cls) {
  const c = document.createElement('canvas');
  c.className = cls;
  c.setAttribute('aria-hidden', 'true');
  const x = c.getContext('2d', { alpha: true, desynchronized: true });
  if (!x) return null;
  document.body.appendChild(c);
  return { el: c, ctx: x };
}

export function start() {
  const base = layer('wash');
  if (!base) return null;
  const canvas = base.el;
  const ctx = base.ctx;

  /* The second layer, and the only one that lightens. It is built the first
     time a bowl is on the page and never otherwise, because whisked foam is
     the one thing here that cannot be painted by darkening: a multiply pass
     can take green out of the tea but it cannot put a pale froth on top of
     the green already in the painting. Confined to the inside of a bowl, so
     it is never over type and can never touch a contrast ratio. */
  let foam = null;
  let fctx = null;

  function ensureFoam() {
    if (foam) return;
    const l = layer('wash wash--foam');
    if (!l) return;
    foam = l.el;
    fctx = l.ctx;
    if (lit) foam.classList.add('is-lit');
    size();
  }

  /* Damp paper is two marks, not one. The body is a plain soft fall-off,
     because a trail is dozens of overlapping stamps and a rim drawn on each
     one is filled in by the next: what you get is a solid band and no edge at
     all. The rim goes on the few youngest stamps only, which is also where it
     belongs, since the wet edge is the boundary the water is still advancing
     into and the rest of the stroke is already drying. */
  const SP = {
    damp: sprite(128, (c, s) => radial(c, s, PINE,
      [[0, 0.62], [0.44, 0.5], [0.78, 0.19], [1, 0]])),
    edge: sprite(128, (c, s) => radial(c, s, PINE,
      [[0, 0], [0.58, 0.1], [0.83, 1], [0.94, 0.4], [1, 0]])),
    steam: sprite(128, (c, s) => radial(c, s, SKY,
      [[0, 1], [0.42, 0.55], [0.72, 0.16], [1, 0]])),
    /* Held tight to its edge: any halo past the painted rim is green sitting
       on bare paper, which is a stain and not a bowl of tea. */
    tea: sprite(128, (c, s) => radial(c, s, MOSS,
      [[0, 1], [0.52, 0.94], [0.79, 0.42], [0.94, 0.05], [1, 0]])),
    deep: sprite(128, (c, s) => radial(c, s, PINE,
      [[0, 0.9], [0.6, 0.5], [1, 0]])),
    /* The two marks that go on the foam layer instead of this one. */
    foam: sprite(128, (c, s) => radial(c, s, FROTH,
      [[0, 1], [0.55, 0.9], [0.82, 0.4], [0.96, 0.05], [1, 0]])),
    lit: sprite(32, (c, s) => radial(c, s, FROTH, [[0, 1], [0.5, 0.6], [1, 0]]))
  };

  /* A bead of foam is a rim, not a dot: on paper the froth is the part left
     unpainted and only its edge is drawn. At the size these are actually
     stamped, two or three pixels, the rim is all you read. */
  SP.bead = sprite(32, (c, s) => {
    c.strokeStyle = 'rgba(' + PINE + ',0.85)';
    c.lineWidth = s * 0.14;
    c.beginPath();
    c.arc(s / 2, s / 2, s * 0.33, 0, Math.PI * 2);
    c.stroke();
  });

  SP.ring = sprite(160, (c, s) => {
    c.strokeStyle = 'rgba(' + PINE + ',0.8)';
    c.lineWidth = s * 0.022;
    c.beginPath();
    c.arc(s / 2, s / 2, s * 0.47, 0, Math.PI * 2);
    c.stroke();
  });

  const BUBBLES = (function () {
    const rnd = lcg(20260813);
    const out = [];
    for (let i = 0; i < 74; i++) {
      out.push({
        a: rnd() * Math.PI * 2,
        r: Math.sqrt(rnd()) * 0.92,
        s: 0.35 + rnd() * 0.9,
        ph: rnd() * Math.PI * 2,
        sp: 0.6 + rnd() * 0.9
      });
    }
    return out;
  }());

  let dpr = 1;
  let vw = 0, vh = 0;
  let raf = 0;
  let dead = false;
  let lit = false;
  let last = 0;
  let time = 0;
  let idle = 0;
  let warm = 0;
  let slowCost = 0;
  let slowPeriod = 0;

  /* The pointer, in page coordinates, plus the air it drags with it. */
  const ptr = { x: -1e5, y: -1e5, px: -1e5, py: -1e5, has: false, at: 0 };
  const air = { x: 0, y: 0 };

  const stamps = [];
  let stampFrom = null;

  let heatState = 'midday';
  let surfaces = [];
  let sources = [];
  let scanned = 0;
  let scrolledAt = 0;
  const bowls = new WeakMap();

  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    vw = window.innerWidth;
    vh = window.innerHeight;
    const w = Math.max(2, Math.round(vw * dpr * SCALE));
    const h = Math.max(2, Math.round(vh * dpr * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (foam && (foam.width !== w || foam.height !== h)) {
      foam.width = w;
      foam.height = h;
    }
  }

  /* Wiped and put back into page coordinates, ready to be drawn on. */
  function prep(x) {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, canvas.width, canvas.height);
    x.setTransform(dpr * SCALE, 0, 0, dpr * SCALE, 0, 0);
    x.globalCompositeOperation = 'source-over';
  }

  /* The painting's own box, before the tilt, and the tilt as a matrix. Taken
     from the offset box rather than getBoundingClientRect, because that one
     reports the rectangle around a rotated painting and every measurement
     inside it would be off by the rotation. */
  function boxOf(el) {
    const par = el.offsetParent;
    if (!par) return null;
    const pr = par.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return null;
    let m = null;
    const t = getComputedStyle(el).transform;
    if (t && t !== 'none') {
      try { m = new DOMMatrix(t); } catch (e) { m = null; }
    }
    return { x: pr.left + el.offsetLeft, y: pr.top + el.offsetTop, w: w, h: h, m: m };
  }

  /* A point in the painting's own coordinates, put where it actually lands on
     screen once the tilt is applied. */
  function mapPoint(b, lx, ly) {
    const cx = lx - b.w / 2, cy = ly - b.h / 2;
    if (!b.m) return { x: b.x + lx, y: b.y + ly };
    return {
      x: b.x + b.w / 2 + b.m.a * cx + b.m.c * cy + b.m.e,
      y: b.y + b.h / 2 + b.m.b * cx + b.m.d * cy + b.m.f
    };
  }

  /* Into the painting's own coordinates, tilt and all, so what is drawn in
     the bowl sits in the bowl however the CSS has turned it. */
  function enterLocal(x, b) {
    x.save();
    x.translate(b.x + b.w / 2, b.y + b.h / 2);
    if (b.m) x.transform(b.m.a, b.m.b, b.m.c, b.m.d, b.m.e, b.m.f);
    x.translate(-b.w / 2, -b.h / 2);
  }

  function scan() {
    surfaces = Array.prototype.slice.call(document.querySelectorAll(PAPER));
    sources = [];
    for (const s of SOURCES) {
      const els = document.querySelectorAll(s.sel);
      for (let i = 0; i < els.length; i++) sources.push({ el: els[i], def: s, seed: i });
      if (s.bowl && els.length) ensureFoam();
    }
    const st = document.documentElement.getAttribute('data-state');
    heatState = HEAT[st] === undefined ? 'midday' : st;
  }

  function bowlOf(el) {
    let b = bowls.get(el);
    if (!b) {
      b = { pour: 0, intro: 0, froth: 0, spin: 0, ripples: [] };
      bowls.set(el, b);
    }
    return b;
  }

  /* ------------------------------------------------------------- pointer --- */

  function overPaper(x, y) {
    for (const el of surfaces) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return r;
    }
    return null;
  }

  function stamp(x, y, speed) {
    /* A brush carrying water lays a broader stroke the faster it is drawn. */
    const r = 17 + Math.min(speed, 900) * 0.016;
    stamps.push({ x: x, y: y + window.scrollY, r: r, born: performance.now() });
    if (stamps.length > STAMP_MAX) stamps.shift();
  }

  function onMove(e) {
    if (dead) return;
    const now = performance.now();
    const dt = Math.max(1, now - ptr.at);
    const x = e.clientX, y = e.clientY;

    if (ptr.has) {
      const dx = x - ptr.x, dy = y - ptr.y;
      const speed = Math.sqrt(dx * dx + dy * dy) / dt * 1000;
      /* The air the pointer pushes, smoothed so a flick wafts and a sweep
         leans; it is what the steam is actually reacting to. */
      air.x += (clamp(dx / dt * 26, -70, 70) - air.x) * 0.3;
      air.y += (clamp(dy / dt * 18, -50, 50) - air.y) * 0.3;

      /* A finger is not a brush. On a touch screen the only pointer moves are
         the start of a scroll, and a wet streak laid down every time someone
         swipes the page is not a damp sheet, it is a mess. The pour and the
         steam still run there; those are the two that need no pointer. */
      const rect = fine ? overPaper(x, y) : null;
      if (rect) {
        if (!stampFrom) stampFrom = { x: ptr.x, y: ptr.y };
        let sx = stampFrom.x, sy = stampFrom.y;
        let travel = Math.hypot(x - sx, y - sy);
        let guard = 0;
        while (travel >= STAMP_GAP && guard++ < 24) {
          const k = STAMP_GAP / travel;
          sx += (x - sx) * k;
          sy += (y - sy) * k;
          if (sy >= rect.top && sy <= rect.bottom && sx >= rect.left && sx <= rect.right) {
            stamp(sx, sy, speed);
          }
          travel = Math.hypot(x - sx, y - sy);
        }
        stampFrom = { x: sx, y: sy };
      } else {
        stampFrom = null;
      }

      if (fine) whisk(x, y, speed);
    }

    ptr.px = ptr.x; ptr.py = ptr.y;
    ptr.x = x; ptr.y = y;
    ptr.has = true;
    ptr.at = now;
    wake();
  }

  /* Circling the bowl raises the foam. Angular travel is what counts, so a
     stir is rewarded and a straight sweep past it is not; speed adds a little
     on top, because a chasen is worked fast. Nothing can be frothed that has
     not been poured. */
  function whisk(x, y, speed) {
    for (const src of sources) {
      if (!src.def.bowl) continue;
      /* The box the last frame measured, never a fresh one. A pointer reports
         well over a hundred times a second and boxOf reads a computed style;
         taking that on every move is a forced layout per report, for a number
         that cannot have changed since the frame that drew the bowl. */
      const b = src.box;
      if (!b) continue;
      const st = bowlOf(src.el);
      if (st.pour < 0.12) continue;
      const m = src.def.mouth;
      const c = mapPoint(b, m[0] * b.w, m[1] * b.h);
      const reach = Math.max(m[2] * b.w, 46) * 2.1;
      const dx = x - c.x, dy = y - c.y;
      /* Forgetting the last angle on the way out matters: kept, a pointer that
         leaves one side of the bowl and comes back at the other reads as one
         enormous sweep of the whisk and the froth jumps. */
      if (dx * dx + dy * dy > reach * reach) { st.lastA = undefined; continue; }

      const a = Math.atan2(dy, dx);
      if (st.lastA !== undefined) {
        let da = a - st.lastA;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        st.spin += da;
        st.froth = Math.min(st.pour, st.froth + Math.abs(da) * 0.24 + Math.min(speed, 1400) * 0.00006);
      }
      st.lastA = a;
    }
  }

  /* --------------------------------------------------------------- paint --- */

  function drawDamp(now) {
    for (let i = stamps.length - 1; i >= 0; i--) {
      const s = stamps[i];
      const age = (now - s.born) / STAMP_LIFE;
      if (age >= 1) { stamps.splice(i, 1); continue; }
      const y = s.y - window.scrollY;
      if (y < -80 || y > vh + 80) continue;
      const wet = age < 0.06 ? age / 0.06 : 1;
      const a = wet * Math.pow(1 - age, 1.8) * 0.021;
      if (a <= 0.001) continue;
      const r = s.r * (1 + age * 0.18);
      ctx.globalAlpha = a;
      ctx.drawImage(SP.damp, s.x - r, y - r, r * 2, r * 2);

      const held = now - s.born;
      if (held < 280) {
        ctx.globalAlpha = (1 - held / 280) * 0.05;
        const er = r * 1.1;
        ctx.drawImage(SP.edge, s.x - er, y - er, er * 2, er * 2);
      }
    }
  }

  function drawBowl(src, b, st) {
    const m = src.def.mouth;
    const mx = m[0] * b.w, my = m[1] * b.h;
    const rx = m[2] * b.w, ry = m[3] * b.h;
    const t = st.pour;
    if (t <= 0.004) return;

    /* Shallow tea sits low and small in the bowl and climbs to the rim. */
    const fx = rx * (0.36 + 0.64 * t);
    const fy = ry * (0.36 + 0.64 * t);
    const cy = my + ry * 0.62 * (1 - t);

    enterLocal(ctx, b);

    /* Whisking lifts the tea and pales it. There is only one blend on this
       canvas and it darkens, so the foam is made by laying less green down,
       not by laying white over it. */
    const settled = 1 - st.froth * 0.62;
    ctx.globalAlpha = 0.5 * t * settled;
    ctx.drawImage(SP.tea, mx - fx, cy - fy, fx * 2, fy * 2);

    /* The far half of the surface, in the shadow of the bowl's own wall. */
    ctx.globalAlpha = 0.26 * t * settled;
    ctx.drawImage(SP.deep, mx - fx * 0.8, cy - fy * 1.05, fx * 1.6, fy * 1.05);

    for (let i = st.ripples.length - 1; i >= 0; i--) {
      const rp = st.ripples[i];
      rp.t += 0.03;
      if (rp.t >= 1) { st.ripples.splice(i, 1); continue; }
      const k = 0.25 + rp.t * 0.8;
      ctx.globalAlpha = 0.3 * (1 - rp.t) * t;
      ctx.drawImage(SP.ring, mx - fx * k, cy - fy * k, fx * 2 * k, fy * 2 * k);
    }

    if (st.froth > 0.01 && fctx) {
      const f = st.froth;
      enterLocal(fctx, b);

      /* The froth itself, laid over the whole surface. */
      fctx.globalAlpha = 0.62 * f * t;
      fctx.drawImage(SP.foam, mx - fx * 0.94, cy - fy * 0.94, fx * 1.88, fy * 1.88);

      for (const bu of BUBBLES) {
        /* The inside of the bowl turns faster than the rim, so the froth
           winds up rather than turning in one piece. */
        const a = bu.a + st.spin * (1.15 - bu.r * 0.75) * bu.sp;
        const rr = bu.r * (0.4 + f * 0.58);
        const bx = mx + Math.cos(a) * fx * rr;
        const by = cy + Math.sin(a) * fy * rr;
        const s = fy * (0.035 + bu.s * 0.055) * (0.55 + f * 0.45);
        const puff = 0.6 + 0.4 * Math.sin(time * 2.1 + bu.ph);

        /* A bead is a lit crown and a rim under it, one on each layer; that
           pair is what makes it a bubble rather than a speck. */
        fctx.globalAlpha = 0.55 * f * puff;
        fctx.drawImage(SP.lit, bx - s * 0.8 - s * 0.25, by - s * 0.8 - s * 0.25, s * 1.6, s * 1.6);
        ctx.globalAlpha = 0.4 * f * puff;
        ctx.drawImage(SP.bead, bx - s, by - s, s * 2, s * 2);
      }

      fctx.restore();
    }

    ctx.restore();
  }

  function drawSteam(src, b, st) {
    const def = src.def;
    let dens = HEAT[heatState] * def.heat;
    if (st) dens *= (0.25 + 0.75 * st.pour) * (1 - st.froth * 0.35);
    if (dens <= 0.02) return;

    const m = def.mouth;
    const c = mapPoint(b, m[0] * b.w, m[1] * b.h);
    const rx = m[2] * b.w;
    const H = b.h * 1.05;
    if (c.y < -H || c.y > vh + 60) return;

    const STEPS = 12;
    const baseR = Math.max(5, rx * 0.34);
    const phase = src.seed * 1.7;

    for (let p = 0; p < def.plumes; p++) {
      const ph = p * 2.399 + phase;
      /* The plumes leave the cup close together and are separated by their own
         wander on the way up, which is the shape steam actually has; started
         wide apart they climb as three parallel bars. */
      const x0 = c.x + (p - (def.plumes - 1) / 2) * rx * 0.3;
      for (let i = 1; i <= STEPS; i++) {
        const t = (i + (p * 0.41) % 1) / STEPS;
        if (t > 1) continue;
        const sway = Math.sin(time * 0.85 + ph + t * 3.4) * H * 0.2 * t +
                     Math.sin(time * 0.36 + ph * 1.7 + t * 1.9) * H * 0.1 * t;
        let x = x0 + sway + air.x * t * 1.5;
        let y = c.y - H * t + air.y * t * 0.5;

        /* The pointer is a hand near the cup: the plume goes round it. */
        if (ptr.has) {
          const dx = x - ptr.x, dy = y - ptr.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 16900) {
            const d = Math.sqrt(d2) || 1;
            const push = 1 - d / 130;
            const k = push * push * 52;
            x += dx / d * k;
            y += dy / d * k;
          }
        }

        const r = baseR * (0.32 + t * 1.75);
        /* Steam comes off in bursts, not as a column; the break-up is what
           stops the plume reading as a bar of fog. */
        const gust = 0.58 + 0.42 * Math.sin(time * 1.35 + ph * 2.1 + t * 5.6);
        const a = dens * 0.082 * Math.pow(1 - t, 1.15) * Math.min(1, t * 4) * gust;
        if (a <= 0.002) continue;
        ctx.globalAlpha = a;
        ctx.drawImage(SP.steam, x - r, y - r, r * 2, r * 2);
      }
    }
  }

  /* ---------------------------------------------------------------- loop --- */

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const started = performance.now();

    const gap = last ? now - last : 16;
    last = now;
    const dt = Math.min(gap, 100);
    time += dt / 1000;

    if (now - scanned > 500) { scan(); scanned = now; }

    size();
    prep(ctx);
    if (fctx) prep(fctx);

    const decay = Math.pow(0.9915, dt / 16.67);
    air.x *= Math.pow(0.9, dt / 16.67);
    air.y *= Math.pow(0.9, dt / 16.67);

    drawDamp(now);

    let busy = stamps.length > 0;

    for (const src of sources) {
      const b = boxOf(src.el);
      src.box = b;                     /* what whisk() reads, once per frame */
      if (!b) continue;
      if (b.y > vh + 120 || b.y + b.h < -260) continue;
      busy = true;

      let st = null;
      if (src.def.bowl) {
        st = bowlOf(src.el);
        /* The pour is the section rising into the window; the ease is so that
           a bowl already on screen when the page opens is still poured rather
           than found full. */
        st.intro = Math.min(1, st.intro + dt / 900);
        const p = clamp((vh - b.y) / (vh * 0.62), 0, 1);
        const next = Math.min(p, st.intro);
        if (next - st.pour > 0.02 && st.ripples.length < 3) st.ripples.push({ t: 0 });
        st.pour = next;
        st.froth = Math.min(st.pour, st.froth * decay);
        st.spin *= Math.pow(0.985, dt / 16.67);
        drawBowl(src, b, st);
        if (st.froth > 0.01) busy = true;
      }
      drawSteam(src, b, st);
    }

    ctx.globalAlpha = 1;

    if (!lit) {
      lit = true;
      canvas.classList.add('is-lit');
      if (foam) foam.classList.add('is-lit');
    }

    const cost = performance.now() - started;
    slowCost = cost > SLOW_MS ? slowCost + 1 : 0;
    if (warm < WARMUP_FRAMES) warm++;
    else if (now - scrolledAt < SCROLL_GRACE) slowPeriod = 0;
    else slowPeriod = gap > PERIOD_MS ? slowPeriod + 1 : 0;
    if (slowCost >= SLOW_FRAMES || slowPeriod >= SLOW_FRAMES) { destroy(); return; }

    idle = busy ? 0 : idle + 1;
    if (idle > IDLE_FRAMES) sleep();
  }

  function onScroll() {
    scrolledAt = performance.now();
    wake();
  }

  function wake() {
    if (dead || raf) return;
    if (document.hidden) return;
    last = 0;
    idle = 0;
    slowCost = 0;
    slowPeriod = 0;
    raf = requestAnimationFrame(frame);
  }

  function sleep() {
    cancelAnimationFrame(raf);
    raf = 0;
    prep(ctx);
    if (fctx) prep(fctx);
  }

  function destroy() {
    dead = true;
    cancelAnimationFrame(raf);
    raf = 0;
    canvas.remove();
    if (foam) foam.remove();
    removeEventListener('pointermove', onMove);
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', wake);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  function onVisibility() {
    if (document.hidden) sleep(); else wake();
  }

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', wake);
  document.addEventListener('visibilitychange', onVisibility);

  scan();
  size();
  wake();

  return { destroy: destroy };
}
