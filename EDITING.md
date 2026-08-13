# Changing the website

There are two files you ever need to open. Everything else on the site is
built from them, so if you change a price in one place it changes everywhere
it appears, including in what Google shows.

Edit them, save, upload. There is nothing to build and nothing to rebuild.

---

## `menu.json`: the board

This is the menu. Each block is one section of the board.

```json
{
  "section": "Coffee",
  "note": "Oat, no charge",
  "standfirst": "This week it is a washed Kirinyaga: blackcurrant, quite bright.",
  "spots": ["spot-cup", "spot-espresso"],
  "items": [
    { "name": "Filter",   "price": "3.20" },
    { "name": "Espresso", "price": "2.60" }
  ]
}
```

- **`name`** and **`price`** are the two things you will change most. Prices are
  plain numbers in quotes, no pound sign; the page adds nothing to them.
- **`note`** is the small line beside the section name. It is for something a
  customer would act on, like Coffee's *Oat, no charge* — not a description of
  the section, which the name already gives. Leave it out if there isn't one.
  Most sections don't have one.
- **`standfirst`** is the longer italic line under the items. No section
  carries one at the moment; add the field back to a section and the line
  returns. Keep it to about two lines; it is cut off past 34 characters a
  line by design. **It also decides the front page:** the first two sections
  with a standfirst are the two shown under the hero on the home page, four
  items each. With no standfirsts anywhere, the first two sections in this
  file are shown instead, which is why Coffee and Kitchen lead the file.
- **`spots`** are the paintings. Leave these alone unless you have had new ones
  painted. Each one hangs off the end of its section's colour bar, and the
  section takes its colour from the painting hanging on it. The first spot of
  each front-page section is also the painting that appears on the home page.

Section order in this file is the order on the board, top to bottom, and the
first section is the one people read first. Each section's bar is only as long
as its own name and note, so renaming one just makes its bar longer or shorter
and its painting moves with it. You can rename a section, reorder them or add
one, and nothing lands on top of the prices.

One thing to avoid: the display face has no en dash, em dash, middot or
ellipsis, and it sets the section names and the item names. Use a hyphen, a
comma or three full stops instead. If one slips in, the deploy stops and tells
you which line it was.

Everything the front page says about the size of the menu counts itself. "And 2
more" under a column, "Also on the board: Tea, Sweet, Cold, Take home", and "The
whole board, 23 things" are all read off `menu.json` when the page is built, so
adding a drink or a whole section updates them on its own, and the front page
can never imply that the eight items it shows are the entire menu.

Adding or removing items is safe: the paintings stay exactly where they are.

**One rule.** It has to stay valid JSON. Every name and price in `"quotes"`, a
comma between each pair of `{ }` blocks and **no comma after the last one**. If
the board looks wrong after an edit, that is almost always a missing or extra
comma.

---

## `config.js`: hours, address, telephone

This is the only place the opening hours are written down. The clock on the
site, the Open/Closed mark in the corner, the hours table, the sentence on the
closed screen and the hours Google reads all come from here.

```js
hours: {
  0: [8, 14],   // Sunday      - the one day
  1: null,      // Monday      - shut
  2: null,      // Tuesday     - shut
  3: null,      // Wednesday   - shut
  4: null,      // Thursday    - shut
  5: null,      // Friday      - shut
  6: null       // Saturday    - shut
}
```

`[8, 14]` means open at eight, shut at two. Whole hours only. `null` means
shut all day. Change a number here and every one of those places follows.

Two things follow the hours that are easy to miss. The hours table starts on
the first day you are actually open, so the open days lead and the shut ones
collapse into one line behind them. And the four paintings are thirds of
whatever the open day is: open eight till two and the morning painting runs
to ten, midday to twelve, late afternoon to close. Shorten the day and they
shorten with it; there is no fixed hour written down anywhere.

Add a second day and everything re-derives, including the hours table, the
sentence on the closed screen and the hours Google reads.

The address, telephone number and email underneath work the same way.

---

## What not to touch

Everything else: `index.html`, `menu.html`, `find-us.html`, `style.css`,
`app.js`, `pigment.js`, `wash.js`, and the `art/` and `fonts/` folders. Each of
those files says so at the top.

If a change needs one of them, it needs a developer, and it is written up in
`README.md`.
