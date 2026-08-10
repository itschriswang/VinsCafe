/* config.js — OWNER-EDITABLE. Hours, timezone, address. Nothing else lives here. */

/* Everything on the site that states a time reads this object: the hero
   state, the open/closed indicator, the hours table, and the opening hours
   in the search-engine data. Change a number here and all four follow.

   hours: 0 is Sunday. [open, close] in whole hours, cafe local time.
   null means shut all day. */

const CAFE = {
  name: 'Deckle',
  timezone: 'Europe/London',

  hours: {
    0: [8, 16],   // Sunday
    1: null,      // Monday      — shut
    2: null,      // Tuesday     — shut
    3: [7, 16],   // Wednesday
    4: [7, 16],   // Thursday
    5: [7, 16],   // Friday
    6: [8, 16]    // Saturday
  },

  address: {
    street: '41 Lower Marsh',
    locality: 'London',
    postcode: 'SE1 7RG',
    country: 'GB'
  },

  geo: { lat: 51.50086, lon: -0.11342 },

  telephone: '+44 20 7946 0417',
  email: 'hello@deckle.cafe',

  /* Opened in a new tab from Find us. No map is embedded in the page. */
  mapUrl: 'https://www.openstreetmap.org/?mlat=51.50086&mlon=-0.11342#map=18/51.50086/-0.11342',

  station: 'Waterloo',
  walk: 'four minutes'
};

/* Loaded as a plain script in <head> so the hero state is resolved before the
   first paint — an ES module would be deferred and the page would flash the
   wrong time of day. Read by app.js and pigment.js as the global CAFE. */
