// Tool 06 — Rental Yield Analyzer + RERA increase checker.

const BED_LABELS = { 0: 'studio', 1: '1-bed', 2: '2-bed', 3: '3-bed' };
const communities = Object.keys(RENT_INDEX_DATA.index);

// each strategy keeps its own management default; the input shows the active one
let mgmtLT = 0, mgmtST = 15;

// latest 5-year projection rows, refreshed by render() for CSV export
let lastProjection = [];

function indexRent() {
  const community = strVal('community');
  const beds = strVal('beds');
  const entry = RENT_INDEX_DATA.index[community];
  return entry && entry[beds] ? entry[beds] : 0;
}

// RERA allowed increase from how far current rent sits below the index.
function allowedIncrease(belowPct) {
  if (belowPct <= 10) return 0;
  if (belowPct <= 20) return 5;
  if (belowPct <= 30) return 10;
  if (belowPct <= 40) return 15;
  return 20;
}

// annual economics for one strategy at a given base (long-term) rent
function economics(strategy, baseRent, sqft) {
  const gross = strategy === 'short' ? baseRent * (1 + numVal('uplift') / 100) : baseRent;
  const mgmtPct = strategy === 'short' ? mgmtST : mgmtLT;
  const service = sqft * numVal('svc');
  const vacancy = gross * numVal('vac') / 100;
  const maintenance = gross * numVal('maint') / 100;
  const mgmt = gross * mgmtPct / 100;
  const utilities = strategy === 'short' ? numVal('utilities') * 12 : 0;
  const costs = service + vacancy + maintenance + mgmt + utilities;
  return { gross, costs, net: gross - costs };
}

function annuityMonthly(principal, annualRatePct, years) {
  const r = annualRatePct / 100 / 12, n = years * 12;
  if (principal <= 0 || n <= 0) return 0;
  if (r <= 0) return principal / n;
  return principal * r / (1 - Math.pow(1 + r, -n));
}

// green for gains, red for losses
function setSign(id, v) {
  const el = document.getElementById(id);
  el.classList.toggle('pos', v >= 0);
  el.classList.toggle('neg', v < 0);
}

