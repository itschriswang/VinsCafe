# Gam Sia

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
index.html      home: the stateful hero
menu.html       the board
find-us.html    address, hours, getting here
404.html        locked to the closed state
style.css       one stylesheet
app.js          clock, state resolution, indicator, menu hydration
pigment.js      the WebGL2 layer, imported asynchronously by app.js
wash.js         the wet layer over the board, imported the same way
config.js       hours, timezone, address        ← owner-editable
menu.json       the board's contents            ← owner-editable
art/            plates, spots, paper, social cards (AVIF + WebP)
fonts/          two families, latin subset, woff2
robots.txt  sitemap.xml  favicon.svg  favicon.ico  apple-touch-icon.png
```

Not deployed: `src-art/` (the PNG masters), `tools/`, `.github/`, `EDITING.md`,
`README.md`.

## Deploying

Live at **https://itschriswang.github.io/VinsCafe/**, published by
`.github/workflows/pages.yml` on every push to `main`. The workflow checks that
the derived blocks are current, copies the files listed above into `_site` and
hands that to GitHub Pages. Nothing is compiled; the deployed files are the
files in this repository.

Every asset path is relative, so the site also runs from any subdirectory, from
`file://`, or from any other static host; copy the same list of files up.

The absolute site URL is written down once, as `url` in `config.js`. The
canonical links, the Open Graph tags, the JSON-LD, `sitemap.xml` and
`robots.txt` are all generated from it. To move to a custom domain:

```sh
# edit config.js:  url: 'https://gamsia.cafe/'
node tools/sync-static.mjs
echo 'gamsia.cafe' > CNAME     # and add CNAME to the cp list in the workflow
```

It used to be 22 copies of the string across three heads, `sitemap.xml` and
`robots.txt`. Renaming the repository pointed every one of them at a 404
(canonicals, social cards and the search-engine data) with nothing failing
loudly. `--check` now catches it.

## How it works

The home page is one hero component with four variants. `app.js` runs
synchronously in `<head>`, resolves the cafe's local hour with
`Intl.DateTimeFormat` in the timezone from `config.js`, and stamps
`data-state="morning|midday|late|closed"` on `<html>` before the first paint.
Every layout difference between the four is CSS keyed off that one attribute.

The plate for the resolved state is written by an inline script at the point in
the markup where it goes, so the browser fetches the painting for the hour you
actually arrived at and never one of the other three. Copy that depends on the
clock is written by `GamSia.paint()` from an inline call at the end of the
section it fills; filling it later would resize things after layout, and the
layout-shift budget here is zero.

`pigment.js` puts a WebGL2 canvas over the plate: a slow domain-warp so the
edges read as still drying, a pigment rim gated on the painting's own contours,
paper grain lit from the same direction as the light in that painting, and a
wet-in-wet bleed when the clock crosses an hour with the tab open. It never
runs on first load, under `prefers-reduced-motion`, on `saveData`, while the
tab is hidden or the hero is off screen, or when the machine cannot keep up;
in the last case it removes itself and leaves the static plate.

`wash.js` is the same idea over the rest of the site, in 2D. It carries four
things and no others: a damp trail under the pointer on the paper surfaces
that dries back to cream in about two seconds, the matcha bowl filling as its
section rises into the window, a foam raised on it by circling the pointer over
it, and steam off the paintings of hot things, thick in the morning and thin
while the room is shut, shouldered aside by the pointer. It is gated exactly
like the pigment layer and it builds its own canvases, so a browser that never
reaches it is a page with nothing missing.

