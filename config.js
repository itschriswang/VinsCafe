/* config.js — OWNER-EDITABLE. Hours, timezone, address. Nothing else lives here. */

/* Everything on the site that states a time reads this object: the hero
   state, the open/closed indicator, the hours table, and the opening hours
   in the search-engine data. Change a number here and all four follow.

   hours: 0 is Sunday. [open, close] in whole hours, cafe local time.
   null means shut all day. */

const CAFE = {
  name: 'Gam Sia',
  timezone: 'Europe/London',

  /* Where the site lives, with the trailing slash. Every absolute URL on it —
     the canonical links, the social tags, the search-engine data, sitemap.xml
     and robots.txt — is built from this by tools/sync-static.mjs. Moving to a
     custom domain is this one line and a CNAME. */
  url: 'https://itschriswang.github.io/VinsCafe/',

  hours: {
    0: [8, 14],   // Sunday      — the one day
    1: null,      // Monday      — shut
    2: null,      // Tuesday     — shut
    3: null,      // Wednesday   — shut
    4: null,      // Thursday    — shut
    5: null,      // Friday      — shut
    6: null       // Saturday    — shut
  },

  address: {
    street: '41 Lower Marsh',
    locality: 'London',
    postcode: 'SE1 7RG',
    country: 'GB'
  },

  geo: { lat: 51.50086, lon: -0.11342 },

  telephone: '+44 20 7946 0417',
  email: 'hello@gamsia.cafe',

  /* Opened in a new tab from Find us. No map is embedded in the page. */
  mapUrl: 'https://www.openstreetmap.org/?mlat=51.50086&mlon=-0.11342#map=18/51.50086/-0.11342',

  station: 'Waterloo',
  walk: 'four minutes'
};

/* Loaded as a plain script in <head> so the hero state is resolved before the
   first paint — an ES module would be deferred and the page would flash the
   wrong time of day. Read by app.js and pigment.js as the global CAFE. */
