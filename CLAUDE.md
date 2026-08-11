# Working on this repository

A static cafe site: plain HTML, CSS and JavaScript, no framework, no build
step, no npm dependencies, and **no third-party request of any kind at
runtime**: fonts are self-hosted, the map is an inline SVG, nothing embeds
or fetches from anyone else. Keep it that way.

`README.md` explains how the site works; `EDITING.md` is the owner's guide.
Read both before changing anything structural.

## The two kinds of files

- **Owner-editable:** `config.js` (hours, address, site URL) and `menu.json`
  (the board). Everything derived from them regenerates.
- **Everything else is developer territory** and most of it is generated in
  part: the HTML files carry `<!--gen:…-->` regions that
  `tools/sync-static.mjs` rewrites from the two files above. Never hand-edit
  inside a gen region; run the tool instead.

## After any change, in this order

1. **`node tools/sync-static.mjs`** rewrites the derived blocks (JSON-LD,
   breadcrumbs, hours, the board, the 404's `<base>`, `sitemap.xml`,
   `robots.txt`). CI runs `--check` and fails the deploy if anything is stale.

2. **`node tools/build-og.mjs`** regenerates the social share cards
   `art/og-home.jpg`, `art/og-menu.jpg`, `art/og-find-us.jpg`.

   **This must be re-run after ANY change to the UI and/or the copy, and the
   JPEGs committed.** The cards are typeset in a real browser with the site's
   own stylesheet, fonts and palette, and their words are read live from the
   pages, `menu.json` and `config.js`: the home headline, the menu prices,
   the hours, the address. A colour tweak, a font swap, a reworded headline,
   a price change: all of them change what the cards should say or look like,
   and nothing else will update them. Needs Playwright once:
   `npm i --no-save playwright` (the browser itself is pre-provisioned in CI
   images and dev containers; never re-download it).

3. **`node tools/check-contrast.mjs`** is only needed after touching the hero,
   the paper strip, the plate art or the pigment layer. Measures the WCAG
   ratio of every pixel actually behind the type, per state.

`python3 tools/build-art.py` regenerates `art/` from the PNG masters in
`src-art/`; only needed when a painting is re-supplied. It no longer writes
the social cards; `build-og.mjs` does.

## Deployment gotchas

- The deploy workflow (`.github/workflows/pages.yml`) copies an explicit list
  of files into `_site`. A new file that should ship must be added to that
  `cp` list or it will 404 in production.
- The site's absolute URL exists in exactly one place: `url` in `config.js`.
  Do not write the domain anywhere else; `sync-static.mjs` propagates it.
- `404.html` carries a `<base>` (generated from `config.js`) because Pages
  serves it at any URL depth. Don't remove it, and don't add relative
  fragment links to that page.
