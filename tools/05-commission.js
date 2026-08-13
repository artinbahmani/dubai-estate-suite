// Commission Calculator — off-plan / resale / rental with VAT and splits.
const VAT_RATE = 0.05;
const RENTAL_RATE = 0.05;
const RENTAL_MIN = 5000;

let active = 'offplan';

const $ = id => document.getElementById(id);

function watch(id) {
  const el = $(id);
  el.addEventListener('input', render);
  el.addEventListener('change', render);
}

// gross commission (excl. VAT, before any rebate) for the active panel
function grossCommission() {
  if (active === 'offplan') {
    return numVal('op-price') * (numVal('op-comm') / 100);
  }
  if (active === 'resale') {
    const fee = numVal('rs-fee') / 100;
    return numVal('rs-price') * fee * ($('rs-dual').checked ? 2 : 1);
  }
  return rentalGross(numVal('rn-rent'));
}

function rentalGross(annualRent) {
  // no floor on an empty deal: 0 rent earns 0 commission
  if (annualRent <= 0) return 0;
  return Math.max(annualRent * RENTAL_RATE, RENTAL_MIN);
}

function dealsPerQuarter() {
  return numVal({ offplan: 'op-deals', resale: 'rs-deals', rental: 'rn-deals' }[active]);
}

// ---- goal mode ----

function renderGoal(agentPerDeal, dpq) {
  const target = numVal('goal-target');
  const segName = { offplan: 'off-plan', resale: 'resale', rental: 'rental' }[active];
  $('goal-seg').textContent = '(' + segName + ')';

  const perMonth = agentPerDeal > 0 && target > 0 ? Math.ceil(target / agentPerDeal / 12) : NaN;
  $('goal-deals').textContent = isFinite(perMonth) ? fmtNum(perMonth) : '—';

  const annual = agentPerDeal * dpq * 4;
  $('goal-pace').textContent = fmtCompact(annual);

  const v = $('goal-verdict');
  if (target <= 0) {
    v.className = 'verdict warn';
    v.textContent = 'Set an annual income target above zero to compute a pace.';
  } else if (!isFinite(perMonth)) {
    v.className = 'verdict warn';
    v.textContent = 'Set a deal above zero commission to compute a pace.';
  } else if (annual >= target) {
    v.className = 'verdict ok';
    v.textContent = 'On track — current pace of ' + fmtNum(dpq) + ' deal' + (dpq === 1 ? '' : 's') +
      '/quarter earns ' + fmtAED(annual) + '/year, meeting the ' + fmtAED(target) + ' target.';
  } else {
    v.className = 'verdict warn';
    v.textContent = 'Short — current pace earns ' + fmtAED(annual) + '/year vs the ' + fmtAED(target) +
      ' target. You need ' + fmtNum(perMonth) + ' ' + segName + ' deal' + (perMonth === 1 ? '' : 's') +
      '/month at current settings.';
  }
}

// ---- quarter pipeline ----

const PL_DEFAULTS = { offplan: 5, resale: 2, rental: 5 };
const PL_SEG_NAMES = { offplan: 'Off-plan', resale: 'Resale', rental: 'Rental' };
const pipeline = [{ seg: 'offplan', value: 1500000, pct: 5 }];

function pipelineRowGross(row) {
  // rental value is annual rent: 5% with the AED 5,000 minimum (no floor on an empty deal)
  if (row.seg === 'rental') return row.value <= 0 ? 0 : Math.max(row.value * row.pct / 100, RENTAL_MIN);
  return row.value * row.pct / 100;
}

function renderPipeline(splitPct) {
  const body = $('pl-body');
  body.innerHTML = '';
  let total = 0;
  pipeline.forEach((row, i) => {
    const gross = pipelineRowGross(row);
    const take = gross * splitPct / 100;
    total += take;
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + PL_SEG_NAMES[row.seg] + '</td>' +
      '<td class="num">' + fmtNum(row.value) + '</td>' +
      '<td class="num">' + fmtNum(row.pct, 1) + '</td>' +
      '<td class="num">' + fmtNum(Math.round(gross)) + '</td>' +
      '<td class="num">' + fmtNum(Math.round(take)) + '</td>' +
      '<td class="no-print"><button class="btn ghost small" data-idx="' + i + '" type="button">Remove</button></td>';
    body.appendChild(tr);
  });
  $('pl-total-q').textContent = fmtAED(total);
  $('pl-total-y').textContent = fmtAED(total * 4);
  $('pl-table').hidden = pipeline.length === 0;
  $('pl-empty').hidden = pipeline.length > 0;
}

