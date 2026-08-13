// Generates a realistic sample dataset shaped like DLD open data
// (transactions + rental index + FX series). Replace with real DLD
// open-data exports when wiring the live pipeline.
const fs = require('fs');
const path = require('path');

// community: [avg AED/sqft 2024, annual growth, villa share, avg unit sqft]
const COMMUNITIES = {
  'Dubai Marina':        [1750, 0.07, 0.02, 1050],
  'Downtown Dubai':      [2350, 0.06, 0.00, 1150],
  'Palm Jumeirah':       [3900, 0.08, 0.35, 2200],
  'JVC':                 [1080, 0.09, 0.15, 850],
  'Business Bay':        [1820, 0.07, 0.01, 950],
  'Dubai Hills Estate':  [1850, 0.08, 0.40, 1800],
  'JLT':                 [1380, 0.05, 0.00, 1000],
  'Dubai Creek Harbour': [1950, 0.08, 0.02, 1100],
  'MBR City':            [2050, 0.09, 0.30, 1900],
  'Damac Hills':         [1180, 0.06, 0.45, 2000],
  'Arjan':               [1050, 0.07, 0.05, 800],
  'International City':  [680, 0.04, 0.00, 700],
};

// avg annual rent (AED) by community and bedroom count — RERA-index-shaped sample
const RENT_INDEX = {
  'Dubai Marina':        { 0: 55000, 1: 80000, 2: 120000, 3: 180000 },
  'Downtown Dubai':      { 0: 70000, 1: 110000, 2: 170000, 3: 260000 },
  'Palm Jumeirah':       { 0: 90000, 1: 150000, 2: 260000, 3: 420000 },
  'JVC':                 { 0: 36000, 1: 50000, 2: 75000, 3: 110000 },
  'Business Bay':        { 0: 52000, 1: 78000, 2: 115000, 3: 170000 },
  'Dubai Hills Estate':  { 0: 50000, 1: 75000, 2: 115000, 3: 175000 },
  'JLT':                 { 0: 42000, 1: 60000, 2: 90000, 3: 135000 },
  'Dubai Creek Harbour': { 0: 55000, 1: 82000, 2: 125000, 3: 190000 },
  'MBR City':            { 0: 58000, 1: 88000, 2: 135000, 3: 210000 },
  'Damac Hills':         { 0: 38000, 1: 55000, 2: 85000, 3: 130000 },
  'Arjan':               { 0: 34000, 1: 47000, 2: 70000, 3: 100000 },
  'International City':  { 0: 24000, 1: 33000, 2: 48000, 3: 70000 },
};

// yearly avg FX: units of foreign currency per 1 USD (approx historical)
// covers the top DLD buyer nationalities: India, UK, Pakistan, China, Russia, Egypt, Turkey
const FX_PER_USD = {
  USD: [1, 1, 1, 1, 1, 1, 1, 1],
  EUR: [0.893, 0.877, 0.845, 0.951, 0.924, 0.924, 0.885, 0.870],
  GBP: [0.783, 0.780, 0.727, 0.811, 0.804, 0.787, 0.770, 0.755],
  INR: [70.4, 74.1, 73.9, 78.6, 82.6, 83.4, 84.6, 85.5],
  PKR: [150.2, 160.5, 162.9, 204.8, 283.0, 278.9, 281.0, 283.5],
  CNY: [6.91, 6.90, 6.45, 6.73, 7.08, 7.20, 7.25, 7.22],
  RUB: [64.7, 73.7, 73.7, 68.4, 85.0, 92.5, 91.0, 90.0],
  EGP: [16.8, 15.8, 15.7, 19.2, 30.7, 47.8, 49.6, 50.4],
  TRY: [5.67, 7.01, 8.89, 16.55, 23.7, 32.8, 36.6, 38.4],
  AED: [3.6725, 3.6725, 3.6725, 3.6725, 3.6725, 3.6725, 3.6725, 3.6725],
};
const FX_YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const gauss = () => (rand() + rand() + rand() + rand() - 2) * 0.8;

const txs = [];
const start = new Date('2024-09-01');
const months = 24;
const names = Object.keys(COMMUNITIES);

for (let m = 0; m < months; m++) {
  const d = new Date(start);
  d.setMonth(d.getMonth() + m);
  const date = d.toISOString().slice(0, 10);
  const yrFrac = m / 12;
  for (const name of names) {
    const [base, growth, villaShare, avgSqft] = COMMUNITIES[name];
    // off-plan share grows from ~55% to ~72% over the window
    const offplanShare = 0.55 + (0.17 * m) / (months - 1);
    const n = 8 + Math.floor(rand() * 10);
    for (let i = 0; i < n; i++) {
      const villa = rand() < villaShare;
      const ppsf = base * Math.pow(1 + growth, yrFrac) * (1 + gauss() * 0.06) * (villa ? 0.85 : 1);
      const sqft = Math.max(350, Math.round(avgSqft * (1 + gauss() * 0.3)));
      const beds = villa
        ? 3 + Math.floor(rand() * 3)
        : [0, 1, 1, 2, 2, 2, 3][Math.floor(rand() * 7)];
      const price = Math.round(ppsf * sqft);
      // store ppsf derived from the stored price so price/sqft always reconciles
      const day = 1 + Math.floor(rand() * 28);
      const txDate = date.slice(0, 8) + String(day).padStart(2, '0');
      txs.push({
        date: txDate,
        community: name,
        type: villa ? 'villa' : 'apartment',
        beds,
        sqft,
        price,
        ppsf: Math.round(price / sqft),
        offplan: rand() < offplanShare,
      });
    }
  }
}

const out = (file, obj, globalName) => {
  fs.writeFileSync(path.join(__dirname, '..', 'data', file), JSON.stringify(obj));
  // .js twin so pages work over file:// without fetch/CORS issues
  fs.writeFileSync(
    path.join(__dirname, '..', 'data', file.replace('.json', '.js')),
    'const ' + globalName + ' = ' + JSON.stringify(obj) + ';\n'
  );
};

out('transactions.json', { generated: 'sample', months, records: txs }, 'DLD_TRANSACTIONS');
out('rent-index.json', { generated: 'sample', index: RENT_INDEX }, 'RENT_INDEX_DATA');
out('fx.json', { generated: 'sample', years: FX_YEARS, perUSD: FX_PER_USD, note: 'units of currency per 1 USD; AED is pegged at 3.6725' }, 'FX_DATA');

console.log('transactions:', txs.length, '| communities:', names.length, '| rent index + fx written');
