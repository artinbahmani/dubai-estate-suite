// Tool 08 — Market Pulse
// Renders volume, median ppsf and off-plan mix from DLD_TRANSACTIONS
// (loaded by ../data/transactions.js). Everything recomputes on filter change.

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const records = DLD_TRANSACTIONS.records;
const communities = [...new Set(records.map(r => r.community))].sort();
const months = [...new Set(records.map(r => r.date.slice(0, 7)))].sort();

function median(arr) {
  if (!arr.length) return NaN;
  const a = [...arr].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// 'YYYY-MM' -> 'Sep 24'
function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return MONTH_NAMES[+m - 1] + ' ' + y.slice(2);
}

function matchesType(r, type) {
  return type === 'all' || r.type === type;
}

function matchesBeds(r, beds) {
  if (beds === 'all') return true;
  if (beds === 'studio') return r.beds === 0;
  if (beds === '3+') return r.beds >= 3;
  return r.beds === +beds;
}

// current filter state -> filtered records (all filters) and baseOnly (no community filter)
function currentFiltered() {
  const comm = strVal('f-community');
  const type = strVal('f-type');
  const beds = strVal('f-beds');
  return {
    comm,
    filtered: records.filter(r => (comm === 'all' || r.community === comm) && matchesType(r, type) && matchesBeds(r, beds)),
    baseOnly: records.filter(r => matchesType(r, type) && matchesBeds(r, beds))
  };
}

// group a record list into a Map of month -> records, keeping every month present
function groupByMonth(list) {
  const m = new Map(months.map(k => [k, []]));
  for (const r of list) m.get(r.date.slice(0, 7)).push(r);
  return m;
}

function clearCanvas(canvas, msg) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#9aa0a6';
  ctx.textAlign = 'center';
  ctx.font = '13px -apple-system, Segoe UI, sans-serif';
  ctx.fillText(msg, canvas.clientWidth / 2, canvas.clientHeight / 2);
}

// median ppsf per month; x = index on the full month axis, months without
// records are omitted (the x coordinate keeps the lines month-aligned)
function medianSeries(grouped) {
  const pts = [];
  months.forEach((ym, i) => {
    const list = grouped.get(ym);
    if (list.length) pts.push([i, median(list.map(r => r.ppsf))]);
  });
  return pts;
}

