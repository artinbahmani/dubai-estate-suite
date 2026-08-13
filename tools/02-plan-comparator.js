// Tool 02 — Payment Plan Comparator
// Compares up to three off-plan projects on cost of money (NPV) and flip IRR.

// plan templates: construction share includes the 10% booking payment
const PLANS = {
  '60/40': { constr: 0.60, handover: 0.40, post: 0.00, postMonths: 0 },
  '70/30': { constr: 0.70, handover: 0.30, post: 0.00, postMonths: 0 },
  '80/20': { constr: 0.80, handover: 0.20, post: 0.00, postMonths: 0 },
  '50/50': { constr: 0.50, handover: 0.50, post: 0.00, postMonths: 0 },
  'ph':    { constr: 0.50, handover: 0.20, post: 0.30, postMonths: 24 },
};
const BOOKING_PCT = 0.10;
const N = 3;

function readProject(i) {
  return {
    name: strVal('p' + i + 'Name').trim() || 'Project ' + i,
    price: numVal('p' + i + 'Price'),
    plan: PLANS[strVal('p' + i + 'Plan')],
    constrMonths: Math.max(1, numVal('p' + i + 'Constr')),
    appr: numVal('p' + i + 'Appr') / 100,
  };
}

// builds the payment schedule: [{ date, amount }] outflows, t0 = YYYY-MM-DD
function buildSchedule(p, t0) {
  const flows = [{ date: t0, amount: p.price * BOOKING_PCT }];
  const handoverDate = addMonths(t0, p.constrMonths);
  // remaining construction share spread quarterly over the build period
  const constrRest = p.price * Math.max(0, p.plan.constr - BOOKING_PCT);
  const nQ = Math.max(1, Math.floor(p.constrMonths / 3));
  if (constrRest > 0) {
    for (let k = 1; k <= nQ; k++) {
      flows.push({ date: addMonths(t0, Math.min(3 * k, p.constrMonths)), amount: constrRest / nQ });
    }
  }
  if (p.plan.handover > 0) flows.push({ date: handoverDate, amount: p.price * p.plan.handover });
  if (p.plan.post > 0) {
    const each = p.price * p.plan.post / p.plan.postMonths;
    for (let m = 1; m <= p.plan.postMonths; m++) {
      flows.push({ date: addMonths(t0, p.constrMonths + m), amount: each });
    }
  }
  return { flows, handoverDate };
}

function analyze(p, t0, discRate) {
  const { flows, handoverDate } = buildSchedule(p, t0);
  const nominal = flows.reduce((s, f) => s + f.amount, 0);
  const npvCost = -xnpv(discRate, flows.map(f => ({ date: f.date, amount: -f.amount })));
  const cutoff = addMonths(t0, 12);
  const cash12 = flows.filter(f => f.date <= cutoff).reduce((s, f) => s + f.amount, 0);

  // flip at handover: sale price less any balance not yet paid (post-handover share)
  const paidByHandover = flows.filter(f => f.date <= handoverDate).reduce((s, f) => s + f.amount, 0);
  const unpaid = p.price - paidByHandover;
  const salePrice = p.price * (1 + p.appr);
  const irrFlows = flows.filter(f => f.date <= handoverDate).map(f => ({ date: f.date, amount: -f.amount }));
  irrFlows.push({ date: handoverDate, amount: salePrice - unpaid });
  const irr = xirr(irrFlows);
  const endMonths = p.constrMonths + (p.plan.postMonths || 0);

  return { name: p.name, price: p.price, flows, endMonths, nominal, npvCost, irr, cash12, salePrice, paidByHandover };
}

// months between two YYYY-MM-DD dates (fractional)
function monthsBetween(t0, dateStr) {
  return (new Date(dateStr).getTime() - new Date(t0).getTime()) / (365.25 * 86400000 / 12);
}

// break-even discount rate d where NPV cost of the schedule equals the discounted cash price
function breakEvenRate(flows, cashTarget) {
  const neg = flows.map(f => ({ date: f.date, amount: -f.amount }));
  const costAt = d => -xnpv(d, neg);
  let lo = 0, hi = 0.01;
  if (costAt(lo) <= cashTarget) return 0;
  while (costAt(hi) > cashTarget && hi < 100) hi *= 2;
  if (costAt(hi) > cashTarget) return NaN; // no solution within 0–10000%
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    costAt(mid) > cashTarget ? lo = mid : hi = mid;
  }
  return (lo + hi) / 2;
}