Everything on it is pigment. Steam is a pale cool wash multiplied into the
paper, which is how it is put down in watercolour and not how it is done in
CSS; laying white over the top would be a veil across the board's type. The one
mark that has to lighten rather than darken is the whisked foam, and it gets a
second canvas of its own, built only where a bowl is and only ever drawn inside
one, so nothing else on the page is screened.

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
python3 tools/build-art.py           # src-art/*.png -> art/*.avif + *.webp
node tools/sync-static.mjs           # rewrite the derived blocks in the HTML
node tools/sync-static.mjs --check   # non-zero exit if anything is stale
node tools/build-og.mjs              # typeset the social cards -> art/og-*.jpg
node tools/check-contrast.mjs        # measure type contrast on every state ground
```

`sync-static.mjs` regenerates the regions marked `<!--gen:…-->` in the
HTML (the JSON-LD, the breadcrumb lists, the hours tables, the hours line in
the footer, and the board) plus the 404's `<base>`, `sitemap.xml` and
`robots.txt`. `app.js` regenerates the clock-dependent ones at runtime from the same two
source files, so a visitor with JavaScript always sees current data; the static
copies exist so that a visitor without it, and a crawler that does not execute
scripts, sees the same thing rather than something stale. Run `--check` in CI
or a pre-commit hook after editing `config.js` or `menu.json`.

`check-contrast.mjs` renders each state, hides the glyphs, and measures the
WCAG ratio of every pixel actually behind each piece of type; the grounds here
are paintings, so no static value can tell you whether a word is legible. It
reports the worst pixel, not the average. Run it after touching the paper strip,
the plate positions or the pigment layer. It needs the site served locally and
`npm i --no-save playwright`.

`build-og.mjs` typesets the three social share cards in a real browser with
the site's own stylesheet: the palette, both faces, the squiggle and the paper
are read from `style.css`, and the words (headline, prices, hours, address)
are read live from the pages, `menu.json` and `config.js`. Nothing on a card
is written down in the tool, so **any UI or copy change means re-running it**
and committing the JPEGs; the cards cannot update themselves. It needs the
same `npm i --no-save playwright` as `check-contrast.mjs`.

`build-art.py` needs Pillow with AVIF support (`pip install Pillow numpy`).

## Notes for the next person

- **The home page is not just the hero.** The cafe opens one morning a week,
  so a hero that only says "closed" is the page essentially every visitor
  sees. The closed hero leads with what the place is and puts the
  reopening in the subhead, and every state carries a short board preview
  underneath: the two sections of `menu.json` that have a `standfirst`, four
  items each. This departs from the brief's "hero, then nothing".
- **Nothing about the week is written down twice.** The hours table starts on
  the first open day; the three daylight states are thirds of whatever the open
  day is; the late eyebrow reads the closing hour. All of it from `config.js`.
  Fixed 7/11/15 bands and a hardcoded Wed-first week were fine for a nine-hour
  Wednesday-to-Sunday cafe and wrong the moment it became a six-hour Sunday:
  the late-afternoon painting could no longer occur at all, and the one open
  day sat buried between two runs of "Closed".
- **Sections are not named in code.** Their order on the board, which column
  they fall in, which side their paintings hang on and how high all derive
  from a section's index in `menu.json`, carried into the markup as `--i`.
  These used to be lists of slugs in the stylesheet, so renaming Kitchen to
  Desserts sent it to the top of the phone board and dropped a teapot on top
  of Coffee's prices.
- **The type carries its own paper.** Each hero's copy sits on a wash sized by
  the copy itself (`.hero-type::before`), not on the fixed `.strip`. The strip
  is a percentage of the hero while the copy is however many lines someone
  writes, so a longer headline or one extra line of body used to push type onto
  bare painting, measured at 1.88:1. The wash is an ellipse inscribed in its
  own box so the fade reaches zero before the element clips; sized any larger
  you get a faint seam down the painting where the mask is cut off.
- **The phone gets the same composition, not a cut-down one.** Plate, then the
  paper sheet laid over its foot carrying all four states' type. It used to be
  an image band with the copy stacked underneath on flat cream, which read as a
  newsletter. The nav is a second row under the wordmark: it was `display:none`
  below 720px, which left the menu reachable only by scrolling the whole hero,
  and unreachable from the closed hero, the one most visitors land on.

- **The wash measures, it does not repeat the CSS.** Every box `wash.js` draws
  into comes off the painting's live offset box and its computed transform, not
  off the rules that place it. The spots change width at three breakpoints,
  swap sides on a phone and tilt further on hover; a copy of any of that in the
  module would be a second place to update and a silent way to put tea beside a
  bowl instead of in it. `getBoundingClientRect` is not enough on its own,
  because it reports the upright rectangle around a tilted painting.
- **Nothing in the module is named after a menu section.** The bowl is found by
  its painting, `.spot--matcha`, never by `[data-sec="matcha"]`: section slugs
  come out of `menu.json`, which the owner edits, and renaming Matcha would
  have quietly taken the pour with it. Sources are re-queried every half second
  so a board rebuilt from `menu.json` picks straight back up.
- **The hero sits above the wash** (`.hero { z-index: 3 }`) because the wash
  paints on the board and the preview and never inside the hero, so it should
  not composite there either. On the board, where there is no WebGL underneath,
  a fully soaked damp trail costs the type 8.93:1 to 8.90:1 and nothing else.
- **`check-contrast.mjs` was wrong in two ways, and both produced ghosts.**

  It sampled *one frame of a moving picture*. `pigment.js` warps the damp edge
  continuously, so the darkest pixel inside a target is not a fixed quantity,
  and a single screenshot reported PASS or FAIL for identical code depending on
  when it landed. Three runs either side of a change looked like a clean signal
  and were not — that is how the wash layer briefly got blamed for a hero
  contrast drop it had nothing to do with. It now samples several frames per
  target and keeps the worst, which is what this file already claimed to do.

  It also measured *the bounding box rather than the letters*. A two-line
  italic headline at 130px is mostly empty paper, and one dark corner of the
  painting inside that rectangle failed the check with no glyph near it: the
  midday headline at 1440 read 2.42:1 against a 3.0 bar that way, on `main`,
  for years. The tool now takes a glyph mask first — still the pigment layer,
  screenshot the type, screenshot it transparent, and the pixels that changed
  are the type — then measures the ground only there.

  With both fixed, every hero target clears AA on every state ground with
  headroom; the tightest is the morning headline at 1440, 3.43:1 against 3.0.
  Neither ghost was ever a real defect on the page. Both were the safety net
  lying, which is worse.
- **A canvas is a replaced element.** Pinned on all four sides with an auto
  width it takes the size of its backing store and ignores the far edges, which
  draws the whole layer at the render scale in the top left corner. Both
  `.pigment` and `.wash` state `width` and `height` for that reason.
- **Colour.** Four interface colours — paper, ink, pine and the sun — and then
  a set that only ever tints: butter, blush, rose, dusty blue, moss, and five
  sampled off a pair of gouache landscapes (lichen, lavender, clay, peony,
  amber). Nothing in the second set carries type, which is why none of it has
  a contrast floor to clear, and why adding to it is cheap.

  This note used to say the four were "written in Oklch" and that lichen and
  lavender grey "exist inside the paintings only". Neither was true. Every
  token is and was hex; there was no `oklch()` anywhere in the stylesheet.
  Oklch is what the *interpolation* runs in — the rule's gradient and the item
  hover's `color-mix` both ask for it by name — so a blend of two of these
  never travels through grey the way the sRGB path would. Lichen and lavender
  did not exist at all until they were sampled for the rule.
- **The rule is painted, not filled.** `.hero-rule` and `.page-rule` are one
  squiggle mask over a gradient of the hour's three pigments, so a single rule
  changes colour along its length the way a loaded brush does crossing a sheet:
  amber into peony into rose at the golden hour, lavender into blue into lichen
  in the morning. The flat `background-color` under it is the fallback — a
  browser that will not interpolate a gradient in Oklch drops the whole
  `background-image` and would otherwise leave no rule at all.
- **Every section on the board is one colour**, and it is a colour that is
  actually in the painting hanging beside it: the bowl's green on Matcha, the
  drop of jam on Kitchen, the cherry on Desserts, the lilac in the glass on
  Cold. Keyed off `.spot--*` and never off `[data-sec]`, because a section's
  slug comes out of `menu.json` and is the owner's to rename, while the
  painting is developer territory and is where the colour came from. Take home
  is pine rather than the bag's clay, because clay on cream is a rule you
  cannot see; the greens instead read as a ladder of value.
- **A rule that is a flex item costs more than its height.** The section rule
  started as a wrapped flex row, which also collected the head's 16px `gap` as
  a row gap: the head grew 25px, the item list walked down into paintings that
  are positioned against the section and do not move, and the first Matcha line
  went from 11.4:1 over paper to 2.5:1 over the bowl. It is out of flow now,
  and the room it sits in is taken back out of the head's own margin — at every
  breakpoint, including the phone's separate `.sec-head` margin. Every name,
  item and painting on the board is within a pixel of where it was before.
- **`--accent` was dead for a while.** It was defined on all four states and
  referenced by nothing. The hover on a board line was a hand-written butter
  `rgba()` that stayed butter at every hour. Both now run off the state, which
  is how the time of day reaches the board pages and not just the hero.
- **Marks.** Six, defined once as CSS mask images at the top of `style.css`.
  Swapping in hand-painted versions is six `url()`s and nothing else.
- **Fonts.** `font-display: optional` with both faces preloaded is the only
  combination that cannot shift layout. `font-synthesis: none` is global;
  Instrument Serif has no bold and must never be asked for one.
- **Spots.** Positioned against their own section, never the page, so adding an
  item to `menu.json` cannot move a painting. Short sections carry a
  `min-height` that clears their spot.
- **The spots carry their own alpha.** `build-art.py` cuts it from the scans:
  flat-field the paper, trim the sheet's torn border, take alpha from how far
  each pixel departs from white, then drop the square of wash some of them were
  painted on. That last step is by density, not by shape: blur the alpha and a
  broad thin backdrop stays low while a subject stays high, with a floor that
  keeps any pixel that is plainly pigment, so a rim or a handle is never cut.
  So there is no mask in the CSS to clip anything and no levels lift to hide a
  backdrop with, only `mix-blend-mode: multiply`, which is how pigment sits on
  paper. Re-supply a painting in `src-art/`, run the script, and it is matted
  the same way.
- **The masters.** `src-art/` holds the PNGs everything in `art/` is made from,
  including three surfaces the site does not currently use.
- **The 404 carries a `<base>`.** Pages serves `404.html` for a missing URL at
  any depth, like `/VinsCafe/a/b/`, where relative paths resolve into the void
  and the page would arrive unstyled. The base pins every relative URL to the
  site root; `sync-static.mjs` keeps it pointing at `config.js`'s `url`.
  Previewing `404.html` locally therefore loads its assets from the live site.
- **The map is drawn, not embedded.** Find us carries an inline SVG sketch of
  the corner in the site's own palette; the no-third-party-requests rule
  covers map tiles too. It is decorative to a screen reader beyond its short
  label; the prose above it gives the same directions, and the real map stays
  a link.
