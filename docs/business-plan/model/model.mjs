#!/usr/bin/env node
/* model.mjs — the financial model for the Gam Sia garage cafe.
 *
 * Reads the real menu from ../../../menu.json and the real trading hours from
 * ../../../config.js, so the revenue side of this model can never drift from
 * what the site actually says. Change a price on the board and the model
 * follows.
 *
 * Everything that is NOT derived from those two files is an ASSUMPTION, and
 * every assumption lives in the ASSUMPTIONS block below with a source note.
 * No dependencies. Run:  node docs/business-plan/model/model.mjs
 * Write the markdown:    node docs/business-plan/model/model.mjs --write
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

/* ─────────────────────────────────────────────────────────────────────────
   THE TWO OWNER-EDITABLE FILES — derived, never assumed
   ───────────────────────────────────────────────────────────────────────── */

const menu = JSON.parse(readFileSync(join(ROOT, 'menu.json'), 'utf8'));

/* config.js is a plain script that assigns a global. Evaluate the object
   literal out of it rather than importing, because it is not a module. */
const configSrc = readFileSync(join(ROOT, 'config.js'), 'utf8');
const CAFE = new Function(`${configSrc}; return CAFE;`)();

const tradingDays = Object.entries(CAFE.hours).filter(([, h]) => h !== null);
const hoursPerWeek = tradingDays.reduce((n, [, [o, c]]) => n + (c - o), 0);
const daysPerWeek = tradingDays.length;

/* ─────────────────────────────────────────────────────────────────────────
   ASSUMPTIONS — every one of these is a guess you should argue with.
   Sourced figures are marked. Unsourced ones are the modeller's judgement
   and are the first thing to sensitivity-test.
   ───────────────────────────────────────────────────────────────────────── */

