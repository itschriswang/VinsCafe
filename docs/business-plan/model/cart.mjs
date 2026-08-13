#!/usr/bin/env node
/* cart.mjs — the matcha cart, modelled the same way the garage was.
 *
 * Same rule as model.mjs: the drinks and their prices come from ../../../menu.json,
 * not from this file. The cart sells the three drink sections of the board and
 * leaves the grill behind, so the menu it works from is derived, not retyped.
 *
 * Two revenue streams, because they have almost nothing in common:
 *   MARKETS   — you sell to strangers, one drink at a time, and carry the risk.
 *   EVENTS    — someone books the cart for a fixed fee and the risk is theirs.
 *
 * No dependencies.  node docs/business-plan/model/cart.mjs [--write]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const menu = JSON.parse(readFileSync(join(ROOT, 'menu.json'), 'utf8'));

/* The cart takes the drinks and leaves the kitchen. */
const DRINK_SECTIONS = ['Coffee', 'Matcha', 'Cold'];

const A = {
  /* ---- what a drink costs to make, in AUD -------------------------------
     Matcha at $160/kg wholesale is $0.64 at a 4g dose. Milk and oat are per
     200mL pour. Coffee is a 20g double off a ~$40/kg wholesale bean. */
  cogs: { matchaServe: 0.64, coffeeServe: 0.80, milkServe: 0.38, cupLid: 0.35 },

  /* Share of drinks sold that are matcha rather than coffee. The whole point
     of the cart is that this number is high — it is the differentiator, and
     it is also the cheaper input. */
  matchaShare: 0.55,

  /* ---- markets ----------------------------------------------------------
     A community market, not a VFMA-accredited farmers' market: accredited
     markets do not take resellers, and a cart pouring imported matcha is a
     reseller. See 18-home-kitchen-and-the-cart.md. */
  market: {
    daysPerYear: 40,
    hours: 5,
    stallFee: 90,          // community market, 3x3m site
    transactionsPerHour: 22,
    travel: 25,
  },

  /* ---- private events ---------------------------------------------------
     Weddings, corporate, brand activations. Melbourne market rate for a
     coffee/matcha cart is roughly $490 to $1,200+; most professional hire
     starts around $750. A package is a fixed fee, not per head. */
  event: {
    perYear: 30,
    packageFee: 950,
    drinksServed: 130,
    staffHours: 6,         // setup, service, pack down
    staffRate: 45,         // one casual hand, weekend
    travel: 60,
  },

  /* ---- the whole year --------------------------------------------------- */
  fixedAnnual: {
    'Mobile food premises registration': 450,
    'Public & product liability insurance': 1100,
    'Vehicle: rego, insurance, servicing': 2600,
    'Cart maintenance & machine servicing': 900,
    'Phone, website, bookings, POS': 700,
    'Accounting & BAS': 1400,
    'Water, gas bottles, sundries': 600,
    'Marketing & photography': 900,
  },

  capex: {
    'Cart or trailer, fitted': [12000, 38000],
    'Espresso machine (LPG or battery)': [4000, 14000],
    'Grinder': [900, 2500],
    'Matcha station: whisks, sifters, chawan, thermometer': [400, 1200],
    'Water tanks, pump, power or generator': [1200, 4500],
    'Refrigeration & esky': [600, 2200],
    'Tow vehicle allowance (if needed)': [0, 25000],
    'POS, EFTPOS, signage, branding': [1200, 4000],
    'Food handler training & registration': [300, 800],
    'Opening stock & smallwares': [800, 2000],
  },
};

/* ---- the model -------------------------------------------------------------- */

const money = (n) => {
  const v = Object.is(n, -0) ? 0 : n;
  return (v < 0 ? '-$' : '$') +
    Math.abs(v).toLocaleString('en-AU', { maximumFractionDigits: 0 });
};
const money2 = (n) => `$${n.toFixed(2)}`;
const pct = (n) => `${(n * 100).toFixed(1)}%`;

/** Average price of a drink across the board's drink sections. */
function drinkPrices() {
  const rows = menu
    .filter((s) => DRINK_SECTIONS.includes(s.section))
    .map((s) => ({
      section: s.section,
      n: s.items.length,
      avg: s.items.reduce((a, i) => a + parseFloat(i.price), 0) / s.items.length,
    }));
  const all = menu
    .filter((s) => DRINK_SECTIONS.includes(s.section))
    .flatMap((s) => s.items.map((i) => parseFloat(i.price)));
  return { rows, avg: all.reduce((a, b) => a + b, 0) / all.length, count: all.length };
}

