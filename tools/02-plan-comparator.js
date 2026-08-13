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
    price: Math.max(0, numVal('p' + i + 'Price')),
    plan: PLANS[strVal('p' + i + 'Plan')],
    constrMonths: Math.max(1, numVal('p' + i + 'Constr')),
    appr: Math.max(0, numVal('p' + i + 'Appr')) / 100,
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
      flows.push({ date: addMonths(t0, 3 * k), amount: constrRest / nQ });
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

function analyze(p, t0, discRate, sellCost) {
  const { flows, handoverDate } = buildSchedule(p, t0);
  const nominal = flows.reduce((s, f) => s + f.amount, 0);
  const npvCost = -xnpv(discRate, flows.map(f => ({ date: f.date, amount: -f.amount })));
  const cutoff = addMonths(t0, 12);
  const cash12 = flows.filter(f => f.date <= cutoff).reduce((s, f) => s + f.amount, 0);

  // flip at handover: sale price less selling costs and any balance not yet paid
  // (unpaid post-handover share is netted at face value, no discounting)
  const paidByHandover = flows.filter(f => f.date <= handoverDate).reduce((s, f) => s + f.amount, 0);
  const unpaid = p.price - paidByHandover;
  const salePrice = p.price * (1 + p.appr);
  const irrFlows = flows.filter(f => f.date <= handoverDate).map(f => ({ date: f.date, amount: -f.amount }));
  irrFlows.push({ date: handoverDate, amount: salePrice * (1 - sellCost) - unpaid });
  const irr = xirr(irrFlows);
  const endMonths = p.constrMonths + (p.plan.postMonths || 0);

  return { name: p.name, price: p.price, flows, endMonths, nominal, npvCost, irr, cash12, salePrice, paidByHandover };
}

// months between two YYYY-MM-DD dates (fractional)
function monthsBetween(t0, dateStr) {
  return (new Date(dateStr).getTime() - new Date(t0).getTime()) / (365 * 86400000 / 12);
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
  const discRate = Math.min(30, Math.max(0, numVal('discRate'))) / 100;
  const sellCost = Math.max(0, numVal('sellCost')) / 100;
  const results = [];
  for (let i = 1; i <= N; i++) results.push(analyze(readProject(i), t0, discRate, sellCost));

  // zero-price projects carry no signal — exclude from ranking and verdicts
  const valid = results.filter(r => r.price > 0);
  const byNpv = [...valid].sort((a, b) => a.npvCost - b.npvCost);
  // NaN IRR (no bracketed root) always ranks last
  const byIrr = [...valid].sort((a, b) => (isNaN(b.irr) ? -Infinity : b.irr) - (isNaN(a.irr) ? -Infinity : a.irr));
  const winNpv = byNpv[0], winIrr = byIrr[0];

  const verdictNpvEl = document.getElementById('verdictNpv');
  const verdictIrrEl = document.getElementById('verdictIrr');
  const verdictCashEl = document.getElementById('verdictCash');

  if (!winNpv) {
    verdictNpvEl.textContent = 'Enter a price for at least one project to see a ranking.';
    verdictIrrEl.textContent = '';
  } else {
    let npvText = 'Cheapest in real terms: ' + winNpv.name + ' — NPV of payments ' + fmtAED(winNpv.npvCost);
    if (byNpv.length > 1) {
      const worstNpv = byNpv[byNpv.length - 1];
      npvText += ' vs ' + fmtAED(byNpv[1].npvCost) + ' for ' + byNpv[1].name + '.' +
        ' ' + fmtAED(worstNpv.npvCost - winNpv.npvCost) + ' real-money difference between best and worst.';
    } else {
      npvText += '.';
    }
    verdictNpvEl.textContent = npvText;
    verdictIrrEl.textContent =
      'Best flip return: ' + winIrr.name + ' — IRR ' + fmtPct(winIrr.irr) +
      ' if sold at handover. IRR and NPV can pick different winners: NPV measures absolute cost of money at the discount rate, while IRR measures return on cash actually deployed — a back-loaded plan deploys less cash early, so it can show a higher IRR even on a pricier unit.';
  }

  // break-even cash discount: rate where the NPV winner's payment plan costs the same as paying cash
  // hidden entirely when the discount input is 0 or 100%+ (no meaningful comparison)
  const cashDisc = Math.max(0, numVal('cashDisc'));
  if (!winNpv || cashDisc <= 0 || cashDisc >= 100) {
    verdictCashEl.style.display = 'none';
  } else {
    verdictCashEl.style.display = '';
    const cashTarget = winNpv.price * (1 - cashDisc / 100);
    const be = breakEvenRate(winNpv.flows, cashTarget);
    verdictCashEl.textContent = isNaN(be)
      ? 'Break-even discount: no rate in 0–10000% makes ' + winNpv.name + ' as cheap as cash at ' + fmtPct(cashDisc / 100, 2) + ' off.'
      : 'Break-even discount rate: ' + fmtPct(be, 2) + ' — if your client\'s money costs less than this, ' + winNpv.name +
        ' beats paying ' + fmtAED(cashTarget) + ' cash (' + fmtPct(cashDisc / 100, 2) + ' off). Above it, take the cash discount.';
  }

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
  // zero-price projects get an empty state, not a row of zeros
  const show = fn => r => r.price > 0 ? fn(r) : '—';
  const dispRows = rows.map(([label, fn]) => [label, show(fn)]);
  if (valid.length < results.length) {
    dispRows.unshift(['Status', r => r.price > 0 ? 'ranked' : 'no price — excluded from ranking']);
  }
  document.getElementById('cmpBody').innerHTML = dispRows.map(([label, fn]) =>
    '<tr><td>' + label + '</td>' + results.map(r => '<td class="num">' + fn(r) + '</td>').join('') + '</tr>'
  ).join('');

  // raw numerics for CSV export (no 'AED'/'%' strings, no thousands separators)
  const raw = v => isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : '';
  const rawRows = [
    ['Total nominal paid', r => r.nominal],
    ['Real cost today (NPV)', r => r.npvCost],
    ['IRR if sold at handover', r => r.irr],
    ['Sale price at handover', r => r.salePrice],
    ['Cash needed in first 12 months', r => r.cash12],
    ['Paid by handover', r => r.paidByHandover],
  ];
  lastTable = { names: results.map(r => r.name), rows: rawRows.map(([label, fn]) => [label, ...results.map(r => raw(fn(r)))]) };

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
