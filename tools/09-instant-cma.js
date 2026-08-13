// Tool 09 — Instant CMA
// Comparative market analysis from the DLD transaction sample dataset.

const RECS = DLD_TRANSACTIONS.records;
const MIN_COMPS = 5;      // below this, widen the search
const MIN_POINT = 3;      // below this, show a range only (no point estimate)
const TABLE_ROWS = 12;

// latest transaction date in the dataset; the "last 12 months" window is
// measured back from this, not from today
const DATA_MAX_DATE = RECS.map(r => r.date).sort().slice(-1)[0];

// linear-interpolation percentile on a sorted numeric array
function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function bedsLabel(b) {
  return b === 0 ? 'Studio' : b + ' BR';
}

// median ppsf per calendar month for a community + type, from the given pool
function monthlyMedianPpsf(pool, community, type) {
  const byMonth = {};
  for (const r of pool) {
    if (r.community !== community || r.type !== type) continue;
    const m = r.date.slice(0, 7);
    (byMonth[m] = byMonth[m] || []).push(r.ppsf);
  }
  const med = {};
  for (const m in byMonth) {
    med[m] = percentile([...byMonth[m]].sort((a, b) => a - b), 0.5);
  }
  return med;
}

// comps matching community + type + beds, with fallback widening.
// preference layers: (1) size within ±15% of the subject, last 12 months;
// (2) any size, last 12 months; (3) any size, full date range;
// (4) beds ±1, full date range. the active layer is stated in the note;
// layer > 1 means a fallback fired.
// pool is the record set to search (off-plan already filtered when the toggle is off).
// returns { comps, note, layer }
function findComps(pool, community, beds, type, sqft) {
  const match = (r, b) =>
    r.community === community && r.type === type &&
    (b === null ? true : r.beds === b);
  const inWindow = r => Math.abs(r.sqft - sqft) <= sqft * 0.15;

  const cutoff = addMonths(DATA_MAX_DATE, -12);
  const exact = pool.filter(r => match(r, beds));
  const recent = exact.filter(r => r.date >= cutoff);
  const recentSized = recent.filter(inWindow);

  if (recentSized.length >= MIN_COMPS) {
    return { comps: recentSized, layer: 1, note: 'Using ' + recentSized.length + ' transactions from the last 12 months (' + cutoff + ' to ' + DATA_MAX_DATE + ') within ±15% of the subject size.' };
  }
  if (recent.length >= MIN_COMPS) {
    return { comps: recent, layer: 2, note: 'Fewer than ' + MIN_COMPS + ' comps within ±15% of the subject size — using all ' + recent.length + ' transactions from the last 12 months (' + cutoff + ' to ' + DATA_MAX_DATE + ') regardless of size.' };
  }
  if (exact.length >= MIN_COMPS) {
    return { comps: exact, layer: 3, note: 'Fewer than ' + MIN_COMPS + ' comps in the last 12 months — using the full dataset range (' + exact.length + ' transactions, any size).' };
  }
  const widened = pool.filter(r => r.community === community && r.type === type && Math.abs(r.beds - beds) <= 1);
  if (widened.length) {
    return { comps: widened, layer: 4, note: 'Fewer than ' + MIN_COMPS + ' comps overall — widened to ±1 bedroom (' + bedsLabel(Math.max(0, beds - 1)) + ' to ' + bedsLabel(beds + 1) + ') across the full dataset range.' };
  }
  return { comps: [], layer: 4, note: 'No comparable transactions found for this combination.' };
}

let lastRows = []; // current comps with trend factor, for CSV export

