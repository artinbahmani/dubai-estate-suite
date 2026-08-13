// Tool 09 — Instant CMA
// Comparative market analysis from the DLD transaction sample dataset.

const RECS = DLD_TRANSACTIONS.records;
const MIN_COMPS = 5;      // below this, widen the search
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

// median ppsf per calendar month for a community, from the given pool
function monthlyMedianPpsf(pool, community) {
  const byMonth = {};
  for (const r of pool) {
    if (r.community !== community) continue;
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
// pool is the record set to search (off-plan already filtered when the toggle is off).
// returns { comps, note }
function findComps(pool, community, beds, type) {
  const match = (r, b) =>
    r.community === community && r.type === type &&
    (b === null ? true : r.beds === b);

  const cutoff = addMonths(DATA_MAX_DATE, -12);
  const exact = pool.filter(r => match(r, beds));
  const recent = exact.filter(r => r.date >= cutoff);

  if (recent.length >= MIN_COMPS) {
    return { comps: recent, note: 'Using ' + recent.length + ' transactions from the last 12 months (' + cutoff + ' to ' + DATA_MAX_DATE + ').' };
  }
  if (exact.length >= MIN_COMPS) {
    return { comps: exact, note: 'Fewer than ' + MIN_COMPS + ' comps in the last 12 months — using the full dataset range (' + exact.length + ' transactions).' };
  }
  const widened = pool.filter(r => r.community === community && r.type === type && Math.abs(r.beds - beds) <= 1);
  if (widened.length) {
    return { comps: widened, note: 'Fewer than ' + MIN_COMPS + ' comps overall — widened to ±1 bedroom (' + bedsLabel(Math.max(0, beds - 1)) + ' to ' + bedsLabel(beds + 1) + ') across the full dataset range.' };
  }
  return { comps: [], note: 'No comparable transactions found for this combination.' };
}

let lastRows = []; // current comps with trend factor, for CSV export

function render() {
  const community = strVal('community');
  const type = strVal('ptype');
  const beds = parseInt(strVal('beds'), 10);
  const sqft = numVal('sqft');
  const trendOn = document.getElementById('trendOn').checked;
  const inclOffplan = document.getElementById('offplanOn').checked;

  const pool = inclOffplan ? RECS : RECS.filter(r => !r.offplan);
  const { comps, note } = findComps(pool, community, beds, type);

  // trend adjustment: scale each comp to the latest dataset month using the
  // community's monthly median ppsf (factor 1 when a month has no data)
  let fullNote = note;
  let factorOf = () => 1;
  if (trendOn && comps.length) {
    const med = monthlyMedianPpsf(pool, community);
    const lastM = DATA_MAX_DATE.slice(0, 7);
    factorOf = r => {
      const now = med[lastM], then = med[r.date.slice(0, 7)];
      return now > 0 && then > 0 ? now / then : 1;
    };
    fullNote += ' Comp prices trend-adjusted to ' + lastM + ' using the community monthly median AED/sqft.';
  }

  const ppsfs = comps.map(r => r.ppsf * factorOf(r)).sort((a, b) => a - b);

  const p25 = percentile(ppsfs, 0.25);
  const p50 = percentile(ppsfs, 0.5);
  const p75 = percentile(ppsfs, 0.75);
  const est = p50 * sqft;

  // stat cards
  document.getElementById('sComps').textContent = comps.length ? String(comps.length) : '0';
  document.getElementById('sMedian').textContent = comps.length ? fmtNum(p50) : '—';
  document.getElementById('sValue').textContent = comps.length ? fmtAED(est) : '—';
  document.getElementById('sRange').textContent = comps.length ? fmtAED(p25 * sqft) + ' – ' + fmtAED(p75 * sqft) : '—';
  document.getElementById('fallbackNote').textContent = fullNote;

  // indicative gross yield from the rent index at the estimated value
  const rentIdx = RENT_INDEX_DATA.index[community];
  const rent = rentIdx && rentIdx[beds] !== undefined ? rentIdx[beds] : null;
  document.getElementById('sYield').textContent =
    comps.length && rent && est > 0
      ? fmtPct(rent / est) + ' (' + fmtCompact(rent) + '/yr index rent)'
      : '—';

  // confidence: driven by comp count and ppsf spread (IQR relative to median)
  const conf = document.getElementById('confidence');
  if (!comps.length) {
    conf.className = 'verdict bad';
    conf.textContent = 'No comparable transactions — cannot produce an estimate.';
  } else {
    const spread = p50 > 0 ? (p75 - p25) / p50 : Infinity;
    if (comps.length < 8 || spread > 0.2) {
      conf.className = 'verdict warn';
      conf.textContent = 'Moderate confidence — ' +
        (comps.length < 8 ? 'limited comp count (' + comps.length + ')' : 'wide price spread between comps (±' + fmtPct(spread / 2) + ' around the median)') +
        '. Treat the range, not the point estimate.';
    } else {
      conf.className = 'verdict ok';
      conf.textContent = 'Good confidence — ' + comps.length + ' comps with a tight spread (±' + fmtPct(spread / 2) + ' around the median).';
    }
  }

  // scatter: comps (trend-adjusted when on) in gold, subject highlighted in red
  const points = comps.map(r => ({ x: r.sqft, y: r.price * factorOf(r) }));
  if (comps.length) points.push({ x: sqft, y: est, r: 7, color: '#f85149' });
  const canvas = document.getElementById('scatter');
  if (points.length) {
    drawScatter(canvas, points, {
      xFmt: v => fmtNum(v) + ' sqft',
      yFmt: v => fmtCompact(v)
    });
  } else {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }
  document.getElementById('scatterNote').textContent = trendOn
    ? 'Gold dots are comparable transactions trend-adjusted to the latest dataset month. The red dot is the subject property at the estimated value.'
    : 'Gold dots are comparable transactions. The red dot is the subject property at the estimated value.';

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
  a.download = 'instant-cma-export.csv';
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
