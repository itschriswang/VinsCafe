# Changing the website

There are two files you ever need to open. Everything else on the site is
built from them, so if you change a price in one place it changes everywhere
it appears — including in what Google shows.

Edit them, save, upload. There is nothing to build and nothing to rebuild.

---

## `menu.json` — the board

This is the menu. Each block is one section of the board.

```json
{
  "section": "Coffee",
  "note": "Oat, no charge",
  "standfirst": "This week it is a washed Kirinyaga — blackcurrant, quite bright.",
  "spots": ["spot-cup", "spot-espresso"],
  "items": [
    { "name": "Filter",   "price": "3.20" },
    { "name": "Espresso", "price": "2.60" }
  ]
}
```

- **`name`** and **`price`** are the two things you will change most. Prices are
  plain numbers in quotes, no pound sign — the page adds nothing to them.
- **`note`** is the small capitals line beside the section name. Leave it out
  if there isn't one.
- **`standfirst`** is the longer italic line under the items. Only Coffee and
  Kitchen have one. Keep it to about two lines; it is cut off past 34 characters
  a line by design. **It also decides the front page:** the two sections with a
  standfirst are the two shown under the hero on the home page, four items each.
  Move it to another section and the front page follows.
- **`spots`** are the paintings in the margin. Leave these alone unless you have
  had new ones painted.

Adding or removing items is safe: the paintings stay exactly where they are.

**One rule.** It has to stay valid JSON. Every name and price in `"quotes"`, a
comma between each pair of `{ }` blocks and **no comma after the last one**. If
the board looks wrong after an edit, that is almost always a missing or extra
comma.

---

## `config.js` — hours, address, telephone

This is the only place the opening hours are written down. The clock on the
site, the Open/Closed mark in the corner, the hours table, the sentence on the
closed screen and the hours Google reads all come from here.

```js
hours: {
  0: [8, 16],   // Sunday
  1: null,      // Monday      — shut
  2: null,      // Tuesday     — shut
  3: [7, 16],   // Wednesday
  4: [7, 16],   // Thursday
  5: [7, 16],   // Friday
  6: [8, 16]    // Saturday
}
```

`[7, 16]` means open at seven, shut at four. Whole hours only. `null` means
shut all day. Change a number here and every one of those places follows.

The address, telephone number and email underneath work the same way.

---

## What not to touch

Everything else — `index.html`, `menu.html`, `find-us.html`, `style.css`,
`app.js`, `pigment.js`, and the `art/` and `fonts/` folders. Each of those
files says so at the top.

If a change needs one of them, it needs a developer, and it is written up in
`README.md`.
