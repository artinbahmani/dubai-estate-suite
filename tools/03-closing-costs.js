// Tool 03 — Closing Cost Calculator (secondary purchase)
// All figures are buyer-side costs due at or before transfer.

const DLD_PCT = 0.04;          // DLD transfer fee
const DLD_ADMIN = 580;         // DLD admin fee (AED)
const TRUSTEE_FEE = 4200;      // trustee office fee (AED)
const AGENCY_VAT = 0.05;       // VAT charged on the agency fee
const MORTGAGE_REG_PCT = 0.0025; // mortgage registration, % of loan
const MORTGAGE_REG_ADMIN = 290;  // mortgage registration admin (AED)
const VALUATION_FEE = 3000;    // property valuation (AED)
const BANK_ARR_PCT = 0.01;     // bank arrangement fee, % of loan
const CONVEYANCING_FEE = 6000; // conveyancing (AED)

function calc() {
  const price = numVal('price');
  const isMortgage = strVal('financing') === 'mortgage';
  const ltv = numVal('ltv') / 100;
  const agencyPct = numVal('agencyPct') / 100;
  const noc = numVal('nocFee');
  const loan = isMortgage ? price * ltv : 0;

  const items = [];
  const add = (label, amount) => items.push({ label, amount });

  add('DLD transfer fee (4% + AED 580 admin)', price * DLD_PCT + DLD_ADMIN);
  add('Trustee office fee', TRUSTEE_FEE);
  add('Agency fee + 5% VAT', price * agencyPct * (1 + AGENCY_VAT));
  if (isMortgage) {
    add('Mortgage registration (0.25% of loan + AED 290 admin)', loan * MORTGAGE_REG_PCT + MORTGAGE_REG_ADMIN);
    add('Property valuation', VALUATION_FEE);
    if (document.getElementById('bankArr').checked) {
      add('Bank arrangement fee (1% of loan)', loan * BANK_ARR_PCT);
    }
  }
  add('NOC fee', noc);
  if (document.getElementById('convey').checked) {
    add('Conveyancing', CONVEYANCING_FEE);
  }

  const totalFees = items.reduce((s, i) => s + i.amount, 0);
  // cash buyer pays full price; mortgage buyer pays down payment, either way plus fees
  const cashNeeded = (isMortgage ? price - loan : price) + totalFees;

  return { price, isMortgage, loan, items, totalFees, cashNeeded };
}

function render() {
  const r = calc();

  document.getElementById('ltvVal').textContent = fmtPct(numVal('ltv') / 100, 0);
  document.getElementById('agencyVal').textContent = fmtPct(numVal('agencyPct') / 100, 2).replace(/0+$/, '');
  document.getElementById('ltvField').style.display = r.isMortgage ? '' : 'none';
  document.getElementById('loanStat').style.display = r.isMortgage ? '' : 'none';

  document.getElementById('sFees').textContent = fmtAED(r.totalFees);
  document.getElementById('sPct').textContent = r.price > 0 ? fmtPct(r.totalFees / r.price) : '—';
  document.getElementById('sCash').textContent = fmtAED(r.cashNeeded);
  document.getElementById('sLoan').textContent = fmtAED(r.loan);

  let rows = '';
  r.items.forEach(it => {
    rows += '<tr><td>' + it.label + '</td><td class="num">' + fmtAED(it.amount) + '</td></tr>';
  });
  rows += '<tr><td><strong>Total closing costs</strong></td><td class="num"><strong>' + fmtAED(r.totalFees) + '</strong></td></tr>';
  document.getElementById('costRows').innerHTML = rows;

  drawDonut(document.getElementById('donut'),
    r.items.map((it, i) => ({
      label: it.label.replace(/ \(.*/, ''),
      value: it.amount,
      color: SERIES_COLORS[i % SERIES_COLORS.length]
    }))
  );
}

['price', 'financing', 'ltv', 'agencyPct', 'nocFee', 'bankArr', 'convey'].forEach(id => {
  document.getElementById(id).addEventListener('input', render);
  document.getElementById(id).addEventListener('change', render);
});
render();
