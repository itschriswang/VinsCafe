# Structure, tax and GST

**Bottom line: the tax admin is easy. The one thing that is not easy, and that
almost nobody sees coming, is that dedicating part of your house to a business
permanently costs you part of the capital gains tax exemption on your home — and
you cannot avoid it by declining to claim deductions.**

## Structure

For a one-day-a-week cafe run by its owner, **sole trader** is the sensible
default: free to establish, no ASIC annual fee, simplest possible accounting,
and losses in the early years can offset other income (subject to the
non-commercial loss rules, which given the projected losses in
[13-the-numbers.md](13-the-numbers.md) are worth asking your accountant about
specifically).

Sole trader means **unlimited personal liability** — a food poisoning claim
reaches your house. A **company** puts a shell between the business and your
personal assets, at the cost of setup, an annual ASIC review fee and real
bookkeeping. **[VERIFY]** current ASIC fees.

The honest position: for a business operating **inside your own home**, the
company structure protects you less than it appears to. The house is the
premises; the risk is on the land you own. **Insurance does the real work here,
not the structure.** See [08-insurance-and-liability.md](08-insurance-and-liability.md).

Recommendation: **sole trader, with genuinely good insurance**, and revisit if
the business grows past one day a week.

## Registrations

| | |
| --- | --- |
| **ABN** | Free, via the Australian Business Register. Required. |
| **Business name** | "gam sia" registered with ASIC if trading under it. One- or three-year terms. **[VERIFY]** fee |
| **TFN** | Sole traders use their individual TFN. |
| **GST** | Compulsory at **$75,000** turnover. **[CONFIRMED]** |
| **PAYG withholding + STP** | Only if you employ. See [07-employment.md](07-employment.md). |

### Should you register for GST?

Every scenario in [13-the-numbers.md](13-the-numbers.md) lands **under
$75,000** — the stretch case is $64,848. So registration is **optional**.

**Register anyway, at least for the build year.** The capital spend is
$56,700–$228,500 and most of it carries GST. Registering lets you claim the input
tax credits on the fitout, the equipment and the professional fees, which on a
$100,000 build is roughly $9,000 back. That is not a rounding error at this
scale.

The cost is that you then remit 10% of your taxable sales and lodge a BAS. On a
$41,000 turnover that is real money out — so the calculation is genuinely: claim
the credits during the build, then reassess. Talk to an accountant about the
timing, because deregistering has its own adjustments.

## GST on this specific menu

The rules that matter, all **[CONFIRMED]**:

- Food or drink **consumed on the premises is taxable**, whatever it is.
- **Hot takeaway food is taxable.**
- **Tea and coffee prepared as a beverage, ready to drink, is taxable** — every
  coffee, every matcha latte, hot or iced.
- **Bakery products** — cakes, biscuits, pastries — **are always taxable.**
- **Sealed packaged tea and coffee** — beans, grounds, leaf — sold to take home
  is **GST-free**.

Applied to [`menu.json`](../../menu.json):

| Board section | Items | GST |
| --- | --- | --- |
| Coffee | filter, espresso, cortado, flat white, latte, cold brew | **Taxable** — prepared beverages |
| Matcha | all seven | **Taxable** — prepared beverages |
| Cold | iced filter, Vietnamese iced coffee, lemonade, yuzu soda | **Taxable** — prepared beverages |
| Kitchen | pho toastie, prawn roll, kaya toast | **Taxable** — hot cooked food |
| Desserts | cheesecake, cookie, cake, bun, croissant, tart | **Taxable** — bakery products |
| **Take home** | **Beans 250g** | **GST-free** — sealed packaged coffee |
| | **Matcha 30g** | **GST-free** — sealed packaged tea **[LIKELY]** |
| | Filter papers | **Taxable** — not food |

So: **everything is taxable except the take-home beans and matcha.** Because the
cafe has seating, even items that would be GST-free as groceries become taxable
when consumed on the premises — which simplifies the till considerably. Two
GST-free SKUs, everything else at 10%.

