/* pigment.js: developer territory. Loaded async by app.js, never on its own.
 *
 * A single WebGL2 canvas over the hero plate. It does three things and no
 * others: it keeps the edges of the painting looking wet, it bleeds one plate
 * into the next when the clock crosses an hour, and it lights the paper grain
 * from the same direction as the light in the painting. No text is ever
 * rendered here; every word on the page is a DOM element over the top.
 */

const VERT = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  v_uv = vec2(p.x, 1.0 - p.y);
}`;

const FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_plate;
uniform sampler2D u_platePrev;
uniform sampler2D u_paper;
uniform float u_time;
uniform float u_progress;
uniform vec2 u_light;
uniform vec2 u_res;
uniform float u_dpr;
uniform vec4 u_fit;        // screen uv -> plate uv, matching CSS object-fit:cover
uniform vec4 u_fitPrev;
uniform vec3 u_dark;       // darkest colour sampled from the incoming plate

in vec2 v_uv;
out vec4 frag;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

/* Colour is adjusted in Oklab. Pigment does not mix through grey. */
vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055,
             step(vec3(0.0031308), c));
}
vec3 oklab(vec3 c) {
  c = toLinear(c);
  vec3 lms = vec3(
    0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b,
    0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b,
    0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b);
  lms = pow(max(lms, 0.0), vec3(1.0 / 3.0));
  return vec3(
    0.2104542553 * lms.x + 0.7936177850 * lms.y - 0.0040720468 * lms.z,
    1.9779984951 * lms.x - 2.4285922050 * lms.y + 0.4505937099 * lms.z,
    0.0259040371 * lms.x + 0.7827717662 * lms.y - 0.8086757660 * lms.z);
}
vec3 unOklab(vec3 lab) {
  vec3 lms = vec3(
    lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z,
    lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z,
    lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z);
  lms = lms * lms * lms;
  vec3 c = vec3(
     4.0767416621 * lms.x - 3.3077115913 * lms.y + 0.2309699292 * lms.z,
    -1.2684380046 * lms.x + 2.6097574011 * lms.y - 0.3413193965 * lms.z,
    -0.0041960863 * lms.x - 0.7034186147 * lms.y + 1.7076147010 * lms.z);
  return clamp(toSrgb(c), 0.0, 1.0);
}

vec2 fitUV(vec2 uv, vec4 f) { return uv * f.xy - f.zw; }

void main() {
  vec2 aspect = vec2(u_res.x / u_res.y, 1.0);
  vec2 p = v_uv * aspect;

  /* a. Damp edge. Two octaves of simplex, walked around a circle in noise
     space so the loop is exactly periodic at 43 and 71 seconds and their
     beat is 51 minutes long, never legible. */
  vec2 c1 = vec2(cos(6.2831853 * u_time / 43.0), sin(6.2831853 * u_time / 43.0)) * 0.35;
  vec2 c2 = vec2(cos(6.2831853 * u_time / 71.0), sin(6.2831853 * u_time / 71.0)) * 0.22;
  vec2 w = vec2(snoise(p * 2.9 + c1), snoise(p * 2.9 + c1 + 19.7))
         + 0.5 * vec2(snoise(p * 6.1 + c2 - 7.3), snoise(p * 6.1 + c2 + 31.1));
  w /= 1.5;

  /* 0.0018 of viewport height, kept isotropic in pixels: about 1.5px at 900. */
  vec2 amp = vec2(0.0018 / aspect.x, 0.0018);
  vec2 duv = w * amp;

  vec3 col = texture(u_plate, fitUV(v_uv + duv, u_fit)).rgb;

  /* b. State bleed: a noise field thresholded by progress, wet into wet.
     The whole term is skipped when nothing is bleeding, because this is the fifth
     noise evaluation per pixel and it is only wanted for about a second an hour. */
  float fringe = 0.0;
  if (u_progress < 0.999) {
    float nb = snoise(p * 2.6 + 41.0) * 0.5 + 0.5;
    vec3 prev = texture(u_platePrev, fitUV(v_uv + duv, u_fitPrev)).rgb;
    col = mix(col, prev, smoothstep(u_progress - 0.08, u_progress + 0.08, nb));
    /* Three pixels of the advancing edge, measured in noise units. */
    fringe = 1.0 - smoothstep(0.0, fwidth(nb) * 3.0, abs(nb - u_progress));
  }

  vec3 lab = oklab(col);

  /* The pigment rim. Where the warp compresses the surface, paint piles up and
     darkens by up to 0.06 of L. Gated on the painting's own contours: the
     divergence of a smooth noise field is itself smooth, so ungated this would
     bloom across every flat wash instead of catching on edges, and it is the
     catching on edges that reads as watercolour rather than as a wobble. */
  float compress = -(dFdx(w.x) + dFdy(w.y));
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float contour = smoothstep(0.004, 0.055, length(vec2(dFdx(lum), dFdy(lum))));
  lab.x -= 0.06 * clamp(compress * 220.0, 0.0, 1.0) * contour;

  /* c. Paper relief. The height map is grain only; the light direction is the
     one in this state's painting. Mixed in at 0.08. */
  vec2 pt = v_uv * (u_res / u_dpr) / 210.0;
  float e = 1.0 / 256.0;
  float hL = texture(u_paper, pt - vec2(e, 0.0)).r;
  float hR = texture(u_paper, pt + vec2(e, 0.0)).r;
  float hD = texture(u_paper, pt - vec2(0.0, e)).r;
  float hU = texture(u_paper, pt + vec2(0.0, e)).r;
  vec3 n = normalize(vec3((hL - hR) * 2.4, (hD - hU) * 2.4, 1.0));
  float lam = clamp(dot(n, normalize(vec3(u_light, 0.62))), 0.0, 1.0);
  lab.x += (lam - 0.5) * 0.08;

  col = unOklab(lab);

  /* The advancing edge carries a fringe of the incoming plate's darkest
     colour, the way a wet edge pulls pigment along with it. */
  col = mix(col, col * u_dark, 0.25 * fringe);

  frag = vec4(col, 1.0);
}`;

