// Tool 03 — Closing Cost Calculator (secondary + off-plan purchases)
// All figures are buyer-side costs due at or before transfer.
// Amounts are computed in AED and converted at display time when USD is selected.

const DLD_PCT = 0.04;          // DLD transfer fee
const DLD_ADMIN = 580;         // DLD admin fee (AED)
const TRUSTEE_FEE = 4200;      // trustee office fee (AED, secondary only)
const OQOOD_PCT = 0.04;        // Oqood registration, % of price (off-plan only)
const OQOOD_ADMIN = 1000;      // Oqood admin fee (AED)
const AGENCY_VAT = 0.05;       // VAT charged on the agency fee
const MORTGAGE_REG_PCT = 0.0025; // mortgage registration, % of loan
const MORTGAGE_REG_ADMIN = 290;  // mortgage registration admin (AED)
const VALUATION_FEE = 3000;    // property valuation (AED)
const BANK_ARR_PCT = 0.01;     // bank arrangement fee, % of loan
const CONVEYANCING_FEE = 6000; // conveyancing (AED)

function calc() {
  const price = numVal('price');
  const isOffplan = strVal('ptype') === 'offplan';
  const isMortgage = strVal('financing') === 'mortgage';
  const ltv = numVal('ltv') / 100;
  const agencyPct = numVal('agencyPct') / 100;
  const dldShare = numVal('dldSplit') / 100; // buyer's share of the 4% DLD fee
  const noc = numVal('nocFee');
  const loan = isMortgage ? price * ltv : 0;

  const items = [];
  const add = (label, amount) => items.push({ label, amount });

  const dldLabel = dldShare >= 1
    ? 'DLD transfer fee (4% + AED 580 admin)'
    : 'DLD transfer fee (4% x ' + Math.round(dldShare * 100) + '% buyer share + AED 580 admin)';
  add(dldLabel, price * DLD_PCT * dldShare + DLD_ADMIN);

  if (isOffplan) {
    add('Oqood registration (4% + AED 1,000 admin)', price * OQOOD_PCT + OQOOD_ADMIN);
  } else {
    add('Trustee office fee', TRUSTEE_FEE);
  }

  add('Agency fee + 5% VAT', price * agencyPct * (1 + AGENCY_VAT));

  if (isMortgage) {
    // off-plan mortgages are registered at handover, not at the initial sale
    if (!isOffplan) {
      add('Mortgage registration (0.25% of loan + AED 290 admin)', loan * MORTGAGE_REG_PCT + MORTGAGE_REG_ADMIN);
    }
    add('Property valuation', VALUATION_FEE);
    if (document.getElementById('bankArr').checked) {
      add('Bank arrangement fee (1% of loan)', loan * BANK_ARR_PCT);
    }
  }

  if (!isOffplan) add('NOC fee', noc);

  if (document.getElementById('convey').checked) {
    add('Conveyancing', CONVEYANCING_FEE);
  }

  const totalFees = items.reduce((s, i) => s + i.amount, 0);
  // cash buyer pays full price; mortgage buyer pays down payment, either way plus fees
  const cashNeeded = (isMortgage ? price - loan : price) + totalFees;

  return { price, isOffplan, isMortgage, loan, items, totalFees, cashNeeded };
}

function render() {
  const r = calc();
  const usd = strVal('currency') === 'usd';
  const conv = n => usd ? n / AED_PER_USD : n;
  const fmt = n => usd ? 'USD ' + fmtNum(n / AED_PER_USD) : fmtAED(n);

  document.getElementById('ltvVal').textContent = fmtPct(numVal('ltv') / 100, 0);
  document.getElementById('agencyVal').textContent = fmtPct(numVal('agencyPct') / 100, 2).replace(/0+$/, '');
  document.getElementById('dldSplitVal').textContent = fmtPct(numVal('dldSplit') / 100, 0);
  document.getElementById('ltvField').style.display = r.isMortgage ? '' : 'none';
  document.getElementById('loanStat').style.display = r.isMortgage ? '' : 'none';
  document.getElementById('nocField').style.display = r.isOffplan ? 'none' : '';

  document.getElementById('sFees').textContent = fmt(r.totalFees);
  document.getElementById('sPct').textContent = r.price > 0 ? fmtPct(r.totalFees / r.price) : '—';
  document.getElementById('sCash').textContent = fmt(r.cashNeeded);
  document.getElementById('sLoan').textContent = fmt(r.loan);

  let rows = '';
  r.items.forEach(it => {
    rows += '<tr><td>' + it.label + '</td><td class="num">' + fmt(it.amount) + '</td></tr>';
  });
  rows += '<tr><td><strong>Total closing costs</strong></td><td class="num"><strong>' + fmt(r.totalFees) + '</strong></td></tr>';
  document.getElementById('costRows').innerHTML = rows;

  document.getElementById('donutTitle').textContent = 'Cost mix (' + (usd ? 'USD' : 'AED') + ')';
  drawDonut(document.getElementById('donut'),
    r.items.map((it, i) => ({
      label: it.label.replace(/ \(.*/, ''),
      value: conv(it.amount),
      color: SERIES_COLORS[i % SERIES_COLORS.length]
    }))
  );
}

['price', 'ptype', 'financing', 'ltv', 'agencyPct', 'dldSplit', 'nocFee', 'bankArr', 'convey', 'currency'].forEach(id => {
  document.getElementById(id).addEventListener('input', render);
  document.getElementById(id).addEventListener('change', render);
});
render();
