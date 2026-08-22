// Tool 11 — UAE Mortgage & Affordability Calculator.
// CBUAE rules: LTV caps by buyer profile, and a 50% debt-burden-ratio (DBR) ceiling
// on total monthly debt (new mortgage payment + existing obligations).

// Applicable LTV cap for the buyer profile and property.
// Off-plan overrides every other tier at 50%.
function ltvCap(buyerType, propStatus, firstProp, price) {
  if (propStatus === 'offplan') return 0.50;
  if (buyerType === 'nonresident') return 0.50;
  if (firstProp === 'additional') return 0.60;
  if (buyerType === 'national') return price <= 5e6 ? 0.85 : 0.75;
  return price <= 5e6 ? 0.80 : 0.70; // expat resident
}

// Principal that a given monthly payment services at rate/term — pmt() rearranged.
function loanFromPayment(pay, annualRate, years) {
  const r = annualRate / 12, n = years * 12;
  if (pay <= 0 || n <= 0) return 0;
  if (r === 0) return pay * n;
  return pay * (1 - Math.pow(1 + r, -n)) / r;
}

function render() {
  const buyerType = strVal('buyerType');
  const propStatus = strVal('propStatus');
  const firstProp = strVal('firstProp');
  // the min/max attributes don't stop typing — clamp before any math
  const income = Math.max(0, numVal('salary')) + Math.max(0, numVal('otherIncome'));
  const debts = Math.max(0, numVal('debts'));
  const price = Math.max(0, numVal('price'));
  const rateDec = Math.max(0, numVal('rate')) / 100;
  const years = Math.max(1, Math.round(numVal('years')));
  const feeArrPct = Math.max(0, numVal('feeArrPct'));
  const feeVal = Math.max(0, numVal('feeValuation'));
  const feeInsPct = Math.max(0, numVal('feeIns'));
  const n = years * 12;

  document.getElementById('offplanNote').hidden = propStatus !== 'offplan';

  const cap = ltvCap(buyerType, propStatus, firstProp, price);
  const maxPay = 0.5 * income - debts;
  const noCapacity = maxPay <= 0;
  const loanDbr = noCapacity ? 0 : loanFromPayment(maxPay, rateDec, years);
  const loanLtv = cap * price;
  const maxLoan = Math.min(loanLtv, loanDbr);
  const binding = loanLtv <= loanDbr ? 'ltv' : 'dbr';
  const payment = maxLoan > 0 ? pmt(maxLoan, rateDec, years) : 0;
  const down = Math.max(0, price - maxLoan);

  const $ = (id) => document.getElementById(id);

  $('sLtvCap').textContent = fmtPct(cap, 0);
  $('sMaxPay').textContent = noCapacity ? '—' : fmtAED(maxPay);
  $('sLoanDbr').textContent = noCapacity ? '—' : fmtAED(loanDbr);
  $('dbrWarning').hidden = !noCapacity;

  if (noCapacity) {
    $('sMaxLoan').textContent = '—';
    $('sPayment').textContent = '—';
    $('sIns').textContent = '—';
    $('sDown').textContent = price > 0 ? fmtAED(price) + ' · 100%' : '—';
    $('sBinding').textContent = 'None';
    $('sBinding').className = 'v neg';
    $('sDbr').textContent = income > 0 ? fmtPct(debts / income, 0) : '—';
    $('sAfford').textContent = '—';
    $('sInterest').textContent = '—';
    $('sBal5').textContent = '—';
    $('cDown').textContent = price > 0 ? fmtAED(price) : '—';
    $('cArr').textContent = '—';
    $('cVal').textContent = fmtAED(feeVal);
    $('cReg').textContent = '—';
    $('cTotal').textContent = price > 0 ? fmtAED(price + feeVal) : '—';
    drawLine($('chart'), [{ label: 'Loan balance', points: [[0, 0], [Math.max(1, years), 0]], color: SERIES_COLORS[0] }],
      { yFmt: v => fmtCompact(v) });
    $('amortBody').innerHTML = '';
    return;
  }

  $('sMaxLoan').textContent = fmtAED(maxLoan);
  $('sPayment').textContent = fmtAED(payment);
  // indicative monthly mortgage-protection premium; year-1 balance ≈ initial loan
  $('sIns').textContent = maxLoan > 0 ? fmtAED(maxLoan * feeInsPct / 1200) : '—';
  $('sDown').textContent = price > 0 ? fmtAED(down) + ' · ' + fmtPct(down / price, 0) : fmtAED(down);
  const bindingEl = $('sBinding');
  if (binding === 'ltv') {
    bindingEl.textContent = 'Limited by LTV';
    bindingEl.className = 'v pos';
  } else {
    bindingEl.textContent = 'Limited by DBR / income';
    bindingEl.className = 'v';
  }
  $('sDbr').textContent = income > 0 ? fmtPct((payment + debts) / income, 0) : '—';

  // reverse affordability: largest price where the DBR loan still fits the cap.
  // The cap tier changes at AED 5M, so it must be evaluated at the affordable
  // price, not at the price entered above.
  let afford = cap > 0 ? loanDbr / cap : NaN;
  if (cap > 0 && propStatus === 'ready' && firstProp === 'first' && buyerType !== 'nonresident') {
    const capLo = buyerType === 'national' ? 0.85 : 0.80; // price ≤ AED 5M
    const capHi = buyerType === 'national' ? 0.75 : 0.70; // price above AED 5M
    afford = loanDbr <= capLo * 5e6 ? loanDbr / capLo : loanDbr / capHi;
  }
  $('sAfford').textContent = isFinite(afford) ? fmtAED(afford) : '—';

  // upfront costs
  const arr = maxLoan * feeArrPct / 100;
  const reg = maxLoan > 0 ? maxLoan * 0.0025 + 290 : 0;
  $('cDown').textContent = fmtAED(down);
  $('cArr').textContent = fmtAED(arr);
  $('cVal').textContent = fmtAED(feeVal);
  $('cReg').textContent = fmtAED(reg);
  $('cTotal').textContent = fmtAED(down + arr + feeVal + reg);

  // amortization
  const totalInterest = payment * n - maxLoan;
  $('sInterest').textContent = fmtAED(totalInterest);
  $('sBal5').textContent = years >= 5 ? fmtAED(Math.max(0, loanBalance(maxLoan, rateDec, years, 60))) : '—';

  const points = [], xLabels = [];
  let prevBal = maxLoan;
  const tbody = [];
  for (let y = 0; y <= years; y++) {
    const bal = y === 0 ? maxLoan : Math.max(0, loanBalance(maxLoan, rateDec, years, 12 * y));
    points.push([y, bal]);
    xLabels.push(y);
    if (y >= 1 && y <= 5) {
      const principal = prevBal - bal;
      const interest = payment * 12 - principal;
      tbody.push({ y, principal, interest, bal });
    }
    prevBal = bal;
  }
  drawLine($('chart'), [{ label: 'Loan balance', points, color: SERIES_COLORS[0] }],
    { yFmt: v => fmtCompact(v), xLabels });

  const body = $('amortBody');
  body.innerHTML = '';
  for (const row of tbody) {
    const tr = document.createElement('tr');
    const cells = ['Year ' + row.y, fmtAED(row.principal), fmtAED(row.interest), fmtAED(row.bal)];
    cells.forEach((txt, i) => {
      const td = document.createElement('td');
      if (i > 0) td.className = 'num';
      td.textContent = txt;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  }
}

function init() {
  for (const id of ['buyerType', 'propStatus', 'firstProp']) {
    document.getElementById(id).addEventListener('change', render);
  }
  for (const id of ['salary', 'otherIncome', 'debts', 'price', 'rate', 'years', 'feeArrPct', 'feeValuation', 'feeIns']) {
    document.getElementById(id).addEventListener('input', render);
  }
  render();
}

init();