/* Light directions, one per state, matched to the light in that plate:
   morning from the left, midday from overhead, late from the right, closed
   from the lit window in the middle of the frame. */
const LIGHT = {
  morning: [-0.88, 0.24],
  midday: [0.0, 1.0],
  late: [0.88, 0.22],
  closed: [-0.06, 0.46]
};

const DPR_CAP = 1.75;
const SCALE = 0.75;         /* render small and upsample; watercolour hides it */
const BLEED_MS = 1100;

/* Two ways of noticing that this is too expensive for the machine it landed on.
   SLOW_MS is our own JavaScript cost, which catches a CPU-bound page. It cannot
   see the fragment shader, because drawArrays returns long before the GPU has
   finished, so PERIOD_MS watches the gap between animation frames instead: we
   are the only thing moving on this page, and if frames are arriving slower
   than about 36 a second then we are the reason. Either one, for thirty frames
   running, and the layer takes itself off the page. */
const SLOW_MS = 12;
const PERIOD_MS = 28;
const SLOW_FRAMES = 30;
const WARMUP_FRAMES = 10;   /* shader compile and texture upload are not a verdict */

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

function texture(gl, unit, wrap) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([242, 237, 224, 255]));
  return t;
}

function upload(gl, unit, tex, img) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
}

/* CSS object-fit:cover, worked out for the shader so the canvas lines up with
   the <img> underneath it to the pixel and the fade-in is invisible. */
function fit(img, cw, ch) {
  const iw = img.naturalWidth || 1376;
  const ih = img.naturalHeight || 768;
  const pos = getComputedStyle(img).objectPosition.split(' ');
  const at = (v) => {
    if (!v) return 0.5;
    if (v.endsWith('%')) return parseFloat(v) / 100;
    return { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 }[v] ?? 0.5;
  };
  const px = at(pos[0]);
  const py = at(pos[1] === undefined ? '50%' : pos[1]);

  const s = Math.max(cw / iw, ch / ih);
  const dw = iw * s, dh = ih * s;
  const ox = (cw - dw) * px, oy = (ch - dh) * py;
  return [cw / dw, ch / dh, ox / dw, oy / dh];
}

/* The darkest colour in the incoming plate, for the wet edge's fringe. */
function darkest(img) {
  try {
    const c = document.createElement('canvas');
    c.width = 24; c.height = 14;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, 24, 14);
    const d = x.getImageData(0, 0, 24, 14).data;
    let best = [0.3, 0.3, 0.3], lo = 1e9;
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      if (v < lo) { lo = v; best = [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]; }
    }
    /* Multiplying by pure black would punch a hole; lift it toward the paint. */
    return best.map((v) => Math.min(1, v * 0.6 + 0.34));
  } catch (e) {
    return [0.62, 0.6, 0.55];
  }
}