function render() {
  const community = strVal('community');
  const type = strVal('ptype');
  const beds = parseInt(strVal('beds'), 10);
  const sqftRaw = numVal('sqft');
  const sqftOk = sqftRaw > 0;           // non-positive size: no estimate, no subject dot
  const sqft = Math.max(100, sqftRaw);  // clamp tiny sizes so filters/axes stay sane
  const trendOn = document.getElementById('trendOn').checked;
  const inclOffplan = document.getElementById('offplanOn').checked;

  const pool = inclOffplan ? RECS : RECS.filter(r => !r.offplan);
  const { comps, note, layer } = findComps(pool, community, beds, type, sqft);

  // trend adjustment: scale each comp to the latest dataset month using the
  // community+type monthly median ppsf (factor 1 when a month has no data)
  let fullNote = note;
  let factorOf = () => 1;
  if (trendOn && comps.length) {
    const med = monthlyMedianPpsf(pool, community, type);
    const lastM = DATA_MAX_DATE.slice(0, 7);
    const hasMed = r => med[lastM] > 0 && med[r.date.slice(0, 7)] > 0;
    factorOf = r => hasMed(r) ? med[lastM] / med[r.date.slice(0, 7)] : 1;
    const unadjusted = comps.filter(r => !hasMed(r)).length;
    fullNote += ' Comp prices trend-adjusted to ' + lastM + ' using the community ' + type + ' monthly median AED/sqft.';
    if (unadjusted > 0) fullNote += ' ' + unadjusted + ' comp' + (unadjusted > 1 ? 's' : '') + ' unadjusted (no median data for their month).';
  }

  const ppsfs = comps.map(r => r.ppsf * factorOf(r)).sort((a, b) => a - b);

  const p25 = percentile(ppsfs, 0.25);
  const p50 = percentile(ppsfs, 0.5);
  const p75 = percentile(ppsfs, 0.75);
  const est = p50 * sqft;
  const enough = comps.length >= MIN_POINT;

  // indicative gross yield from the rent index at the estimated value
  // (apartments only — the index is apartment-level)
  const rentIdx = RENT_INDEX_DATA.index[community];
  const rent = type === 'apartment' && rentIdx && rentIdx[beds] !== undefined ? rentIdx[beds] : null;
  if (type !== 'apartment') fullNote += ' Gross yield is shown for apartments only — the rent index is apartment-level.';
  else if (rent === null) fullNote += ' No index rent for this configuration — gross yield unavailable.';

  // stat cards
  document.getElementById('sComps').textContent = String(comps.length);
  document.getElementById('sMedian').textContent = enough ? fmtNum(p50) : '—';
  document.getElementById('sValue').textContent = enough && sqftOk ? fmtAED(est) : '—';
  document.getElementById('sRange').textContent = comps.length && sqftOk ? fmtAED(p25 * sqft) + ' – ' + fmtAED(p75 * sqft) : '—';
  document.getElementById('sYield').textContent =
    enough && sqftOk && rent && est > 0
      ? fmtPct(rent / est) + ' (' + fmtCompact(rent) + '/yr index rent)'
      : '—';
  document.getElementById('fallbackNote').textContent = fullNote;

  // confidence: driven by comp count, ppsf spread (IQR relative to median) and
  // whether any fallback branch fired; a fallback caps the verdict at Moderate
  const conf = document.getElementById('confidence');
  if (!comps.length) {
    conf.className = 'verdict bad';
    conf.textContent = 'No comparable transactions — cannot produce an estimate.';
  } else if (!enough) {
    conf.className = 'verdict warn';
    conf.textContent = 'Only ' + comps.length + ' comparable transaction' + (comps.length > 1 ? 's' : '') + ' — showing a range only; a point estimate needs at least ' + MIN_POINT + ' comps.';
  } else {
    const cutoff = addMonths(DATA_MAX_DATE, -12);
    const stale = comps.some(r => r.date < cutoff);
    const fallbackFired = layer > 1 || (stale && !trendOn);
    const spread = p50 > 0 ? (p75 - p25) / p50 : Infinity;
    if (comps.length < 8 || spread > 0.2 || fallbackFired) {
      conf.className = 'verdict warn';
      conf.textContent = 'Moderate confidence — ' +
        (comps.length < 8 ? 'limited comp count (' + comps.length + ')'
          : spread > 0.2 ? 'wide price spread between comps (IQR spans ' + fmtPct(spread) + ' of the median)'
          : 'fallback search used (size, date or bedroom criteria widened' + (stale && !trendOn ? '; comps predate the last 12 months and trend adjustment is off' : '') + ')') +
        '. Treat the range, not the point estimate.';
    } else {
      conf.className = 'verdict ok';
      conf.textContent = 'Good confidence — ' + comps.length + ' comps with a tight spread (IQR spans ' + fmtPct(spread) + ' of the median).';
    }
  }

  // scatter: comps (trend-adjusted when on) in gold, subject highlighted in red
  const points = comps.map(r => ({ x: r.sqft, y: r.price * factorOf(r) }));
  const showSubject = enough && sqftOk;
  if (showSubject) points.push({ x: sqft, y: est, r: 7, color: '#f85149' });
  const canvas = document.getElementById('scatter');
  if (points.length) {
    drawScatter(canvas, points, {
      xFmt: v => fmtNum(v) + ' sqft',
      yFmt: v => fmtCompact(v)
    });
  } else {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }
  document.getElementById('scatterNote').textContent =
    (trendOn
      ? 'Gold dots are comparable transactions trend-adjusted to the latest dataset month.'
      : 'Gold dots are comparable transactions.') +
    (showSubject ? ' The red dot is the subject property at the estimated value.' : '');

  // table: most recent comps first (recorded prices, unadjusted)
  const sorted = [...comps].sort((a, b) => (a.date < b.date ? 1 : -1));
  lastRows = sorted.map(r => ({ r, f: factorOf(r) }));
  const rows = sorted.slice(0, TABLE_ROWS);
  document.getElementById('compsBody').innerHTML = rows.length
    ? rows.map(r =>
        '<tr>' +
        '<td>' + r.date + '</td>' +
        '<td>' + (r.type === 'apartment' ? 'Apartment' : 'Villa') + ' · ' + bedsLabel(r.beds) +
          (r.offplan ? '<span class="badge">off-plan</span>' : '') + '</td>' +
        '<td class="num">' + fmtNum(r.sqft) + '</td>' +
        '<td class="num">' + fmtAED(r.price) + '</td>' +
        '<td class="num">' + fmtNum(r.ppsf) + '</td>' +
        '</tr>').join('')
    : '<tr><td colspan="5">No comparable transactions.</td></tr>';
  document.getElementById('tableNote').textContent =
    sorted.length > TABLE_ROWS ? 'Showing ' + rows.length + ' of ' + sorted.length + ' comps (most recent first).' : '';
}

