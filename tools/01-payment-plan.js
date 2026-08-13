// Tool 01 — Off-Plan Payment Plan Calculator
// Booking today, construction share over quarterly or monthly milestones,
// handover share at completion, optionally split into post-handover installments.

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

let lastRows = []; // milestone rows from the latest render, used by CSV export
let hvDirty = false; // true once the user edits the expected handover value manually

function shortDate(dateStr) {
  const d = new Date(dateStr);
  return MONTHS[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);
}

function constructionShare() {
  const t = strVal('planTemplate');
  return t === 'custom' ? Math.min(Math.max(0, numVal('customShare')), 100) : parseFloat(t);
}

// Build the milestone list: [{ month, label, pct, amount }]
function buildMilestones() {
  const price = Math.max(0, numVal('price'));
  const bookingPct = Math.min(Math.max(0, numVal('bookingPct')), 100);
  const constrMonths = Math.max(3, numVal('constrMonths'));
  const share = constructionShare();
  // clamp the handover share so booking + construction + handover always totals 100%
  const handoverPct = Math.max(0, Math.min(100 - share, 100 - bookingPct));
  const phOn = document.getElementById('phToggle').checked;
  const phMonths = Math.max(1, numVal('phMonths'));
  const step = Math.max(1, numVal('milestoneFreq')); // months between construction milestones

  const ms = [{ month: 0, label: 'Booking', pct: bookingPct, amount: price * bookingPct / 100 }];

  // remainder of the construction share after booking, spread over the milestones
  const nInst = Math.max(1, Math.floor(constrMonths / step));
  const restPct = Math.max(0, share - bookingPct);
  document.getElementById('clampNote').hidden = bookingPct <= share;
  const perInst = restPct / nInst;
  for (let i = 1; i <= nInst; i++) {
    ms.push({ month: i * step, label: 'Construction milestone ' + i, pct: perInst, amount: price * perInst / 100 });
  }

  // when the last construction milestone lands in the handover month, merge both into one row
  const collide = ms[ms.length - 1].month === constrMonths;
  const addHandover = pct => {
    if (collide) {
      const lm = ms[ms.length - 1];
      lm.label = 'Completion + handover';
      lm.pct += pct;
      lm.amount += price * pct / 100;
    } else {
      ms.push({ month: constrMonths, label: 'Handover', pct, amount: price * pct / 100 });
    }
  };

  if (phOn) {
    const half = handoverPct / 2;
    addHandover(half);
    const perM = handoverPct / 2 / phMonths;
    for (let i = 1; i <= phMonths; i++) {
      ms.push({ month: constrMonths + i, label: 'Post-handover ' + i, pct: perM, amount: price * perM / 100 });
    }
  } else {
    addHandover(handoverPct);
  }
  return { ms, constrMonths, phOn };
}

// IRR of selling at handover for a given sale value: payments up to handover,
// then sale proceeds net of the unpaid balance.
function irrAtValue(rows, constrMonths, price, paidByHandover, saleValue) {
  const today = rows.length ? rows[0].date : new Date().toISOString().slice(0, 10);
  const flows = rows.filter(r => r.month <= constrMonths).map(r => ({ date: r.date, amount: -r.amount }));
  flows.push({ date: addMonths(today, constrMonths), amount: saleValue - (price - paidByHandover) });
  return xirr(flows);
}