function render() {
  const price = numVal('price');
  const rent = numVal('rent');
  const sqft = numVal('sqft');
  const idx = indexRent();
  const strategy = strVal('strategy');

  const eco = economics(strategy, rent, sqft);

  // financing
  const mortgaged = document.getElementById('mortgage').checked;
  // typed values bypass the input min/max attributes, so clamp before financing math
  const ltvPct = Math.min(80, Math.max(0, numVal('ltv'))); // CBUAE caps LTV at 80%
  const ratePct = Math.max(0, numVal('rate'));
  const termYrs = Math.max(1, numVal('years'));
  let coc = price > 0 ? eco.net / price : NaN;
  let monthlyPayment = 0;
  if (mortgaged) {
    const loan = price * ltvPct / 100;
    monthlyPayment = annuityMonthly(loan, ratePct, termYrs);
    const cashInvested = price - loan + price * numVal('acqPct') / 100;
    coc = cashInvested > 0 ? (eco.net - monthlyPayment * 12) / cashInvested : NaN;
  }

  document.getElementById('sGross').textContent = price > 0 ? fmtPct(eco.gross / price) : '—';
  document.getElementById('sCosts').textContent = fmtAED(eco.costs);
  document.getElementById('sNet').textContent = price > 0 ? fmtPct(eco.net / price) : '—';
  setSign('sNet', eco.net);
  document.getElementById('sCoC').textContent = isFinite(coc) ? fmtPct(coc) : '—';
  if (isFinite(coc)) setSign('sCoC', coc);
  document.getElementById('sMonthlyK').textContent = mortgaged ? 'Monthly net income (after debt service)' : 'Monthly net income';
  document.getElementById('sMonthly').textContent = fmtAED(mortgaged ? (eco.net - monthlyPayment * 12) / 12 : eco.net / 12);
  document.getElementById('sMortgage').textContent = mortgaged ? fmtAED(monthlyPayment) : '—';

  // strategy note tracks the live short-term assumptions
  document.getElementById('strNote').textContent = 'Short-term applies the revenue uplift to rent (' +
    numVal('uplift') + '%), ' + mgmtST + '% management and ' + fmtAED(numVal('utilities')) +
    '/month utilities. The active strategy drives the stats and charts below.';

  drawBars(document.getElementById('chart'),
    ['Gross rent', 'Costs', 'Net income'],
    [{ label: 'AED / yr', values: [eco.gross, eco.costs, eco.net], color: SERIES_COLORS[0] }],
    { yFmt: v => fmtCompact(v) });

  // strategy comparison (both rows, active one highlighted)
  const longEco = economics('long', rent, sqft);
  const shortEco = economics('short', rent, sqft);
  document.getElementById('cmpLongNet').textContent = fmtAED(longEco.net);
  document.getElementById('cmpLongYield').textContent = price > 0 ? fmtPct(longEco.net / price) : '—';
  document.getElementById('cmpShortNet').textContent = fmtAED(shortEco.net);
  document.getElementById('cmpShortYield').textContent = price > 0 ? fmtPct(shortEco.net / price) : '—';
  document.getElementById('cmpLong').style.fontWeight = strategy === 'long' ? '700' : '';
  document.getElementById('cmpShort').style.fontWeight = strategy === 'short' ? '700' : '';

  // 5-year projection (unleveraged)
  const g = numVal('rentGrowth') / 100;
  const a = numVal('appr') / 100;
  const labels = [], grosses = [], nets = [];
  let totalNet = 0;
  for (let y = 0; y < 5; y++) {
    const yr = economics(strategy, rent * Math.pow(1 + g, y), sqft);
    labels.push('Y' + (y + 1));
    grosses.push(yr.gross);
    nets.push(yr.net);
    totalNet += yr.net;
  }
  const value5 = price * Math.pow(1 + a, 5);
  const totalRet = totalNet + value5 - price;
  document.getElementById('sNet5').textContent = fmtAED(totalNet);
  document.getElementById('sVal5').textContent = fmtAED(value5);
  document.getElementById('sTotalRet').textContent = price > 0 ? fmtPct(totalRet / price) : '—';
  setSign('sTotalRet', totalRet);

  // levered layer: post-debt cash flow, exit equity, 5-yr IRR (financing only)
  const projSets = [{ label: 'Net income / yr', values: nets, color: SERIES_COLORS[2] }];
  let levIrr = NaN, equityExit = NaN, cf1 = NaN, debtService = null;
  if (mortgaged) {
    const loan = price * ltvPct / 100;
    const rateDec = ratePct / 100;
    const ds = pmt(loan, rateDec, termYrs) * 12; // annual debt service
    debtService = ds;
    const cf = nets.map(n => n - ds);
    const bal5 = Math.max(0, loanBalance(loan, rateDec, termYrs, 60));
    equityExit = value5 - bal5;
    cf1 = cf[0];
    const cashInvested = price - loan + price * numVal('acqPct') / 100;
    const t0 = '2026-01-01';
    const flows = [{ date: t0, amount: -cashInvested }];
    for (let y = 0; y < 5; y++) {
      // year 5 adds net sale proceeds: value - remaining balance - 2% selling costs
      const amt = y === 4 ? cf[y] + value5 - bal5 - value5 * 0.02 : cf[y];
      flows.push({ date: addMonths(t0, 12 * (y + 1)), amount: amt });
    }
    levIrr = xirr(flows);
    projSets.push({ label: 'Post-debt cash flow / yr', values: cf, color: SERIES_COLORS[1] });
  }
  document.getElementById('sLevIRR').textContent = isFinite(levIrr) ? fmtPct(levIrr) : '—';
  if (isFinite(levIrr)) setSign('sLevIRR', levIrr);
  document.getElementById('sEquityExit').textContent = isFinite(equityExit) ? fmtAED(equityExit) : '—';
  if (isFinite(equityExit)) setSign('sEquityExit', equityExit);
  document.getElementById('sCF1').textContent = isFinite(cf1) ? fmtAED(cf1) : '—';
  if (isFinite(cf1)) setSign('sCF1', cf1);

  drawBars(document.getElementById('projChart'), labels, projSets,
    { yFmt: v => fmtCompact(v) });

  // keep the latest projection rows for CSV export
  lastProjection = labels.map((lab, y) => ({
    year: lab,
    gross: Math.round(grosses[y]),
    net: Math.round(nets[y]),
    cf: debtService !== null ? Math.round(nets[y] - debtService) : null,
  }));

  // RERA check
  const community = strVal('community');
  const beds = strVal('beds');
  document.getElementById('indexRef').textContent = community + ' · ' + BED_LABELS[beds];
  document.getElementById('indexRent').value = idx > 0 ? fmtAED(idx) : '—';

  const contract = numVal('contractRent');
  const verdict = document.getElementById('rVerdict');
  if (idx <= 0) {
    document.getElementById('rBelow').textContent = '—';
    document.getElementById('rAllowed').textContent = '—';
    document.getElementById('rMax').textContent = '—';
    verdict.className = 'verdict warn';
    verdict.textContent = 'No index data for this community and unit type — pick another combination.';
    return;
  }
  if (contract <= 0) {
    document.getElementById('rBelow').textContent = '—';
    document.getElementById('rAllowed').textContent = '—';
    document.getElementById('rMax').textContent = '—';
    verdict.className = 'verdict warn';
    verdict.textContent = 'Enter a contract rent to check against the index.';
    return;
  }

  const diffPct = (idx - contract) / idx * 100;
  const allowed = allowedIncrease(Math.max(0, diffPct));
  const maxNew = contract * (1 + allowed / 100);

  document.getElementById('rBelow').textContent = diffPct >= 0
    ? diffPct.toFixed(1) + '% below'
    : (-diffPct).toFixed(1) + '% above';
  document.getElementById('rAllowed').textContent = allowed + '%';
  document.getElementById('rMax').textContent = fmtAED(maxNew);

  if (allowed > 0) {
    verdict.className = 'verdict ok';
    verdict.textContent = 'Increase allowed: up to ' + allowed + '% (' + fmtAED(maxNew) + '/yr), with 90-day written notice before renewal.';
  } else {
    verdict.className = 'verdict warn';
    verdict.textContent = contract >= idx
      ? 'Contract rent is at or above the index — no increase permitted.'
      : 'Rent is less than 10% below the index — no increase permitted this renewal.';
  }
}

