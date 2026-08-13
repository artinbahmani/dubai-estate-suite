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

  return { name: p.name, nominal, npvCost, irr, cash12, salePrice, paidByHandover };
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

  drawBars(
    document.getElementById('npvChart'),
    results.map(r => r.name),
    [{ label: 'Real cost today (NPV)', values: results.map(r => r.npvCost), color: '#d4af37' }],
    { yFmt: v => v >= 1e6 ? 'AED ' + (v / 1e6).toFixed(1) + 'M' : fmtNum(v) }
  );
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.querySelectorAll('input, select').forEach(el => {
  el.addEventListener('input', render);
  el.addEventListener('change', render);
});
window.addEventListener('resize', render);
render();