function csvCell(x) {
  const s = String(x);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportPipelineCSV() {
  const splitPct = numVal('split');
  const rows = [['Segment', 'Value (AED)', 'Commission %', 'Gross commission (AED)', 'VAT (AED)', 'Agent take-home (AED)', 'Brokerage share (AED)']];
  let total = 0;
  for (const row of pipeline) {
    const gross = pipelineRowGross(row);
    const vat = gross * VAT_RATE;
    const take = gross * splitPct / 100;
    total += take;
    rows.push([PL_SEG_NAMES[row.seg], Math.round(row.value), row.pct, Math.round(gross),
      Math.round(vat), Math.round(take), Math.round(gross - take)]);
  }
  rows.push(['Quarterly agent income', '', '', '', '', Math.round(total), '']);
  rows.push(['Annualized if this quarter repeats', '', '', '', '', Math.round(total * 4), '']);
  const csv = rows.map(r => r.map(csvCell).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'commission-pipeline-export.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

function render() {
  const splitPct = numVal('split');
  $('split-val').textContent = splitPct + '%';
  $('op-comm-val').textContent = numVal('op-comm').toFixed(1) + '%';
  $('rs-dual-note').hidden = !$('rs-dual').checked;

  const gross = Math.max(0, grossCommission());
  const vat = gross * VAT_RATE;
  const net = gross + vat;
  // off-plan rebate: % of commission (clamped 0-100), paid out of the agent's share
  // after the split; VAT and the brokerage share stay on the full gross
  const rebatePct = active === 'offplan' ? Math.min(100, Math.max(0, numVal('op-rebate'))) : 0;
  const agentShare = gross * splitPct / 100;
  const agent = Math.max(0, agentShare - gross * rebatePct / 100);
  const broker = gross - agentShare;
  const dpq = dealsPerQuarter();
  const quarterly = agent * dpq;

  const rebateWipesShare = active === 'offplan' && gross > 0 && rebatePct >= splitPct;
  const rebateWarn = $('op-rebate-warn');
  rebateWarn.hidden = !rebateWipesShare;
  if (rebateWipesShare) {
    rebateWarn.textContent = 'Warning: a ' + fmtNum(rebatePct) + '% rebate meets or exceeds the agent ' +
      fmtNum(splitPct) + '% share — agent take-home is zero, and VAT is still due on the full gross.';
  }

  $('s-gross').textContent = fmtAED(gross);
  $('s-vat').textContent = fmtAED(vat);
  $('s-net').textContent = fmtAED(net);
  $('s-agent').textContent = fmtAED(agent);
  $('s-broker').textContent = fmtAED(broker);
  $('s-quarter').textContent = fmtAED(quarterly);
  $('s-year').textContent = fmtAED(quarterly * 4);

  drawBars($('chart-split'), ['Commission split'], [
    { label: 'Agent take-home', values: [agent], color: '#d4af37' },
    { label: 'Brokerage keeps', values: [broker], color: '#58a6ff' },
  ], { yFmt: fmtCompact });

  const cum = [];
  for (let q = 1; q <= 4; q++) cum.push([q - 1, quarterly * q]);
  drawLine($('chart-proj'), [
    { label: 'Cumulative agent income', color: '#d4af37', points: cum },
  ], { xLabels: ['Q1', 'Q2', 'Q3', 'Q4'], yFmt: fmtCompact });

  const flow = fmtNum(dpq) + ' deal' + (dpq === 1 ? '' : 's') + ' per quarter';
  $('proj-note').textContent = 'At ' + flow + ': ' + fmtAED(quarterly) +
    ' per quarter, ' + fmtAED(quarterly * 4) + ' per year in agent take-home (excl. VAT).';

  renderGoal(agent, dpq);
  renderPipeline(splitPct);
}

function setTab(name) {
  active = name;
  for (const n of ['offplan', 'resale', 'rental']) {
    $('tab-' + n).className = n === name ? 'btn' : 'btn ghost';
    $('panel-' + n).hidden = n !== name;
  }
  render();
}

['op-price', 'op-comm', 'op-rebate', 'op-deals', 'rs-price', 'rs-fee', 'rs-dual', 'rs-deals', 'rn-rent', 'rn-deals', 'split', 'goal-target'].forEach(watch);
$('tab-offplan').addEventListener('click', () => setTab('offplan'));
$('tab-resale').addEventListener('click', () => setTab('resale'));
$('tab-rental').addEventListener('click', () => setTab('rental'));

$('pl-seg').addEventListener('change', () => {
  $('pl-pct').value = PL_DEFAULTS[strVal('pl-seg')];
});
$('pl-add').addEventListener('click', () => {
  const seg = strVal('pl-seg');
  const pctRaw = $('pl-pct').value.trim();
  // an explicitly typed 0% is kept; only an empty field falls back to the segment default
  pipeline.push({ seg, value: numVal('pl-value'), pct: pctRaw === '' ? PL_DEFAULTS[seg] : numVal('pl-pct') });
  render();
});
$('pl-body').addEventListener('click', (e) => {
  const idx = e.target.dataset.idx;
  if (idx === undefined) return;
  pipeline.splice(Number(idx), 1);
  render();
});
$('pl-export').addEventListener('click', exportPipelineCSV);

render();