/** What one drink costs to put in a cup, blended across the matcha/coffee mix. */
function cogsPerDrink() {
  const base = A.matchaShare * A.cogs.matchaServe + (1 - A.matchaShare) * A.cogs.coffeeServe;
  return base + A.cogs.milkServe + A.cogs.cupLid;
}

function markets() {
  const m = A.market;
  const price = drinkPrices().avg;
  const cogs = cogsPerDrink();
  const perDay = m.transactionsPerHour * m.hours;
  const revenue = perDay * price * m.daysPerYear;
  const cost = perDay * cogs * m.daysPerYear + (m.stallFee + m.travel) * m.daysPerYear;
  return {
    daysPerYear: m.daysPerYear, perDay, price, cogs,
    revenue, cost, contribution: revenue - cost,
    perDayContribution: (revenue - cost) / m.daysPerYear,
  };
}

function events() {
  const e = A.event;
  const cogs = cogsPerDrink();
  const revenue = e.packageFee * e.perYear;
  const perEventCost = e.drinksServed * cogs + e.staffHours * e.staffRate + e.travel;
  const cost = perEventCost * e.perYear;
  return {
    perYear: e.perYear, fee: e.packageFee, perEventCost,
    revenue, cost, contribution: revenue - cost,
    perEventContribution: e.packageFee - perEventCost,
  };
}

const mk = markets();
const ev = events();
const fixed = Object.values(A.fixedAnnual).reduce((a, c) => a + c, 0);
const revenue = mk.revenue + ev.revenue;
const contribution = mk.contribution + ev.contribution;
const ebitda = contribution - fixed;
const capLow = Object.values(A.capex).reduce((a, [l]) => a + l, 0);
const capHigh = Object.values(A.capex).reduce((a, [, h]) => a + h, 0);

/* Owner hours: a market day is the 5 hours plus 3 either side; an event is the
   6 rostered hours plus 2 of quoting, prep and invoicing. */
const ownerHours = mk.daysPerYear * 8 + ev.perYear * 8;

const out = [];
const w = (s = '') => out.push(s);