export function start(canvas, opts) {
  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: false, stencil: false,
    powerPreference: 'low-power', preserveDrawingBuffer: false
  });
  if (!gl) { canvas.remove(); return null; }

  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    canvas.remove();
    return null;
  }
  gl.useProgram(prog);

  const U = {};
  for (const n of ['u_plate', 'u_platePrev', 'u_paper', 'u_time', 'u_progress',
                   'u_light', 'u_res', 'u_dpr', 'u_fit', 'u_fitPrev', 'u_dark']) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  const texPlate = texture(gl, 0, gl.CLAMP_TO_EDGE);
  const texPrev = texture(gl, 1, gl.CLAMP_TO_EDGE);
  const texPaper = texture(gl, 2, gl.REPEAT);
  gl.uniform1i(U.u_plate, 0);
  gl.uniform1i(U.u_platePrev, 1);
  gl.uniform1i(U.u_paper, 2);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  let img = opts.plate;
  let state = opts.state;
  let dark = [0.62, 0.6, 0.55];
  let progress = 1;
  let bleedFrom = 0;
  let fitNow = [1, 1, 0, 0];
  let fitPrev = [1, 1, 0, 0];
  let dpr = 1;
  let elapsed = 0;          /* only advances while we are actually drawing */
  let last = 0;
  let slowCost = 0;
  let slowPeriod = 0;
  let warm = 0;
  let raf = 0;
  let lit = false;
  let dead = false;
  let visible = true;
  let ready = false;

  function size() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const w = Math.max(2, Math.round(r.width * dpr * SCALE));
    const h = Math.max(2, Math.round(r.height * dpr * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    if (img) fitNow = fit(img, r.width, r.height);
  }

  function useImage(next) {
    if (!next) return;
    img = next;
    upload(gl, 0, texPlate, img);
    dark = darkest(img);
    size();
    ready = true;
  }

  function whenReady(el, fn) {
    if (!el) return;
    if (el.complete && el.naturalWidth) fn();
    else el.addEventListener('load', fn, { once: true });
  }

  whenReady(img, () => useImage(img));

  const paper = new Image();
  paper.decoding = 'async';
  paper.onload = () => { upload(gl, 2, texPaper, paper); };
  paper.onerror = () => { /* relief simply stays flat */ };
  paper.src = opts.paper;

  function stop(remove) {
    cancelAnimationFrame(raf);
    raf = 0;
    if (remove) {
      dead = true;
      /* Freeze on the frame we have, then take the canvas away and let the
         static plate underneath carry the hero. Never stutter twice. */
      canvas.remove();
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!ready) return;

    const gap = last ? now - last : 0;
    last = now;
    elapsed += Math.min(gap || 16, 100) / 1000;

    if (progress < 1) {
      const t = Math.min(1, (now - bleedFrom) / BLEED_MS);
      /* ease-in-out */
      progress = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      if (t >= 1) progress = 1;
    }

    gl.uniform1f(U.u_time, elapsed);
    gl.uniform1f(U.u_progress, progress);
    gl.uniform2f(U.u_res, canvas.width, canvas.height);
    gl.uniform1f(U.u_dpr, dpr * SCALE);
    gl.uniform2fv(U.u_light, LIGHT[state] || LIGHT.midday);
    gl.uniform4fv(U.u_fit, fitNow);
    gl.uniform4fv(U.u_fitPrev, fitPrev);
    gl.uniform3fv(U.u_dark, dark);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (!lit) {
      lit = true;
      canvas.classList.add('is-lit');
    }

    const cost = performance.now() - now;
    slowCost = cost > SLOW_MS ? slowCost + 1 : 0;
    if (warm < WARMUP_FRAMES) warm++;
    else slowPeriod = gap > PERIOD_MS ? slowPeriod + 1 : 0;
    if (slowCost >= SLOW_FRAMES || slowPeriod >= SLOW_FRAMES) stop(true);
  }

  function play() {
    if (dead || raf) return;
    if (document.hidden || !visible) return;
    last = 0;
    slowPeriod = 0;
    slowCost = 0;
    raf = requestAnimationFrame(frame);
  }

  /* Pause conditions: tab hidden, hero scrolled away, or a resize in flight. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(false); else play();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) play(); else stop(false);
    }, { threshold: 0 }).observe(canvas.parentElement || canvas);
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => { if (!dead) size(); }).observe(canvas);
  } else {
    window.addEventListener('resize', () => { if (!dead) size(); });
  }

  size();
  play();

  return {
    /* Called by app.js before the <img> src changes, while the element still
       holds the outgoing painting. The same element is reused, so the copy
       has to be taken first. */
    snapshot() {
      if (dead || !img || !ready) return false;
      upload(gl, 1, texPrev, img);
      fitPrev = fitNow.slice();
      return true;
    },

    /* Never called on first load: the site opens as a still image and only
       breathes once you are watching it. */
    bleed(nextImg, nextState, haveSnapshot) {
      if (dead) return;
      state = nextState;
      whenReady(nextImg, () => {
        useImage(nextImg);
        if (!haveSnapshot || document.hidden || !visible) { progress = 1; return; }
        progress = 0;
        bleedFrom = performance.now();
        play();
      });
    },

    setState(nextState, nextImg) {
      if (dead) return;
      state = nextState;
      whenReady(nextImg, () => { useImage(nextImg); progress = 1; });
    }
  };
}