function exportCsv() {
  const esc = s => {
    s = String(s);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const financed = lastProjection.some(r => r.cf !== null);
  const lines = [financed
    ? 'Year,Gross rent (AED),Net income (AED),Post-debt cash flow (AED)'
    : 'Year,Gross rent (AED),Net income (AED)'];
  for (const r of lastProjection) {
    const row = financed ? [r.year, r.gross, r.net, r.cf] : [r.year, r.gross, r.net];
    lines.push(row.map(esc).join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rental-yield-projection.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function init() {
  const sel = document.getElementById('community');
  for (const c of communities) {
    const opt = document.createElement('option');
    opt.value = opt.textContent = c;
    sel.appendChild(opt);
  }
  sel.value = 'Dubai Marina';

  // rent fields autofill from the index until the user types their own value;
  // a field counts as clean while it is untouched or still holds the last index value
  let rentTouched = false, contractTouched = false;
  let prevIdx = indexRent();
  document.getElementById('rent').value = prevIdx;
  document.getElementById('contractRent').value = prevIdx;
  const autofill = () => {
    const idx = indexRent();
    if (!rentTouched || numVal('rent') === prevIdx) document.getElementById('rent').value = idx;
    if (!contractTouched || numVal('contractRent') === prevIdx) document.getElementById('contractRent').value = idx;
    prevIdx = idx;
    render();
  };
  sel.addEventListener('change', autofill);
  document.getElementById('beds').addEventListener('change', autofill);
  document.getElementById('rent').addEventListener('input', () => { rentTouched = true; });
  document.getElementById('contractRent').addEventListener('input', () => { contractTouched = true; });

  for (const id of ['price', 'rent', 'sqft', 'svc', 'vac', 'maint', 'contractRent', 'uplift', 'utilities', 'ltv', 'rate', 'years', 'acqPct', 'rentGrowth', 'appr']) {
    document.getElementById(id).addEventListener('input', render);
  }

  // management % is stored per strategy; the input edits the active one
  document.getElementById('mgmt').addEventListener('input', () => {
    if (strVal('strategy') === 'short') mgmtST = numVal('mgmt'); else mgmtLT = numVal('mgmt');
    render();
  });

  document.getElementById('strategy').addEventListener('change', () => {
    const s = strVal('strategy');
    document.getElementById('mgmt').value = s === 'short' ? mgmtST : mgmtLT;
    document.getElementById('upliftField').hidden = s !== 'short';
    document.getElementById('utilField').hidden = s !== 'short';
    render();
  });

  document.getElementById('mortgage').addEventListener('change', () => {
    document.getElementById('mortgageFields').hidden = !document.getElementById('mortgage').checked;
    render();
  });

  document.getElementById('exportCsv').addEventListener('click', exportCsv);

  render();
}

init();
