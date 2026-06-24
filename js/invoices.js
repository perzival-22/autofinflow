/* ============================================
   AutoFinFlow - Invoices Logic v2
   VAT, PDF export, CSV, client URL filter
   ============================================ */

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// Pre-fill client filter from URL param (from clients page)
function initClientFilter() {
  const params = new URLSearchParams(window.location.search);
  const client = params.get('client');
  if (client) {
    const el = document.getElementById('searchInput');
    if (el) el.value = decodeURIComponent(client);
  }
}

function calcVAT() {
  const sub     = parseFloat(document.getElementById('invSubtotal').value) || 0;
  const rate    = parseFloat(document.getElementById('invVatRate').value)  || 0;
  const vatAmt  = sub * (rate / 100);
  const total   = sub + vatAmt;
  document.getElementById('invVatAmt').value = vatAmt.toFixed(2);
  document.getElementById('invAmount').value = total.toFixed(2);
}

function renderTable() {
  const query  = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const tbody  = document.getElementById('invoiceTable');

  let invoices = DB.getInvoices().map(inv => ({
    ...inv,
    _status: DB.isOverdue(inv.dueDate, inv.status) && inv.status !== 'paid' ? 'overdue' : inv.status
  }));
  if (query)  invoices = invoices.filter(i => i.client.toLowerCase().includes(query) || i.number.toLowerCase().includes(query));
  if (status) invoices = invoices.filter(i => i._status === status);

  document.getElementById('invoiceCount').textContent = `${invoices.length} invoice(s)`;

  if (!invoices.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
      <div class="empty-icon">🧾</div><h3>No invoices found</h3>
      <p>Create your first invoice using the button above.</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = invoices.map(inv => `
    <tr>
      <td><strong>${inv.number}</strong></td>
      <td>${inv.client}</td>
      <td>${DB.formatDate(inv.date)}</td>
      <td>${DB.formatDate(inv.dueDate)}</td>
      <td>${DB.fmt(inv.subtotal || inv.amount)}</td>
      <td>${DB.fmt(inv.taxAmount || 0)}</td>
      <td><strong>${DB.fmt(inv.amount)}</strong></td>
      <td><span class="badge badge-${inv._status}">${inv._status}</span></td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" title="Edit"     onclick="openModal('${inv.id}')">✏️</button>
          <button class="action-btn view" title="PDF"      onclick="exportPDF('${inv.id}')">📄</button>
          <button class="action-btn del"  title="Delete"   onclick="deleteInvoice('${inv.id}')">🗑️</button>
          ${inv._status !== 'paid' ? `<button class="action-btn view" title="Mark Paid" style="background:#dcfce7;color:#15803d" onclick="markPaid('${inv.id}')">✅</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function openModal(id = null) {
  const s     = DB.getSettings();
  const today = new Date().toISOString().slice(0, 10);
  const due   = new Date(Date.now() + (s.paymentTerms||30)*86400000).toISOString().slice(0,10);

  if (id) {
    const inv = DB.getInvoice(id);
    if (!inv) return;
    document.getElementById('modalTitle').textContent   = 'Edit Invoice';
    document.getElementById('invId').value              = inv.id;
    document.getElementById('invNumber').value          = inv.number;
    document.getElementById('invClient').value          = inv.client;
    document.getElementById('invDate').value            = inv.date;
    document.getElementById('invDue').value             = inv.dueDate;
    document.getElementById('invSubtotal').value        = inv.subtotal || inv.amount;
    document.getElementById('invVatRate').value         = inv.taxRate  != null ? inv.taxRate : s.vatRate;
    document.getElementById('invStatus').value          = inv.status;
    document.getElementById('invNotes').value           = inv.notes || '';
    calcVAT();
  } else {
    document.getElementById('modalTitle').textContent   = 'New Invoice';
    document.getElementById('invId').value              = '';
    document.getElementById('invNumber').value          = DB.nextInvoiceNumber();
    document.getElementById('invClient').value          = '';
    document.getElementById('invDate').value            = today;
    document.getElementById('invDue').value             = due;
    document.getElementById('invSubtotal').value        = '';
    document.getElementById('invVatRate').value         = s.vatRate || 16;
    document.getElementById('invVatAmt').value          = '';
    document.getElementById('invAmount').value          = '';
    document.getElementById('invStatus').value          = 'pending';
    document.getElementById('invNotes').value           = '';
  }
  document.getElementById('invoiceModal').classList.add('open');
}

function closeModal() {
  document.getElementById('invoiceModal').classList.remove('open');
}

function saveInvoice() {
  const id       = document.getElementById('invId').value;
  const client   = document.getElementById('invClient').value.trim();
  const subtotal = parseFloat(document.getElementById('invSubtotal').value);
  const vatRate  = parseFloat(document.getElementById('invVatRate').value) || 0;
  const date     = document.getElementById('invDate').value;
  const due      = document.getElementById('invDue').value;
  const number   = document.getElementById('invNumber').value.trim();

  if (!client) { toast('Client name is required.', 'error'); return; }
  if (!subtotal || subtotal <= 0) { toast('Enter a valid subtotal.', 'error'); return; }
  if (!date || !due) { toast('Both dates are required.', 'error'); return; }

  const taxAmount = subtotal * (vatRate / 100);
  const total     = subtotal + taxAmount;

  const invoice = {
    id:        id || DB.uuid(),
    number:    number || DB.nextInvoiceNumber(),
    client,
    subtotal,
    taxRate:   vatRate,
    taxAmount,
    amount:    total,
    date,
    dueDate:   due,
    status:    document.getElementById('invStatus').value,
    notes:     document.getElementById('invNotes').value.trim(),
    items:     [{ description: document.getElementById('invNotes').value.trim() || 'Services', quantity: 1, rate: subtotal, amount: subtotal }]
  };

  DB.saveInvoice(invoice);
  closeModal();
  renderTable();
  toast(id ? 'Invoice updated.' : 'Invoice created.', 'success');
}

function deleteInvoice(id) {
  if (!confirm('Delete this invoice? This cannot be undone.')) return;
  DB.deleteInvoice(id);
  renderTable();
  toast('Invoice deleted.', 'info');
}

function markPaid(id) {
  const inv = DB.getInvoice(id);
  if (!inv) return;
  inv.status = 'paid';
  DB.saveInvoice(inv);
  renderTable();
  toast('Invoice marked as paid.', 'success');
}

// ---- PDF Export ----
function exportPDF(id) {
  const inv = DB.getInvoice(id);
  if (!inv) return;
  const s   = DB.getSettings();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W   = 210, margin = 20;
  let y     = 20;

  // Header background
  doc.setFillColor(26, 86, 219);
  doc.rect(0, 0, W, 45, 'F');

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(s.company || 'My Business', margin, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (s.tagline)  doc.text(s.tagline,  margin, 27);
  if (s.email)    doc.text(s.email,    margin, 33);
  if (s.phone)    doc.text(s.phone,    margin, 39);

  // INVOICE label
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', W - margin, 20, { align: 'right' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(inv.number,               W - margin, 30, { align: 'right' });
  doc.text('Date: ' + DB.formatDate(inv.date),   W - margin, 37, { align: 'right' });
  doc.text('Due:  ' + DB.formatDate(inv.dueDate),W - margin, 44, { align: 'right' });

  y = 60;
  doc.setTextColor(15, 23, 42);

  // Bill To
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(inv.client, margin, y + 7);
  y += 22;

  // Status badge
  const statusColor = inv.status === 'paid' ? [16,185,129] : inv.status === 'overdue' ? [239,68,68] : [245,158,11];
  doc.setFillColor(...statusColor);
  doc.roundedRect(margin, y, 30, 8, 2, 2, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(inv.status.toUpperCase(), margin + 15, y + 5.5, { align: 'center' });
  y += 16;

  // Line items table header
  doc.setTextColor(15,23,42);
  doc.setFillColor(241,245,249);
  doc.rect(margin, y, W - 2*margin, 9, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Description',   margin + 2, y + 6);
  doc.text('Qty',           130,        y + 6);
  doc.text('Rate',          155,        y + 6);
  doc.text('Amount',        W-margin,   y + 6, { align: 'right' });
  y += 11;

  // Items
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const items = inv.items && inv.items.length ? inv.items : [{ description: inv.notes || 'Services', quantity: 1, rate: inv.subtotal || inv.amount, amount: inv.subtotal || inv.amount }];
  items.forEach(item => {
    doc.text(item.description || '', margin + 2, y + 4);
    doc.text(String(item.quantity || 1), 130, y + 4);
    doc.text(DB.fmt(item.rate || 0),     155, y + 4);
    doc.text(DB.fmt(item.amount || 0),   W-margin, y + 4, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 7, W - margin, y + 7);
    y += 9;
  });

  // Totals
  y += 5;
  const subtotal  = inv.subtotal  || inv.amount;
  const taxAmount = inv.taxAmount || 0;
  const total     = inv.amount;
  const drawRow = (label, val, bold = false) => {
    if (bold) { doc.setFont('helvetica','bold'); doc.setFontSize(11); }
    else       { doc.setFont('helvetica','normal'); doc.setFontSize(10); }
    doc.text(label, 140, y);
    doc.text(val, W - margin, y, { align: 'right' });
    y += 7;
  };
  drawRow('Subtotal:', DB.fmt(subtotal));
  drawRow(`VAT (${inv.taxRate || 0}%):`, DB.fmt(taxAmount));
  doc.setDrawColor(26,86,219);
  doc.line(130, y - 1, W - margin, y - 1);
  drawRow('TOTAL:', DB.fmt(total), true);

  // Notes
  if (inv.notes) {
    y += 6;
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(100,116,139);
    doc.text('NOTES', margin, y);
    doc.setFont('helvetica','normal'); doc.setTextColor(15,23,42);
    doc.text(inv.notes, margin, y + 5);
    y += 14;
  }

  // Footer
  doc.setFontSize(8); doc.setTextColor(148,163,184);
  doc.text('Generated by AutoFinFlow · ' + new Date().toLocaleDateString(), W/2, 285, { align: 'center' });

  doc.save(`${inv.number}-${inv.client.replace(/\s+/g,'-')}.pdf`);
  toast('PDF downloaded.', 'success');
}

// ---- CSV Export ----
function exportCSV() {
  const invoices = DB.getInvoices();
  const rows = invoices.map(inv => ({
    number: inv.number, client: inv.client, date: inv.date, dueDate: inv.dueDate,
    subtotal: inv.subtotal || inv.amount, vatRate: inv.taxRate || 0,
    vatAmount: inv.taxAmount || 0, total: inv.amount,
    status: DB.isOverdue(inv.dueDate, inv.status) && inv.status !== 'paid' ? 'overdue' : inv.status,
    notes: inv.notes || ''
  }));
  DB.downloadCSV('invoices-' + new Date().toISOString().slice(0,10) + '.csv', rows,
    ['number','client','date','dueDate','subtotal','vatRate','vatAmount','total','status','notes']);
  toast('CSV downloaded.', 'success');
}

document.getElementById('invoiceModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

document.addEventListener('DOMContentLoaded', () => {
  initClientFilter();
  renderTable();
});
