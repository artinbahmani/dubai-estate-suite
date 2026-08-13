// Shared helpers for all tools: formatting, finance math, canvas charts.
// No dependencies. Everything runs client-side.

const AED_PER_USD = 3.6725;

function fmtAED(n) {
  if (!isFinite(n)) return '—';
  return 'AED ' + Math.round(n).toLocaleString('en-US');
}

function fmtNum(n, d = 0) {
  if (!isFinite(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtPct(x, d = 1) {
  if (!isFinite(x)) return '—';
  return (x * 100).toFixed(d) + '%';
}

// ---- finance ----

// flows: [{ date: 'YYYY-MM-DD' | Date, amount }]  (negative = outflow)
function xnpv(rate, flows) {
  const t0 = new Date(flows[0].date).getTime();
  let s = 0;
  for (const f of flows) {
    const yrs = (new Date(f.date).getTime() - t0) / (365 * 86400000);
    s += f.amount / Math.pow(1 + rate, yrs);
  }
  return s;
}

function xirr(flows, lo = -0.95, hi = 10) {
  const sorted = [...flows].sort((a, b) => new Date(a.date) - new Date(b.date));
  let flo = xnpv(lo, sorted), fhi = xnpv(hi, sorted);
  if (flo * fhi > 0) return NaN;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const fm = xnpv(mid, sorted);
    if (Math.abs(fm) < 1e-7) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

// add months to a YYYY-MM-DD string, returns YYYY-MM-DD
function addMonths(dateStr, m) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + m);
  return d.toISOString().slice(0, 10);
}

// ---- canvas charts ----
// palette for multi-series charts
const SERIES_COLORS = ['#d4af37', '#58a6ff', '#3fb950', '#f85149', '#bc8cff', '#e3b341'];

function _chartSetup(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.font = '11px -apple-system, Segoe UI, sans-serif';
  return { ctx, w, h };
}

function _niceTicks(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const err = span / count / step;
  const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const niceStep = mult * step;
  const lo = Math.floor(min / niceStep) * niceStep;
  const ticks = [];
  for (let v = lo; v <= max + niceStep * 0.5; v += niceStep) ticks.push(v);
  return ticks;
}

function _yAxis(ctx, pad, ticks, yMin, yMax, plotH, plotW, fmt) {
  ctx.strokeStyle = '#26292f';
  ctx.fillStyle = '#9aa0a6';
  ctx.textAlign = 'right';
  for (const t of ticks) {
    const y = pad.top + plotH - ((t - yMin) / (yMax - yMin)) * plotH;
    if (y < pad.top - 1 || y > pad.top + plotH + 1) continue;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.fillText(fmt ? fmt(t) : fmtNum(t), pad.left - 8, y + 4);
  }
}

// series: [{ label, points: [[x,y],...] }] — x values must be numeric and shared scale
function drawLine(canvas, series, opts = {}) {
  const { ctx, w, h } = _chartSetup(canvas);
  const pad = { top: 14, right: 14, bottom: 26, left: 64 };
  const plotW = w - pad.left - pad.right, plotH = h - pad.top - pad.bottom;
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const s of series) for (const [x, y] of s.points) {
    if (x < xMin) xMin = x; if (x > xMax) xMax = x;
    if (y < yMin) yMin = y; if (y > yMax) yMax = y;
  }
  const ticks = _niceTicks(yMin, yMax);
  _yAxis(ctx, pad, ticks, ticks[0], ticks[ticks.length - 1], plotH, plotW, opts.yFmt);
  yMin = ticks[0]; yMax = ticks[ticks.length - 1];
  ctx.fillStyle = '#9aa0a6';
  ctx.textAlign = 'center';
  const nX = Math.min(8, opts.xLabels ? opts.xLabels.length : 0);
  if (opts.xLabels) {
    for (let i = 0; i < nX; i++) {
      const idx = Math.round(i * (opts.xLabels.length - 1) / Math.max(1, nX - 1));
      const x = pad.left + ((idx / Math.max(1, opts.xLabels.length - 1)) * plotW);
      ctx.fillText(String(opts.xLabels[idx]), x, h - 8);
    }
  }
  series.forEach((s, si) => {
    const color = s.color || SERIES_COLORS[si % SERIES_COLORS.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const xCount = s.points.length;
    s.points.forEach(([x, y], i) => {
      const px = pad.left + (xCount > 1 ? (i / (xCount - 1)) * plotW : plotW / 2);
      const py = pad.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
    if (s.label) {
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.fillText(s.label, pad.left + 10 + si * 110, pad.top + 6);
    }
  });
}

// labels: string[], datasets: [{ label, values: number[] }]
function drawBars(canvas, labels, datasets, opts = {}) {
  const { ctx, w, h } = _chartSetup(canvas);
  const pad = { top: 16, right: 14, bottom: 40, left: 64 };
  const plotW = w - pad.left - pad.right, plotH = h - pad.top - pad.bottom;
  let yMax = 0, yMin = 0;
  for (const d of datasets) for (const v of d.values) { if (v > yMax) yMax = v; if (v < yMin) yMin = v; }
  const ticks = _niceTicks(yMin, yMax);
  _yAxis(ctx, pad, ticks, ticks[0], ticks[ticks.length - 1], plotH, plotW, opts.yFmt);
  yMin = ticks[0]; yMax = ticks[ticks.length - 1];
  const groupW = plotW / labels.length;
  const barW = Math.min(34, (groupW * 0.7) / datasets.length);
  const yZero = pad.top + plotH - ((0 - yMin) / (yMax - yMin)) * plotH;
  labels.forEach((lab, i) => {
    datasets.forEach((d, di) => {
      const v = d.values[i];
      const x = pad.left + i * groupW + groupW / 2 - (datasets.length * barW) / 2 + di * barW;
      const y = pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
      ctx.fillStyle = d.color || SERIES_COLORS[di % SERIES_COLORS.length];
      ctx.fillRect(x, Math.min(y, yZero), barW - 3, Math.abs(yZero - y));
    });
    ctx.fillStyle = '#9aa0a6';
    ctx.textAlign = 'center';
    const short = String(lab).length > 9 ? String(lab).slice(0, 8) + '…' : String(lab);
    ctx.fillText(short, pad.left + i * groupW + groupW / 2, h - 22);
  });
  datasets.forEach((d, di) => {
    if (!d.label) return;
    ctx.fillStyle = d.color || SERIES_COLORS[di % SERIES_COLORS.length];
    ctx.textAlign = 'left';
    ctx.fillText(d.label, pad.left + 10 + di * 110, pad.top - 4);
  });
}

// items: [{ label, value, color }]
function drawDonut(canvas, items, opts = {}) {
  const { ctx, w, h } = _chartSetup(canvas);
  const total = items.reduce((s, i) => s + i.value, 0);
  const cx = h / 2 + 10, cy = h / 2, r = h / 2 - 16, rIn = r * 0.62;
  let a = -Math.PI / 2;
  items.forEach((it, i) => {
    const frac = total > 0 ? it.value / total : 0;
    const a2 = a + frac * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a, a2);
    ctx.arc(cx, cy, rIn, a2, a, true);
    ctx.closePath();
    ctx.fillStyle = it.color || SERIES_COLORS[i % SERIES_COLORS.length];
    ctx.fill();
    a = a2;
  });
  ctx.textAlign = 'left';
  items.forEach((it, i) => {
    const y = 24 + i * 22;
    const color = it.color || SERIES_COLORS[i % SERIES_COLORS.length];
    ctx.fillStyle = color;
    ctx.fillRect(w * 0.45, y - 9, 10, 10);
    ctx.fillStyle = '#e8e9ea';
    const pctTxt = total > 0 ? ' (' + fmtPct(it.value / total) + ')' : '';
    ctx.fillText(it.label + pctTxt, w * 0.45 + 18, y);
  });
}

// scatter: points: [{x, y, r?, color?}]
function drawScatter(canvas, points, opts = {}) {
  const { ctx, w, h } = _chartSetup(canvas);
  const pad = { top: 14, right: 14, bottom: 30, left: 64 };
  const plotW = w - pad.left - pad.right, plotH = h - pad.top - pad.bottom;
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const p of points) {
    if (p.x < xMin) xMin = p.x; if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y; if (p.y > yMax) yMax = p.y;
  }
  const ticks = _niceTicks(yMin, yMax);
  _yAxis(ctx, pad, ticks, ticks[0], ticks[ticks.length - 1], plotH, plotW, opts.yFmt);
  yMin = ticks[0]; yMax = ticks[ticks.length - 1];
  ctx.fillStyle = '#9aa0a6';
  ctx.textAlign = 'center';
  const xTicks = _niceTicks(xMin, xMax, 4);
  for (const t of xTicks) {
    const x = pad.left + ((t - xMin) / (xMax - xMin || 1)) * plotW;
    ctx.fillText(opts.xFmt ? opts.xFmt(t) : fmtNum(t), x, h - 8);
  }
  for (const p of points) {
    const px = pad.left + ((p.x - xMin) / (xMax - xMin || 1)) * plotW;
    const py = pad.top + plotH - ((p.y - yMin) / (yMax - yMin)) * plotH;
    ctx.beginPath();
    ctx.arc(px, py, p.r || 3.5, 0, Math.PI * 2);
    ctx.fillStyle = p.color || 'rgba(212,175,55,0.55)';
    ctx.fill();
  }
}

// small helper: read numeric input value
function numVal(id) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  const v = parseFloat(String(el.value).replace(/,/g, ''));
  return isNaN(v) ? 0 : v;
}

function strVal(id) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  return el.value;
}
