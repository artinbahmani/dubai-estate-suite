// Currency-Adjusted Return Calculator — tool 10.
// FX_DATA comes from ../data/fx.js: yearly averages, units of currency per 1 USD.

// AED_PER_USD (3.6725 peg) comes from shared.js
// index of the latest (current) year — don't assume years[] is sorted
const LAST = FX_DATA.years.indexOf(Math.max(...FX_DATA.years));
const CCYS = ['EUR', 'GBP', 'INR', 'RUB', 'CNY', 'USD', 'PKR', 'EGP', 'TRY'];

// AED amount -> home currency at a given year index
function toHome(aed, ccy, yi) {
  return (aed / AED_PER_USD) * FX_DATA.perUSD[ccy][yi];
}

// rent collected in years AFTER the purchase year, converted at each year's rate
function rentHomeTotal(ccy, rentPerYear, pi) {
  let sum = 0;
  for (let yi = pi + 1; yi <= LAST; yi++) sum += toHome(rentPerYear, ccy, yi);
  return sum;
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

// total return (fraction) in a given currency for the same AED inputs;
// rent is summed per-year at each year's rate, matching the headline figures
function totalReturnIn(ccy, price, curVal, rentPerYear, pi) {
  const purchaseHome = toHome(price, ccy, pi);
  const endHome = toHome(curVal, ccy, LAST) + rentHomeTotal(ccy, rentPerYear, pi);
  return purchaseHome > 0 ? endHome / purchaseHome - 1 : NaN;
}

function render() {
  const ccy = strVal('cur');
  const pYear = Number(strVal('pYear'));
  const price = numVal('price');
  const curVal = Math.max(0, numVal('curVal'));
  const rentPerYear = Math.max(0, numVal('rent'));

  const pi = FX_DATA.years.indexOf(pYear);
  const holdYears = FX_DATA.years[LAST] - pYear;
  const rate = FX_DATA.perUSD[ccy];
  const rentTotal = rentPerYear * holdYears;
  const rentHome = rentHomeTotal(ccy, rentPerYear, pi);

  // purchase at purchase-year rate; exit value at the latest rate plus
  // rent summed per-year at each year's rate (matches the table)
  const purchaseHome = toHome(price, ccy, pi);
  const endHome = toHome(curVal, ccy, LAST) + rentHome;

  const aedRet = price > 0 ? (curVal + rentTotal) / price - 1 : NaN;
  const homeRet = purchaseHome > 0 ? endHome / purchaseHome - 1 : NaN;
  const fxEffect = homeRet - aedRet;
  const annAed = annualized(aedRet, holdYears);
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
    ' at ' + rate[pi] + ' ' + ccy + '/USD (' + FX_DATA.years[pi] + ' avg)' +
    ' · value + rent today: ' + ccy + ' ' + fmtNum(Math.round(endHome)) +
    ' at ' + rate[LAST] + ' ' + ccy + '/USD (' + FX_DATA.years[LAST] + ' avg)' +
    ' · annualized in AED: ' + fmtPct(annAed) + '.';

  // verdict: FX direction effect, then what it equals per year
  const v = document.getElementById('verdict');
  const pp = Math.abs(fxEffect * 100).toFixed(1);
  // multiplicative FX factor per year: (1+annHome)/(1+annAed) - 1
  const fxPerYear = (isFinite(annHome) && isFinite(annAed) && annAed > -1)
    ? (1 + annHome) / (1 + annAed) - 1
    : NaN;
  const perYearSentence = isFinite(fxPerYear)
    ? 'That equals an annualized FX ' + (fxPerYear >= 0 ? 'boost' : 'drag') + ' of ' +
      fmtPct(Math.abs(fxPerYear)) + ' per year — ' + fmtPct(annHome) + ' annualized in ' +
      ccy + ' versus ' + fmtPct(annAed) + ' in AED.'
    : '';
  if (!isFinite(fxEffect)) {
    v.className = 'verdict warn';
    v.textContent = 'Enter a purchase price above zero to compute returns.';
  } else if (fxEffect > 0.005) {
    v.className = 'verdict ok';
    v.textContent = 'FX helped: ' + ccy + ' weakened against the USD-pegged dirham over the ' +
      holdYears + '-year hold, adding ' + pp + ' percentage points on top of the ' +
      fmtPct(aedRet) + ' AED return for a ' + fmtPct(homeRet) + ' return in ' + ccy + '. ' +
      perYearSentence;
  } else if (fxEffect < -0.005) {
    v.className = 'verdict bad';
    v.textContent = 'FX hurt: ' + ccy + ' strengthened against the USD-pegged dirham over the ' +
      holdYears + '-year hold, wiping ' + pp + ' percentage points off the ' +
      fmtPct(aedRet) + ' AED return to leave ' + fmtPct(homeRet) + ' in ' + ccy + '. ' +
      perYearSentence;
  } else {
    v.className = 'verdict warn';
    v.textContent = 'FX was roughly neutral: ' + ccy + ' held near its purchase-year level against the USD-pegged dirham, so the ' +
      fmtPct(homeRet) + ' home-currency return closely tracks the ' + fmtPct(aedRet) + ' AED return. ' +
      perYearSentence;
  }

  // series + table: straight-line AED value, converted at each year's rate;
  // rent counts only for years AFTER the purchase year (holdYears years total)
  const points = [];
  const rows = [];
  for (let yi = pi; yi <= LAST; yi++) {
    const t = LAST === pi ? 0 : (yi - pi) / (LAST - pi);
    const aedVal = price + (curVal - price) * t;
    const homeVal = toHome(aedVal, ccy, yi);
    const rentYr = yi > pi ? toHome(rentPerYear, ccy, yi) : 0;
    points.push([FX_DATA.years[yi], homeVal]);
    rows.push('<tr><td>' + FX_DATA.years[yi] + '</td>' +
      '<td class="num">' + fmtAED(aedVal) + '</td>' +
      '<td class="num">' + fmtNum(rate[yi], 4) + '</td>' +
      '<td class="num">' + ccy + ' ' + fmtNum(Math.round(homeVal)) + '</td>' +
      '<td class="num">' + ccy + ' ' + fmtNum(Math.round(rentYr)) + '</td></tr>');
  }
  document.getElementById('thHome').textContent = ccy + ' value';
  document.getElementById('thRent').textContent = 'Rent (' + ccy + ')';
  document.getElementById('rows').innerHTML = rows.join('');
  document.getElementById('rentTotalRow').innerHTML =
    '<td>Total rent, ' + holdYears + ' yrs</td><td class="num">' + fmtAED(rentTotal) + '</td>' +
    '<td class="num">—</td><td class="num">—</td>' +
    '<td class="num">' + ccy + ' ' + fmtNum(Math.round(rentHome)) + '</td>';

  drawLine(document.getElementById('chart'), [{
    label: 'Value in ' + ccy,
    color: SERIES_COLORS[0],
    points: points
  }], {
    xLabels: FX_DATA.years.slice(pi).map(String),
    yFmt: v => fmtCompact(v, ccy + ' ')
  });

  // same AED deal, total return measured in each home currency; AED as reference
  // (skip any currency missing from the FX data)
  const ccys = CCYS.filter(c => FX_DATA.perUSD[c]);
  drawBars(document.getElementById('chartAll'), ccys, [
    {
      label: 'Home-currency return',
      values: ccys.map(c => totalReturnIn(c, price, curVal, rentPerYear, pi))
    },
    {
      label: 'AED reference',
      color: SERIES_COLORS[3],
      values: ccys.map(() => aedRet)
    }
  ], { yFmt: fmtPct });

  renderForward(ccy, curVal);

  // per-USD rate path for the selected currency, all years
  const fxDec = (ccy === 'INR' || ccy === 'RUB') ? 0 : 2;
  document.getElementById('fxTitle').textContent = 'FX rate: ' + ccy + ' per USD';
  drawLine(document.getElementById('chartFx'), [{
    label: ccy + ' per USD',
    color: SERIES_COLORS[1],
    points: FX_DATA.years.map((y, i) => [y, rate[i]])
  }], {
    xLabels: FX_DATA.years.map(String),
    yFmt: v => fmtNum(v, fxDec)
  });
}

// forward scenario: grow current AED value and the latest FX rate, convert to
// home currency; scenario shifts both rates by +/-2 pp. Projection, not a forecast.
function renderForward(ccy, curVal) {
  const years = Math.max(1, Math.round(numVal('fYears')));
  const appr = numVal('fAppr') / 100;
  const fx = numVal('fFx') / 100;
  const scen = strVal('fScen');
  const shift = scen === 'best' ? 0.02 : scen === 'worst' ? -0.02 : 0;

  const rateNow = FX_DATA.perUSD[ccy][LAST];
  const todayHome = toHome(curVal, ccy, LAST);
  const year0 = FX_DATA.years[LAST];

  // projected home value k years out under given appreciation / FX-change rates
  function proj(k, a, f) {
    return (curVal * Math.pow(1 + a, k) / AED_PER_USD) * rateNow * Math.pow(1 + f, k);
  }

  const scens = [
    { key: 'base', label: 'Base', a: appr, f: fx },
    { key: 'best', label: 'Best', a: appr + 0.02, f: fx + 0.02 },
    { key: 'worst', label: 'Worst', a: appr - 0.02, f: fx - 0.02 }
  ];

  // stats for the selected scenario: return vs today's home value
  const s = scens.find(x => x.key === scen);
  const endHome = proj(years, s.a, s.f);
  const fRet = todayHome > 0 ? endHome / todayHome - 1 : NaN;
  const fAnn = annualized(fRet, years);
  document.getElementById('kFVal').textContent = 'Projected value, ' + ccy + ' (' + s.label + ')';
  document.getElementById('sFVal').textContent = ccy + ' ' + fmtNum(Math.round(endHome));
  const sFRet = document.getElementById('sFRet');
  sFRet.textContent = fmtPct(fRet);
  sFRet.className = 'v' + (fRet > 0 ? ' pos' : fRet < 0 ? ' neg' : '');
  document.getElementById('sFAnn').textContent = fmtPct(fAnn);

  // one line per scenario, year 0 = today's home value
  drawLine(document.getElementById('chartFwd'), scens.map((sc, i) => ({
    label: sc.label,
    color: SERIES_COLORS[i],
    points: Array.from({ length: years + 1 }, (_, k) => [year0 + k, proj(k, sc.a, sc.f)])
  })), {
    xLabels: Array.from({ length: years + 1 }, (_, k) => String(year0 + k)),
    yFmt: v => fmtCompact(v, ccy + ' ')
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

['cur', 'pYear', 'price', 'curVal', 'rent', 'fYears', 'fAppr', 'fFx', 'fScen'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('input', render);
  el.addEventListener('change', render);
});
window.addEventListener('resize', render);
render();