const ASSUMPTIONS = {
  weeksPerYear: 48,           // 4 weeks off: Christmas, a winter break, illness

  /* Share of TRANSACTIONS that include an item from each board section.
     A customer typically buys a drink plus something else, so these sum to
     more than 1 — that is the attach rate, not a distribution error. */
  attach: {
    Coffee:      0.62,        // the anchor purchase
    Matcha:      0.22,        // the differentiator, and the reason people drive
    Desserts:    0.45,        // very high attach for a weekend suburban cafe
    Kitchen:     0.30,        // hot food: slow to make, caps throughput
    Cold:        0.12,        // weather-dependent, summer skew
    'Take home': 0.06,        // beans and matcha, impulse at the counter
  },

  /* Cost of goods as a share of that section's menu price. Melbourne 2026
     wholesale inputs; see 13-financial-model.md for the per-cup build-up. */
  cogsRate: {
    Coffee:      0.22,
    Matcha:      0.30,        // ceremonial matcha is the expensive input
    Desserts:    0.32,        // baked in-house; higher if bought in
    Kitchen:     0.38,        // prawns and eggs are the margin killers
    Cold:        0.25,
    'Take home': 0.65,        // retail resale, thin by design
  },

  /* Packaging is charged per transaction, not per item: a cup, a lid, a
     napkin, a bag. Takeaway-heavy trade pushes this up. */
  packagingPerTransaction: 0.42,

  /* Throughput. One person on a machine can pull and pour roughly this many
     transactions an hour sustained; two people roughly doubles it until the
     grill becomes the constraint. Peak is ~1.6x the average across a
     6-hour Sunday because 9am–11am carries the day. */
  transactionsPerHour: { lean: 8, base: 14, stretch: 22 },

  /* Labour. Rates are the award-derived cost of a casual Food & Beverage
     Attendant on a Sunday, all-in (base + casual loading + Sunday penalty +
     super). Owner hours are unpaid in the P&L and then valued separately,
     because pretending the owner works for nothing is how cafes lie to
     themselves. */
  /* Restaurant Industry Award MA000119, casual Level 2 (Food & Beverage
     Attendant Grade 2), Sunday = 150% including the 25% casual loading =
     $48.46/hr, plus 12% superannuation. This is the number that decides
     whether a Sunday-only cafe can afford anyone at all. */
  staffHourlyAllIn: 54.28,
  staffHoursPerTradingDay: { lean: 0, base: 6, stretch: 14 },
  ownerHoursPerTradingDay: 13,     // 6 trading + 7 prep, baking, cleaning, admin
  ownerHourlyOpportunityCost: 40,  // what the owner's Sunday is worth elsewhere

  /* Fixed annual operating costs, in AUD. Sourced in the domain briefings. */
  fixedAnnual: {
    'Public & product liability insurance': 1200,
    'Business contents & equipment insurance': 900,
    'Home insurance uplift (business use disclosed)': 700,
    'Food Act registration renewal (Class 2)': 800,
    'Commercial waste collection': 2400,
    'Grease arrestor pump-out & servicing': 1200,   // $150–400/quarter, Melbourne
    'Backflow device annual test': 250,
    'Essential Safety Measures annual statement': 600,
    'Trade waste agreement (Yarra Valley Water)': 625,  // contract fee, billed quarterly
    'Utilities uplift (power, water, gas)': 3000,
    'Accounting & BAS': 2200,
    'POS & software subscriptions': 900,
    'Repairs, servicing & machine maintenance': 1500,
    'Marketing & signage': 600,
    'Council rates uplift (commercial reclassification)': 1500,
    'Sundries & contingency': 1200,
  },

  merchantFeeRate: 0.016,     // card fees on ~95% of a modern cafe's takings
  cardShare: 0.95,

  /* Capital. Low = second-hand and self-installed. High = new gear and
     trades for everything. See 05-building-and-access.md for the compliance
     side, which is the bulk of it. */
  capex: {
    'Planning permit application & town planner': [3500, 12000],
    'Building permit, surveyor, drawings': [4000, 14000],
    'Garage structural works, lining, insulation, floor': [8000, 30000],
    'Fire separation from the dwelling': [3000, 12000],
    /* NCC Part F4: patron sanitary facilities are not required where the
       building accommodates not more than 20 persons. Cap the fitout at 20
       and this line goes to zero — the single largest saving available. */
    'Accessible patron toilet (avoidable at ≤20 persons)': [0, 30000],
    'Accessible entry, ramp, path of travel': [3000, 15000],
    'Mechanical exhaust hood & make-up air': [6000, 18000],
    'Plumbing: sinks, hand basin, warm water, tempering': [5000, 14000],
    'Grease arrestor supply & install': [4000, 12000],
    'Backflow prevention device': [1200, 3000],
    'Electrical: dedicated circuits, board, possible 3-phase': [3000, 15000],
    'Espresso machine & grinders': [6000, 22000],
    'Refrigeration, freezer, under-bench': [3000, 9000],
    'Grill, oven, small kitchen equipment': [2500, 8000],
    'Glasswasher / commercial dishwasher': [1500, 5000],
    'Benches, joinery, counter, shelving': [4000, 18000],
    'Seating, fitout, lighting, signage': [2000, 10000],
    'POS, EFTPOS, small wares, opening stock': [2500, 6000],
    'Food safety program, training, certification': [500, 1500],
    'Legal, title search, covenant advice, insurance broking': [1000, 4000],
  },
};

/* ─────────────────────────────────────────────────────────────────────────
   THE MODEL
   ───────────────────────────────────────────────────────────────────────── */

