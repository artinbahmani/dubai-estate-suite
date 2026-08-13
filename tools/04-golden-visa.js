// Tool 04 — Golden Visa eligibility via the property route.
// Rules (DLD/GDRFA, as of Feb 2026):
//  - threshold: AED 2,000,000 purchase price / DLD-certified value per title deed
//    (ready) or Oqood (off-plan); properties combine
//  - ready, owned outright: counts at full price
//  - ready, mortgaged: counts at full price (bank NOC required) — eligible since Jan 2024
//  - off-plan: counts at full DLD-certified value regardless of amount paid or
//    construction stage (Feb-2026 circular); must be from a RERA/DLD-approved
//    developer and Oqood-registered. The completion slider is informational only.
//  - joint ownership: each applicant's share must independently reach AED 2M,
//    so counted value = price x ownership share %

const THRESHOLD = 2000000;

const STORAGE_KEY = 'des-golden-visa';          // property list
const CHECKLIST_KEY = 'des-golden-visa-checklist'; // checkbox states
const BUDGET_KEY = 'des-golden-visa-budget';    // gap planner extra budget

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
        <input type="number" data-f="price" min="0" step="10000" value="">
      </div>
      <div class="field">
        <label>Amount already paid (AED)</label>
        <input type="number" data-f="paid" min="0" step="10000" value="">
      </div>
      <div class="field">
        <label>Ownership share (%)</label>
        <input type="number" data-f="share" min="0" max="100" step="1" value="100">
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
  for (const key of ['name', 'price', 'paid', 'share', 'build']) {
    els[key].addEventListener('input', render);
  }
  els.status.addEventListener('change', () => {
    // completion slider is informational only, shown for off-plan
    els.buildField.style.display = els.status.value === 'offplan' ? '' : 'none';
    render();
  });

  rowsEl.appendChild(wrap);
  return { id, els };
}

function addRow(saved, doRender = true) {
  const r = buildRow();
  if (saved) {
    r.els.name.value = saved.name || '';
    r.els.status.value = saved.status in STATUS ? saved.status : 'owned';
    r.els.price.value = saved.price ?? '';
    r.els.paid.value = saved.paid ?? '';
    r.els.share.value = saved.share ?? 100;
    r.els.build.value = saved.build ?? 50;
    r.els.buildField.style.display = r.els.status.value === 'offplan' ? '' : 'none';
  }
  rows.push(r);
  if (doRender) render();
}

function removeRow(id) {
  const i = rows.findIndex(r => r.id === id);
  if (i === -1) return;
  rows[i].els.wrap.remove();
  rows.splice(i, 1);
  render();
}

// ---- persistence ----

