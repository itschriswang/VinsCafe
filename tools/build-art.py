#!/usr/bin/env python3
"""Developer tool — NOT part of the deployed site and NOT owner-editable.

Reads the watercolour PNG masters in src-art/ and writes the AVIF + WebP
derivatives the site actually ships, into art/.

    python3 tools/build-art.py

Nothing here runs at request time. The site itself has no build step; this
script exists only so the art in art/ can be regenerated from the masters
if a painting is re-supplied.

Requires: Pillow with AVIF + WebP support.
"""

import os

from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src-art")
OUT = os.path.join(ROOT, "art")

# AVIF is the primary format; WebP is the fallback for the handful of
# browsers without AVIF. Watercolour is low-frequency and survives AVIF at
# modest quality far better than it survives being downscaled twice, so
# quality stays high and dimensions do the budget work.
AVIF_Q = 62
AVIF_SPEED = 4
WEBP_Q = 74

# Plate masters are 1376x768. The spec asks for 1600w and 2400w; there is no
# real detail above 1376 to give, and upscaling would spend the byte budget
# on invented pixels. Native width plus one small step is what ships.
PLATE_WIDTHS = [960, 1376]

# Spots are placed at fixed pixel widths, so each one only needs 1x and 2x of
# its own largest display width. Widths come straight from the menu comp.
SPOTS = {
    "spot-cup": 330,          # Coffee, first spot
    "spot-espresso": 200,     # Coffee, second spot
    "spot-teapot": 270,       # Tea
    "spot-beans": 200,        # Take home
    "spot-croissant": 320,    # Kitchen, first spot
    "spot-toast": 220,        # Kitchen, second spot
    "spot-cake": 300,         # Sweet
    "spot-coldbrew": 220,     # Cold, first spot   (mobile is the wider of the two)
    "spot-matcha": 280,       # Cold, second spot
    "spot-flatwhite": 380,    # Find us, margin
}

PLATES = ["hero-morning", "hero-midday", "hero-lateafternoon", "hero-closed"]


def emit(im, stem, width):
    """Write one AVIF + one WebP at the given width. Returns (w, h, bytes)."""
    h = round(im.height * width / im.width)
    r = im.resize((width, h), Image.LANCZOS)
    a = os.path.join(OUT, "%s-%dw.avif" % (stem, width))
    w = os.path.join(OUT, "%s-%dw.webp" % (stem, width))
    r.save(a, format="AVIF", quality=AVIF_Q, speed=AVIF_SPEED)
    r.save(w, format="WEBP", quality=WEBP_Q, method=6)
    return width, h, os.path.getsize(a), os.path.getsize(w)


def flatten(path):
    """Masters are RGBA over nothing; composite onto paper cream so the
    scans' white margins stay white rather than going transparent."""
    im = Image.open(path)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, (242, 237, 224, 255))
        im = Image.alpha_composite(bg, im)
    return im.convert("RGB")


