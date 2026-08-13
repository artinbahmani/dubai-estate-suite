// Tool 07 — Off-Plan Flip Analyzer
// Net position when selling an off-plan unit before handover.

const AGENCY_FEE_RATE = 0.02;
const VAT_RATE = 0.05;
const SENS_STEPS = [-0.10, -0.05, 0, 0.05, 0.10, 0.15, 0.20];

function aedCompact(v) {
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e6) return sign + 'AED ' + (a / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return sign + 'AED ' + (a / 1e3).toFixed(0) + 'k';
  return sign + 'AED ' + Math.round(a);
}

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
  const annRoi = isFinite(roi) && roi > -1 && months > 0
    ? Math.pow(1 + roi, 12 / months) - 1
    : NaN;

  setStat('oCash', fmtAED(invested));
  setStat('oOutstanding', fmtAED(outstanding));
  setStat('oCosts', fmtAED(c.costs));
  setStat('oNetCash', fmtAED(c.net), c.net < 0 ? 'neg' : '');
  setStat('oProfit', fmtAED(profit), profit > 0 ? 'pos' : profit < 0 ? 'neg' : '');
  setStat('oRoi', fmtPct(roi), roi > 0 ? 'pos' : roi < 0 ? 'neg' : '');
  setStat('oAnnRoi', fmtPct(annRoi), annRoi > 0 ? 'pos' : annRoi < 0 ? 'neg' : '');

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

  // sensitivity: profit across resale price steps
  const points = SENS_STEPS.map((s, i) => {
    const cc = closingAt(resale * (1 + s), outstanding, vatOn, noc);
    return [i, cc.net - invested];
  });
  drawLine(document.getElementById('sensChart'),
    [{ label: 'Profit', color: '#d4af37', points }],
    {
      xLabels: SENS_STEPS.map(s => (s > 0 ? '+' : '') + Math.round(s * 100) + '%'),
      yFmt: aedCompact
    });
}

document.querySelectorAll('input, select').forEach(el => {
  el.addEventListener('input', render);
  el.addEventListener('change', render);
});
render();