function render() {
  const { comm, filtered, baseOnly } = currentFiltered();

  // ---- stat cards ----
  const offplanCount = filtered.filter(r => r.offplan).length;
  const medTicket = median(filtered.map(r => r.price));
  document.getElementById('s-count').textContent = fmtNum(filtered.length);
  document.getElementById('s-ppsf').textContent = fmtNum(median(filtered.map(r => r.ppsf)));
  document.getElementById('s-offplan').textContent = filtered.length ? fmtPct(offplanCount / filtered.length) : '—';
  document.getElementById('s-ticket').textContent = fmtAED(medTicket);

  const grouped = groupByMonth(filtered);

  // ---- (a) monthly transaction count ----
  const volCanvas = document.getElementById('c-volume');
  if (!filtered.length) {
    clearCanvas(volCanvas, 'No data for this selection');
  } else {
    const counts = months.map(ym => grouped.get(ym).length);
    drawBars(
      volCanvas,
      months.map(monthLabel),
      [{ label: 'Transactions', values: counts, color: SERIES_COLORS[0] }]
    );
  }

  // ---- (b) median ppsf: selected community vs all Dubai ----
  const selPts = medianSeries(grouped);
  const allPts = medianSeries(groupByMonth(baseOnly));
  const ppsfCanvas = document.getElementById('c-ppsf');
  if (!selPts.length) {
    clearCanvas(ppsfCanvas, 'No data for this selection');
  } else {
    // x = month index on the full axis, so community and all-Dubai stay month-aligned
    const series = [];
    if (comm !== 'all') {
      series.push({ label: comm, color: SERIES_COLORS[0], points: selPts });
      series.push({ label: 'All Dubai', color: SERIES_COLORS[1], points: allPts });
    } else {
      series.push({ label: 'All Dubai', color: SERIES_COLORS[0], points: allPts });
    }
    drawLine(ppsfCanvas, series, {
      xLabels: months.map(monthLabel),
      yFmt: v => fmtNum(v)
    });
  }

  // ---- (c) off-plan share % by month ----
  const sharePts = [], shareLabels = [];
  let i = 0;
  for (const [ym, list] of grouped) {
    if (!list.length) continue;
    sharePts.push([i, list.filter(r => r.offplan).length / list.length]);
    shareLabels.push(monthLabel(ym));
    i++;
  }
  const shareCanvas = document.getElementById('c-offplan');
  if (!sharePts.length) {
    clearCanvas(shareCanvas, 'No data for this selection');
  } else {
    drawLine(shareCanvas, [{ label: 'Off-plan share', color: SERIES_COLORS[0], points: sharePts }], {
      xLabels: shareLabels,
      yFmt: v => fmtPct(v, 0)
    });
  }

  // ---- momentum: median ppsf, last 3 months vs previous 3 ----
  const prevSet = new Set(months.slice(-6, -3));
  const lastSet = new Set(months.slice(-3));
  // same 3 months one year earlier, for the YoY stat
  const yoySet = new Set(months.slice(-3).map(ym => (+ym.slice(0, 4) - 1) + ym.slice(4)));
  const windowMedian = (list, set) => {
    const vals = list.filter(r => set.has(r.date.slice(0, 7))).map(r => r.ppsf);
    return vals.length ? median(vals) : NaN;
  };
  const windowCount = (list, set) => list.filter(r => set.has(r.date.slice(0, 7))).length;
  const momChange = list => {
    const p = windowMedian(list, prevSet), l = windowMedian(list, lastSet);
    return { prev: p, last: l, change: isFinite(p) && isFinite(l) && p > 0 ? l / p - 1 : NaN };
  };
  const mom = momChange(filtered);
  const yoyBase = windowMedian(filtered, yoySet);
  const yoyChange = isFinite(yoyBase) && isFinite(mom.last) && yoyBase > 0 ? mom.last / yoyBase - 1 : NaN;
  const signedPct = x => (isFinite(x) ? (x >= 0 ? '+' : '') + fmtPct(x) : '—');
  document.getElementById('s-momentum').textContent = signedPct(mom.change);
  document.getElementById('s-yoy').textContent = signedPct(yoyChange);
  document.getElementById('s-mom-first').textContent = fmtNum(mom.prev);
  document.getElementById('s-mom-last').textContent = fmtNum(mom.last);

  // per-community momentum ranking (type + bedrooms filters only);
  // a community needs >= 10 records in each 3-month window to qualify
  const momByComm = new Map();
  for (const r of baseOnly) {
    if (!momByComm.has(r.community)) momByComm.set(r.community, []);
    momByComm.get(r.community).push(r);
  }
  const ranked = [...momByComm.entries()]
    .map(([name, list]) => ({
      name,
      change: momChange(list).change,
      minN: Math.min(windowCount(list, prevSet), windowCount(list, lastSet))
    }))
    .filter(c => isFinite(c.change) && c.minN >= 10)
    .sort((a, b) => b.change - a.change);
  const fillMomRows = (bodyId, rows) => {
    const body = document.getElementById(bodyId);
    body.textContent = '';
    if (!rows.length) {
      const c = body.insertRow().insertCell();
      c.colSpan = 2;
      c.textContent = '—';
      return;
    }
    for (const r of rows) {
      const tr = body.insertRow();
      tr.insertCell().textContent = r.name;
      const c = tr.insertCell();
      c.className = 'num';
      c.textContent = signedPct(r.change);
    }
  };
  fillMomRows('tbl-gainers', ranked.slice(0, 3));
  // losers start after the gainers slice so the two tables never overlap
  fillMomRows('tbl-losers', ranked.slice(Math.max(3, ranked.length - 3)).reverse());

  // ---- mix: apartment vs villa share by count ----
  const mixCanvas = document.getElementById('c-mix');
  if (!filtered.length) {
    clearCanvas(mixCanvas, 'No data for this selection');
  } else {
    drawDonut(mixCanvas, [
      { label: 'Apartments', value: filtered.filter(r => r.type === 'apartment').length, color: SERIES_COLORS[0] },
      { label: 'Villas', value: filtered.filter(r => r.type === 'villa').length, color: SERIES_COLORS[1] }
    ]);
  }

  // ---- top 5 communities table (type + bedrooms filters only) ----
  const byComm = new Map();
  for (const r of baseOnly) {
    if (!byComm.has(r.community)) byComm.set(r.community, []);
    byComm.get(r.community).push(r);
  }
  const top = [...byComm.entries()]
    .map(([name, list]) => ({
      name,
      count: list.length,
      ppsf: median(list.map(r => r.ppsf)),
      offplan: list.filter(r => r.offplan).length / list.length
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topBody = document.getElementById('tbl-top');
  topBody.textContent = '';
  for (const t of top) {
    const tr = topBody.insertRow();
    tr.insertCell().textContent = t.name;
    for (const v of [fmtNum(t.count), fmtNum(t.ppsf), fmtPct(t.offplan)]) {
      const c = tr.insertCell();
      c.className = 'num';
      c.textContent = v;
    }
  }
}

// populate community select from the data so it stays in sync with the dataset
const commSelect = document.getElementById('f-community');
for (const c of communities) {
  const opt = document.createElement('option');
  opt.value = c;
  opt.textContent = c;
  commSelect.appendChild(opt);
}

// subtitle count and coverage badge are derived from the dataset, not hardcoded
document.getElementById('subtitle').textContent =
  'Transaction volume, price per sqft trends and off-plan vs ready share across ' +
  communities.length + ' Dubai communities.';
document.getElementById('data-through').textContent =
  'Data through ' + monthLabel(months[months.length - 1]) + ' · sample dataset';

// CSV export of the fully filtered record set
function exportCsv() {
  const rows = currentFiltered().filtered;
  const esc = v => {
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = ['date,community,type,beds,sqft,price,ppsf,offplan'];
  for (const r of rows) {
    lines.push([r.date, r.community, r.type, r.beds, r.sqft, r.price, r.ppsf, r.offplan].map(esc).join(','));
  }
  // BOM so Excel reads the UTF-8 correctly; revoke deferred until the click is dispatched
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'market-pulse-export.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
}

document.getElementById('f-community').addEventListener('change', render);
document.getElementById('f-type').addEventListener('change', render);
document.getElementById('f-beds').addEventListener('change', render);
document.getElementById('btn-export').addEventListener('click', exportCsv);
render();
