// Currency-Adjusted Return Calculator — tool 10.
// FX_DATA comes from ../data/fx.js: yearly averages, units of currency per 1 USD.

// AED_PER_USD (3.6725 peg) comes from shared.js
const LAST = FX_DATA.years.length - 1; // index of the latest (current) year

// AED amount -> home currency at a given year index
function toHome(aed, ccy, yi) {
  return (aed / AED_PER_USD) * FX_DATA.perUSD[ccy][yi];
}

// compact axis labels: 1234567 -> "1.23M"
function compact(v) {
  if (!isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e6) return fmtNum(v / 1e6, 2) + 'M';
  if (a >= 1e3) return fmtNum(v / 1e3, 1) + 'k';
  return fmtNum(v);
}

function annualized(totalRet, years) {
  if (!isFinite(totalRet)) return NaN;
  if (totalRet <= -1) return -1;
  return Math.pow(1 + totalRet, 1 / years) - 1;
}

function signedPp(x) {
  if (!isFinite(x)) return '—';
  return (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + ' pp';
}

function render() {
  const ccy = strVal('cur');
  const pYear = Number(strVal('pYear'));
  const price = numVal('price');
  const curVal = numVal('curVal');
  const rent = numVal('rent');

  const pi = FX_DATA.years.indexOf(pYear);
  const holdYears = FX_DATA.years[LAST] - pYear;
  const rate = FX_DATA.perUSD[ccy];

  // purchase at purchase-year rate; exit value + rent at the latest rate
  const purchaseHome = toHome(price, ccy, pi);
  const endHome = toHome(curVal + rent, ccy, LAST);

  const aedRet = price > 0 ? (curVal + rent) / price - 1 : NaN;
  const homeRet = purchaseHome > 0 ? endHome / purchaseHome - 1 : NaN;
  const fxEffect = homeRet - aedRet;
  const annHome = annualized(homeRet, holdYears);

  // stat cards
  document.getElementById('kHome').textContent = 'Total return, ' + ccy;
  document.getElementById('kAnn').textContent = 'Annualized, ' + ccy;
  document.getElementById('sAed').textContent = fmtPct(aedRet);
  document.getElementById('sHome').textContent = fmtPct(homeRet);
  const sFx = document.getElementById('sFx');
  sFx.textContent = signedPp(fxEffect);
  sFx.className = 'v' + (fxEffect > 0 ? ' pos' : fxEffect < 0 ? ' neg' : '');
  document.getElementById('sAnn').textContent = fmtPct(annHome);

  document.getElementById('homeDetail').textContent =
    'Purchase cost: ' + ccy + ' ' + fmtNum(Math.round(purchaseHome)) +
    ' at ' + rate[pi] + '/' + FX_DATA.years[pi] +
    ' · value + rent today: ' + ccy + ' ' + fmtNum(Math.round(endHome)) +
    ' at ' + rate[LAST] + '/' + FX_DATA.years[LAST] +
    ' · annualized in AED: ' + fmtPct(annualized(aedRet, holdYears)) + '.';

  // verdict: did the currency move add to or eat the AED gain?
  const v = document.getElementById('verdict');
  const pp = Math.abs(fxEffect * 100).toFixed(1);
  if (!isFinite(fxEffect)) {
    v.className = 'verdict warn';
    v.textContent = 'Enter a purchase price above zero to compute returns.';
  } else if (fxEffect > 0.005) {
    v.className = 'verdict ok';
    v.textContent = 'FX helped: ' + ccy + ' weakened against the USD-pegged dirham over the ' +
      holdYears + '-year hold, adding ' + pp + ' percentage points on top of the ' +
      fmtPct(aedRet) + ' AED return for a ' + fmtPct(homeRet) + ' return in ' + ccy + '.';
  } else if (fxEffect < -0.005) {
    v.className = 'verdict bad';
    v.textContent = 'FX hurt: ' + ccy + ' strengthened against the USD-pegged dirham over the ' +
      holdYears + '-year hold, wiping ' + pp + ' percentage points off the ' +
      fmtPct(aedRet) + ' AED return to leave ' + fmtPct(homeRet) + ' in ' + ccy + '.';
  } else {
    v.className = 'verdict warn';
    v.textContent = 'FX was roughly neutral: ' + ccy + ' held near its purchase-year level against the USD-pegged dirham, so the ' +
      fmtPct(homeRet) + ' home-currency return closely tracks the ' + fmtPct(aedRet) + ' AED return.';
  }

  // series + table: straight-line AED value, converted at each year's rate
  const points = [];
  const rows = [];
  for (let yi = pi; yi <= LAST; yi++) {
    const t = LAST === pi ? 0 : (yi - pi) / (LAST - pi);
    const aedVal = price + (curVal - price) * t;
    const homeVal = toHome(aedVal, ccy, yi);
    points.push([FX_DATA.years[yi], homeVal]);
    rows.push('<tr><td>' + FX_DATA.years[yi] + '</td>' +
      '<td class="num">' + fmtAED(aedVal) + '</td>' +
      '<td class="num">' + fmtNum(rate[yi], 4) + '</td>' +
      '<td class="num">' + ccy + ' ' + fmtNum(Math.round(homeVal)) + '</td></tr>');
  }
  document.getElementById('thHome').textContent = ccy + ' value';
  document.getElementById('rows').innerHTML = rows.join('');

  drawLine(document.getElementById('chart'), [{
    label: 'Value in ' + ccy,
    color: SERIES_COLORS[0],
    points: points
  }], {
    xLabels: FX_DATA.years.slice(pi).map(String),
    yFmt: compact
  });
}

// purchase-year options: every year except the latest (need at least 1 year of holding)
const pYearSel = document.getElementById('pYear');
FX_DATA.years.slice(0, -1).forEach(y => {
  const opt = document.createElement('option');
  opt.value = y;
  opt.textContent = y;
  pYearSel.appendChild(opt);
});
pYearSel.value = FX_DATA.years[0];

['cur', 'pYear', 'price', 'curVal', 'rent'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('input', render);
  el.addEventListener('change', render);
});
window.addEventListener('resize', render);
render();
