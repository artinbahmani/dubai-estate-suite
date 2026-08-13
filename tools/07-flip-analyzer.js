// Tool 07 — Off-Plan Flip Analyzer
// Net position when selling an off-plan unit before handover.

const AGENCY_FEE_RATE = 0.02;
const VAT_RATE = 0.05;
const SENS_STEPS = [-0.10, -0.05, 0, 0.05, 0.10, 0.15, 0.20];
const HOLD_YEAR_OFFSETS = [0, 6, 12];

// Selling costs and net cash to the seller at a given resale price.
// Net is the same whether the buyer takes over the plan or the seller
// settles it — only the flow of funds differs (shown in the breakdown).
function closingAt(resale, outstanding, vatOn, noc) {
  const agency = resale * AGENCY_FEE_RATE * (vatOn ? 1 + VAT_RATE : 1);
  const costs = agency + noc;
  return { agency, costs, net: resale - outstanding - costs };
}

function setStat(id, text, cls) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'v' + (cls ? ' ' + cls : '');
}

// Empty input falls back to the documented default.
function numOr(id, fallback) {
  const raw = document.getElementById(id).value.trim();
  if (raw === '') return fallback;
  const v = parseFloat(raw);
  return isFinite(v) ? v : fallback;
}

function annualized(roi, months) {
  return isFinite(roi) && roi > -1 && months > 0
    ? Math.pow(1 + roi, 12 / months) - 1
    : NaN;
}

function roiClass(v) {
  return v > 0 ? 'pos' : v < 0 ? 'neg' : '';
}

