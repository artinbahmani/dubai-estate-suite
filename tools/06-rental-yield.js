// Tool 06 — Rental Yield Analyzer + RERA increase checker.

const BED_LABELS = { 0: 'studio', 1: '1-bed', 2: '2-bed', 3: '3-bed' };
const communities = Object.keys(RENT_INDEX_DATA.index);

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

function render() {
  const price = numVal('price');
  const rent = numVal('rent');
  const sqft = numVal('sqft');
  const idx = indexRent();

  // costs
  const service = sqft * numVal('svc');
  const vacancy = rent * numVal('vac') / 100;
  const maintenance = rent * numVal('maint') / 100;
  const mgmt = rent * numVal('mgmt') / 100;
  const costs = service + vacancy + maintenance + mgmt;
  const net = rent - costs;

  document.getElementById('sGross').textContent = price > 0 ? fmtPct(rent / price) : '—';
  document.getElementById('sCosts').textContent = fmtAED(costs);
  document.getElementById('sNet').textContent = price > 0 ? fmtPct(net / price) : '—';
  document.getElementById('sMonthly').textContent = fmtAED(net / 12);

  drawBars(document.getElementById('chart'),
    ['Gross rent', 'Costs', 'Net income'],
    [{ label: 'AED / yr', values: [rent, costs, net], color: SERIES_COLORS[0] }],
    { yFmt: v => fmtNum(v / 1000) + 'k' });

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
  for (const id of ['price', 'rent', 'sqft', 'svc', 'vac', 'maint', 'mgmt', 'contractRent']) {
    document.getElementById(id).addEventListener('input', render);
  }
  render();
}

init();