const A = ASSUMPTIONS;
const money = (n) => {
  const v = Object.is(n, -0) ? 0 : n;
  return v < 0 ? `-$${Math.abs(v).toLocaleString('en-AU', { maximumFractionDigits: 0 })}`
               : `$${v.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
};
const money2 = (n) => `$${n.toFixed(2)}`;
const pct = (n) => `${(n * 100).toFixed(1)}%`;

/** Average price of a section, straight mean of its items. */
function sectionAverage(section) {
  const items = section.items.map((i) => parseFloat(i.price));
  return items.reduce((a, b) => a + b, 0) / items.length;
}

/** Average transaction value, and the COGS carried inside it. */
function basket() {
  let revenue = 0;
  let cogs = 0;
  const lines = [];
  for (const section of menu) {
    const attach = A.attach[section.section] ?? 0;
    const avg = sectionAverage(section);
    const rev = attach * avg;
    const cost = rev * (A.cogsRate[section.section] ?? 0.3);
    revenue += rev;
    cogs += cost;
    lines.push({
      section: section.section,
      items: section.items.length,
      avgPrice: avg,
      attach,
      revenuePerTransaction: rev,
      cogsRate: A.cogsRate[section.section] ?? 0.3,
      cogsPerTransaction: cost,
    });
  }
  cogs += A.packagingPerTransaction;
  return { atv: revenue, cogs, lines };
}

function scenario(name) {
  const b = basket();
  const tph = A.transactionsPerHour[name];
  const transactionsPerDay = tph * hoursPerWeek / daysPerWeek;
  const transactionsPerYear = tph * hoursPerWeek * A.weeksPerYear;

  const revenue = transactionsPerYear * b.atv;
  const cogs = transactionsPerYear * b.cogs;
  const grossProfit = revenue - cogs;

  const staffHours = A.staffHoursPerTradingDay[name] * daysPerWeek * A.weeksPerYear;
  const wages = staffHours * A.staffHourlyAllIn;

  const merchantFees = revenue * A.cardShare * A.merchantFeeRate;
  const fixed = Object.values(A.fixedAnnual).reduce((a, c) => a + c, 0);
  const opex = wages + merchantFees + fixed;

  const ebitda = grossProfit - opex;

  const ownerHours = A.ownerHoursPerTradingDay * daysPerWeek * A.weeksPerYear;
  const ownerEffectiveRate = ebitda / ownerHours;
  const economicProfit = ebitda - ownerHours * A.ownerHourlyOpportunityCost;

  return {
    name, tph, transactionsPerDay, transactionsPerYear, atv: b.atv,
    revenue, cogs, grossProfit, wages, staffHours, merchantFees, fixed, opex,
    ebitda, ownerHours, ownerEffectiveRate, economicProfit,
    grossMargin: grossProfit / revenue,
  };
}

/** Transactions per year needed for EBITDA = 0, holding staffing fixed. */
function breakEven(name) {
  const b = basket();
  const contributionPerTransaction =
    b.atv - b.cogs - b.atv * A.cardShare * A.merchantFeeRate;
  const staffHours = A.staffHoursPerTradingDay[name] * daysPerWeek * A.weeksPerYear;
  const wages = staffHours * A.staffHourlyAllIn;
  const fixed = Object.values(A.fixedAnnual).reduce((a, c) => a + c, 0);
  const need = (wages + fixed) / contributionPerTransaction;
  return {
    contributionPerTransaction,
    transactionsPerYear: need,
    transactionsPerTradingDay: need / (daysPerWeek * A.weeksPerYear),
    transactionsPerHour: need / (hoursPerWeek * A.weeksPerYear),
    revenue: need * b.atv,
  };
}

function capexTotals() {
  const low = Object.values(A.capex).reduce((a, [l]) => a + l, 0);
  const high = Object.values(A.capex).reduce((a, [, h]) => a + h, 0);
  return { low, high, mid: (low + high) / 2 };
}

/* ─────────────────────────────────────────────────────────────────────────
   OUTPUT
   ───────────────────────────────────────────────────────────────────────── */

const b = basket();
const scenarios = ['lean', 'base', 'stretch'].map(scenario);
const cap = capexTotals();

const out = [];
const w = (s = '') => out.push(s);

w('<!-- Generated by docs/business-plan/model/model.mjs — do not hand-edit. -->');
w('<!-- Re-run: node docs/business-plan/model/model.mjs --write -->');
w();
w('# The numbers');
w();
w(`Trading pattern read from \`config.js\`: **${daysPerWeek} day a week, ${hoursPerWeek} hours**` +
  ` (${tradingDays.map(([d, [o, c]]) => `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]} ${o}:00–${c}:00`).join(', ')}),` +
  ` ${A.weeksPerYear} weeks a year.`);