w('<!-- Generated by docs/business-plan/model/cart.mjs — do not hand-edit. -->');
w('<!-- Re-run: node docs/business-plan/model/cart.mjs --write -->');
w();
w('# The cart, by the numbers');
w();
w('The same modelling applied to the matcha cart instead of the garage. Drinks and');
w(`prices are read from \`menu.json\`: the **${drinkPrices().count} drinks** across`);
w(`${DRINK_SECTIONS.join(', ')}. The grill stays home.`);
w();
w('## What a drink is worth');
w();
w('| Section | Drinks | Average price |');
w('| --- | ---: | ---: |');
for (const r of drinkPrices().rows) w(`| ${r.section} | ${r.n} | ${money2(r.avg)} |`);
w(`| **All drinks** | **${drinkPrices().count}** | **${money2(drinkPrices().avg)}** |`);
w();
w(`Cost to make, blended at ${pct(A.matchaShare)} matcha: **${money2(cogsPerDrink())}**`);
w(`(matcha ${money2(A.cogs.matchaServe)} at 4g of $160/kg, or coffee ${money2(A.cogs.coffeeServe)},`);
w(`plus milk ${money2(A.cogs.milkServe)} and cup ${money2(A.cogs.cupLid)}).`);
w(`Gross margin per drink: **${money2(drinkPrices().avg - cogsPerDrink())}**`);
w(`(${pct((drinkPrices().avg - cogsPerDrink()) / drinkPrices().avg)}).`);
w();
w('## Markets');
w();
w('| | |');
w('| --- | ---: |');
w(`| Market days a year | ${mk.daysPerYear} |`);
w(`| Drinks a day | ${mk.perDay} |`);
w(`| Revenue | ${money(mk.revenue)} |`);
w(`| Cost of goods, stall fees, travel | ${money(-mk.cost)} |`);
w(`| **Contribution** | **${money(mk.contribution)}** |`);
w(`| Per market day | ${money(mk.perDayContribution)} |`);
w();
w('## Private events');
w();
w('| | |');
w('| --- | ---: |');
w(`| Events a year | ${ev.perYear} |`);
w(`| Package fee | ${money(ev.fee)} |`);
w(`| Cost per event (drinks, one hand, travel) | ${money(-ev.perEventCost)} |`);
w(`| **Contribution per event** | **${money(ev.perEventContribution)}** |`);
w(`| Revenue | ${money(ev.revenue)} |`);
w(`| **Contribution** | **${money(ev.contribution)}** |`);
w();
w('## The year');
w();
w('| | |');
w('| --- | ---: |');
w(`| Revenue | ${money(revenue)} |`);
w(`| Contribution after direct costs | ${money(contribution)} |`);
w(`| Fixed operating costs | ${money(-fixed)} |`);
w(`| **EBITDA, owner unpaid** | **${money(ebitda)}** |`);
w(`| Owner hours | ${ownerHours.toLocaleString('en-AU')} |`);
w(`| Owner effective hourly rate | ${money2(ebitda / ownerHours)} |`);
w();
w('## Fixed costs');
w();
w('| Item | Annual |');
w('| --- | ---: |');
for (const [k, v] of Object.entries(A.fixedAnnual)) w(`| ${k} | ${money(v)} |`);
w(`| **Total** | **${money(fixed)}** |`);
w();
w('## Capital');
w();
w('| Line | Low | High |');
w('| --- | ---: | ---: |');
for (const [k, [lo, hi]] of Object.entries(A.capex)) w(`| ${k} | ${money(lo)} | ${money(hi)} |`);
w(`| **Total** | **${money(capLow)}** | **${money(capHigh)}** |`);
w();
w('## Payback');
w();
w('| | |');
w('| --- | ---: |');
for (const [label, amount] of [['Low capex', capLow], ['High capex', capHigh]]) {
  w(`| ${label} (${money(amount)}) | ${ebitda <= 0 ? 'never' : `${(amount / ebitda).toFixed(1)} yrs`} |`);
}
w();
w('## How few events it takes');
w();
w('Events carry the year. Holding markets and fixed costs where they are:');
w();
w('| Events a year | EBITDA |');
w('| --- | ---: |');
for (const n of [0, 10, 20, 30, 40, 50]) {
  const c = mk.contribution + ev.perEventContribution * n - fixed;
  w(`| ${n} | ${money(c)} |`);
}
w();
const breakEvenEvents = Math.max(0, Math.ceil((fixed - mk.contribution) / ev.perEventContribution));
w(breakEvenEvents === 0
  ? 'The market days alone very nearly cover the whole year of fixed costs, so **every ' +
    'event after the first is close to pure profit**. That is the shape of this business: ' +
    'the markets keep the lights on and build the name, and the events are the margin.'
  : `Break-even is about **${breakEvenEvents} event${breakEvenEvents === 1 ? '' : 's'} a year** ` +
    'alongside the market days.');
w();

const text = out.join('\n') + '\n';

/* The half of the comparison on plan.html that belongs to the cart. Written as
   data for the same reason model.mjs writes figures.json: tools/sync-static.mjs
   renders the table on the website from both files, so the page cannot say one
   thing while the models say another. */
const figures = {
  marketDays: mk.daysPerYear,
  eventsPerYear: ev.perYear,
  drinkPrice: drinkPrices().avg,
  cogsPerDrink: cogsPerDrink(),
  revenue: Math.round(revenue),
  fixed,
  ebitda: Math.round(ebitda),
  ownerHours,
  ownerRate: ebitda / ownerHours,
  capex: { low: capLow, high: capHigh },
  paybackLow: ebitda > 0 ? capLow / ebitda : null,
  paybackHigh: ebitda > 0 ? capHigh / ebitda : null,
};

if (process.argv.includes('--write')) {
  const dest = join(HERE, '..', '19-the-cart-numbers.md');
  writeFileSync(dest, text);
  console.log(`wrote ${dest}`);
  const json = join(HERE, 'cart-figures.json');
  writeFileSync(json, JSON.stringify(figures, null, 2) + '\n');
  console.log(`wrote ${json}`);
} else {
  console.log(text);
}
