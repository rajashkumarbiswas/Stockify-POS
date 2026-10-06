import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

const row = (label, value, className = '') =>
  `<div class="row ${className}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;

const buildHtml = (sale, settings) => {
  const business = settings || {};
  const items = sale.items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.name)}<small>${escapeHtml(item.sku)}</small></td>
        <td class="num">${escapeHtml(formatNumber(item.quantity))}</td>
        <td class="num">${escapeHtml(formatMoney(item.unitPrice))}</td>
        <td class="num">${escapeHtml(formatMoney(item.lineTotal))}</td>
      </tr>`
    )
    .join('');

  const discountLabel = sale.discount?.type === 'PERCENT' ? `Discount (${sale.discount.value}%)` : 'Discount';

  const totals = [
    row('Subtotal', formatMoney(sale.subtotal)),
    sale.discount?.amount > 0 ? row(discountLabel, `- ${formatMoney(sale.discount.amount)}`) : '',
    sale.taxAmount > 0 ? row(`Tax (${sale.taxRate}%)`, formatMoney(sale.taxAmount)) : '',
    row('Grand total', formatMoney(sale.grandTotal), 'grand'),
    row('Paid', formatMoney(sale.amountPaid)),
    sale.dueAmount > 0 ? row('Due', formatMoney(sale.dueAmount), 'due') : '',
    sale.totalRefunded > 0 ? row('Refunded', formatMoney(sale.totalRefunded)) : '',
  ].join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Invoice ${escapeHtml(sale.invoiceNumber)}</title>
<style>
  @page { margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0 auto; max-width: 380px; padding: 16px; font-size: 13px; }
  h1 { font-size: 20px; margin: 0 0 4px; text-align: center; }
  .center { text-align: center; color: #444; font-size: 12px; line-height: 1.5; }
  hr { border: 0; border-top: 1px dashed #999; margin: 12px 0; }
  .meta p { margin: 3px 0; display: flex; justify-content: space-between; gap: 12px; }
  .meta span:first-child { color: #555; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; color: #555; border-bottom: 1px solid #ccc; padding: 6px 0; }
  td { padding: 7px 0; border-bottom: 1px dotted #ddd; vertical-align: top; }
  td small { display: block; color: #777; font-size: 11px; }
  .num { text-align: right; white-space: nowrap; padding-left: 8px; }
  .row { display: flex; justify-content: space-between; padding: 3px 0; }
  .grand { font-weight: bold; font-size: 16px; border-top: 1px solid #111; margin-top: 6px; padding-top: 8px; }
  .due { color: #b91c1c; font-weight: bold; }
  .footer { text-align: center; margin-top: 16px; color: #444; }
</style>
</head>
<body>
  <h1>${escapeHtml(business.businessName || 'Invoice')}</h1>
  <div class="center">
    ${business.address ? `${escapeHtml(business.address)}<br>` : ''}
    ${business.phone ? `Phone: ${escapeHtml(business.phone)}<br>` : ''}
    ${business.email ? `${escapeHtml(business.email)}<br>` : ''}
    ${business.taxId ? `Tax ID: ${escapeHtml(business.taxId)}` : ''}
  </div>
  <hr>
  <div class="meta">
    <p><span>Invoice</span><strong>${escapeHtml(sale.invoiceNumber)}</strong></p>
    <p><span>Date</span><span>${escapeHtml(formatDateTime(sale.createdAt))}</span></p>
    <p><span>Customer</span><span>${escapeHtml(sale.customer ? sale.customer.name : 'Walk-in customer')}</span></p>
    ${sale.customer?.phone ? `<p><span>Phone</span><span>${escapeHtml(sale.customer.phone)}</span></p>` : ''}
    <p><span>Cashier</span><span>${escapeHtml(sale.cashier?.name || '-')}</span></p>
    <p><span>Payment</span><span>${escapeHtml(PAYMENT_METHOD_LABELS[sale.paymentMethod] || sale.paymentMethod)}</span></p>
  </div>
  <hr>
  <table>
    <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead>
    <tbody>${items}</tbody>
  </table>
  <hr>
  ${totals}
  ${sale.notes ? `<hr><p>Notes: ${escapeHtml(sale.notes)}</p>` : ''}
  <p class="footer">${escapeHtml(business.invoiceFooter || 'Thank you for your purchase!')}</p>
</body>
</html>`;
};

/** Opens a clean print-friendly invoice in a new window and starts printing (Save as PDF works there too). */
export function printInvoice(sale, settings) {
  const win = window.open('', '_blank', 'width=460,height=760');
  if (!win) return false;

  win.document.write(buildHtml(sale, settings));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
  return true;
}