w(`Prices read from \`menu.json\`: **${menu.reduce((n, s) => n + s.items.length, 0)} items across ${menu.length} sections**.`);
w();
w('## What one customer is worth');
w();
w('| Section | Items | Avg price | Attach rate | Revenue / txn | COGS % | COGS / txn |');
w('| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
for (const l of b.lines) {
  w(`| ${l.section} | ${l.items} | ${money2(l.avgPrice)} | ${pct(l.attach)} | ${money2(l.revenuePerTransaction)} | ${pct(l.cogsRate)} | ${money2(l.cogsPerTransaction)} |`);
}
w(`| Packaging | — | — | — | — | — | ${money2(A.packagingPerTransaction)} |`);
w(`| **Average transaction** | | | | **${money2(b.atv)}** | | **${money2(b.cogs)}** |`);
w();
w(`Gross margin per transaction: **${money2(b.atv - b.cogs)}** (${pct((b.atv - b.cogs) / b.atv)}).`);
w();
w('## Three scenarios');
w();
w('| | Lean | Base | Stretch |');
w('| --- | ---: | ---: | ---: |');
const row = (label, f) => w(`| ${label} | ${f(scenarios[0])} | ${f(scenarios[1])} | ${f(scenarios[2])} |`);
row('Transactions / hour', (s) => s.tph);
row('Transactions / Sunday', (s) => Math.round(s.transactionsPerDay));
row('Transactions / year', (s) => Math.round(s.transactionsPerYear).toLocaleString('en-AU'));
row('**Revenue**', (s) => `**${money(s.revenue)}**`);
row('Cost of goods', (s) => money(-s.cogs));
row('Gross profit', (s) => money(s.grossProfit));
row('Gross margin', (s) => pct(s.grossMargin));
row('Wages (staff, incl. Sunday penalties)', (s) => money(-s.wages));
row('Merchant fees', (s) => money(-s.merchantFees));
row('Fixed operating costs', (s) => money(-s.fixed));
row('**EBITDA (owner unpaid)**', (s) => `**${money(s.ebitda)}**`);
row('Owner hours / year', (s) => Math.round(s.ownerHours).toLocaleString('en-AU'));
row('Owner effective hourly rate', (s) => money2(s.ownerEffectiveRate));
row('Economic profit (owner time costed)', (s) => money(s.economicProfit));
w();
w('## Break-even');
w();
w('| | Lean | Base | Stretch |');
w('| --- | ---: | ---: | ---: |');
const be = ['lean', 'base', 'stretch'].map(breakEven);
w(`| Contribution / transaction | ${be.map((x) => money2(x.contributionPerTransaction)).join(' | ')} |`);
w(`| Transactions / year to break even | ${be.map((x) => Math.round(x.transactionsPerYear).toLocaleString('en-AU')).join(' | ')} |`);
w(`| Transactions / Sunday to break even | ${be.map((x) => Math.round(x.transactionsPerTradingDay)).join(' | ')} |`);
w(`| Customers / hour to break even | ${be.map((x) => x.transactionsPerHour.toFixed(1)).join(' | ')} |`);
w(`| Revenue to break even | ${be.map((x) => money(x.revenue)).join(' | ')} |`);
w();
w('## Capital required before the first coffee');
w();
w('| Line | Low | High |');
w('| --- | ---: | ---: |');
for (const [k, [lo, hi]] of Object.entries(A.capex)) {
  w(`| ${k} | ${money(lo)} | ${money(hi)} |`);
}
w(`| **Total** | **${money(cap.low)}** | **${money(cap.high)}** |`);
w();
w('## Payback');
w();
w('| | Lean | Base | Stretch |');
w('| --- | ---: | ---: | ---: |');
for (const [label, amount] of [['Low capex', cap.low], ['Mid capex', cap.mid], ['High capex', cap.high]]) {
  w(`| ${label} (${money(amount)}) | ${scenarios.map((s) =>
    s.ebitda <= 0 ? 'never' : `${(amount / s.ebitda).toFixed(1)} yrs`).join(' | ')} |`);
}
w();
w('## Fixed operating costs, itemised');
w();
w('| Item | Annual |');
w('| --- | ---: |');
for (const [k, v] of Object.entries(A.fixedAnnual)) w(`| ${k} | ${money(v)} |`);
w(`| **Total** | **${money(Object.values(A.fixedAnnual).reduce((a, c) => a + c, 0))}** |`);
w();

const text = out.join('\n') + '\n';

if (process.argv.includes('--write')) {
  const dest = join(HERE, '..', '13-the-numbers.md');
  writeFileSync(dest, text);
  console.log(`wrote ${dest}`);
} else {
  console.log(text);
}
