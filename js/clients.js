/* ============================================
   AutoFinFlow - Clients Logic
   ============================================ */

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function renderTable() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const tbody = document.getElementById('clientTable');
  let clients = DB.getClients();
  if (query) clients = clients.filter(c => c.name.toLowerCase().includes(query) || (c.email||'').toLowerCase().includes(query));

  document.getElementById('clientCount').textContent = `${clients.length} client(s)`;

  if (!clients.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <div class="empty-icon">👥</div>
      <h3>No clients yet</h3><p>Add your first client above.</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = clients.map(c => {
    const stats = DB.clientStats(c.name);
    const outColor = stats.outstanding > 0 ? 'var(--warning)' : 'var(--success)';
    return `<tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.email || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${c.phone || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${DB.fmt(stats.totalBilled)}</td>
      <td style="color:var(--success);font-weight:500">${DB.fmt(stats.totalPaid)}</td>
      <td style="color:${outColor};font-weight:500">${DB.fmt(stats.outstanding)}</td>
      <td>${stats.invoiceCount}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" title="Edit" onclick="openModal('${c.id}')">✏️</button>
          <button class="action-btn view" title="View Invoices" onclick="viewInvoices('${encodeURIComponent(c.name)}')">🧾</button>
          <button class="action-btn del"  title="Delete" onclick="deleteClient('${c.id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openModal(id = null) {
  if (id) {
    const c = DB.getClient(id);
    if (!c) return;
    document.getElementById('modalTitle').textContent = 'Edit Client';
    document.getElementById('clientId').value      = c.id;
    document.getElementById('clientName').value    = c.name;
    document.getElementById('clientEmail').value   = c.email  || '';
    document.getElementById('clientPhone').value   = c.phone  || '';
    document.getElementById('clientAddress').value = c.address|| '';
    document.getElementById('clientNotes').value   = c.notes  || '';
  } else {
    document.getElementById('modalTitle').textContent = 'Add Client';
    ['clientId','clientName','clientEmail','clientPhone','clientAddress','clientNotes'].forEach(id => document.getElementById(id).value = '');
  }
  document.getElementById('clientModal').classList.add('open');
}

function closeModal() {
  document.getElementById('clientModal').classList.remove('open');
}

function saveClient() {
  const name = document.getElementById('clientName').value.trim();
  if (!name) { toast('Client name is required.', 'error'); return; }
  const id = document.getElementById('clientId').value;
  const client = {
    id:      id || DB.uuid(),
    name,
    email:   document.getElementById('clientEmail').value.trim(),
    phone:   document.getElementById('clientPhone').value.trim(),
    address: document.getElementById('clientAddress').value.trim(),
    notes:   document.getElementById('clientNotes').value.trim()
  };
  DB.saveClient(client);
  closeModal();
  renderTable();
  toast(id ? 'Client updated.' : 'Client added.', 'success');
}

function deleteClient(id) {
  if (!confirm('Delete this client? Their invoices and payments will remain.')) return;
  DB.deleteClient(id);
  renderTable();
  toast('Client deleted.', 'info');
}

function viewInvoices(encodedName) {
  window.location.href = `invoices.html?client=${encodedName}`;
}

document.getElementById('clientModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

document.addEventListener('DOMContentLoaded', renderTable);
