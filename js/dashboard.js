/* ============================================
   AutoFinFlow - Dashboard Logic
   ============================================ */

// Toast helper
function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function init() {
  // Set current date
  document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-GB', {weekday:'short', day:'numeric', month:'long', year:'numeric'});

  const stats = DB.getStats();

  // KPI values
  document.getElementById('kpiIncome').textContent      = DB.fmt(stats.totalIncome);
  document.getElementById('kpiExpense').textContent     = DB.fmt(stats.totalExpense);
  document.getElementById('kpiNet').textContent         = DB.fmt(stats.netFlow);
  document.getElementById('kpiOutstanding').textContent = DB.fmt(stats.outstanding);

  // KPI subtexts
  document.getElementById('kpiIncomeSub').textContent    = 'This month';
  document.getElementById('kpiExpenseSub').textContent   = 'This month';
  const netEl = document.getElementById('kpiNetSub');
  netEl.textContent = stats.netFlow >= 0 ? '▲ Positive flow' : '▼ Negative flow';
  netEl.className = 'kpi-sub ' + (stats.netFlow >= 0 ? 'up' : 'down');
  document.getElementById('kpiOutstandingSub').textContent = stats.overdueCount + ' overdue invoice(s)';

  renderRecentTransactions();
  renderRecentInvoices();
  renderCashflowChart();
  renderPieChart();
}

function renderRecentTransactions() {
  const tbody = document.getElementById('recentTxTable');
  const payments = DB.getPayments().slice(0, 8);
  if (!payments.length) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">💳</div><h3>No transactions yet</h3></div></td></tr>';
    return;
  }
  tbody.innerHTML = payments.map(p => `
    <tr>
      <td>${DB.formatDate(p.date)}</td>
      <td>${p.notes || p.client || '—'}</td>
      <td><span class="badge badge-${p.type}">${p.type}</span></td>
      <td style="font-weight:600; color:${p.type==='income'?'var(--success)':'var(--danger)'}">${p.type==='income'?'+':'-'}${DB.fmt(p.amount)}</td>
    </tr>
  `).join('');
}

function renderRecentInvoices() {
  const tbody = document.getElementById('recentInvTable');
  const invoices = DB.getInvoices().slice(0, 6);
  if (!invoices.length) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">🧾</div><h3>No invoices yet</h3></div></td></tr>';
    return;
  }
  tbody.innerHTML = invoices.map(inv => {
    const status = DB.isOverdue(inv.dueDate, inv.status) && inv.status !== 'paid' ? 'overdue' : inv.status;
    return `<tr>
      <td style="font-weight:600">${inv.number}</td>
      <td>${inv.client}</td>
      <td>${DB.fmt(inv.amount)}</td>
      <td><span class="badge badge-${status}">${status}</span></td>
    </tr>`;
  }).join('');
}

function renderCashflowChart() {
  const payments = DB.getPayments();
  const months = [];
  const incomeData = [];
  const expenseData = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    months.push(label);
    const m = d.getMonth(), y = d.getFullYear();
    const filtered = payments.filter(p => { const pd = new Date(p.date); return pd.getMonth()===m && pd.getFullYear()===y; });
    incomeData.push(filtered.filter(p => p.type==='income').reduce((s,p) => s+Number(p.amount), 0));
    expenseData.push(filtered.filter(p => p.type==='expense').reduce((s,p) => s+Number(p.amount), 0));
  }

  new Chart(document.getElementById('cashflowChart'), {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: 'Income', data: incomeData, backgroundColor: 'rgba(16,185,129,0.75)', borderRadius: 5 },
        { label: 'Expenses', data: expenseData, backgroundColor: 'rgba(239,68,68,0.65)', borderRadius: 5 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { font: { size: 12 } } } },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: { callback: v => 'KES ' + (v/1000).toFixed(0) + 'k' }
        }
      }
    }
  });
}

function renderPieChart() {
  const stats = DB.getStats();
  new Chart(document.getElementById('pieChart'), {
    type: 'doughnut',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{
        data: [stats.totalIncome || 1, stats.totalExpense || 1],
        backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(239,68,68,0.75)'],
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 13 }, padding: 16 } },
        tooltip: { callbacks: { label: ctx => ' KES ' + Number(ctx.raw).toLocaleString() } }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