function saveState() {
  try {
    const properties = rows.map(r => ({
      name: r.els.name.value,
      status: r.els.status.value,
      price: r.els.price.value,
      paid: r.els.paid.value,
      share: r.els.share.value,
      build: r.els.build.value,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
    localStorage.setItem(BUDGET_KEY, document.getElementById('extraBudget').value);
  } catch (e) { /* file:// or private mode can block storage; persistence just degrades */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const properties = raw ? JSON.parse(raw) : null;
    return Array.isArray(properties) ? properties : null;
  } catch (e) { return null; }
}

// ---- eligibility logic ----

// returns { counted, label, badges: [{ text, cls }] }
function assess(r) {
  const price = Math.max(0, numVal(r.els.price));
  const rawPaid = Math.max(0, numVal(r.els.paid));
  const share = Math.min(100, Math.max(0, numVal(r.els.share)));
  const status = r.els.status.value;
  const label = STATUS[status];

  // paid is clamped to price for all math; warn when the entered amount exceeds it
  const paidExceeded = rawPaid > price && rawPaid > 0;

  if (status === 'offplan' && price <= 0) {
    // special case: no price -> nothing to count, don't report '0% paid'
    const badges = [{ text: 'counts for AED 0 — no price entered', cls: 'warn' }];
    if (paidExceeded) badges.push({ text: 'amount paid exceeds price — capped at price', cls: 'warn' });
    return { counted: 0, label, badges };
  }

  const counted = price * share / 100;
  const badges = [];
  if (status === 'owned') {
    badges.push({ text: 'counts at full price', cls: 'ok' });
  } else if (status === 'mortgaged') {
    // full price counts since Jan 2024, but the bank NOC is a filing requirement
    badges.push({ text: 'counts — bank NOC showing paid amount required', cls: 'warn' });
  } else {
    // Feb-2026 circular: off-plan counts at full DLD-certified value regardless
    // of amount paid or construction stage
    badges.push({ text: 'counts at full DLD-certified value', cls: 'ok' });
    badges.push({ text: 'from a RERA/DLD-approved developer, Oqood-registered', cls: 'warn' });
  }
  if (share < 100) {
    badges.push({ text: "each applicant's share must independently reach AED 2M", cls: 'warn' });
  }
  if (paidExceeded) {
    badges.push({ text: 'amount paid exceeds price — capped at price', cls: 'warn' });
  }
  return { counted, label, badges };
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

  renderGap(total, gap);
  saveState();
}

// ---- gap planner ----

function renderGap(total, gap) {
  const card = document.getElementById('gapCard');
  if (gap <= 0) { card.style.display = 'none'; return; }
  card.style.display = '';

  const extra = numVal('extraBudget');
  const stillNeeded = Math.max(0, gap - extra);
  const v = document.getElementById('gapVerdict');
  if (stillNeeded === 0) {
    v.className = 'verdict ok';
    v.textContent = 'Adding ' + fmtAED(extra) + ' closes the gap — you would reach ' +
      fmtCompact(total + extra) + ' of counted value, above the AED 2,000,000 threshold.';
  } else if (extra > 0) {
    v.className = 'verdict warn';
    v.textContent = 'Adding ' + fmtAED(extra) + ' is not enough — ' + fmtAED(stillNeeded) +
      ' of extra counted value still needed on top of it.';
  } else {
    v.className = 'verdict warn';
    v.textContent = fmtAED(gap) + ' of additional counted property value is needed to reach the threshold.';
  }
}

// ---- checklist (localStorage-backed) ----

const checklistBoxes = document.querySelectorAll('#checklist input[type="checkbox"]');
try {
  const saved = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '[]');
  checklistBoxes.forEach((cb, i) => {
    cb.checked = !!saved[i];
    if (cb.checked) cb.closest('li').classList.add('done');
  });
} catch (e) { /* ignore corrupt state */ }
checklistBoxes.forEach(cb => cb.addEventListener('change', () => {
  cb.closest('li').classList.toggle('done', cb.checked);
  try {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify([...checklistBoxes].map(b => b.checked)));
  } catch (e) { /* storage unavailable */ }
}));

// ---- wiring & init ----

document.getElementById('extraBudget').addEventListener('input', render);
document.getElementById('addProperty').addEventListener('click', () => addRow());
document.getElementById('resetAll').addEventListener('click', () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CHECKLIST_KEY);
    localStorage.removeItem(BUDGET_KEY);
  } catch (e) { /* ignore */ }
  for (const r of rows) r.els.wrap.remove();
  rows.length = 0;
  nextId = 1;
  document.getElementById('extraBudget').value = 0;
  checklistBoxes.forEach(cb => { cb.checked = false; cb.closest('li').classList.remove('done'); });
  addRow();
});

try {
  const savedBudget = localStorage.getItem(BUDGET_KEY);
  if (savedBudget !== null) document.getElementById('extraBudget').value = savedBudget;
} catch (e) { /* storage unavailable */ }

const restored = loadState();
if (restored && restored.length) {
  restored.forEach(p => addRow(p, false)); // add all rows first...
  render();                                 // ...then render once
} else {
  addRow(); // start with one row; addRow() runs the initial render
}
