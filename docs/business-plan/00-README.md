# Opening gam sia in the garage — the whole plan

Everything needed to decide whether the cafe on the board can lawfully and
profitably open out of the garage at **10 Katupna Ct, Vermont South VIC 3133**,
in the **City of Whitehorse**, on **Sundays 8am–2pm** — the trading pattern
`config.js` already describes.

**Start with [01-the-verdict.md](01-the-verdict.md).** If you read one file,
read that one.

## How to read this

| | |
| --- | --- |
| [01-the-verdict.md](01-the-verdict.md) | The answer, the reasoning, and what to do instead. |
| [02-planning-permit.md](02-planning-permit.md) | Land use, Clause 52.11, the zone, parking, signs, objections. |
| [03-food-registration.md](03-food-registration.md) | Food Act 1984, the class system, why a domestic kitchen will not do. |
| [04-building-and-access.md](04-building-and-access.md) | Change of use to Class 6, the NCC, and the 20-person rule that saves $30k. |
| [05-utilities-waste.md](05-utilities-waste.md) | Trade waste, grease arrestor, backflow, commercial bins, rates. |
| [06-structure-tax-gst.md](06-structure-tax-gst.md) | Entity, ABN, GST per menu item, and the CGT trap on your house. |
| [07-employment.md](07-employment.md) | The Sunday penalty rate, and why it makes help unaffordable. |
| [08-insurance-and-liability.md](08-insurance-and-liability.md) | The cover you need, and the home policy you are about to void. |
| [09-neighbours.md](09-neighbours.md) | Noise, parking, odour, and the people who can stop this. |
| [10-title-covenants-mortgage.md](10-title-covenants-mortgage.md) | The title search that can end the project for $50. |
| [11-alternatives.md](11-alternatives.md) | The routes that actually work, ranked. **The recommendation lives here.** |
| [12-concept-and-marketing.md](12-concept-and-marketing.md) | Positioning, who comes, channels, pricing. |
| [13-the-numbers.md](13-the-numbers.md) | Generated. Do not hand-edit. |
| [14-operations.md](14-operations.md) | The Sunday run sheet and the week around it. |
| [15-risk-register.md](15-risk-register.md) | What goes wrong, how likely, what it costs. |
| [16-critical-path.md](16-critical-path.md) | The order to do things in, and the cheap kill-switches first. |
| [17-contacts-and-questions.md](17-contacts-and-questions.md) | Who to ring, and the exact questions to ask them. |

## The model

`model/model.mjs` reads `menu.json` and `config.js` directly rather than
restating them, so the revenue side cannot drift from the board. Change a price
or a trading day and the model follows.

```sh
node docs/business-plan/model/model.mjs           # print to stdout
node docs/business-plan/model/model.mjs --write   # regenerate 13-the-numbers.md
```

Everything not derived from those two files sits in one `ASSUMPTIONS` block at
the top. **The assumptions are the argument** — they are what to attack. The
attach rates and the throughput figures are judgement; the award rate, the trade
waste fee and the cost-of-sales band are sourced.

## Nothing here ships

The deploy workflow copies an explicit list of files into `_site` and `docs/` is
not on it, so none of this reaches the website. No site UI or copy was changed,
so the social cards did not need regenerating. `node tools/sync-static.mjs
--check` passes.

## How these facts were gathered, and how much to trust them

Read this before spending money on anything in here.

This plan was researched from **web search results only**. The session's network
policy blocked direct access to every primary source — `planning.vic.gov.au`,
`whitehorse.vic.gov.au`, `health.vic.gov.au`, `ato.gov.au`, `fairwork.gov.au`,
`yvw.com.au` and the rest were all refused by the egress proxy. So the clause
numbers, thresholds and dollar figures below come from search engine summaries of
those pages, not from the pages themselves.

That is good enough to **shape a decision** and it is emphatically not good
enough to **sign a contract on**. In particular:

- **Nothing here was verified against the Whitehorse Planning Scheme itself**,
  including the single most important fact of all: what zone 10 Katupna Ct is
  actually in. General Residential and Neighbourhood Residential have materially
  different use tables. This plan assumes General Residential and flags
  everywhere that this needs checking.
- **Council fees are not quoted** where they could not be sourced. Where a
  figure is a placeholder it says so. Do not budget off a number that is marked
  unverified.
- **One live legal change is flagged and unresolved**: the *Planning Amendment
  (Better Decisions Made Faster) Act 2026* appears to reverse s61(4) of the
  *Planning and Environment Act 1987* on restrictive covenants. Whether it has
  commenced, and in what form, materially affects
  [10-title-covenants-mortgage.md](10-title-covenants-mortgage.md). Check it.

Every substantive claim carries a confidence tag:

- **[CONFIRMED]** — consistent across multiple independent sources.
- **[LIKELY]** — one credible source, or several that broadly agree.
- **[VERIFY]** — directionally right, specifics unconfirmed. Ring someone.

[17-contacts-and-questions.md](17-contacts-and-questions.md) lists exactly who
to ring and what to ask, in the order that resolves the most uncertainty per
phone call.

**This is not legal, planning, building, tax or financial advice.** It is a
decision document assembled to make the professional conversations shorter and
better-informed. The professionals worth paying for are, in order: a town
planner, a registered building surveyor, and an accountant who has done
hospitality.