// ---- CSV export ----

function csvCell(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportCsv() {
  if (!lastRows.length) return;
  const trendOn = document.getElementById('trendOn').checked;
  const head = ['Date', 'Community', 'Type', 'Beds', 'Sqft', 'Price (AED)', 'AED / sqft', 'Off-plan'];
  if (trendOn) head.push('Trend-adjusted price (AED)');
  const lines = [head.map(csvCell).join(',')];
  for (const { r, f } of lastRows) {
    const row = [r.date, r.community, r.type === 'apartment' ? 'Apartment' : 'Villa',
      bedsLabel(r.beds), r.sqft, r.price, r.ppsf, r.offplan ? 'yes' : 'no'];
    if (trendOn) row.push(Math.round(r.price * f));
    lines.push(row.map(csvCell).join(','));
  }
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  // cma-<community>-<yyyymmdd>.csv
  const slug = lastRows[0].r.community.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const d = new Date();
  const p2 = n => String(n).padStart(2, '0');
  a.download = 'cma-' + slug + '-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

// populate community select from the dataset, then wire up live recompute
(function init() {
  const communities = [...new Set(RECS.map(r => r.community))].sort();
  const sel = document.getElementById('community');
  sel.innerHTML = communities.map(c => '<option value="' + c + '">' + c + '</option>').join('');

  ['community', 'ptype', 'beds', 'sqft', 'trendOn', 'offplanOn'].forEach(id => {
    document.getElementById(id).addEventListener('input', render);
    document.getElementById(id).addEventListener('change', render);
  });
  document.getElementById('exportCsv').addEventListener('click', exportCsv);

  render();
})();