function render() {
  const price = numVal('inPrice');
  const pctPaid = numVal('inPctPaid') / 100;
  const months = numVal('inMonths');
  const resale = numVal('inResale');
  const noc = numVal('inNoc');
  const vatOn = document.getElementById('inVat').checked;
  const mode = strVal('inBalance');

  const invested = price * Math.min(Math.max(pctPaid, 0), 1);
  const outstanding = Math.max(0, price - invested);
  const c = closingAt(resale, outstanding, vatOn, noc);
  const profit = c.net - invested;
  const roi = invested > 0 ? profit / invested : NaN;
  const annRoi = annualized(roi, months);

  // resale price where proceeds exactly cover costs + cash in (zero profit)
  const feeRate = AGENCY_FEE_RATE * (vatOn ? 1 + VAT_RATE : 1);
  const breakeven = (invested + outstanding + noc) / (1 - feeRate);

  setStat('oCash', fmtAED(invested));
  setStat('oOutstanding', fmtAED(outstanding));
  setStat('oCosts', fmtAED(c.costs));
  setStat('oNetCash', fmtAED(c.net), c.net < 0 ? 'neg' : '');
  setStat('oProfit', fmtAED(profit), roiClass(profit));
  setStat('oRoi', fmtPct(roi), roiClass(roi));
  setStat('oAnnRoi', fmtPct(annRoi), roiClass(annRoi));
  setStat('oBreakeven', fmtAED(breakeven), resale >= breakeven ? 'pos' : 'neg');

  // verdict on annualized return
  const v = document.getElementById('oVerdict');
  if (!isFinite(annRoi)) {
    v.className = 'verdict warn';
    v.textContent = 'Enter a valid deal to assess the flip.';
  } else if (annRoi > 0.15) {
    v.className = 'verdict ok';
    v.textContent = 'Strong flip — annualized ROI of ' + fmtPct(annRoi) + ' clears the 15% bar.';
  } else if (annRoi >= 0) {
    v.className = 'verdict warn';
    v.textContent = 'Marginal — ' + fmtPct(annRoi) + ' annualized; holding may compound better.';
  } else {
    v.className = 'verdict bad';
    v.textContent = 'Do not sell — this resale price locks in a loss of ' + fmtAED(Math.abs(profit)) + '.';
  }

  // closing breakdown — rows follow the chosen flow of funds
  const rows = [];
  if (mode === 'takeover') {
    rows.push(['Resale price agreed with buyer', resale]);
    rows.push(['Balance taken over by buyer (not paid by you)', -outstanding]);
  } else {
    rows.push(['Resale proceeds received', resale]);
    rows.push(['Settle remaining balance to developer', -outstanding]);
  }
  rows.push(['Agency fee 2%' + (vatOn ? ' + 5% VAT' : ''), -c.agency]);
  rows.push(['Developer NOC / assignment fee', -noc]);
  document.getElementById('oBreakdown').innerHTML =
    rows.map(([label, amt]) =>
      '<tr><td>' + label + '</td><td class="num">' + fmtAED(amt) + '</td></tr>'
    ).join('') +
    '<tr><td><strong>Net cash out at closing</strong></td><td class="num"><strong>' + fmtAED(c.net) + '</strong></td></tr>' +
    '<tr><td>Less: cash invested so far</td><td class="num">' + fmtAED(-invested) + '</td></tr>' +
    '<tr><td><strong>Profit</strong></td><td class="num"><strong>' + fmtAED(profit) + '</strong></td></tr>';

  // flip vs hold — hold pays the plan to 100%, rents out, then sells at handover value
  const holdValue = numOr('inHoldValue', resale * 1.1);
  const holdRent = numOr('inHoldRent', holdValue * 0.06);
  const holdYears = Math.max(0, numOr('inHoldYears', 2));
  const holdClosing = closingAt(holdValue, 0, vatOn, noc); // balance settled by then
  const holdNetCash = holdClosing.net + holdRent * holdYears;
  const holdDeployed = invested + outstanding;
  const holdProfit = holdNetCash - holdDeployed;
  const holdRoi = holdDeployed > 0 ? holdProfit / holdDeployed : NaN;
  const holdAnnRoi = annualized(holdRoi, months + holdYears * 12);

  document.getElementById('oCompare').innerHTML = [
    ['Cash deployed', invested, holdDeployed],
    ['Net cash out', c.net, holdNetCash],
    ['Profit', profit, holdProfit],
  ].map(([label, f, h]) =>
    '<tr><td>' + label + '</td><td class="num">' + fmtAED(f) + '</td><td class="num">' + fmtAED(h) + '</td></tr>'
  ).join('') + [
    ['ROI on cash', roi, holdRoi],
    ['Annualized ROI', annRoi, holdAnnRoi],
  ].map(([label, f, h]) =>
    '<tr><td><strong>' + label + '</strong></td><td class="num"><strong>' + fmtPct(f) + '</strong></td><td class="num"><strong>' + fmtPct(h) + '</strong></td></tr>'
  ).join('');

  const hv = document.getElementById('oHoldVerdict');
  if (!isFinite(annRoi) || !isFinite(holdAnnRoi)) {
    hv.className = 'verdict warn';
    hv.textContent = 'Enter a valid deal to compare flipping vs holding.';
  } else if (holdAnnRoi > annRoi) {
    hv.className = 'verdict ok';
    hv.textContent = 'Hold wins — ' + fmtPct(holdAnnRoi) + ' annualized vs ' + fmtPct(annRoi) + ' if you flip now, on ' + fmtAED(holdDeployed) + ' deployed instead of ' + fmtAED(invested) + '.';
  } else {
    hv.className = 'verdict warn';
    hv.textContent = 'Flip wins — ' + fmtPct(annRoi) + ' annualized now vs ' + fmtPct(holdAnnRoi) + ' if you hold ' + holdYears + ' year' + (holdYears === 1 ? '' : 's') + ' past handover.';
  }

  // sensitivity grid: annualized ROI by resale step x months held
  const monthCols = HOLD_YEAR_OFFSETS.map(d => months + d);
  let grid = '<thead><tr><th>Resale price</th>' +
    monthCols.map((m, i) => '<th class="num">' + (i === 0 ? m + ' mo (now)' : '+' + HOLD_YEAR_OFFSETS[i] + ' mo') + '</th>').join('') +
    '</tr></thead><tbody>';
  SENS_STEPS.forEach(s => {
    const r = resale * (1 + s);
    grid += '<tr><td>' + (s > 0 ? '+' : '') + Math.round(s * 100) + '% · ' + fmtCompact(r) + '</td>';
    monthCols.forEach(m => {
      const cc = closingAt(r, outstanding, vatOn, noc);
      const a = annualized(invested > 0 ? (cc.net - invested) / invested : NaN, m);
      const color = !isFinite(a) ? '#9aa0a6' : a > 0.15 ? '#3fb950' : a >= 0 ? '#d4af37' : '#f85149';
      grid += '<td class="num" style="color:' + color + ';font-weight:600;">' + fmtPct(a) + '</td>';
    });
    grid += '</tr>';
  });
  document.getElementById('oSensGrid').innerHTML = grid + '</tbody>';

  // sensitivity: profit across resale price steps
  const points = SENS_STEPS.map((s, i) => {
    const cc = closingAt(resale * (1 + s), outstanding, vatOn, noc);
    return [i, cc.net - invested];
  });
  drawLine(document.getElementById('sensChart'),
    [{ label: 'Profit', color: '#d4af37', points }],
    {
      xLabels: SENS_STEPS.map(s => (s > 0 ? '+' : '') + Math.round(s * 100) + '%'),
      yFmt: v => fmtCompact(v)
    });
}

document.querySelectorAll('input, select').forEach(el => {
  el.addEventListener('input', render);
  el.addEventListener('change', render);
});
render();
