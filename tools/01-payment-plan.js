// Tool 01 — Off-Plan Payment Plan Calculator
// Booking today, construction share over quarterly milestones,
// handover share at completion, optionally split into post-handover installments.

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function compactAED(n) {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e6) return 'AED ' + (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return 'AED ' + Math.round(n / 1e3) + 'K';
  return 'AED ' + Math.round(n);
}

function shortDate(dateStr) {
  const d = new Date(dateStr);
  return MONTHS[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);
}

function constructionShare() {
  const t = strVal('planTemplate');
  return t === 'custom' ? numVal('customShare') : parseFloat(t);
}

// Build the milestone list: [{ month, label, pct, amount }]
function buildMilestones() {
  const price = numVal('price');
  const bookingPct = Math.min(numVal('bookingPct'), 100);
  const constrMonths = Math.max(3, numVal('constrMonths'));
  const share = constructionShare();
  const handoverPct = 100 - share;
  const phOn = document.getElementById('phToggle').checked;
  const phMonths = Math.max(1, numVal('phMonths'));

  const ms = [{ month: 0, label: 'Booking', pct: bookingPct, amount: price * bookingPct / 100 }];

  // remainder of the construction share after booking, over quarterly milestones
  const nQ = Math.max(1, Math.floor(constrMonths / 3));
  const restPct = Math.max(0, share - bookingPct);
  document.getElementById('clampNote').hidden = bookingPct <= share;
  const perQ = restPct / nQ;
  for (let i = 1; i <= nQ; i++) {
    const m = Math.min(i * 3, constrMonths);
    ms.push({ month: m, label: 'Construction milestone ' + i, pct: perQ, amount: price * perQ / 100 });
  }

  if (phOn) {
    const half = handoverPct / 2;
    ms.push({ month: constrMonths, label: 'Handover', pct: half, amount: price * half / 100 });
    const perM = handoverPct / 2 / phMonths;
    for (let i = 1; i <= phMonths; i++) {
      ms.push({ month: constrMonths + i, label: 'Post-handover ' + i, pct: perM, amount: price * perM / 100 });
    }
  } else {
    ms.push({ month: constrMonths, label: 'Handover', pct: handoverPct, amount: price * handoverPct / 100 });
  }
  return { ms, constrMonths, phOn };
}

function render() {
  const price = numVal('price');
  const today = new Date().toISOString().slice(0, 10);
  const { ms, constrMonths, phOn } = buildMilestones();

  // cumulative cash
  let cum = 0;
  const rows = ms.map(m => {
    cum += m.amount;
    return { ...m, date: addMonths(today, m.month), cum };
  });

  const last = rows[rows.length - 1];
  const paidByHandover = rows.filter(r => r.month <= constrMonths).reduce((s, r) => s + r.amount, 0);

  document.getElementById('statTotal').textContent = fmtAED(last ? last.cum : 0);
  document.getElementById('statByHandover').textContent = fmtAED(paidByHandover);
  document.getElementById('statMonths').textContent = last ? last.month + ' mo' : '—';

  // table
  document.getElementById('planBody').innerHTML = rows.map(r =>
    '<tr><td>' + r.date + '</td><td>' + r.label + '</td>' +
    '<td class="num">' + fmtPct(r.pct / 100, 1) + '</td>' +
    '<td class="num">' + fmtAED(r.amount) + '</td>' +
    '<td class="num">' + fmtAED(r.cum) + '</td></tr>'
  ).join('');

  // chart
  drawLine(document.getElementById('chart'), [{
    label: 'Cumulative paid',
    color: SERIES_COLORS[0],
    points: rows.map((r, i) => [i, r.cum])
  }], { xLabels: rows.map(r => shortDate(r.date)), yFmt: compactAED });

  // investment view
  const rate = numVal('discRate') / 100;
  const valueAtHandover = numVal('handoverValue');
  const flows = rows.map(r => ({ date: r.date, amount: -r.amount }));
  const npv = -xnpv(rate, flows);
  document.getElementById('statNpv').textContent = fmtAED(npv);

  // IRR on selling at handover: payments up to handover, then sale proceeds net of unpaid balance
  const unpaidAtHandover = price - paidByHandover;
  const irrFlows = rows.filter(r => r.month <= constrMonths).map(r => ({ date: r.date, amount: -r.amount }));
  irrFlows.push({ date: addMonths(today, constrMonths), amount: valueAtHandover - unpaidAtHandover });
  const irr = xirr(irrFlows);
  document.getElementById('statIrr').textContent = isFinite(irr) ? fmtPct(irr, 1) + ' p.a.' : '—';

  // verdict vs all-cash purchase with 5% discount
  const cashPrice = price * 0.95;
  const v = document.getElementById('verdict');
  if (price <= 0) {
    v.className = 'verdict warn';
    v.textContent = 'Enter a unit price to compare.';
  } else if (npv <= cashPrice) {
    v.className = 'verdict ok';
    v.textContent = 'Payment plan beats a 5% cash discount — present cost ' + fmtAED(npv) + ' vs ' + fmtAED(cashPrice) + ' cash (saves ' + fmtAED(cashPrice - npv) + ').';
  } else if (npv <= price) {
    v.className = 'verdict warn';
    v.textContent = 'Plan is cheaper than sticker in present terms, but a 5% cash discount (' + fmtAED(cashPrice) + ') saves ' + fmtAED(npv - cashPrice) + ' more.';
  } else {
    v.className = 'verdict bad';
    v.textContent = 'Plan costs more than sticker in present terms (' + fmtAED(npv) + ') — negotiate a discount or pay cash at ' + fmtAED(cashPrice) + '.';
  }
}

function init() {
  const ids = ['price', 'bookingPct', 'constrMonths', 'planTemplate', 'customShare', 'phToggle', 'phMonths', 'handoverValue', 'discRate'];
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

  render();
}

document.addEventListener('DOMContentLoaded', init);
