// Tool 13 — Offer Letter / Form F (MOU) summary generator.
// Reads the form inputs, keeps the printable offer preview in sync, prints via window.print().

const VAT_RATE = 0.05; // VAT on agency commission

// trimmed text value, or '' when empty
function txt(id) {
  return String(strVal(id)).trim();
}

// empty fields render as an em dash in the preview
function dash(s) {
  return s ? s : '—';
}

// 'YYYY-MM-DD' -> '13 August 2026' (local-time parse, no timezone shift)
function fmtDate(str) {
  if (!str) return '—';
  const [y, m, d] = String(str).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// labels of the checked boxes in an [[id, label], ...] list
function checkedLabels(pairs) {
  const out = [];
  for (const [id, label] of pairs) {
    if (document.getElementById(id).checked) out.push(label);
  }
  return out;
}

// "AED 40,000 + AED 2,000 VAT" for a commission line
function fmtCommWithVat(amount) {
  return fmtAED(amount) + ' + ' + fmtAED(amount * VAT_RATE) + ' VAT';
}

function render() {
  // property
  document.getElementById('oCommunity').textContent = dash(txt('community'));
  document.getElementById('oBuilding').textContent = dash(txt('building'));
  document.getElementById('oUnit').textContent = dash(txt('unitNo'));
  document.getElementById('oBeds').textContent = dash(txt('beds'));
  const sqft = numVal('sqft');
  document.getElementById('oSqft').textContent = sqft > 0 ? fmtNum(sqft) + ' sqft' : '—';
  document.getElementById('oPermit').textContent = dash(txt('permit'));

  // parties
  document.getElementById('oBuyerName').textContent = dash(txt('buyerName'));
  document.getElementById('oBuyerNat').textContent = dash(txt('buyerNat'));
  document.getElementById('oBuyerPassport').textContent = dash(txt('buyerPassport'));
  document.getElementById('oSellerName').textContent = dash(txt('sellerName'));
  document.getElementById('oBuyerAgency').textContent = dash(txt('buyerAgency'));
  document.getElementById('oBuyerAgent').textContent = dash(txt('buyerAgent'));
  document.getElementById('oBuyerOrn').textContent = dash(txt('buyerOrn'));
  document.getElementById('oSellerAgency').textContent = dash(txt('sellerAgency'));
  document.getElementById('oSellerAgent').textContent = dash(txt('sellerAgent'));

  // deal & financials
  const price = numVal('price');
  const depPct = numVal('depPct');
  const bPct = numVal('bCommPct');
  const sPct = numVal('sCommPct');
  const hasPrice = price > 0;

  document.getElementById('oPrice').textContent = hasPrice ? fmtAED(price) : '—';

  const deposit = price * depPct / 100;
  document.getElementById('oDepositK').textContent = 'Deposit cheque (' + fmtNum(depPct) + '%)';
  document.getElementById('oDeposit').textContent = hasPrice ? fmtAED(deposit) : '—';
  document.getElementById('oBalance').textContent = hasPrice ? fmtAED(price - deposit) : '—';

  const mortgage = strVal('payMethod') === 'mortgage';
  document.getElementById('oPayMethod').textContent = mortgage ? 'Mortgage' : 'Cash';
  document.getElementById('oMortgageRow').hidden = !mortgage;

  document.getElementById('oTransferDate').textContent = fmtDate(strVal('transferDate'));

  document.getElementById('oBuyerCommK').textContent = 'Buyer agency commission (' + fmtNum(bPct) + '% + 5% VAT)';
  document.getElementById('oBuyerComm').textContent = hasPrice ? fmtCommWithVat(price * bPct / 100) : '—';
  document.getElementById('oSellerCommK').textContent = 'Seller agency commission (' + fmtNum(sPct) + '% + 5% VAT)';
  document.getElementById('oSellerComm').textContent = hasPrice ? fmtCommWithVat(price * sPct / 100) : '—';

  // terms
  const included = checkedLabels([
    ['incFurnished', 'Furnished'],
    ['incWhiteGoods', 'White goods'],
    ['incParking', 'Parking'],
    ['incStorage', 'Storage'],
  ]);
  document.getElementById('oIncluded').textContent = included.length ? included.join(', ') : '—';
  document.getElementById('oVacant').textContent = document.getElementById('vacant').checked ? 'Yes' : 'No';

  const subjects = checkedLabels([
    ['subMortgage', 'Mortgage approval'],
    ['subValuation', 'Valuation'],
    ['subNoc', 'NOC from developer'],
  ]);
  document.getElementById('oSubjects').textContent = subjects.length ? subjects.join('; ') : 'None';
}

function init() {
  const textIds = [
    'community', 'building', 'unitNo', 'sqft', 'permit',
    'buyerName', 'buyerNat', 'buyerPassport', 'buyerAgency', 'buyerAgent', 'buyerOrn',
    'sellerName', 'sellerAgency', 'sellerAgent',
    'price', 'depPct', 'bCommPct', 'sCommPct',
  ];
  for (const id of textIds) {
    document.getElementById(id).addEventListener('input', render);
  }
  const toggleIds = [
    'beds', 'payMethod', 'transferDate',
    'incFurnished', 'incWhiteGoods', 'incParking', 'incStorage', 'vacant',
    'subMortgage', 'subValuation', 'subNoc',
  ];
  for (const id of toggleIds) {
    document.getElementById(id).addEventListener('change', render);
    document.getElementById(id).addEventListener('input', render); // date inputs fire both
  }

  document.getElementById('printBtn').addEventListener('click', () => window.print());

  render();
}

init();
