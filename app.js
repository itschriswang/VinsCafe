/* app.js — developer territory. The owner edits menu.json and config.js, not this. */

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

  var COPY = {
    morning: {
      eyebrow: 'Seven till eleven',
      mark: 'note',
      headline: 'The first pour is at seven.',
      body: 'Filter, cortado, and yesterday’s loaf toasted properly. Quiet until about half eight.'
    },
    midday: {
      eyebrow: 'Board up at eleven',
      mark: 'board',
      headline: 'Lunch is one thing, done well.',
      body: 'One sandwich, one soup, one cake. Gone by two, usually.'
    },
    late: {
      /* The brief’s eyebrow read “half five”, which contradicts the four o’clock
         close in config.js. The hour here is derived so the two cannot disagree. */
      eyebrow: null,
      mark: 'hours',
      headline: 'The light gets long. We stay open.',
      body: 'The corner table is free most afternoons. Nobody will ask you to order again.'
    },
    closed: {
      /* The cafe is shut for about three quarters of the week, so this is the
         page most visitors land on. It leads with what the place is; the
         reopening is the subhead, and the hours table sits beside it. */
      eyebrow: 'Chairs up, lights off',
      mark: 'close',
      headline: 'A long counter, six stools, and one soup a day.',
      body: null        /* derived: it has to name the day we actually reopen */
    }
  };

  var DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DAY_SCHEMA = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var WORDS = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six',
               'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

  /* Board order runs Wednesday to Tuesday, so the open days group first. */
  var WEEK_ORDER = [3, 4, 5, 6, 0, 1, 2];

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

  function band(hour) {
    if (hour >= 7 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 15) return 'midday';
    if (hour >= 15 && hour < 18) return 'late';
    return 'closed';
  }

  function stateAt(now) {
    var h = CAFE.hours[now.weekday];
    if (!h) return 'closed';                                  /* no hours today */
    if (now.hour < h[0] || now.hour >= h[1]) return 'closed';  /* shut, on an open day */
    return band(now.hour);
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

  function lateEyebrow() {
    /* Last coffee half an hour before the chairs go up. */
    var h = CAFE.hours[3] || [7, 16];
    var last = h[1] - 1;
    return 'Last coffee at half ' + hour12(last);
  }

  function eyebrowFor(state) {
    return state === 'late' ? lateEyebrow() : COPY[state].eyebrow;
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
    if (body && !body.hasAttribute('data-fixed')) setText(body, c.body || closedHeadline(now));
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
     the right words in it — filling them at DOMContentLoaded instead would
     resize the indicator and the hero after layout, which is a layout shift,
     and the shift budget for this site is zero. */
  function paint() {
    paintHero(now, state);
    paintStamp(now, state);
    paintIndicator(now);
    paintHours($('.page-hours'));
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
    'spot-cup':       { w: 206, h: 111, sizes: '(max-width:719px) 156px, (max-width:1179px) 168px, 206px',
      alt: 'Watercolour of a green and lilac cup, half full, a small red mark on its side.' },
    'spot-espresso':  { w: 134, h: 130, sizes: '(max-width:1179px) 112px, 134px',
      alt: 'Watercolour of a green espresso cup with a lilac shadow pooling under it.' },
    'spot-teapot':    { w: 168, h: 187, sizes: '(max-width:719px) 132px, (max-width:1179px) 138px, 168px',
      alt: 'Watercolour of a squat green teapot with a lilac handle, on a pale wash.' },
    'spot-beans':     { w: 132, h: 150, sizes: '(max-width:719px) 126px, (max-width:1179px) 110px, 132px',
      alt: 'Watercolour of a paper bag of coffee, the dark green showing through the sides.' },
    'spot-croissant': { w: 198, h: 198, sizes: '(max-width:719px) 168px, (max-width:1179px) 162px, 198px',
      alt: 'Watercolour of a croissant in olive and grey, one flake of it catching red.' },
    'spot-toast':     { w: 146, h: 166, sizes: '(max-width:1179px) 120px, 146px',
      alt: 'Watercolour of two thick slices of toast stacked, a red drop of jam below them.' },
    'spot-cake':      { w: 180, h: 205, sizes: '(max-width:719px) 156px, (max-width:1179px) 148px, 180px',
      alt: 'Watercolour of a slice of layer cake on a grey plate, a red cherry on top.' },
    'spot-coldbrew':  { w: 140, h: 160, sizes: '(max-width:719px) 140px, (max-width:1179px) 114px, 138px',
      alt: 'Watercolour of a tumbler of iced coffee, the ice drawn as gaps left in the wash.' },
    'spot-matcha':    { w: 170, h: 194, sizes: '(max-width:1179px) 140px, 170px',
      alt: 'Watercolour of a matcha bowl and a bamboo whisk, the green settling in the base.' },
    'spot-flatwhite': { w: 232, h: 232, sizes: '(max-width:719px) 200px, 232px',
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

  function sectionHTML(sec) {
    var h = '<section class="sec" data-sec="' + slug(sec.section) + '">';
    (sec.spots || []).forEach(function (id) { h += spotHTML(id); });
    h += '<div class="sec-head"><h2 class="sec-name">' + esc(sec.section) + '</h2>';
    if (sec.note) h += '<p class="sec-note">' + esc(sec.note) + '</p>';
    h += '</div><ul class="items">';
    (sec.items || []).forEach(function (it) {
      h += '<li class="item"><span class="item-name">' + esc(it.name) +
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
        items: (sec.items || []).slice(0, PREVIEW_ITEMS)
      };
    });
  }

  function previewHTML(sec) {
    var h = '<section class="sec" data-sec="' + slug(sec.section) + '">';
    h += '<div class="sec-head"><h3 class="sec-name">' + esc(sec.section) + '</h3>';
    if (sec.note) h += '<p class="sec-note">' + esc(sec.note) + '</p>';
    h += '</div><ul class="items">';
    (sec.items || []).forEach(function (it) {
      h += '<li class="item"><span class="item-name">' + esc(it.name) +
        '</span><span class="item-lead" aria-hidden="true"></span>' +
        '<span class="item-price">' + esc(it.price) + '</span></li>';
    });
    return h + '</ul></section>';
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
        var psig = signature(JSON.stringify(previewSlice(data)));
        if (psig !== preview.getAttribute('data-preview-sig')) {
          preview.innerHTML = previewSlice(data).map(previewHTML).join('');
          preview.setAttribute('data-preview-sig', psig);
        }
      }
      if (!board) return;
      var sig = signature(JSON.stringify(data));
      if (sig === board.getAttribute('data-menu-sig')) return;   /* markup is current */
      var cols = $$('.board-col', board);
      if (cols.length !== 2) return;
      /* The comp's left column is Coffee, Tea, Take home; everything else
         goes right, so a section the owner adds lands somewhere sensible
         rather than shifting the whole board. */
      var LEFT = ['coffee', 'tea', 'take-home'];
      var left = data.filter(function (s) { return LEFT.indexOf(slug(s.section)) >= 0; });
      var right = data.filter(function (s) { return LEFT.indexOf(slug(s.section)) < 0; });
      cols[0].innerHTML = left.map(sectionHTML).join('');
      cols[1].innerHTML = right.map(sectionHTML).join('');
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
  }

  function tick() {
    var m = moment();
    var next = locked ? state : (forcedState || stateAt(m));
    if (next !== state) apply(next, m, true);
    else { paintHero(m, state); paintStamp(m, state); paintIndicator(m); }
  }

  /* ---------------------------------------------------------------- init --- */

  function init() {
    paint();                 /* idempotent: the inline call already did this */
    wireIndicator();
    syncSchema();
    hydrateMenu();
    loadPigment();

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