**What this means for the board prices.** If you register for GST, the prices in
`menu.json` are GST-inclusive and you are remitting one-eleventh of them. A $4.00
latte yields you $3.64. That is a 9% cut to the revenue line in
[13-the-numbers.md](13-the-numbers.md), which the model does **not** currently
apply — it treats the menu prices as net. If you register, either lift prices or
re-run the model with prices divided by 1.1. See the note in
[12-concept-and-marketing.md](12-concept-and-marketing.md) about coffee being
underpriced; this is another argument for the same fix.

## The CGT trap

This is the most expensive thing in this document and it is invisible until you
sell the house.

Your main residence is normally exempt from capital gains tax. **You are not
entitled to the full exemption if you run a business from home** — you get a
**partial** exemption instead. **[CONFIRMED]**

The trigger is using part of the dwelling as a **place of business**: space set
aside exclusively for that purpose, such that you could claim a deduction for
occupancy costs. A garage converted into a registered commercial kitchen, with a
planning permit and an occupancy permit, is the textbook case. It is not a
grey area — it is the clearest possible example of a place of business.

The portion of the gain that becomes taxable is based on **the floor area used
for business and the period it was used that way**. A 35 m² garage in a 200 m²
house is roughly 17.5% of the floor area.

**And here is the part that surprises people:**

> If you set aside and use part of the dwelling **exclusively** as a place of
> business, you **cannot** preserve the CGT exemption for that part simply by
> declining to claim the interest deduction. **[CONFIRMED]**

You do not get to opt out. Not claiming deductions does not buy back the
exemption. The exemption loss follows the *use of the property*, not the
*deductions claimed*. So the choice is not "claim and lose it" versus "don't
claim and keep it" — it is "lose it either way, so you may as well claim".

### Roughly what it costs

Illustrative only, and **you must get this modelled by an accountant on your
actual numbers**:

- Suppose the house is worth $1.2m and rises to $1.7m over ten years — a $500,000 gain.
- 17.5% of the floor area used for business for the whole period → $87,500 of the gain is not exempt.
- The 50% CGT discount applies on a 10-year hold → $43,750 assessable.
- At a 37% marginal rate → roughly **$16,200 of tax**.

That is a real cost of this project, it does not appear in any year's P&L, and
it is roughly three years of the lean scenario's entire gross profit.

None of the alternatives in [11-alternatives.md](11-alternatives.md) have this
problem, because a van is not part of your house.

## Other tax matters

- **Instant asset write-off / small business depreciation** — the thresholds
  change frequently. **[VERIFY]** the rules in force for FY2026-27 before
  timing any equipment purchase.
- **Non-commercial loss rules** — with projected losses, whether you can offset
  them against other income depends on passing one of the ATO's tests. Ask
  specifically; this materially affects the after-tax cost of the early years.
- **Record keeping** — five years, and a Class 2 food business generates its own
  parallel record set anyway. See [14-operations.md](14-operations.md).

## Benchmarks to measure yourself against

The ATO publishes small business benchmarks built from actual tax returns. For
**cafes and coffee shops**: **cost of sales 33–42% of turnover**, averaging
36–38%. **[CONFIRMED]** Labour 23–31% and rent 9–14% for comparable turnover
bands. **[LIKELY]**

The model in [13-the-numbers.md](13-the-numbers.md) computes cost of sales at
**37.7%** — dead centre of the band. That is a useful signal: the *menu
economics are normal*. What is abnormal is the fixed cost per trading hour, and
no amount of pricing fixes that.

Being outside the benchmark range is also what draws ATO attention, so it is
worth tracking deliberately from the first year.

## Ask your accountant

- Sole trader or company for a business physically inside my home?
- Should I register for GST during the build year to claim the fitout credits, and what happens when I deregister?
- Exactly what CGT exposure am I creating, on this house, at this floor area? Model it.
- Do I pass any of the non-commercial loss tests, so early losses can offset other income?
- What is the current instant asset write-off position for FY2026-27?
