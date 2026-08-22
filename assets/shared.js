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

// 1234567 -> "AED 1.2M" (axis labels, compact stats)
function fmtCompact(n, prefix = 'AED ') {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return sign + prefix + (abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1) + 'M';
  if (abs >= 1e3) return sign + prefix + Math.round(abs / 1e3) + 'K';
  return sign + prefix + Math.round(abs);
}

// ---- finance ----

// flows: [{ date: 'YYYY-MM-DD' | Date, amount }]  (negative = outflow)
function xnpv(rate, flows) {
  if (!flows || !flows.length) return 0;
  const t0 = new Date(flows[0].date).getTime();
  let s = 0;
  for (const f of flows) {
    const yrs = (new Date(f.date).getTime() - t0) / (365 * 86400000);
    s += f.amount / Math.pow(1 + rate, yrs);
  }
  return s;
}

function xirr(flows, lo = -0.95, hi = 10000) {
  if (!flows || !flows.length) return NaN;
  const sorted = [...flows].sort((a, b) => new Date(a.date) - new Date(b.date));
  let flo = xnpv(lo, sorted), fhi = xnpv(hi, sorted);
  if (flo * fhi > 0) return NaN;
  const scale = Math.max(1, Math.abs(flo), Math.abs(fhi));
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const fm = xnpv(mid, sorted);
    if (Math.abs(fm) < scale * 1e-10) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

// add months to a YYYY-MM-DD string, returns YYYY-MM-DD.
// Local-time parse + day clamp so 2026-01-31 + 1mo = 2026-02-28, not Mar 3.
function addMonths(dateStr, m) {
  const [y, mo, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  const target = new Date(y, mo - 1 + m, 1);
  const dim = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, dim));
  const p = (n) => String(n).padStart(2, '0');
  return target.getFullYear() + '-' + p(target.getMonth() + 1) + '-' + p(target.getDate());
}

// ---- loans ----

// monthly annuity payment
function pmt(principal, annualRate, years) {
  const r = annualRate / 12, n = years * 12;
  if (n <= 0) return 0;
  if (r === 0) return principal / n;
  return principal * r / (1 - Math.pow(1 + r, -n));
}

// remaining balance after k monthly payments
function loanBalance(principal, annualRate, years, k) {
  const r = annualRate / 12, n = years * 12;
  if (r === 0) return principal * (1 - k / n);
  return principal * Math.pow(1 + r, k) - pmt(principal, annualRate, years) * ((Math.pow(1 + r, k) - 1) / r);
}

// ---- canvas charts ----
// palette for multi-series charts
const SERIES_COLORS = ['#d4af37', '#58a6ff', '#3fb950', '#f85149', '#bc8cff', '#e3b341'];

// ---- hover tooltips (auto-enabled by every draw* call) ----

let _tipEl = null;
function _tooltip() {
  if (!_tipEl) {
    _tipEl = document.createElement('div');
    _tipEl.className = 'chart-tip';
    document.body.appendChild(_tipEl);
  }
  return _tipEl;
}

// hits: [{ px, py, text }] or bars [{ x0, x1, text }]
// segFn(x, y) -> string | null  overrides point matching
function _attachTooltip(canvas, hits, segFn) {
  canvas._hits = hits;
  canvas._segFn = segFn || null;
  if (canvas._tipAttached) return;
  canvas._tipAttached = true;
  const show = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    const tip = _tooltip();
    let text = canvas._segFn ? canvas._segFn(x, y) : null;
    if (!text && canvas._hits && canvas._hits.length) {
      let best = null, bestD = Infinity;
      for (const h of canvas._hits) {
        let d;
        if (h.x0 !== undefined) {
          d = (x >= h.x0 && x <= h.x1 && y >= 0 && y <= rect.height) ? 0 : Infinity; // bar: x-range match
        } else {
          d = Math.hypot(h.px - x, h.py - y);
        }
        if (d < bestD) { bestD = d; best = h; }
      }
      const threshold = best && best.x0 !== undefined ? 0 : 14;
      if (best && bestD <= threshold) text = best.text;
    }
    if (text) {
      tip.textContent = text;
      tip.style.display = 'block';
      tip.style.left = (clientX + 14) + 'px';
      tip.style.top = (clientY + 14) + 'px';
    } else {
      tip.style.display = 'none';
    }
  };
  canvas.addEventListener('mousemove', (e) => show(e.clientX, e.clientY));
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length) show(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length) show(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  canvas.addEventListener('mouseleave', () => { _tooltip().style.display = 'none'; });
  canvas.addEventListener('touchend', () => { _tooltip().style.display = 'none'; });
}