def _flat_field(a):
    """Divide out the scanner's illumination so the paper is uniformly white.

    A single global white point is not enough: every one of these scans is
    brighter in the middle than at the edges, and the residue of that is a soft
    dark rectangle round each illustration once it is multiplied onto the page.
    Estimating the paper brightness per region — a high percentile over coarse
    blocks, smoothed — removes the gradient without touching the paint, which
    is far below that percentile everywhere.
    """
    import numpy as np

    h, w, _ = a.shape
    bh, bw = max(1, h // 18), max(1, w // 18)
    ny, nx = h // bh, w // bw
    crop = a[:ny * bh, :nx * bw]
    blocks = crop.reshape(ny, bh, nx, bw, 3)
    field = np.percentile(blocks, 92, axis=(1, 3))              # ny x nx x 3
    field = np.array(
        Image.fromarray(np.clip(field, 1, 255).astype("uint8"), "RGB")
        .resize((w, h), Image.BICUBIC)
        .filter(ImageFilter.GaussianBlur(max(w, h) / 40.0)),
        dtype=np.float32,
    )
    return np.clip(a / np.maximum(field, 1.0) * 255.0, 0, 255)


def _sheet_inset(flat):
    """How far in from each edge the painted sheet's own torn border reaches.

    Several of these are scans of a whole small sheet, so the deckle edge sits
    inside the frame and reads on the page as a hard straight line across the
    illustration. Walk in from each side until the rows stop containing dark
    pixels; that is where the paper proper begins.
    """
    dark = flat.min(axis=2) < 236
    h, w = dark.shape
    out = []
    for axis_len, profile in ((h, dark.mean(axis=1)), (w, dark.mean(axis=0))):
        limit = int(axis_len * 0.14)

        def walk(index):
            """Inward from one edge, looking only for a line that runs most of
            the way across. The torn edge of the sheet does; a painting that
            happens to reach into the margin does not, and must not be cut."""
            last = -1
            for i in range(limit):
                if profile[index(i)] > 0.45:
                    last = i
            return min(last + 4, limit) if last >= 0 else 0

        out.append((walk(lambda i: i), walk(lambda i: axis_len - 1 - i)))
    return out[0], out[1]                                        # (top, bottom), (left, right)


def spot_matte(im, feather=0.07):
    """Turn a watercolour scan into artwork with a real alpha channel.

    The brief's stopgap was a fixed elliptical mask over the whole scan, with a
    note that a transparent image is the intended end state. This is that end
    state, derived rather than re-painted: flat-field the paper, trim the
    sheet's border, then take alpha from how far each pixel departs from white.

    The colour channels are un-multiplied against white so that the image still
    behaves as pigment — laid over the page with mix-blend-mode:multiply, the
    painted parts darken the paper and the unpainted parts do nothing at all.
    No mask, so nothing gets clipped, and no box, so nothing needs hiding.
    """
    import numpy as np

    flat = _flat_field(np.asarray(im, dtype=np.float32))
    (top, bottom), (left, right) = _sheet_inset(flat)
    h, w, _ = flat.shape
    flat = flat[top:h - bottom, left:w - right]
    h, w, _ = flat.shape

    # Flat-fielding evens the paper out but leaves it a couple of levels below
    # white; put the white point exactly on it, since the 95th percentile of an
    # evened scan is paper by definition.
    flat = np.clip(flat * (255.0 / max(float(np.percentile(flat, 95)), 1.0)), 0, 255)

    lo = flat.min(axis=2)
    raw = 1.0 - lo / 255.0                                       # 0 on paper, 1 on ink

    # Colour that reproduces the scan when composited back over white.
    denom = np.maximum(raw, 1e-3)[:, :, None]
    colour = np.clip((flat - lo[:, :, None]) / denom, 0, 255)
    colour = np.where(raw[:, :, None] > 1e-3, colour, 255.0)

    # The tooth of the paper is not artwork. Left in at one or two per cent it
    # is still legible as a grainy panel round every illustration, which is the
    # rectangle the elliptical mask was there to hide. Gate it out; paint above
    # the gate keeps its exact value.
    t = np.clip((raw - 0.035) / 0.075, 0.0, 1.0)
    alpha = raw * (t * t * (3.0 - 2.0 * t))

    # A soft edge on the asset rather than a mask on the element: the ramp is
    # measured from the trimmed sheet, so it can never cut into the painting.
    def ramp(n):
        i = np.arange(n, dtype=np.float32)
        d = np.minimum(i, n - 1 - i) / max(1.0, feather * n)
        d = np.clip(d, 0.0, 1.0)
        return d * d * (3.0 - 2.0 * d)
    alpha *= ramp(h)[:, None] * ramp(w)[None, :]

    alpha = _drop_backdrop(alpha)

    rgba = np.dstack([colour, alpha * 255.0])
    return Image.fromarray(np.clip(rgba, 0, 255).astype("uint8"), "RGBA")


def _drop_backdrop(alpha):
    """Lose the square of wash several of these were painted on.

    That backdrop is what reads on the page as a box, and losing it is the
    whole job the brief gave the elliptical mask. A shape cannot do it: a
    fixed ellipse knows nothing about where the subject is, and even one
    measured from the subject's extent keeps whatever wash falls inside that
    radius — which for the espresso and the teapot is all of it.

    Density can do it. Blur the alpha heavily and the subject stays high while
    a broad thin wash stays low, because the wash is thin everywhere and the
    subject is not. Threshold that, relative to each painting's own density so
    a pale subject is not mistaken for a backdrop, and use it to decide what is
    drawing and what is the sheet it was drawn on. The result keeps a soft
    halo of wash against the subject, which is what a painting looks like, and
    drops it well before any edge, which is what the page needs.
    """
    import numpy as np

    h, w = alpha.shape
    a8 = Image.fromarray(np.clip(alpha * 255.0, 0, 255).astype("uint8"), "L")
    core = np.asarray(
        a8.filter(ImageFilter.GaussianBlur(min(h, w) / 26.0)), dtype=np.float32
    ) / 255.0

    peak = float(np.percentile(core, 99.8))
    if peak < 0.06:                      # nothing solid here; leave it alone
        return alpha
    lo_t, hi_t = 0.18 * peak, 0.42 * peak
    keep = np.clip((core - lo_t) / max(hi_t - lo_t, 1e-4), 0.0, 1.0)
    keep = keep * keep * (3.0 - 2.0 * keep)

    # Density alone would cut a rim, a handle or an outline stroke, because a
    # thin line has almost no neighbourhood density however dark it is. So keep
    # anything that is plainly pigment on its own account as well. A backdrop
    # wash sits far below this; a drawn line sits far above it.
    own = np.clip((alpha - 0.13) / 0.19, 0.0, 1.0)
    keep = np.maximum(keep, own * own * (3.0 - 2.0 * own))

    # Soften the decision so the subject's own cast shadow and the wash right
    # against it survive, and nothing acquires a cut-out edge.
    keep = np.asarray(
        Image.fromarray(np.clip(keep * 255.0, 0, 255).astype("uint8"), "L")
        .filter(ImageFilter.GaussianBlur(min(h, w) / 60.0)),
        dtype=np.float32,
    ) / 255.0

    # Gating the backdrop also thins the soft outer washes a painting is
    # entitled to — a cast shadow, the bloom round a wet edge. A small gain
    # gives that weight back. It cannot resurrect the backdrop, which the gate
    # has already multiplied to nothing.
    return np.clip(alpha * keep * 1.15, 0.0, 1.0)


def paper_field(im, inset=0.085):
    """The middle of the paper scan, with the deckle edges cropped away.

    The strip in the hero is a plane of paper for type to sit on. The torn
    edges of the sheet read as a seam across the page wherever the crop lands,
    so only the even wash in the middle of the sheet ships.
    """
    w, h = im.size
    dx, dy = int(w * inset), int(h * inset)
    return im.crop((dx, dy, w - dx, h - dy))


def seamless_grey(im, size=512):
    """A tiling greyscale height map for the shader's paper relief.

    Two things have to be true of this tile. It must be grain and nothing
    else — the scan carries a broad vignette and a cold wash, and a normal
    derived from those would light the page like a dome instead of like
    paper — and it must wrap exactly, because the shader tiles it.

    So: crop the centre (the deckle edge would tile as a hard seam),
    high-pass to throw away everything but the tooth of the paper, then
    build the tile as one quadrant mirrored into four. Mirroring is
    symmetrical by construction, which is the price of a guaranteed wrap;
    at 0.08 relief mix on grain this reads as paper, not as a pattern.
    """
    import numpy as np

    w, h = im.size
    s = min(w, h) * 3 // 4
    q = size // 2
    quad = (
        im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
        .convert("L")
        .resize((q, q), Image.LANCZOS)
    )

    # High pass: subtract the local average, keep the tooth.
    a = np.asarray(quad, dtype=np.float32)
    low = np.asarray(quad.filter(ImageFilter.GaussianBlur(q / 24.0)), dtype=np.float32)
    hp = a - low

    # Normalise to a predictable amplitude so the shader's 0.08 mix means the
    # same thing whatever paper is scanned next.
    sd = float(hp.std()) or 1.0
    hp = np.clip(128.0 + hp * (26.0 / sd), 0, 255).astype(np.uint8)

    tile = np.empty((size, size), dtype=np.uint8)
    tile[:q, :q] = hp
    tile[:q, q:] = hp[:, ::-1]
    tile[q:, :q] = hp[::-1, :]
    tile[q:, q:] = hp[::-1, ::-1]
    return Image.fromarray(tile, "L")


def og(stem, dst, crop=(0.5, 0.5)):
    """1200x630 social card cut from a painting. No type baked in."""
    im = flatten(os.path.join(SRC, stem + ".png"))
    tw, th = 1200, 630
    scale = max(tw / im.width, th / im.height)
    r = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    x = int((r.width - tw) * crop[0])
    y = int((r.height - th) * crop[1])
    r.crop((x, y, x + tw, y + th)).save(
        os.path.join(OUT, dst), format="JPEG", quality=82, optimize=True, progressive=True
    )
    return os.path.getsize(os.path.join(OUT, dst))


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0

    print("plates")
    for stem in PLATES:
        im = flatten(os.path.join(SRC, stem + ".png"))
        for width in PLATE_WIDTHS:
            w, h, a, wb = emit(im, stem, width)
            total += a
            print("  %-22s %4dx%-4d avif %6.1fkB  webp %6.1fkB" % (stem, w, h, a / 1024, wb / 1024))

    print("spots")
    ratios = []
    for stem, display in sorted(SPOTS.items()):
        im = spot_matte(flatten(os.path.join(SRC, stem + ".png")))
        for width in (display, display * 2):
            w, h, a, wb = emit(im, stem, width)
            total += a
            if width == display:
                ratios.append((stem, w, h))
            print("  %-22s %4dx%-4d avif %6.1fkB  webp %6.1fkB" % (stem, w, h, a / 1024, wb / 1024))
    print("\n  intrinsic sizes for the SPOTS tables in app.js and tools/sync-static.mjs:")
    for stem, w, h in ratios:
        print("    %-16s w: %3d, h: %3d" % ("'" + stem + "':", w, h))

    print("paper")
    paper_master = flatten(os.path.join(SRC, "tex-paper.png"))
    paper = paper_field(paper_master)
    for width in (900, 1376):
        w, h, a, wb = emit(paper, "tex-paper", width)
        total += a
        print("  %-22s %4dx%-4d avif %6.1fkB  webp %6.1fkB" % ("tex-paper", w, h, a / 1024, wb / 1024))

    # Grain is the worst case for any codec, so the height map is small and
    # tiled often rather than large and tiled once. 256 at q55 is the knee of
    # the curve: 512 costs four times as much for relief nobody can see.
    tile = seamless_grey(paper_master, 256)
    tile.save(os.path.join(OUT, "tex-paper-height.avif"), format="AVIF", quality=55, speed=AVIF_SPEED)
    tile.save(os.path.join(OUT, "tex-paper-height.webp"), format="WEBP", quality=72, method=6)
    total += os.path.getsize(os.path.join(OUT, "tex-paper-height.avif"))
    print("  %-22s  256x256  avif %6.1fkB" % ("tex-paper-height", os.path.getsize(os.path.join(OUT, "tex-paper-height.avif")) / 1024))

    print("social")
    print("  og-home    %6.1fkB" % (og("hero-midday", "og-home.jpg", (0.5, 0.88)) / 1024))
    print("  og-menu    %6.1fkB" % (og("spot-cup", "og-menu.jpg", (0.5, 0.5)) / 1024))
    print("  og-find-us %6.1fkB" % (og("hero-lateafternoon", "og-find-us.jpg", (0.78, 0.5)) / 1024))

    print("icons")
    icons()

    print("\nart/ total avif bytes: %.1f kB" % (total / 1024))


def icons():
    """The favicon is the note mark — the six-ray sun — drawn to the same
    geometry as the inline SVG sprite so the tab matches the page."""
    from PIL import ImageDraw

    def draw(size):
        ss = 8  # supersample, then downscale: no antialiasing primitives in PIL
        im = Image.new("RGB", (size * ss, size * ss), (242, 237, 224))
        d = ImageDraw.Draw(im)
        u = size * ss / 26.0                      # sprite units -> pixels
        w = max(1, round(1.9 * u))                # a touch heavier than the 1.4 sprite stroke
        rays = (
            ((13, 2.6), (13, 23.4)),
            ((3.8, 7.8), (22.2, 18.2)),
            ((22.2, 7.8), (3.8, 18.2)),
        )
        for (x1, y1), (x2, y2) in rays:
            d.line((x1 * u, y1 * u, x2 * u, y2 * u), fill=(232, 105, 92), width=w)
        return im.resize((size, size), Image.LANCZOS)

    draw(180).save(os.path.join(ROOT, "apple-touch-icon.png"), optimize=True)
    ico = draw(64)
    ico.save(os.path.join(ROOT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    print("  apple-touch-icon.png %5.1fkB   favicon.ico %5.1fkB" % (
        os.path.getsize(os.path.join(ROOT, "apple-touch-icon.png")) / 1024,
        os.path.getsize(os.path.join(ROOT, "favicon.ico")) / 1024,
    ))


if __name__ == "__main__":
    main()