function render() {
  const t0 = new Date().toISOString().slice(0, 10);
  const discRate = numVal('discRate') / 100;
  const results = [];
  for (let i = 1; i <= N; i++) results.push(analyze(readProject(i), t0, discRate));

  const byNpv = [...results].sort((a, b) => a.npvCost - b.npvCost);
  const byIrr = [...results].sort((a, b) => (isNaN(b.irr) ? -1 : b.irr) - (isNaN(a.irr) ? -1 : a.irr));
  const winNpv = byNpv[0], winIrr = byIrr[0];

  document.getElementById('verdictNpv').textContent =
    'Cheapest in real terms: ' + winNpv.name + ' — NPV of payments ' + fmtAED(winNpv.npvCost) +
    ' vs ' + fmtAED(byNpv[1].npvCost) + ' for ' + byNpv[1].name + '.';
  document.getElementById('verdictIrr').textContent =
    'Best flip return: ' + winIrr.name + ' — IRR ' + fmtPct(winIrr.irr) +
    ' if sold at handover. IRR and NPV can pick different winners: NPV measures absolute cost of money at the discount rate, while IRR measures return on cash actually deployed — a back-loaded plan deploys less cash early, so it can show a higher IRR even on a pricier unit.';

  // break-even cash discount: rate where the NPV winner's payment plan costs the same as paying cash
  const cashDisc = numVal('cashDisc') / 100;
  const cashTarget = winNpv.price * (1 - cashDisc);
  const be = cashDisc > 0 && cashDisc < 1 ? breakEvenRate(winNpv.flows, cashTarget) : NaN;
  document.getElementById('verdictCash').textContent = isNaN(be)
    ? 'Break-even discount: no rate in 0–10000% makes ' + winNpv.name + ' as cheap as cash at ' + fmtPct(cashDisc, 2) + ' off — check the discount input.'
    : 'Break-even discount rate: ' + fmtPct(be, 2) + ' — if your client\'s money costs less than this, ' + winNpv.name +
      ' beats paying ' + fmtAED(cashTarget) + ' cash (' + fmtPct(cashDisc, 2) + ' off). Above it, take the cash discount.';

  // comparison table: rows = metrics, columns = projects
  document.getElementById('cmpHead').innerHTML =
    '<tr><th>Metric</th>' + results.map(r => '<th class="num">' + esc(r.name) + '</th>').join('') + '</tr>';
  const rows = [
    ['Total nominal paid', r => fmtAED(r.nominal)],
    ['Real cost today (NPV)', r => fmtAED(r.npvCost)],
    ['IRR if sold at handover', r => fmtPct(r.irr)],
    ['Sale price at handover', r => fmtAED(r.salePrice)],
    ['Cash needed in first 12 months', r => fmtAED(r.cash12)],
    ['Paid by handover', r => fmtAED(r.paidByHandover)],
  ];
  document.getElementById('cmpBody').innerHTML = rows.map(([label, fn]) =>
    '<tr><td>' + label + '</td>' + results.map(r => '<td class="num">' + fn(r) + '</td>').join('') + '</tr>'
  ).join('');
  lastTable = { names: results.map(r => r.name), rows: rows.map(([label, fn]) => [label, ...results.map(r => String(fn(r)))]) };

  drawBars(
    document.getElementById('npvChart'),
    results.map(r => r.name),
    [{ label: 'Real cost today (NPV)', values: results.map(r => r.npvCost), color: '#d4af37' }],
    { yFmt: fmtCompact }
  );

  // cumulative cash: one line per project, monthly steps to the longest schedule end
  const maxEnd = Math.max(...results.map(r => r.endMonths));
  const months = [];
  for (let m = 0; m <= maxEnd; m++) months.push(m);
  const series = results.map(r => {
    // sort flows by month offset, then walk a pointer while accumulating
    const fs = r.flows.map(f => ({ m: Math.round(monthsBetween(t0, f.date)), amount: f.amount }))
      .sort((a, b) => a.m - b.m);
    let fi = 0, cum = 0;
    return {
      label: r.name,
      points: months.map(m => {
        while (fi < fs.length && fs[fi].m <= m + 1e-9) cum += fs[fi++].amount;
        return [m, cum];
      }),
    };
  });
  drawLine(
    document.getElementById('cumChart'),
    series,
    { xLabels: months.map(String), yFmt: fmtCompact }
  );
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// latest rendered comparison table, for CSV export
let lastTable = { names: [], rows: [] };

function exportCsv() {
  const cell = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  const lines = [['Metric', ...lastTable.names], ...lastTable.rows]
    .map(r => r.map(cell).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plan-comparator-export.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

document.getElementById('samePrice').addEventListener('click', () => {
  const price = document.getElementById('p1Price').value;
  document.getElementById('p2Price').value = price;
  document.getElementById('p3Price').value = price;
  render();
});
document.getElementById('exportCsv').addEventListener('click', exportCsv);

document.querySelectorAll('input, select').forEach(el => {
  el.addEventListener('input', render);
  el.addEventListener('change', render);
});
window.addEventListener('resize', render);
render();
