// Tool 06 — Rental Yield Analyzer + RERA increase checker.

const BED_LABELS = { 0: 'studio', 1: '1-bed', 2: '2-bed', 3: '3-bed' };
const communities = Object.keys(RENT_INDEX_DATA.index);

// each strategy keeps its own management default; the input shows the active one
let mgmtLT = 0, mgmtST = 15;

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
  const utilities = strategy === 'short' ? 400 * 12 : 0;
  const costs = service + vacancy + maintenance + mgmt + utilities;
  return { gross, costs, net: gross - costs };
}

function annuityMonthly(principal, annualRatePct, years) {
  const r = annualRatePct / 100 / 12, n = years * 12;
  if (principal <= 0 || n <= 0) return 0;
  if (r <= 0) return principal / n;
  return principal * r / (1 - Math.pow(1 + r, -n));
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
  let coc = price > 0 ? eco.net / price : NaN;
  let monthlyPayment = 0;
  if (mortgaged) {
    const loan = price * numVal('ltv') / 100;
    monthlyPayment = annuityMonthly(loan, numVal('rate'), numVal('years'));
    const cashInvested = price - loan;
    coc = cashInvested > 0 ? (eco.net - monthlyPayment * 12) / cashInvested : NaN;
  }

  document.getElementById('sGross').textContent = price > 0 ? fmtPct(eco.gross / price) : '—';
  document.getElementById('sCosts').textContent = fmtAED(eco.costs);
  document.getElementById('sNet').textContent = price > 0 ? fmtPct(eco.net / price) : '—';
  document.getElementById('sCoC').textContent = isFinite(coc) ? fmtPct(coc) : '—';
  document.getElementById('sMonthly').textContent = fmtAED(eco.net / 12);
  document.getElementById('sMortgage').textContent = mortgaged ? fmtAED(monthlyPayment) : '—';

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
  const labels = [], nets = [];
  let totalNet = 0;
  for (let y = 0; y < 5; y++) {
    const yr = economics(strategy, rent * Math.pow(1 + g, y), sqft);
    labels.push('Y' + (y + 1));
    nets.push(yr.net);
    totalNet += yr.net;
  }
  const value5 = price * Math.pow(1 + a, 5);
  document.getElementById('sNet5').textContent = fmtAED(totalNet);
  document.getElementById('sVal5').textContent = fmtAED(value5);
  document.getElementById('sTotalRet').textContent = price > 0 ? fmtPct((totalNet + value5 - price) / price) : '—';

  drawBars(document.getElementById('projChart'), labels,
    [{ label: 'Net income / yr', values: nets, color: SERIES_COLORS[2] }],
    { yFmt: v => fmtCompact(v) });

  // RERA check
  const community = strVal('community');
  const beds = strVal('beds');
  document.getElementById('indexRef').textContent = community + ' · ' + BED_LABELS[beds];
  document.getElementById('indexRent').value = idx > 0 ? fmtAED(idx) : '—';

  const contract = numVal('contractRent');
  const verdict = document.getElementById('rVerdict');
  if (idx <= 0 || contract <= 0) {
    document.getElementById('rBelow').textContent = '—';
    document.getElementById('rAllowed').textContent = '—';
    document.getElementById('rMax').textContent = '—';
    verdict.className = 'verdict warn';
    verdict.textContent = 'Enter a contract rent to check against the index.';
    return;
  }

  const belowPct = Math.max(0, (idx - contract) / idx * 100);
  const allowed = allowedIncrease(belowPct);
  const maxNew = contract * (1 + allowed / 100);

  document.getElementById('rBelow').textContent = belowPct.toFixed(1) + '%';
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

function init() {
  const sel = document.getElementById('community');
  for (const c of communities) {
    const opt = document.createElement('option');
    opt.value = opt.textContent = c;
    sel.appendChild(opt);
  }
  sel.value = 'Dubai Marina';
  document.getElementById('rent').value = indexRent();

  // community/beds change re-fills rent from the index; everything else just recalcs
  sel.addEventListener('change', () => { document.getElementById('rent').value = indexRent(); render(); });
  document.getElementById('beds').addEventListener('change', () => { document.getElementById('rent').value = indexRent(); render(); });
  for (const id of ['price', 'rent', 'sqft', 'svc', 'vac', 'maint', 'contractRent', 'uplift', 'ltv', 'rate', 'years', 'rentGrowth', 'appr']) {
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
    render();
  });

  document.getElementById('mortgage').addEventListener('change', () => {
    document.getElementById('mortgageFields').hidden = !document.getElementById('mortgage').checked;
    render();
  });

  render();
}

init();
