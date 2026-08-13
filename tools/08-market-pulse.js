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

// median ppsf per month; months without records are skipped (and their labels dropped)
function medianSeries(grouped) {
  const pts = [], labels = [];
  let i = 0;
  for (const [ym, list] of grouped) {
    if (!list.length) continue;
    pts.push([i, median(list.map(r => r.ppsf))]);
    labels.push(monthLabel(ym));
    i++;
  }
  return { pts, labels };
}

function render() {
  const comm = strVal('f-community');
  const type = strVal('f-type');

  const filtered = records.filter(r => (comm === 'all' || r.community === comm) && matchesType(r, type));
  const typeOnly = records.filter(r => matchesType(r, type));

  // ---- stat cards ----
  const offplanCount = filtered.filter(r => r.offplan).length;
  const avgTicket = filtered.length ? filtered.reduce((s, r) => s + r.price, 0) / filtered.length : NaN;
  document.getElementById('s-count').textContent = fmtNum(filtered.length);
  document.getElementById('s-ppsf').textContent = fmtNum(median(filtered.map(r => r.ppsf)));
  document.getElementById('s-offplan').textContent = filtered.length ? fmtPct(offplanCount / filtered.length) : '—';
  document.getElementById('s-ticket').textContent = fmtAED(avgTicket);

  const grouped = groupByMonth(filtered);

  // ---- (a) monthly transaction count ----
  const counts = months.map(ym => grouped.get(ym).length);
  drawBars(
    document.getElementById('c-volume'),
    months.map(monthLabel),
    [{ label: 'Transactions', values: counts, color: SERIES_COLORS[0] }]
  );

  // ---- (b) median ppsf: selected community vs all Dubai ----
  const sel = medianSeries(grouped);
  const all = medianSeries(groupByMonth(typeOnly));
  const ppsfCanvas = document.getElementById('c-ppsf');
  if (!sel.pts.length) {
    clearCanvas(ppsfCanvas, 'No data for this selection');
  } else {
    // x positions are index-based; the all-Dubai line is realigned to the same month axis
    const series = [];
    if (comm !== 'all') {
      series.push({ label: comm, color: SERIES_COLORS[0], points: sel.pts });
      series.push({ label: 'All Dubai', color: SERIES_COLORS[1], points: all.pts });
    } else {
      series.push({ label: 'All Dubai', color: SERIES_COLORS[0], points: all.pts });
    }
    drawLine(ppsfCanvas, series, {
      xLabels: comm !== 'all' ? sel.labels : all.labels,
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

  // ---- top 5 communities table (type filter only) ----
  const byComm = new Map();
  for (const r of typeOnly) {
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

  document.getElementById('tbl-top').innerHTML = top.map(t =>
    '<tr><td>' + t.name + '</td>' +
    '<td class="num">' + fmtNum(t.count) + '</td>' +
    '<td class="num">' + fmtNum(t.ppsf) + '</td>' +
    '<td class="num">' + fmtPct(t.offplan) + '</td></tr>'
  ).join('');
}

// populate community select from the data so it stays in sync with the dataset
const commSelect = document.getElementById('f-community');
for (const c of communities) {
  const opt = document.createElement('option');
  opt.value = c;
  opt.textContent = c;
  commSelect.appendChild(opt);
}

document.getElementById('f-community').addEventListener('change', render);
document.getElementById('f-type').addEventListener('change', render);
render();
