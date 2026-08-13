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

// comps matching community + type + beds, with fallback widening.
// returns { comps, note }
function findComps(community, beds, type) {
  const match = (r, b) =>
    r.community === community && r.type === type &&
    (b === null ? true : r.beds === b);

  const cutoff = addMonths(DATA_MAX_DATE, -12);
  const exact = RECS.filter(r => match(r, beds));
  const recent = exact.filter(r => r.date >= cutoff);

  if (recent.length >= MIN_COMPS) {
    return { comps: recent, note: 'Using ' + recent.length + ' transactions from the last 12 months (' + cutoff + ' to ' + DATA_MAX_DATE + ').' };
  }
  if (exact.length >= MIN_COMPS) {
    return { comps: exact, note: 'Fewer than ' + MIN_COMPS + ' comps in the last 12 months — using the full dataset range (' + exact.length + ' transactions).' };
  }
  const widened = RECS.filter(r => r.community === community && r.type === type && Math.abs(r.beds - beds) <= 1);
  if (widened.length) {
    return { comps: widened, note: 'Fewer than ' + MIN_COMPS + ' comps overall — widened to ±1 bedroom (' + bedsLabel(Math.max(0, beds - 1)) + ' to ' + bedsLabel(beds + 1) + ') across the full dataset range.' };
  }
  return { comps: [], note: 'No comparable transactions found for this combination.' };
}

function render() {
  const community = strVal('community');
  const type = strVal('ptype');
  const beds = parseInt(strVal('beds'), 10);
  const sqft = numVal('sqft');

  const { comps, note } = findComps(community, beds, type);
  const ppsfs = comps.map(r => r.ppsf).sort((a, b) => a - b);

  const p25 = percentile(ppsfs, 0.25);
  const p50 = percentile(ppsfs, 0.5);
  const p75 = percentile(ppsfs, 0.75);
  const est = p50 * sqft;

  // stat cards
  document.getElementById('sComps').textContent = comps.length ? String(comps.length) : '0';
  document.getElementById('sMedian').textContent = comps.length ? fmtNum(p50) : '—';
  document.getElementById('sValue').textContent = comps.length ? fmtAED(est) : '—';
  document.getElementById('sRange').textContent = comps.length ? fmtAED(p25 * sqft) + ' – ' + fmtAED(p75 * sqft) : '—';
  document.getElementById('fallbackNote').textContent = note;

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

  // scatter: comps in gold, subject property highlighted in red
  const points = comps.map(r => ({ x: r.sqft, y: r.price }));
  if (comps.length) points.push({ x: sqft, y: est, r: 7, color: '#f85149' });
  const canvas = document.getElementById('scatter');
  if (points.length) {
    drawScatter(canvas, points, {
      xFmt: v => fmtNum(v) + ' sqft',
      yFmt: v => 'AED ' + (v / 1e6).toFixed(1) + 'M'
    });
  } else {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }

  // table: most recent comps first
  const rows = [...comps].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, TABLE_ROWS);
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

// populate community select from the dataset, then wire up live recompute
(function init() {
  const communities = [...new Set(RECS.map(r => r.community))].sort();
  const sel = document.getElementById('community');
  sel.innerHTML = communities.map(c => '<option value="' + c + '">' + c + '</option>').join('');

  ['community', 'ptype', 'beds', 'sqft'].forEach(id => {
    document.getElementById(id).addEventListener('input', render);
    document.getElementById(id).addEventListener('change', render);
  });

  render();
})();