// redraw charts when the window resizes — registered transparently by each draw*
const _resizeCanvases = new Set();
let _resizeBound = false;
function _autoResize(canvas, redrawFn) {
  canvas._redraw = redrawFn;
  _resizeCanvases.add(canvas);
  if (!_resizeBound) {
    _resizeBound = true;
    let t = null;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        for (const c of _resizeCanvases) {
          if (c.isConnected && c._redraw) c._redraw();
        }
      }, 150);
    });
  }
}

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
  const hits = [];
  const xSpan = xMax - xMin || 1;
  series.forEach((s, si) => {
    const color = s.color || SERIES_COLORS[si % SERIES_COLORS.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const xCount = s.points.length;
    s.points.forEach(([x, y], i) => {
      const px = pad.left + ((x - xMin) / xSpan) * plotW;
      const py = pad.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      // xLabels are indexed by the x value itself (month index), not the point's position in the series
      const xTxt = opts.xLabels && opts.xLabels[x] !== undefined ? String(opts.xLabels[x]) : (Number.isInteger(x) && x >= 1900 && x <= 2100 ? String(x) : fmtNum(x));
      const yTxt = opts.yFmt ? opts.yFmt(y) : fmtNum(y);
      hits.push({ px, py, text: (s.label ? s.label + ' · ' : '') + xTxt + ': ' + yTxt });
    });
    ctx.stroke();
    // a single point draws no segment — mark it with a dot so it stays visible
    if (xCount === 1) {
      const [sx, sy] = s.points[0];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pad.left + ((sx - xMin) / xSpan) * plotW, pad.top + plotH - ((sy - yMin) / (yMax - yMin)) * plotH, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.label) {
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.fillText(s.label, pad.left + 10 + si * 110, pad.top + 6);
    }
  });
  // hover: snap to nearest point on the x axis (dense lines are hard to hit exactly)
  _attachTooltip(canvas, hits, (x) => {
    if (!hits.length) return null;
    let best = null, bestD = Infinity;
    for (const h of hits) {
      const d = Math.abs(h.px - x);
      if (d < bestD) { bestD = d; best = h; }
    }
    return bestD <= 30 ? best.text : null;
  });
  _autoResize(canvas, () => drawLine(canvas, series, opts));
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
  const hits = [];
  labels.forEach((lab, i) => {
    datasets.forEach((d, di) => {
      const v = d.values[i];
      const x = pad.left + i * groupW + groupW / 2 - (datasets.length * barW) / 2 + di * barW;
      const y = pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
      ctx.fillStyle = d.color || SERIES_COLORS[di % SERIES_COLORS.length];
      ctx.fillRect(x, Math.min(y, yZero), barW - 3, Math.abs(yZero - y));
      hits.push({
        x0: x, x1: x + barW - 3,
        text: lab + (d.label ? ' · ' + d.label : '') + ': ' + (opts.yFmt ? opts.yFmt(v) : fmtNum(v)),
      });
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
  _attachTooltip(canvas, hits, (x) => {
    for (const hb of hits) if (x >= hb.x0 && x <= hb.x1) return hb.text;
    return null;
  });
  _autoResize(canvas, () => drawBars(canvas, labels, datasets, opts));
}

// items: [{ label, value, color }]
function drawDonut(canvas, items, opts = {}) {
  const { ctx, w, h } = _chartSetup(canvas);
  const total = items.reduce((s, i) => s + i.value, 0);
  const cx = h / 2 + 10, cy = h / 2, r = h / 2 - 16, rIn = r * 0.62;
  let a = -Math.PI / 2;
  const segs = [];
  items.forEach((it, i) => {
    const frac = total > 0 ? it.value / total : 0;
    const a2 = a + frac * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, a, a2);
    ctx.arc(cx, cy, rIn, a2, a, true);
    ctx.closePath();
    ctx.fillStyle = it.color || SERIES_COLORS[i % SERIES_COLORS.length];
    ctx.fill();
    segs.push({ a0: a, a1: a2, text: it.label + ': ' + fmtNum(it.value) + (total > 0 ? ' (' + fmtPct(it.value / total) + ')' : '') });
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
  _attachTooltip(canvas, null, (x, y) => {
    const dx = x - cx, dy = y - cy;
    const rad = Math.hypot(dx, dy);
    if (rad < rIn || rad > r) return null;
    let ang = Math.atan2(dy, dx);
    if (ang < -Math.PI / 2) ang += Math.PI * 2;
    for (const s of segs) if (ang >= s.a0 && ang <= s.a1) return s.text;
    return null;
  });
  _autoResize(canvas, () => drawDonut(canvas, items, opts));
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
  const hits = [];
  for (const p of points) {
    const px = pad.left + ((p.x - xMin) / (xMax - xMin || 1)) * plotW;
    const py = pad.top + plotH - ((p.y - yMin) / (yMax - yMin)) * plotH;
    ctx.beginPath();
    ctx.arc(px, py, p.r || 3.5, 0, Math.PI * 2);
    ctx.fillStyle = p.color || 'rgba(212,175,55,0.55)';
    ctx.fill();
    hits.push({
      px, py,
      text: (opts.xFmt ? opts.xFmt(p.x) : fmtNum(p.x)) + ' · ' + (opts.yFmt ? opts.yFmt(p.y) : fmtNum(p.y)),
    });
  }
  _attachTooltip(canvas, hits);
  _autoResize(canvas, () => drawScatter(canvas, points, opts));
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
