// Tool 12 — Service Charge Index: searchable reference, cost estimator, comparison chart.

const entries = SERVICE_CHARGES.communities;

// unique community names in data order
const communityNames = [...new Set(entries.map(e => e.community))];

function entriesFor(community) {
  return entries.filter(e => e.community === community);
}

// ---- reference table ----

// rows currently shown in the table (after search + sort), used by the CSV export
let shownRows = [];

function renderTable() {
  const q = strVal('search').trim().toLowerCase();
  const sort = strVal('sort');
  let rows = entries.filter(e => e.community.toLowerCase().includes(q));
  if (sort === 'typAsc') rows = [...rows].sort((a, b) => a.typical - b.typical);
  else if (sort === 'typDesc') rows = [...rows].sort((a, b) => b.typical - a.typical);
  else rows = [...rows].sort((a, b) => a.community.localeCompare(b.community) || a.segment.localeCompare(b.segment));
  shownRows = rows;

  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  for (const e of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + e.community + '</td>' +
      '<td>' + e.segment + '</td>' +
      '<td class="num">' + fmtNum(e.low, 1) + '</td>' +
      '<td class="num gold">' + fmtNum(e.typical, 1) + '</td>' +
      '<td class="num">' + fmtNum(e.high, 1) + '</td>' +
      '<td style="color:var(--muted);">' + e.notes + '</td>';
    tbody.appendChild(tr);
  }
  document.getElementById('listNote').textContent = rows.length
    ? rows.length + ' of ' + entries.length + ' entries shown · AED per sqft per year. ' + SERVICE_CHARGES.note + '.'
    : 'No communities match your search.';
}

function csvCell(x) {
  const s = String(x);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportCsv() {
  const rows = [['Community', 'Segment', 'Low (AED/sqft/yr)', 'Typical (AED/sqft/yr)', 'High (AED/sqft/yr)', 'Notes']];
  for (const e of shownRows) rows.push([e.community, e.segment, e.low, e.typical, e.high, e.notes]);
  const csv = rows.map(r => r.map(csvCell).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'service-charge-index.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---- cost estimator ----

function fillSegments() {
  const community = strVal('estCommunity');
  const sel = document.getElementById('estSegment');
  sel.innerHTML = '';
  for (const e of entriesFor(community)) {
    const opt = document.createElement('option');
    opt.value = opt.textContent = e.segment;
    sel.appendChild(opt);
  }
}

function renderEstimate() {
  const community = strVal('estCommunity');
  const segment = strVal('estSegment');
  const sqft = numVal('estSqft');
  const e = entriesFor(community).find(x => x.segment === segment);
  if (!e || sqft <= 0) {
    for (const id of ['sLow', 'sTyp', 'sHigh', 'sMonthly']) document.getElementById(id).textContent = '—';
    document.getElementById('estNote').textContent = sqft <= 0 ? 'Enter a property size to estimate the annual cost.' : '—';
    return;
  }
  document.getElementById('sLow').textContent = fmtAED(e.low * sqft);
  document.getElementById('sTyp').textContent = fmtAED(e.typical * sqft);
  document.getElementById('sHigh').textContent = fmtAED(e.high * sqft);
  document.getElementById('sMonthly').textContent = fmtAED(e.typical * sqft / 12);
  document.getElementById('estNote').textContent =
    community + ' · ' + segment + ' · ' + fmtNum(e.low, 1) + '–' + fmtNum(e.high, 1) + ' AED/sqft/yr (typical ' + fmtNum(e.typical, 1) + '). ' + e.notes;
}

// ---- comparison chart ----

// each comparison option is one community+segment pair
function fillCompare(sel) {
  sel.innerHTML = '';
  const optNone = document.createElement('option');
  optNone.value = '';
  optNone.textContent = '— none —';
  sel.appendChild(optNone);
  entries.forEach((e, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = e.community + ' · ' + e.segment;
    sel.appendChild(opt);
  });
}

function renderCompare() {
  const picks = [];
  for (const id of ['cmp1', 'cmp2', 'cmp3']) {
    const v = strVal(id);
    if (v === '') continue;
    const e = entries[Number(v)];
    if (e && !picks.includes(e)) picks.push(e);
  }
  // several communities appear with multiple segments — disambiguate identical bar labels
  const counts = {};
  for (const e of picks) counts[e.community] = (counts[e.community] || 0) + 1;
  drawBars(document.getElementById('cmpChart'),
    picks.map(e => counts[e.community] > 1 ? e.community + ' (' + e.segment + ')' : e.community),
    [{ label: 'Typical AED/sqft/yr', values: picks.map(e => e.typical), color: SERIES_COLORS[0] }],
    { yFmt: v => 'AED ' + fmtNum(v, 0) });
}

// ---- wiring ----

function init() {
  const est = document.getElementById('estCommunity');
  for (const c of communityNames) {
    const opt = document.createElement('option');
    opt.value = opt.textContent = c;
    est.appendChild(opt);
  }
  est.value = 'JVC';
  fillSegments();

  for (const [id, def] of [['cmp1', 0], ['cmp2', 3], ['cmp3', 14]]) {
    fillCompare(document.getElementById(id));
    document.getElementById(id).value = def;
  }

  document.getElementById('search').addEventListener('input', renderTable);
  document.getElementById('sort').addEventListener('change', renderTable);
  document.getElementById('exportCsv').addEventListener('click', exportCsv);
  est.addEventListener('change', () => { fillSegments(); renderEstimate(); });
  document.getElementById('estSegment').addEventListener('change', renderEstimate);
  document.getElementById('estSqft').addEventListener('input', renderEstimate);
  for (const id of ['cmp1', 'cmp2', 'cmp3']) document.getElementById(id).addEventListener('change', renderCompare);

  renderTable();
  renderEstimate();
  renderCompare();
}

init();
