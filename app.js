/* app.js: developer territory. The owner edits menu.json and config.js, not this. */

/* Loaded synchronously in <head>, after config.js, so that <html data-state>
   is stamped before the browser's first paint. A deferred or module script
   would resolve after layout and the page would flash the wrong time of day.
   Everything that touches the DOM waits for DOMContentLoaded. */

(function () {
  'use strict';

  /* ------------------------------------------------------------- plates --- */

  var PLATES = {
    morning: {
      file: 'hero-morning',
      alt: 'Watercolour of the room at first light: a green counter, a dark cup ' +
           'steaming beside a small red apple, blue stools, and cold light coming ' +
           'through the tall window on the left.'
    },
    midday: {
      file: 'hero-midday',
      alt: 'Watercolour of the counter at midday under a yellow wash, a row of ' +
           'mismatched cups and saucers set out along it, and a grey city window ' +
           'to the left.'
    },
    late: {
      file: 'hero-lateafternoon',
      alt: 'Watercolour of the room in late afternoon: pink and gold light across ' +
           'the far wall, two empty stools at the counter, and an open book left ' +
           'on the corner table.'
    },
    closed: {
      file: 'hero-closed',
      alt: 'Watercolour of the room after closing: deep blue-green dark, chairs ' +
           'stacked in the one lit window, and a single red light by the door.'
    }
  };

  var LABEL = { morning: 'Morning', midday: 'Midday', late: 'Late afternoon', closed: 'Closed' };

  /* Copy rule: name a real thing in the room. No adverbs doing the work of a
     detail: "toasted properly" tells you nothing, "under the grill" is a
     kitchen you can picture. Every line here should be false of the cafe two
     doors down. */
  var COPY = {
    morning: {
      eyebrow: null,       /* derived: the hours are the whole story now */
      mark: 'note',
      headline: 'The morning we wait all week for.',
      body: 'First light through the window, warm trays coming out, the pho broth back on the heat. Six days of getting ready, for this.'
    },
    midday: {
      eyebrow: 'Say how you want it',
      mark: 'board',
      headline: 'A quiet obsession with matcha.',
      body: 'Stone-ground, whisked to order, poured slow. Tell us how you like it, take the window seat, and let the morning stretch.'
    },
    late: {
      /* Derived from the closing hour in config.js so the two cannot disagree.
         The brief's fixed "half five" was already wrong twice over. */
      eyebrow: null,
      mark: 'hours',
      headline: 'Stay for the golden hour.',
      body: 'The sun drops low over Kingsway and the room goes soft. The regulars call this the good hour. Now you know too.'
    },
    closed: {
      /* Six days in seven this is the site. Nearly every visitor will only ever
         see this one state, so it has to say what the place is, what it sells
         and when it is next open: the headline, then the subhead carries both. */
      eyebrow: 'Chairs up, lights off',
      mark: 'close',
      headline: 'Worth setting a Sunday alarm for.',
      body: null        /* derived: it has to name the day we actually reopen */
    }
  };

  var DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DAY_SCHEMA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var WORDS = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six',
               'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

  /* The hours table starts on the first day we are actually open, so the open
     days lead and the shut ones collapse behind them. Hardcoded Wed-first, a
     Sunday-only week read "Wed–Sat Closed / Sun 08–14 / Mon–Tue Closed", with
     the one day we are open buried in the middle of two runs of nothing. */
  function weekOrder() {
    var start = 1;                                  /* look from Monday */
    for (var i = 0; i < 7; i++) {
      var d = (1 + i) % 7;
      if (CAFE.hours[d]) { start = d; break; }
    }
    var order = [];
    for (var j = 0; j < 7; j++) order.push((start + j) % 7);
    return order;
  }
  var WEEK_ORDER = weekOrder();

  /* The first day of the week we open, for copy that has to name an hour while
     we are shut. Reading a fixed weekday broke the moment that day went dark. */
  function openHours() {
    for (var i = 0; i < 7; i++) {
      var h = CAFE.hours[WEEK_ORDER[i]];
      if (h) return h;
    }
    return [8, 14];
  }

  /* ----------------------------------------------------------- the clock ---
     Resolved in the cafe's timezone, never the visitor's. Someone opening the
     site from another country must not be told we are open when we are shut. */

  function zoneNow() {
    var f = new Intl.DateTimeFormat('en-GB', {
      timeZone: CAFE.timezone, hourCycle: 'h23',
      weekday: 'short', hour: '2-digit', minute: '2-digit'
    });
    var p = {};
    var parts = f.formatToParts(new Date());
    for (var i = 0; i < parts.length; i++) p[parts[i].type] = parts[i].value;
    return {
      weekday: DAY_SHORT.indexOf(p.weekday),
      hour: parseInt(p.hour, 10),
      minute: parseInt(p.minute, 10),
      forced: false
    };
  }

  /* ?t=2026-08-11T09:00 forces a moment, read as cafe wall-clock time. The
     weekday of a calendar date is the same in every zone, so no offset maths. */
  function forcedMoment(raw) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?$/.exec(raw || '');
    if (!m) return null;
    var day = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (isNaN(day.getTime())) return null;
    return {
      weekday: day.getUTCDay(),
      hour: m[4] === undefined ? 0 : +m[4],
      minute: m[5] === undefined ? 0 : +m[5],
      forced: true
    };
  }

  /* The three daylight states are thirds of whatever the day actually is, not
     fixed clock hours. Pinned to 7/11/15/18 they assumed a nine-hour day: on a
     six-hour Sunday the late-afternoon painting could never appear at all,
     because the cafe shut an hour before that band began. */
  function bands(h) {
    var third = Math.max(1, Math.round((h[1] - h[0]) / 3));
    return { middayFrom: h[0] + third, lateFrom: Math.max(h[0] + third, h[1] - third) };
  }

  function stateAt(now) {
    var h = CAFE.hours[now.weekday];
    if (!h) return 'closed';                                  /* no hours today */
    if (now.hour < h[0] || now.hour >= h[1]) return 'closed';  /* shut, on an open day */
    var b = bands(h);
    if (now.hour < b.middayFrom) return 'morning';
    if (now.hour < b.lateFrom) return 'midday';
    return 'late';
  }

  /* The next time the door is unlocked, walking forward from `now`. */
  function nextOpening(now) {
    for (var i = 0; i < 8; i++) {
      var d = (now.weekday + i) % 7;
      var h = CAFE.hours[d];
      if (!h) continue;
      if (i === 0 && now.hour >= h[0]) continue;   /* today's opening has been and gone */
      return { weekday: d, hour: h[0], days: i };
    }
    return null;
  }

  function hour12(h) { return WORDS[h % 12 === 0 ? 12 : h % 12]; }
  function digit12(h) { var n = h % 12; return String(n === 0 ? 12 : n); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* "Closed until seven tomorrow." / "Closed until seven on Wednesday."
     Same sentence shape whichever it is, so the type never reflows badly. */
  function closedHeadline(now) {
    var n = nextOpening(now);
    if (!n) return 'Closed.';
    var when = n.days === 0 ? 'this morning'
             : n.days === 1 ? 'tomorrow'
             : 'on ' + DAY_LONG[n.weekday];
    return 'Closed until ' + hour12(n.hour) + ' ' + when + '.';
  }

  /* Closed says what the room loves first, then when the door is open. The
     day names come from config.js, so a second open day lands here on its
     own. Short, because on a phone it sits directly under the headline. */
  function openDaysLine() {
    var parts = hourRuns().filter(function (r) { return r.hours; })
      .map(function (r) {
        return r.days.length > 1
          ? DAY_LONG[r.days[0]] + ' to ' + DAY_LONG[r.days[r.days.length - 1]]
          : DAY_LONG[r.days[0]] + 's';
      });
    return 'Open on ' + parts.join(' and ') + '.';
  }

  function closedBody(now) {
    return 'Star anise, pandan and black sesame, the flavours we grew up on. ' +
      openDaysLine() + " We can't wait to have you.";
  }

  function lateEyebrow() {
    /* Last orders half an hour before the chairs go up. Read off the day we
       actually open; a fixed weekday went dark when the week shrank. */
    var last = openHours()[1] - 1;
    return 'Last orders at half ' + hour12(last);
  }

  function morningEyebrow() {
    /* "Eight till ten": the span of the morning band, not a fixed hour. */
    var h = openHours();
    return capitalise(hour12(h[0])) + ' till ' + hour12(bands(h).middayFrom);
  }

  function capitalise(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function eyebrowFor(state) {
    if (state === 'late') return lateEyebrow();
    if (state === 'morning') return COPY.morning.eyebrow || morningEyebrow();
    return COPY[state].eyebrow;
  }

  /* Consecutive days that share hours, collapsed into Wed–Fri / Sat–Sun / Mon–Tue. */
  function hourRuns() {
    var runs = [];
    for (var i = 0; i < WEEK_ORDER.length; i++) {
      var d = WEEK_ORDER[i];
      var h = CAFE.hours[d] || null;
      var last = runs[runs.length - 1];
      var same = last && ((!last.hours && !h) || (last.hours && h && last.hours[0] === h[0] && last.hours[1] === h[1]));
      if (same) last.days.push(d);
      else runs.push({ hours: h, days: [d] });
    }
    return runs.map(function (r) {
      r.label = r.days.length > 1
        ? DAY_SHORT[r.days[0]] + '–' + DAY_SHORT[r.days[r.days.length - 1]]
        : DAY_SHORT[r.days[0]];
      r.value = r.hours ? pad(r.hours[0]) + ' – ' + pad(r.hours[1]) : 'Closed';
      return r;
    });
  }

  /* The indicator always answers the clock, never the ?state= preview: a
     Monday morning previewed as `morning` still says we are shut, because we
     are. It follows ?t=, which moves the clock rather than overriding it. */
  function indicatorLabel(now) {
    var today = CAFE.hours[now.weekday];
    if (stateAt(now) !== 'closed' && today) {
      return 'Open · to ' + digit12(today[1]);
    }
    var n = nextOpening(now);
    return n ? 'Closed · opens ' + digit12(n.hour) : 'Closed';
  }

  /* ---------------------------------------------------------------- boot --- */

  var params = new URLSearchParams(location.search);
  var forcedState = params.get('state');
  if (['morning', 'midday', 'late', 'closed'].indexOf(forcedState) < 0) forcedState = null;

  function moment() { return forcedMoment(params.get('t')) || zoneNow(); }

  var root = document.documentElement;
  var locked = root.hasAttribute('data-state-lock');   /* the 404 stays shut */
  var now = moment();
  var state = locked ? root.getAttribute('data-state') : (forcedState || stateAt(now));

  root.classList.add('js');
  root.setAttribute('data-state', state);

  /* Preload only the plate we are about to show. Never the other three. */
  (function () {
    var f = PLATES[state].file;
    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.type = 'image/avif';
    link.setAttribute('imagesrcset', 'art/' + f + '-960w.avif 960w, art/' + f + '-1376w.avif 1376w');
    link.setAttribute('imagesizes', '100vw');
    link.fetchPriority = 'high';
    document.head.appendChild(link);
  }());

  function plateHTML(s) {
    var p = PLATES[s];
    return '<picture class="plate">' +
      '<source type="image/avif" sizes="100vw" srcset="art/' + p.file + '-960w.avif 960w, art/' + p.file + '-1376w.avif 1376w">' +
      '<source type="image/webp" sizes="100vw" srcset="art/' + p.file + '-960w.webp 960w, art/' + p.file + '-1376w.webp 1376w">' +
      '<img src="art/' + p.file + '-1376w.webp" width="1376" height="768" alt="' + p.alt +
      '" fetchpriority="high" decoding="async">' +
      '</picture>';
  }

  var STRIP_SIZES = { morning: '44vw', late: '46vw', midday: '100vw' };

  function stripHTML(s) {
    if (s === 'closed') return '';
    return '<img class="strip" alt="" aria-hidden="true" width="1376" height="768" decoding="async"' +
      ' sizes="' + STRIP_SIZES[s] + '"' +
      ' srcset="art/tex-paper-900w.avif 900w, art/tex-paper-1376w.avif 1376w"' +
      ' src="art/tex-paper-900w.webp">';
  }

  /* Written from an inline script at the point in the markup where the plate
     goes, so the parser starts the right fetch immediately and never the
     wrong one. <noscript> in the same place carries the no-JS plate. */
  window.GamSia = {
    state: state,
    plateHTML: plateHTML,
    stripHTML: stripHTML,
    writePlate: function (script) {
      script.insertAdjacentHTML('beforebegin', plateHTML(state) +
        '<canvas class="pigment" aria-hidden="true"></canvas>' + stripHTML(state));
    }
  };

  /* ------------------------------------------------------------ the DOM --- */

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function setText(el, text) { if (el) el.textContent = text; }

  function paintHours(el) {
    if (!el) return;
    var runs = hourRuns();
    var html = '';
    for (var i = 0; i < runs.length; i++) {
      html += '<dt>' + runs[i].label + '</dt><dd>' + runs[i].value + '</dd>';
    }
    el.innerHTML = html;
  }

  function paintIndicator(now) {
    var label = indicatorLabel(now);
    $$('.ind').forEach(function (ind) {
      var trigger = $('.ind-trigger', ind);
      if (trigger) trigger.hidden = false;
      setText($('.ind-label', ind), label);
      paintHours($('.hours', ind));
    });
  }

  function paintHero(now, state) {
    var hero = $('.hero');
    if (!hero) return;
    var c = COPY[state];
    setText($('.hero-eyebrow-text', hero), eyebrowFor(state));
    var markEl = $('.hero-eyebrow .mark', hero);
    if (markEl) markEl.className = 'mark mark--' + c.mark;

    /* data-fixed is the 404's own copy: it is closed by design, not by clock. */
    var head = $('.hero-headline', hero);
    if (head && !head.hasAttribute('data-fixed')) setText(head, c.headline || closedHeadline(now));
    var body = $('.hero-body', hero);
    if (body && !body.hasAttribute('data-fixed')) setText(body, c.body || closedBody(now));
    paintHours($('.hero-hours', hero));
  }

  /* The timestamp appears in the hero on the home page and in the footer strip
     on the others; it is the same component in both places. */
  function paintStamp(now, state) {
    var text = pad(now.hour) + ':' + pad(now.minute) + ' · ' + LABEL[state];
    $$('.stamp').forEach(function (el) { el.textContent = text; });
  }

  function paintPlate(state) {
    var pic = $('.plate');
    if (!pic) return null;
    var p = PLATES[state];
    var srcs = $$('source', pic);
    if (srcs[0]) srcs[0].srcset = 'art/' + p.file + '-960w.avif 960w, art/' + p.file + '-1376w.avif 1376w';
    if (srcs[1]) srcs[1].srcset = 'art/' + p.file + '-960w.webp 960w, art/' + p.file + '-1376w.webp 1376w';
    var img = $('img', pic);
    if (img) { img.src = 'art/' + p.file + '-1376w.webp'; img.alt = p.alt; }
    return img;
  }

  /* Everything the clock decides, written in one pass. Called from an inline
     script at the end of the section it fills, so the first paint already has
     the right words in it. Filling them at DOMContentLoaded instead would
     resize the indicator and the hero after layout, which is a layout shift,
     and the shift budget for this site is zero. */
  function paint() {
    paintHero(now, state);
    paintStamp(now, state);
    paintIndicator(now);
    paintHours($('.page-hours'));
    setThemeColor(state);
  }
  window.GamSia.paint = paint;

  /* ----------------------------------------------------------- json-ld ---
     Regenerated from config.js on every load so the structured data and the
     indicator can never drift apart. tools/sync-static.mjs writes the same
     object into the markup for crawlers that do not run scripts. */

  function schemaHours() {
    var runs = hourRuns(), out = [];
    for (var i = 0; i < runs.length; i++) {
      if (!runs[i].hours) continue;
      out.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: runs[i].days.map(function (d) { return DAY_SCHEMA[d]; }),
        opens: pad(runs[i].hours[0]) + ':00',
        closes: pad(runs[i].hours[1]) + ':00'
      });
    }
    return out;
  }

  function syncSchema() {
    var el = $('script[type="application/ld+json"][data-generated]');
    if (!el) return;
    var data;
    try { data = JSON.parse(el.textContent); } catch (e) { return; }
    data.name = CAFE.name;
    data.telephone = CAFE.telephone;
    data.email = CAFE.email;
    data.address = {
      '@type': 'PostalAddress',
      streetAddress: CAFE.address.street,
      addressLocality: CAFE.address.locality,
      postalCode: CAFE.address.postcode,
      addressCountry: CAFE.address.country
    };
    data.geo = { '@type': 'GeoCoordinates', latitude: CAFE.geo.lat, longitude: CAFE.geo.lon };
    data.openingHoursSpecification = schemaHours();
    el.textContent = JSON.stringify(data, null, 2);
  }

  /* ------------------------------------------------------------- the menu ---
     menu.json is the owner's file. The same content is in the markup so the
     page works with no JS and so crawlers see it; if the two ever differ the
     JSON wins, and the section is rebuilt. Signatures match in the normal
     case, so nothing is rewritten and nothing shifts. */

  var SPOTS = {
    'spot-cup':       { w: 330, h: 177, sizes: '(max-width:719px) 240px, (max-width:1179px) 260px, 330px',
      alt: 'Watercolour of a green and lilac cup, half full, a small red mark on its side.' },
    'spot-espresso':  { w: 200, h: 194, sizes: '(max-width:719px) 150px, (max-width:1179px) 160px, 200px',
      alt: 'Watercolour of a green espresso cup with a lilac shadow pooling under it.' },
    'spot-teapot':    { w: 270, h: 300, sizes: '(max-width:719px) 200px, (max-width:1179px) 215px, 270px',
      alt: 'Watercolour of a squat green teapot with a lilac handle, on a pale wash.' },
    'spot-beans':     { w: 200, h: 228, sizes: '(max-width:719px) 170px, (max-width:1179px) 160px, 200px',
      alt: 'Watercolour of a paper bag of coffee, the dark green showing through the sides.' },
    'spot-croissant': { w: 320, h: 320, sizes: '(max-width:719px) 250px, (max-width:1179px) 255px, 320px',
      alt: 'Watercolour of a croissant in olive and grey, one flake of it catching red.' },
    'spot-toast':     { w: 220, h: 252, sizes: '(max-width:719px) 170px, (max-width:1179px) 175px, 220px',
      alt: 'Watercolour of two thick slices of toast stacked, a red drop of jam below them.' },
    'spot-cake':      { w: 300, h: 342, sizes: '(max-width:719px) 230px, (max-width:1179px) 240px, 300px',
      alt: 'Watercolour of a slice of layer cake on a grey plate, a red cherry on top.' },
    'spot-coldbrew':  { w: 220, h: 251, sizes: '(max-width:719px) 190px, (max-width:1179px) 175px, 220px',
      alt: 'Watercolour of a tumbler of iced coffee, the ice drawn as gaps left in the wash.' },
    'spot-matcha':    { w: 280, h: 319, sizes: '(max-width:719px) 210px, (max-width:1179px) 225px, 280px',
      alt: 'Watercolour of a matcha bowl and a bamboo whisk, the green settling in the base.' },
    'spot-flatwhite': { w: 380, h: 380, sizes: '(max-width:719px) 280px, (max-width:1179px) 300px, 380px',
      alt: 'Watercolour of a flat white seen from above, the crema drawn as one olive ring.' }
  };

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function spotHTML(id) {
    var s = SPOTS[id];
    if (!s) return '';
    return '<img class="spot spot--' + id.replace('spot-', '') + '"' +
      ' width="' + s.w + '" height="' + s.h + '" alt="' + esc(s.alt) + '" loading="lazy" decoding="async"' +
      ' sizes="' + s.sizes + '"' +
      ' srcset="art/' + id + '-' + s.w + 'w.avif ' + s.w + 'w, art/' + id + '-' + (s.w * 2) + 'w.avif ' + (s.w * 2) + 'w"' +
      ' src="art/' + id + '-' + (s.w * 2) + 'w.webp">';
  }

  /* --i is the section's place in menu.json; see the note in sync-static.mjs.
     The phone board is a single column and needs the file's reading order,
     which DOM order cannot give it once the desktop board splits the sections
     across two columns. */
  function sectionHTML(sec, i) {
    var h = '<section class="sec' + (i % 2 ? ' sec--flip' : '') + '" data-sec="' +
      slug(sec.section) + '" style="--i:' + i + '">';
    (sec.spots || []).forEach(function (id) { h += spotHTML(id); });
    h += '<div class="sec-head"><h2 class="sec-name">' + esc(sec.section) + '</h2>';
    if (sec.note) h += '<p class="sec-note">' + esc(sec.note) + '</p>';
    h += '</div><ul class="items">';
    (sec.items || []).forEach(function (it) {
      h += '<li class="item" data-item="' + slug(it.name) + '"><span class="item-name">' + esc(it.name) +
        '</span><span class="item-lead" aria-hidden="true"></span>' +
        '<span class="item-price">' + esc(it.price) + '</span></li>';
    });
    h += '</ul>';
    if (sec.standfirst) h += '<p class="standfirst">' + esc(sec.standfirst) + '</p>';
    return h + '</section>';
  }

  /* Which two sections get the shop window: the ones the owner bothered to
     write a standfirst for. That is already the signal for "this is the part
     I care about", and it means the front page follows menu.json without
     naming any section in code. Topped up in file order if there are fewer
     than two. */
  var PREVIEW_SECTIONS = 2;
  var PREVIEW_ITEMS = 4;

  function previewPick(data) {
    var picked = data.filter(function (s) { return s.standfirst; });
    for (var i = 0; i < data.length && picked.length < PREVIEW_SECTIONS; i++) {
      if (picked.indexOf(data[i]) < 0) picked.push(data[i]);
    }
    return picked.slice(0, PREVIEW_SECTIONS);
  }

  function previewSlice(data) {
    return previewPick(data).map(function (sec) {
      return {
        section: sec.section,
        note: sec.note,
        /* One spot, not the section's whole set: the preview columns are
           narrower than the board's and a second spot would land on the type. */
        spot: (sec.spots || [])[0] || null,
        items: (sec.items || []).slice(0, PREVIEW_ITEMS),
        of: (sec.items || []).length
      };
    });
  }

  /* What the preview is NOT showing. Without this the four items under each
     heading read as the entire menu, which is the one thing a cafe site must
     never get wrong. Both numbers come from menu.json, so they cannot drift. */
  function previewRest(data) {
    var shown = previewPick(data);
    return {
      others: data.filter(function (s) { return shown.indexOf(s) < 0; })
                  .map(function (s) { return s.section; }),
      total: data.reduce(function (n, s) { return n + (s.items || []).length; }, 0)
    };
  }

  function previewHTML(sec, i) {
    var h = '<section class="sec' + (i % 2 ? ' sec--flip' : '') + '" data-sec="' +
      slug(sec.section) + '" style="--i:' + i + '">';
    if (sec.spot) h += spotHTML(sec.spot);
    h += '<div class="sec-head"><h3 class="sec-name">' + esc(sec.section) + '</h3>';
    if (sec.note) h += '<p class="sec-note">' + esc(sec.note) + '</p>';
    h += '</div><ul class="items">';
    (sec.items || []).forEach(function (it) {
      h += '<li class="item" data-item="' + slug(it.name) + '"><span class="item-name">' + esc(it.name) +
        '</span><span class="item-lead" aria-hidden="true"></span>' +
        '<span class="item-price">' + esc(it.price) + '</span></li>';
    });
    h += '</ul>';
    if (sec.of > sec.items.length) {
      h += '<p class="sec-more">and ' + (sec.of - sec.items.length) + ' more</p>';
    }
    return h + '</section>';
  }

  function previewRestHTML(rest) {
    var h = '<p class="preview-rest">Also on the menu: ' + rest.others.map(esc).join(', ') + '.</p>';
    h += '<a class="hero-onward preview-more" href="menu.html#menu">' +
      'The whole menu, ' + rest.total + ' things' +
      ' <span class="mark mark--onward" aria-hidden="true"></span></a>';
    return h;
  }

  function signature(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  /* menu.json cannot carry a comment and stay valid JSON, so the note that it
     is owner-editable lives in EDITING.md next to it. */
  function hydrateMenu() {
    var board = $('.board[data-menu-sig]');
    var preview = $('.preview-cols[data-preview-sig]');
    if ((!board && !preview) || !window.fetch) return;
    fetch('menu.json', { cache: 'no-cache' }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (data) {
      if (!Array.isArray(data)) return;
      if (preview) {
        /* The signature covers the rest-line too, so an edit that only changes
           a section we are not showing still updates "and 15 more". */
        var rest = previewRest(data);
        var psig = signature(JSON.stringify([previewSlice(data), rest]));
        if (psig !== preview.getAttribute('data-preview-sig')) {
          preview.innerHTML = previewSlice(data).map(previewHTML).join('');
          preview.setAttribute('data-preview-sig', psig);
          var tail = $('.preview-tail');
          if (tail) tail.innerHTML = previewRestHTML(rest);
        }
      }
      if (!board) return;
      var sig = signature(JSON.stringify(data));
      if (sig === board.getAttribute('data-menu-sig')) return;   /* markup is current */
      var cols = $$('.board-col', board);
      if (cols.length !== 2) return;
      /* Alternating, not a named list: sections go left, right, left, right
         down menu.json, so any set of sections stays balanced and a renamed
         one cannot fall through to a default. */
      var html = ['', ''];
      data.forEach(function (sec, i) { html[i % 2] += sectionHTML(sec, i); });
      cols[0].innerHTML = html[0];
      cols[1].innerHTML = html[1];
      board.setAttribute('data-menu-sig', sig);
    }).catch(function () { /* the markup already says the right thing */ });
  }

  /* ---------------------------------------------------------- indicator --- */

  function wireIndicator() {
    $$('.ind').forEach(function (ind) {
      var trigger = $('.ind-trigger', ind);
      var panel = $('.ind-panel', ind);
      var closer = $('.ind-close', ind);
      if (!trigger || !panel) return;

      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');

      function open(yes) {
        panel.hidden = !yes;
        trigger.setAttribute('aria-expanded', String(yes));
        if (!yes) trigger.focus();
      }

      trigger.addEventListener('click', function () {
        open(panel.hidden);
      });
      if (closer) closer.addEventListener('click', function () { open(false); });

      ind.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); open(false); }
      });
      document.addEventListener('click', function (e) {
        if (!panel.hidden && !ind.contains(e.target)) {
          panel.hidden = true;
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  /* ------------------------------------------------------------ day dial ---
     The paintings are keyed to the clock, so on any single visit three of
     the four can never be seen. The dial under the hero turns the room
     through its day by setting the same forced state ?state= uses, so the
     pigment layer bleeds between paintings exactly as an hour change would.
     The indicator keeps answering the real clock throughout. */

  function markDaydial() {
    /* When the passage is built, the scroll owns the dial. */
    if (dayscroll) return;
    var strip = $('.daystrip');
    $$('.daystrip-btns button').forEach(function (b, i) {
      var on = b.getAttribute('data-set-state') === state;
      b.setAttribute('aria-pressed', String(on));
      /* the sun rides the arc to whichever hour is chosen */
      if (on && strip) strip.style.setProperty('--sun-i', i);
    });
  }

  /* -------------------------------------------------- the day, scrubbed ---
     The daystrip grown into a tall passage with the room pinned inside it:
     scroll position maps to a point in the day, the four paintings crossfade
     through it (the incoming one arriving wet), and the sun is dragged along
     the arc rather than gliding to a stop. The compact dial stays in the
     markup as the fallback and the reduced-motion answer, and the hero above
     keeps answering the real clock, exactly like the indicator. */

  var dayscroll = null;

  function enhanceDayscroll() {
    var strip = $('.daystrip');
    if (!strip) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (navigator.connection && navigator.connection.saveData) return;
    if (!('IntersectionObserver' in window)) return;

    var wrap = document.createElement('section');
    wrap.className = 'dayscroll';
    var stage = document.createElement('div');
    stage.className = 'dayscroll-stage';
    strip.parentNode.insertBefore(wrap, strip);
    wrap.appendChild(stage);

    var room = document.createElement('div');
    room.className = 'dayscroll-room';
    stage.appendChild(room);
    stage.appendChild(strip);            /* the dial rides inside the stage */

    var order = ['morning', 'midday', 'late', 'closed'];
    var plates = null;

    /* All four paintings is the cost of the feature, so they are fetched
       only once the passage is within a scroll of the viewport. */
    function buildPlates() {
      if (plates) return;
      plates = order.map(function (s) {
        var p = PLATES[s];
        var pic = document.createElement('picture');
        pic.className = 'dayplate';
        pic.innerHTML =
          '<source type="image/avif" sizes="92vw" srcset="art/' + p.file + '-960w.avif 960w, art/' + p.file + '-1376w.avif 1376w">' +
          '<source type="image/webp" sizes="92vw" srcset="art/' + p.file + '-960w.webp 960w, art/' + p.file + '-1376w.webp 1376w">' +
          '<img src="art/' + p.file + '-1376w.webp" alt="' + p.alt + '" loading="lazy" decoding="async" width="1376" height="768">';
        room.appendChild(pic);
        return pic;
      });
      scrub();
    }

    new IntersectionObserver(function (entries, io) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { buildPlates(); io.disconnect(); return; }
      }
    }, { rootMargin: '150% 0%' }).observe(wrap);

    var btns = $$('.daystrip-btns button', stage);
    var ticking = false;

    function scrub() {
      ticking = false;
      var r = wrap.getBoundingClientRect();
      var span = Math.max(1, r.height - window.innerHeight);
      var p = Math.min(1, Math.max(0, -r.top / span));
      var seg = p * (order.length - 1);

      if (plates) {
        /* Stacked, not dissolved: the settled painting stays whole underneath
           and the next one washes in over it, so the room never goes thin in
           the middle of a turn the way a plain crossfade would. */
        for (var i = 0; i < plates.length; i++) {
          var w = i === 0 ? 1 : Math.min(1, Math.max(0, 1 + seg - i));
          plates[i].style.opacity = w.toFixed(3);
          /* the arriving painting is still wet; the settled one is not */
          plates[i].style.filter =
            (i > 0 && w > 0 && w < 1) ? 'blur(' + (2.5 * (1 - w)).toFixed(2) + 'px)' : '';
        }
      }
      strip.style.setProperty('--sun-i', seg.toFixed(3));
      var near = Math.round(seg);
      for (var j = 0; j < btns.length; j++) {
        btns[j].setAttribute('aria-pressed', String(j === near));
      }
    }

    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(scrub); }
    }
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    scrub();

    dayscroll = {
      /* a button is a bookmark: scroll to that hour's band of the passage */
      jump: function (s) {
        var i = order.indexOf(s);
        if (i < 0) return;
        var top = wrap.getBoundingClientRect().top + window.scrollY;
        var span = wrap.offsetHeight - window.innerHeight;
        scrollTo({ top: top + span * (i / (order.length - 1)), behavior: 'smooth' });
      }
    };
  }

  /* The browser chrome follows the page: pine while a closed hero is dark,
     paper everywhere else. */
  function setThemeColor(s) {
    var m = $('meta[name="theme-color"]');
    if (m) m.setAttribute('content', s === 'closed' && $('.hero') ? '#404A2E' : '#F7EFDF');
  }

  function wireDaydial() {
    var btns = $$('.daystrip-btns button');
    if (!btns.length) return;
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var s = b.getAttribute('data-set-state');
        /* in the scrubbed passage the button is a bookmark into the scroll */
        if (dayscroll) { dayscroll.jump(s); return; }
        /* choosing the hour we are actually in hands the page back to the clock */
        forcedState = s === stateAt(moment()) ? null : s;
        tick();
        markDaydial();
        /* the hero is above the dial; bring the painting into view to watch it turn */
        var hero = $('.hero');
        if (hero) hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    markDaydial();
  }

  /* ------------------------------------------------------------- pigment --- */

  var pigment = null;

  function loadPigment() {
    var canvas = $('.pigment');
    if (!canvas) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { canvas.remove(); return; }
    if (navigator.connection && navigator.connection.saveData) { canvas.remove(); return; }
    if (!canvas.getContext('webgl2')) { canvas.remove(); return; }

    import('./pigment.js').then(function (mod) {
      pigment = mod.start(canvas, {
        plate: $('.plate img'),
        paper: 'art/tex-paper-height.avif',
        state: state
      });
    }).catch(function () { canvas.remove(); });
  }

  /* ------------------------------------------------------------- ticking --- */

  function apply(next, nowMoment, animate) {
    /* Take the copy of the outgoing plate before anything touches the <img>
       or the state attribute it is positioned by. */
    var snapped = pigment && animate ? pigment.snapshot() : false;

    state = next;
    window.GamSia.state = next;
    root.setAttribute('data-state', next);

    var strip = $('.strip');
    if (next === 'closed') {
      if (strip) strip.remove();
    } else if (!strip) {
      var wrap = $('.plate-wrap');
      if (wrap) wrap.insertAdjacentHTML('beforeend', stripHTML(next));
    } else {
      strip.sizes = STRIP_SIZES[next];
    }

    var img = paintPlate(next);
    paintHero(nowMoment, next);
    paintStamp(nowMoment, next);
    paintIndicator(nowMoment);

    if (pigment && animate) pigment.bleed(img, next, snapped);
    else if (pigment) pigment.setState(next, img);
    markDaydial();
    setThemeColor(next);
  }

  function tick() {
    var m = moment();
    var next = locked ? state : (forcedState || stateAt(m));
    if (next !== state) apply(next, m, true);
    else { paintHero(m, state); paintStamp(m, state); paintIndicator(m); }
  }

  /* ---------------------------------------------------------------- init --- */

  /* For whoever opens the hood: the same word we say at the door. Composed
     from config.js like everything else, so even the easter egg cannot go
     stale. */
  function signOff() {
    var open = hourRuns().filter(function (r) { return r.hours; })
      .map(function (r) { return r.label + ' ' + r.value.replace(' – ', '–'); }).join(' · ');
    try {
      console.log(
        '%cgam sia%c\nHokkien for thank you. That covers reading the source, too.\n' +
        open + ' · ' + CAFE.address.street + ', ' + CAFE.address.locality,
        "font: italic 22px Georgia, 'Times New Roman', serif; color: #404A2E;",
        'font: 12px ui-monospace, Menlo, monospace; color: #5A6530;'
      );
    } catch (e) { /* a console is never load-bearing */ }
  }

  function init() {
    paint();                 /* idempotent: the inline call already did this */
    wireIndicator();
    enhanceDayscroll();      /* before the dial wires: the buttons ask it first */
    wireDaydial();
    syncSchema();
    hydrateMenu();
    loadPigment();
    signOff();

    /* Fifteen seconds is fine: the timestamp shows minutes and the state can
       only change on the hour. */
    setInterval(tick, 15000);

    window.addEventListener('popstate', function () {
      params = new URLSearchParams(location.search);
      forcedState = params.get('state');
      if (['morning', 'midday', 'late', 'closed'].indexOf(forcedState) < 0) forcedState = null;
      tick();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
