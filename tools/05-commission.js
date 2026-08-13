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

// gross commission (excl. VAT, after any rebate) for the active panel
function grossCommission() {
  if (active === 'offplan') {
    const price = numVal('op-price');
    return price * (numVal('op-comm') / 100) - price * (numVal('op-rebate') / 100);
  }
  if (active === 'resale') {
    const fee = numVal('rs-fee') / 100;
    return numVal('rs-price') * fee * ($('rs-dual').checked ? 2 : 1);
  }
  return Math.max(numVal('rn-rent') * RENTAL_RATE, RENTAL_MIN);
}

function dealsPerQuarter() {
  // only the off-plan panel models deal flow; resale/rental assume one deal per quarter
  return active === 'offplan' ? numVal('op-deals') : 1;
}

function render() {
  const splitPct = numVal('split');
  $('split-val').textContent = splitPct + '%';
  $('op-comm-val').textContent = numVal('op-comm').toFixed(1) + '%';
  $('rs-dual-note').hidden = !$('rs-dual').checked;

  const gross = Math.max(0, grossCommission());
  const vat = gross * VAT_RATE;
  const net = gross + vat;
  const agent = gross * splitPct / 100;
  const broker = gross - agent;
  const dpq = dealsPerQuarter();
  const quarterly = agent * dpq;

  $('s-gross').textContent = fmtAED(gross);
  $('s-vat').textContent = fmtAED(vat);
  $('s-net').textContent = fmtAED(net);
  $('s-agent').textContent = fmtAED(agent);
  $('s-broker').textContent = fmtAED(broker);
  $('s-quarter').textContent = fmtAED(quarterly);
  $('s-year').textContent = fmtAED(quarterly * 4);

  const kFmt = v => fmtNum(v / 1000) + 'k';
  drawBars($('chart-split'), ['Commission split'], [
    { label: 'Agent take-home', values: [agent], color: '#d4af37' },
    { label: 'Brokerage keeps', values: [broker], color: '#58a6ff' },
  ], { yFmt: kFmt });

  const cum = [];
  for (let q = 1; q <= 4; q++) cum.push([q - 1, quarterly * q]);
  drawLine($('chart-proj'), [
    { label: 'Cumulative agent income', color: '#d4af37', points: cum },
  ], { xLabels: ['Q1', 'Q2', 'Q3', 'Q4'], yFmt: kFmt });

  const flow = active === 'offplan'
    ? fmtNum(dpq) + ' deal' + (dpq === 1 ? '' : 's') + ' per quarter'
    : 'assumed 1 deal per quarter';
  $('proj-note').textContent = 'At ' + flow + ': ' + fmtAED(quarterly) +
    ' per quarter, ' + fmtAED(quarterly * 4) + ' per year in agent take-home (excl. VAT).';
}

function setTab(name) {
  active = name;
  for (const n of ['offplan', 'resale', 'rental']) {
    $('tab-' + n).className = n === name ? 'btn' : 'btn ghost';
    $('panel-' + n).hidden = n !== name;
  }
  render();
}

['op-price', 'op-comm', 'op-rebate', 'op-deals', 'rs-price', 'rs-fee', 'rs-dual', 'rn-rent', 'split'].forEach(watch);
$('tab-offplan').addEventListener('click', () => setTab('offplan'));
$('tab-resale').addEventListener('click', () => setTab('resale'));
$('tab-rental').addEventListener('click', () => setTab('rental'));

render();
