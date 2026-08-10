# Deckle

A static site for a small cafe. Information only: no ordering, no bookings, no
cart, no accounts, no analytics, and no third-party request of any kind at
runtime.

Plain HTML, CSS and JavaScript. No framework, no build step, no npm
dependencies. Upload the repository to any static host and it works.

**If you run the cafe, you want [EDITING.md](EDITING.md).** This file is for
whoever maintains the code.

---

## What ships

```
index.html      home — the stateful hero
menu.html       the board
find-us.html    address, hours, getting here
404.html        locked to the closed state
style.css       one stylesheet
app.js          clock, state resolution, indicator, menu hydration
pigment.js      the WebGL2 layer, imported asynchronously by app.js
config.js       hours, timezone, address        ← owner-editable
menu.json       the board's contents            ← owner-editable
art/            plates, spots, paper, social cards (AVIF + WebP)
fonts/          two families, latin subset, woff2
robots.txt  sitemap.xml  favicon.svg  favicon.ico  apple-touch-icon.png
```

Not deployed: `src-art/` (the PNG masters), `tools/`, `EDITING.md`, `README.md`.

Relative paths throughout, so it will run from a subdirectory. The one thing to
change before going live is the domain: `https://deckle.cafe/` appears in the
canonical links, the Open Graph tags, `sitemap.xml`, `robots.txt` and the
JSON-LD `@id`.

## How it works

The home page is one hero component with four variants. `app.js` runs
synchronously in `<head>`, resolves the cafe's local hour with
`Intl.DateTimeFormat` in the timezone from `config.js`, and stamps
`data-state="morning|midday|late|closed"` on `<html>` before the first paint.
Every layout difference between the four is CSS keyed off that one attribute.

The plate for the resolved state is written by an inline script at the point in
the markup where it goes, so the browser fetches the painting for the hour you
actually arrived at and never one of the other three. Copy that depends on the
clock is written by `Deckle.paint()` from an inline call at the end of the
section it fills — filling it later would resize things after layout, and the
layout-shift budget here is zero.

`pigment.js` puts a WebGL2 canvas over the plate: a slow domain-warp so the
edges read as still drying, a pigment rim gated on the painting's own contours,
paper grain lit from the same direction as the light in that painting, and a
wet-in-wet bleed when the clock crosses an hour with the tab open. It never
runs on first load, under `prefers-reduced-motion`, on `saveData`, while the
tab is hidden or the hero is off screen, or when the machine cannot keep up —
in the last case it removes itself and leaves the static plate.

## Preview switches

Not linked from anywhere; for the owner and whoever is maintaining this.

- `?state=morning|midday|late|closed` forces the hero's appearance. The
  open/closed indicator deliberately ignores it and keeps answering the real
  clock, so it can never be made to claim the cafe is open when it is shut.
- `?t=2026-08-11T09:00` forces a moment, read as cafe wall-clock time. This one
  does move the indicator, because it moves the clock.

## Developer tools

Neither runs on deploy. The site still has no build step.

```
python3 tools/build-art.py        # src-art/*.png -> art/*.avif + *.webp
node tools/sync-static.mjs        # rewrite the derived blocks in the HTML
node tools/sync-static.mjs --check   # non-zero exit if anything is stale
```

`sync-static.mjs` regenerates the four regions marked `<!--gen:…-->` in the
HTML: the JSON-LD, the hours tables, the hours line in the footer, and the
board. `app.js` regenerates all of the same things at runtime from the same two
source files, so a visitor with JavaScript always sees current data; the static
copies exist so that a visitor without it, and a crawler that does not execute
scripts, sees the same thing rather than something stale. Run `--check` in CI
or a pre-commit hook after editing `config.js` or `menu.json`.

`build-art.py` needs Pillow with AVIF support (`pip install Pillow numpy`).

## Notes for the next person

- **Colour.** Four interface colours, written in Oklch so every interpolation
  the browser performs runs through Oklch rather than sRGB. Lichen, butter,
  blush, dusty blue and lavender grey exist inside the paintings only.
- **Marks.** Six, defined once as CSS mask images at the top of `style.css`.
  Swapping in hand-painted versions is six `url()`s and nothing else.
- **Fonts.** `font-display: optional` with both faces preloaded is the only
  combination that cannot shift layout. `font-synthesis: none` is global;
  Instrument Serif has no bold and must never be asked for one.
- **Spots.** Positioned against their own section, never the page, so adding an
  item to `menu.json` cannot move a painting. Short sections carry a
  `min-height` that clears their spot.
- **The masters.** `src-art/` holds the PNGs the site's images are made from.
  The spots are white-pointed at build time so `mix-blend-mode: multiply`
  leaves no rectangle on the page; when a spot is re-supplied as a transparent
  PNG, drop the elliptical mask for that image in `style.css`.