function render() {
  const price = Math.max(0, numVal('price'));
  const today = new Date().toISOString().slice(0, 10);
  const { ms, constrMonths, phOn } = buildMilestones();

  // cumulative cash
  let cum = 0;
  const rows = ms.map(m => {
    cum += m.amount;
    return { ...m, date: addMonths(today, m.month), cum };
  });
  lastRows = rows;

  const last = rows[rows.length - 1];
  const paidByHandover = rows.filter(r => r.month <= constrMonths).reduce((s, r) => s + r.amount, 0);

  document.getElementById('statTotal').textContent = fmtAED(last ? last.cum : 0);
  document.getElementById('statByHandover').textContent = fmtAED(paidByHandover);
  document.getElementById('statMonths').textContent = last ? last.month + ' mo' : '—';

  // table
  const totPct = rows.reduce((s, r) => s + r.pct, 0);
  document.getElementById('planBody').innerHTML = rows.map(r =>
    '<tr><td>' + r.date + '</td><td>' + r.label + '</td>' +
    '<td class="num">' + fmtPct(r.pct / 100, 2) + '</td>' +
    '<td class="num">' + fmtAED(r.amount) + '</td>' +
    '<td class="num">' + fmtAED(r.cum) + '</td></tr>'
  ).join('') +
  '<tr><td></td><td>Total</td>' +
  '<td class="num">' + totPct.toFixed(2) + '%</td>' +
  '<td class="num">' + fmtAED(last ? last.cum : 0) + '</td><td></td></tr>';

  // chart
  drawLine(document.getElementById('chart'), [{
    label: 'Cumulative paid',
    color: SERIES_COLORS[0],
    points: rows.map((r, i) => [i, r.cum])
  }], { xLabels: rows.map(r => shortDate(r.date)), yFmt: fmtCompact });

  // investment view
  const rate = Math.max(0, numVal('discRate')) / 100;
  const valueAtHandover = Math.max(0, numVal('handoverValue'));
  const flows = rows.map(r => ({ date: r.date, amount: -r.amount }));
  const pv = -xnpv(rate, flows); // present cost of the payment stream (outflows only)
  document.getElementById('statNpv').textContent = fmtAED(pv);

  const irr = irrAtValue(rows, constrMonths, price, paidByHandover, valueAtHandover);
  document.getElementById('statIrr').textContent = isFinite(irr) ? fmtPct(irr, 1) + ' p.a.' : '—';

  // verdict: payment plan (present cost) vs all-cash purchase at the entered discount
  const cashDiscPct = Math.min(Math.max(numVal('cashDisc'), 0), 100);
  const cashPrice = price * (1 - cashDiscPct / 100);
  document.getElementById('statPlanPv').textContent = fmtAED(pv);
  document.getElementById('statCashPrice').textContent = fmtAED(cashPrice);
  const v = document.getElementById('verdict');
  const discLabel = fmtNum(cashDiscPct, cashDiscPct % 1 ? 1 : 0) + '%';
  if (price <= 0) {
    v.className = 'verdict warn';
    v.textContent = 'Enter a unit price to compare.';
  } else if (pv <= cashPrice) {
    v.className = 'verdict ok';
    v.textContent = 'Payment plan beats a ' + discLabel + ' cash discount — present cost ' + fmtAED(pv) + ' vs ' + fmtAED(cashPrice) + ' cash (saves ' + fmtAED(cashPrice - pv) + ').';
  } else if (pv <= price) {
    v.className = 'verdict warn';
    v.textContent = 'Plan is cheaper than sticker in present terms, but a ' + discLabel + ' cash discount (' + fmtAED(cashPrice) + ') saves ' + fmtAED(pv - cashPrice) + ' more.';
  } else {
    v.className = 'verdict bad';
    v.textContent = 'Plan costs more than sticker in present terms (' + fmtAED(pv) + ') — negotiate a discount or pay cash at ' + fmtAED(cashPrice) + '.';
  }

  // IRR sensitivity: handover sale value from -20% to +30% in 5% steps
  const deltas = [];
  for (let d = -20; d <= 30; d += 5) deltas.push(d);
  // skip points where xirr has no finite solution instead of plotting them as 0%
  const sens = deltas
    .map(d => ({ d, irr: irrAtValue(rows, constrMonths, price, paidByHandover, valueAtHandover * (1 + d / 100)) }))
    .filter(p => isFinite(p.irr));
  drawLine(document.getElementById('irrChart'), [{
    label: 'IRR at handover sale',
    color: SERIES_COLORS[1],
    points: sens.map((p, i) => [i, p.irr])
  }], {
    xLabels: sens.map(p => (p.d > 0 ? '+' : '') + p.d + '%'),
    yFmt: x => fmtPct(x)
  });
}

function exportCsv() {
  const esc = s => {
    s = String(s);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = ['Date,Milestone,%,Amount (AED),Cumulative (AED)'];
  for (const r of lastRows) {
    lines.push([r.date, r.label, r.pct.toFixed(2), Math.round(r.amount), Math.round(r.cum)].map(esc).join(','));
  }
  const totPct = lastRows.reduce((s, r) => s + r.pct, 0);
  const totAmt = lastRows.length ? lastRows[lastRows.length - 1].cum : 0;
  lines.push(['', 'Total', totPct.toFixed(2), Math.round(totAmt), ''].map(esc).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'payment-plan-export.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function init() {
  // expected handover value defaults to price x 1.15; kept in sync with price
  // until the user's first manual edit (dirty flag)
  const hvEl = document.getElementById('handoverValue');
  const syncHv = () => { if (!hvDirty) hvEl.value = Math.round(Math.max(0, numVal('price')) * 1.15); };
  hvEl.addEventListener('input', () => { hvDirty = true; });
  document.getElementById('price').addEventListener('input', syncHv);
  document.getElementById('price').addEventListener('change', syncHv);

  const ids = ['price', 'bookingPct', 'constrMonths', 'milestoneFreq', 'planTemplate', 'customShare', 'phToggle', 'phMonths', 'handoverValue', 'discRate', 'cashDisc'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  document.getElementById('planTemplate').addEventListener('change', () => {
    document.getElementById('customRow').hidden = strVal('planTemplate') !== 'custom';
  });
  document.getElementById('customShare').addEventListener('input', () => {
    document.getElementById('customShareVal').textContent = numVal('customShare') + '%';
  });
  document.getElementById('phToggle').addEventListener('change', () => {
    document.getElementById('phMonthsRow').hidden = !document.getElementById('phToggle').checked;
  });
  document.getElementById('exportCsv').addEventListener('click', exportCsv);

  syncHv(); // prefill the default expected handover value on first load
  render();
}

document.addEventListener('DOMContentLoaded', init);
