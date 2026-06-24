/* ============================================
   AutoFinFlow - Payments Logic
   ============================================ */

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

const METHOD_LABELS = { bank_transfer: 'Bank Transfer', mpesa: 'M-Pesa', cash: 'Cash', card: 'Card' };

function updateSummary() {
  const payments = DB.getPayments();
  const income  = payments.filter(p => p.type==='income').reduce((s,p) => s+Number(p.amount), 0);
  const expense = payments.filter(p => p.type==='expense').reduce((s,p) => s+Number(p.amount), 0);
  const net     = income - expense;
  document.getElementById('sumIncome').textContent  = DB.fmt(income);
  document.getElementById('sumExpense').textContent = DB.fmt(expense);
  const netEl = document.getElementById('sumNet');
  netEl.textContent = DB.fmt(net);
  netEl.style.color = net >= 0 ? 'var(--success)' : 'var(--danger)';
}

function renderTable() {
  const query  = (document.getElementById('searchInput').value || '').toLowerCase();
  const type   = document.getElementById('typeFilter').value;
  const method = document.getElementById('methodFilter').value;
  const tbody  = document.getElementById('payTable');

  let payments = DB.getPayments();
  if (query)  payments = payments.filter(p => (p.client+p.notes+p.category).toLowerCase().includes(query));
  if (type)   payments = payments.filter(p => p.type === type);
  if (method) payments = payments.filter(p => p.method === method);

  document.getElementById('payCount').textContent = `${payments.length} record(s)`;

  if (!payments.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <div class="empty-icon">💳</div>
      <h3>No transactions found</h3>
      <p>Record your first income or expense.</p>
    </div></td></tr>`;
    updateSummary();
    return;
  }

  tbody.innerHTML = payments.map(p => `
    <tr>
      <td>${DB.formatDate(p.date)}</td>
      <td>${p.client || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${p.notes || '—'}</td>
      <td style="text-transform:capitalize">${p.category || '—'}</td>
      <td>${METHOD_LABELS[p.method] || p.method}</td>
      <td><span class="badge badge-${p.type}">${p.type}</span></td>
      <td style="font-weight:600; color:${p.type==='income'?'var(--success)':'var(--danger)'}">
        ${p.type==='income'?'+':'-'}${DB.fmt(p.amount)}
      </td>
      <td>${p.recurringId ? '<span class="badge" style="background:#ede9fe;color:#6d28d9">🔁</span>' : ''}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" title="Edit" onclick="openModal('${p.id}')">✏️</button>
          <button class="action-btn del"  title="Delete" onclick="deletePayment('${p.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  updateSummary();
}

function openModal(id = null) {
  const today = new Date().toISOString().slice(0, 10);
  if (id) {
    const p = DB.getPayment(id);
    if (!p) return;
    document.getElementById('modalTitle').textContent = 'Edit Transaction';
    document.getElementById('payId').value       = p.id;
    document.getElementById('payType').value     = p.type;
    document.getElementById('payDate').value     = p.date;
    document.getElementById('payClient').value   = p.client || '';
    document.getElementById('payAmount').value   = p.amount;
    document.getElementById('payMethod').value   = p.method;
    document.getElementById('payCategory').value = p.category || 'other';
    document.getElementById('payNotes').value    = p.notes || '';
  } else {
    document.getElementById('modalTitle').textContent = 'Record Payment';
    document.getElementById('payId').value       = '';
    document.getElementById('payType').value     = 'income';
    document.getElementById('payDate').value     = today;
    document.getElementById('payClient').value   = '';
    document.getElementById('payAmount').value   = '';
    document.getElementById('payMethod').value   = 'bank_transfer';
    document.getElementById('payCategory').value = 'services';
    document.getElementById('payNotes').value    = '';
  }
  document.getElementById('payModal').classList.add('open');
}

function closeModal() {
  document.getElementById('payModal').classList.remove('open');
}

function savePayment() {
  const id     = document.getElementById('payId').value;
  const amount = parseFloat(document.getElementById('payAmount').value);
  const date   = document.getElementById('payDate').value;

  if (!amount || amount <= 0) { toast('Enter a valid amount.', 'error'); return; }
  if (!date) { toast('Date is required.', 'error'); return; }

  const payment = {
    id:       id || DB.uuid(),
    type:     document.getElementById('payType').value,
    date,
    client:   document.getElementById('payClient').value.trim(),
    amount,
    method:   document.getElementById('payMethod').value,
    category: document.getElementById('payCategory').value,
    notes:    document.getElementById('payNotes').value.trim()
  };

  DB.savePayment(payment);
  closeModal();
  renderTable();
  toast(id ? 'Transaction updated.' : 'Transaction recorded.', 'success');
}

function deletePayment(id) {
  if (!confirm('Delete this transaction? This cannot be undone.')) return;
  DB.deletePayment(id);
  renderTable();
  toast('Transaction deleted.', 'info');
}

function exportCSV() {
  const payments = DB.getPayments();
  DB.downloadCSV('payments-' + new Date().toISOString().slice(0,10) + '.csv', payments,
    ['date','client','notes','category','method','type','amount']);
  toast('CSV downloaded.', 'success');
}

document.getElementById('payModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

document.addEventListener('DOMContentLoaded', () => {
  const added = DB.processRecurring();
  if (added > 0) toast(`${added} recurring transaction(s) auto-logged.`, 'info');
  renderTable();
});
