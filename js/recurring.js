/* ============================================
   AutoFinFlow - Recurring Transactions Logic
   ============================================ */

const FREQ_LABELS = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
const METHOD_LABELS = { bank_transfer: 'Bank Transfer', mpesa: 'M-Pesa', cash: 'Cash', card: 'Card' };

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function renderTable() {
  const tbody = document.getElementById('recurTable');
  const list  = DB.getRecurring();
  document.getElementById('recurCount').textContent = `${list.length} schedule(s)`;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
      <div class="empty-icon">🔁</div>
      <h3>No recurring transactions</h3>
      <p>Set up auto-logging for rent, salaries, retainers, and more.</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(r => `
    <tr>
      <td><strong>${r.notes || r.category}</strong>${r.client ? '<br><span style="font-size:12px;color:var(--text-muted)">'+r.client+'</span>' : ''}</td>
      <td><span class="badge badge-${r.type}">${r.type}</span></td>
      <td style="font-weight:600;color:${r.type==='income'?'var(--success)':'var(--danger)'}">${DB.fmt(r.amount)}</td>
      <td>${FREQ_LABELS[r.frequency] || r.frequency}</td>
      <td style="text-transform:capitalize">${r.category}</td>
      <td>${METHOD_LABELS[r.method] || r.method}</td>
      <td>${r.lastRun ? DB.formatDate(r.lastRun) : '<span style="color:var(--text-muted)">Never</span>'}</td>
      <td>
        <span class="badge" style="${r.active ? 'background:#dcfce7;color:#15803d' : 'background:#f1f5f9;color:#64748b'}">
          ${r.active ? 'Active' : 'Paused'}
        </span>
      </td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" title="Edit"   onclick="openModal('${r.id}')">✏️</button>
          <button class="action-btn view" title="${r.active?'Pause':'Resume'}" onclick="toggleActive('${r.id}')">${r.active?'⏸️':'▶️'}</button>
          <button class="action-btn del"  title="Delete" onclick="deleteRecurring('${r.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openModal(id = null) {
  const today = new Date().toISOString().slice(0, 10);
  if (id) {
    const r = DB.getRecurring().find(x => x.id === id);
    if (!r) return;
    document.getElementById('modalTitle').textContent = 'Edit Recurring';
    document.getElementById('recurId').value    = r.id;
    document.getElementById('rType').value      = r.type;
    document.getElementById('rFreq').value      = r.frequency;
    document.getElementById('rClient').value    = r.client || '';
    document.getElementById('rAmount').value    = r.amount;
    document.getElementById('rMethod').value    = r.method;
    document.getElementById('rCategory').value  = r.category;
    document.getElementById('rStart').value     = r.startDate;
    document.getElementById('rNotes').value     = r.notes || '';
  } else {
    document.getElementById('modalTitle').textContent = 'New Recurring Transaction';
    ['recurId','rClient','rAmount','rNotes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('rType').value     = 'expense';
    document.getElementById('rFreq').value     = 'monthly';
    document.getElementById('rMethod').value   = 'bank_transfer';
    document.getElementById('rCategory').value = 'rent';
    document.getElementById('rStart').value    = today;
  }
  document.getElementById('recurModal').classList.add('open');
}

function closeModal() {
  document.getElementById('recurModal').classList.remove('open');
}

function saveRecurring() {
  const id     = document.getElementById('recurId').value;
  const amount = parseFloat(document.getElementById('rAmount').value);
  const start  = document.getElementById('rStart').value;
  if (!amount || amount <= 0) { toast('Enter a valid amount.', 'error'); return; }
  if (!start) { toast('Start date is required.', 'error'); return; }

  const rec = {
    id:        id || DB.uuid(),
    type:      document.getElementById('rType').value,
    frequency: document.getElementById('rFreq').value,
    client:    document.getElementById('rClient').value.trim(),
    amount,
    method:    document.getElementById('rMethod').value,
    category:  document.getElementById('rCategory').value,
    startDate: start,
    notes:     document.getElementById('rNotes').value.trim(),
    active:    true,
    lastRun:   id ? (DB.getRecurring().find(x=>x.id===id)||{}).lastRun || null : null
  };

  DB.saveRecurring(rec);
  closeModal();
  renderTable();
  toast(id ? 'Schedule updated.' : 'Recurring schedule created.', 'success');
}

function toggleActive(id) {
  const list = DB.getRecurring();
  const rec  = list.find(r => r.id === id);
  if (!rec) return;
  rec.active = !rec.active;
  DB.saveRecurring(rec);
  renderTable();
  toast(rec.active ? 'Schedule resumed.' : 'Schedule paused.', 'info');
}

function deleteRecurring(id) {
  if (!confirm('Delete this recurring schedule? Past auto-logged entries remain.')) return;
  DB.deleteRecurring(id);
  renderTable();
  toast('Schedule deleted.', 'info');
}

document.getElementById('recurModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

document.addEventListener('DOMContentLoaded', () => {
  const added = DB.processRecurring();
  if (added > 0) toast(`${added} recurring transaction(s) auto-logged.`, 'info');
  renderTable();
});
