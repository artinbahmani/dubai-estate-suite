# Dubai Estate Suite

A client-side toolkit for Dubai real estate agents covering the three segments that actually make up a Dubai book: **off-plan**, **secondary (resale)** and **rentals**.

Thirteen tools, zero dependencies, no build step. Open `index.html` in a browser and everything works — including over `file://`.

## Tools

| # | Tool | What it does |
|---|------|--------------|
| 01 | Payment Plan Calculator | Models any off-plan structure (60/40, 70/30, 80/20, 50/50, custom, post-handover) — milestone schedule, cumulative cash, NPV and IRR vs a cash-discount purchase |
| 02 | Payment Plan Comparator | Three projects side by side, ranked on real cost of money (NPV of payments) and flip IRR — not the static milestone tables portals show |
| 03 | Closing Cost Calculator | Full buyer closing breakdown: DLD 4% + admin, trustee fee, agency fee + VAT, mortgage registration, valuation, NOC, conveyancing |
| 04 | Golden Visa Checker | AED 2M property-route eligibility — combined properties, mortgaged units (bank NOC), off-plan at full DLD-certified value |
| 05 | Commission Calculator | Off-plan (developer 3–7%), resale (2% + VAT, dual agency), rental (5% of annual rent) with agent/brokerage splits from 50/50 to 80/20 and income projection |
| 06 | Rental Yield Analyzer | Gross vs net yield with service charges, vacancy and maintenance — plus a RERA rental-index increase-legality check (0/5/10/15/20% brackets) |
| 07 | Off-Plan Flip Analyzer | Sell before handover: net cash out, ROI on cash deployed, annualized return, profit sensitivity to resale price |
| 08 | Market Pulse | Transaction volume, median AED/sqft trends and off-plan share across 12 Dubai communities |
| 09 | Instant CMA | Comparative market analysis from transaction records — comps, median pricing, 25th–75th range, scatter view |
| 10 | Currency-Adjusted Returns | What a Dubai investment actually returned in the client's home currency (EUR, GBP, INR, RUB, CNY) vs the AED headline |
| 11 | Mortgage & Affordability | UAE LTV tiers and the 50% DBR cap — max affordable price, monthly payment and full amortization schedule |
| 12 | Service Charge Guide | Searchable AED/sqft ranges per community, with a yearly cost estimator by unit size |
| 13 | Offer / Form F Generator | Printable offer summary with price, deposits, commission and terms — ready for client signature |

## Structure

```
index.html            launcher
assets/style.css      shared design system
assets/shared.js      formatting, XIRR/NPV, canvas charts (line / bars / donut / scatter)
data/                 sample datasets (DLD-open-data-shaped transactions, rental index, FX, service charges)
scripts/gen-data.js   regenerates the sample datasets
tools/NN-*.html|.js   the thirteen tools
```

## Data

`data/` ships with a **sample dataset** shaped like DLD open data (24 months of transactions across 12 communities, a RERA-style rental index, yearly FX averages, indicative service-charge ranges). It exists so every tool is demonstrable offline. Swap in real DLD open-data exports to go live — the generator script documents the shape.

Figures like the 4% DLD fee, 2% agency commission and Golden Visa threshold reflect published rules as of mid-2026 — always verify against DLD/RERA before client use.

## Notes

- No frameworks, no CDNs, no tracking. Charts are hand-drawn on `<canvas>`.
- Every tool recomputes live on input.
- Designed dark-first for late-night deal work.
