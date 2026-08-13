// Tool 04 — Golden Visa eligibility via the property route.
// Rules (DLD/GDRFA):
//  - threshold: AED 2,000,000 purchase price per title deed / Oqood; properties combine
//  - ready, owned outright: counts at full price
//  - ready, mortgaged: counts at full price (bank NOC required) — eligible since Jan 2024
//  - off-plan: counts at full price only if >= 50% paid AND >= 50% construction complete

const THRESHOLD = 2000000;
const MIN_PAID_PCT = 50;
const MIN_BUILD_PCT = 50;

const STATUS = {
  owned:     'Ready — owned outright',
  mortgaged: 'Ready — mortgaged',
  offplan:   'Off-plan',
};

let nextId = 1;
const rows = []; // { id, els: { wrap, price, paid, status, buildField, build, buildVal } }

const rowsEl = document.getElementById('rows');

// ---- row DOM ----

function buildRow() {
  const id = nextId++;
  const wrap = document.createElement('div');
  wrap.className = 'prow';
  wrap.innerHTML = `
    <button type="button" class="remove">Remove</button>
    <div class="grid grid-2">
      <div class="field">
        <label>Nickname</label>
        <input type="text" data-f="name" placeholder="e.g. Marina apartment" value="Property ${id}">
      </div>
      <div class="field">
        <label>Status</label>
        <select data-f="status">
          <option value="owned">${STATUS.owned}</option>
          <option value="mortgaged">${STATUS.mortgaged}</option>
          <option value="offplan">${STATUS.offplan}</option>
        </select>
      </div>
      <div class="field">
        <label>Purchase price (AED)</label>
        <input type="number" data-f="price" min="0" step="10000" value="2000000">
      </div>
      <div class="field">
        <label>Amount already paid (AED)</label>
        <input type="number" data-f="paid" min="0" step="10000" value="2000000">
      </div>
    </div>
    <div class="field" data-f="buildField" style="display:none; margin-bottom:0">
      <label>Construction completion: <span class="range-val" data-f="buildVal">50%</span></label>
      <input type="range" data-f="build" min="0" max="100" step="1" value="50">
    </div>
  `;

  const els = { wrap };
  for (const input of wrap.querySelectorAll('[data-f]')) els[input.dataset.f] = input;

  els.remove = wrap.querySelector('.remove');
  els.remove.addEventListener('click', () => removeRow(id));
  for (const key of ['name', 'price', 'paid', 'build']) {
    els[key].addEventListener('input', render);
  }
  els.status.addEventListener('change', () => {
    // completion slider only matters for off-plan
    els.buildField.style.display = els.status.value === 'offplan' ? '' : 'none';
    render();
  });

  rowsEl.appendChild(wrap);
  return { id, els };
}

function addRow() {
  rows.push(buildRow());
  render();
}

function removeRow(id) {
  const i = rows.findIndex(r => r.id === id);
  if (i === -1) return;
  rows[i].els.wrap.remove();
  rows.splice(i, 1);
  render();
}

// ---- eligibility logic ----

// returns { counted, label, badges: [{ text, cls }] }
function assess(r) {
  const price = numVal(r.els.price);
  const paid = numVal(r.els.paid);
  const status = r.els.status.value;
  const label = STATUS[status];

  if (status === 'owned') {
    return { counted: price, label, badges: [{ text: 'counts at full price', cls: 'ok' }] };
  }
  if (status === 'mortgaged') {
    // full price counts since Jan 2024, but the bank NOC is a filing requirement
    return { counted: price, label, badges: [{ text: 'counts — bank NOC showing paid amount required', cls: 'warn' }] };
  }
  const build = numVal(r.els.build);
  const paidPct = price > 0 ? (paid / price) * 100 : 0;
  const qualifies = price > 0 && paidPct >= MIN_PAID_PCT && build >= MIN_BUILD_PCT;
  if (qualifies) {
    return { counted: price, label, badges: [{ text: 'counts — 50% paid & 50% built', cls: 'ok' }] };
  }
  const reasons = [];
  if (paidPct < MIN_PAID_PCT) reasons.push(`only ${fmtPct(paidPct / 100, 0)} paid`);
  if (build < MIN_BUILD_PCT) reasons.push(`only ${fmtNum(build, 0)}% built`);
  return { counted: 0, label, badges: [{ text: 'counts at 0 — ' + (reasons.join(', ') || 'no price entered'), cls: 'warn' }] };
}

// ---- render ----

function render() {
  // slider value labels
  for (const r of rows) r.els.buildVal.textContent = fmtNum(numVal(r.els.build), 0) + '%';

  const results = rows.map(r => ({ r, ...assess(r) }));
  const total = results.reduce((s, x) => s + x.counted, 0);
  const gap = THRESHOLD - total;

  document.getElementById('statCounted').textContent = fmtAED(total);
  document.getElementById('statThreshold').textContent = fmtAED(THRESHOLD);
  const gapEl = document.getElementById('statGap');
  const gapLabel = document.getElementById('statGapLabel');
  if (gap > 0) {
    gapLabel.textContent = 'Shortfall';
    gapEl.textContent = fmtAED(gap);
    gapEl.className = 'v neg';
  } else {
    gapLabel.textContent = 'Above threshold';
    gapEl.textContent = fmtAED(-gap);
    gapEl.className = 'v pos';
  }

  const pct = Math.min(100, (total / THRESHOLD) * 100);
  document.getElementById('barFill').style.width = pct + '%';
  document.getElementById('barLabel').textContent =
    fmtPct(total / THRESHOLD, 1) + ' of the ' + fmtAED(THRESHOLD) + ' threshold';

  const verdict = document.getElementById('verdict');
  if (total >= THRESHOLD) {
    verdict.className = 'verdict ok';
    verdict.textContent = 'Eligible — counted property value meets the AED 2,000,000 threshold for a 10-year renewable Golden Visa.';
  } else {
    verdict.className = 'verdict bad';
    verdict.textContent = 'Not yet eligible — ' + fmtAED(gap) + ' short of the AED 2,000,000 threshold.';
  }

  const body = document.getElementById('resultBody');
  body.innerHTML = '';
  for (const x of results) {
    const tr = document.createElement('tr');
    const badgeHtml = x.badges.map(b => `<span class="badge ${b.cls}">${b.text}</span>`).join('');
    const name = x.r.els.name.value.trim() || 'Property ' + x.r.id;
    tr.innerHTML = `
      <td></td>
      <td class="num">${fmtAED(numVal(x.r.els.price))}</td>
      <td class="num">${fmtAED(numVal(x.r.els.paid))}</td>
      <td class="num">${fmtAED(x.counted)}</td>
      <td>${x.label}${badgeHtml}</td>
    `;
    tr.firstElementChild.textContent = name; // textContent, not HTML — user input
    body.appendChild(tr);
  }
}

document.getElementById('addProperty').addEventListener('click', addRow);
addRow(); // start with one row; addRow() runs the initial render
