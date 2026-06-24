/* ============================================
   AutoFinFlow - Reports Logic
   ============================================ */

let incomeChartRef = null;
let expenseChartRef = null;

function buildMonthFilter() {
  const sel = document.getElementById('monthFilter');
  const now = new Date();
  sel.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    if (i === 0) opt.selected = true;
    sel.appendChild(opt);
  }
}

function getSelectedMonth() {
  const val = document.getElementById('monthFilter').value;
  const [y, m] = val.split('-').map(Number);
  return { year: y, month: m - 1 };
}

function filterByMonth(payments, year, month) {
  return payments.filter(p => {
    const d = new Date(p.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

function renderAll() {
  const { year, month } = getSelectedMonth();
  const allPayments = DB.getPayments();
  const monthly     = filterByMonth(allPayments, year, month);
  const income      = monthly.filter(p => p.type === 'income');
  const expenses    = monthly.filter(p => p.type === 'expense');

  const totalIncome  = income.reduce((s,p) => s + Number(p.amount), 0);
  const totalExpense = expenses.reduce((s,p) => s + Number(p.amount), 0);
  const net          = totalIncome - totalExpense;

  // KPIs
  document.getElementById('rptIncome').textContent  = DB.fmt(totalIncome);
  document.getElementById('rptExpense').textContent = DB.fmt(totalExpense);
  const netEl = document.getElementById('rptNet');
  netEl.textContent = DB.fmt(net);
  netEl.style.color = net >= 0 ? 'var(--success)' : 'var(--danger)';

  // Invoice count for selected month
  const invCount = DB.getInvoices().filter(inv => {
    const d = new Date(inv.date);
    return d.getFullYear() === year && d.getMonth() === month;
  }).length;
  document.getElementById('rptInvCount').textContent = invCount;

  renderCategoryChart('incomeChart', income, 'Income by Category', incomeChartRef, ref => incomeChartRef = ref);
  renderCategoryChart('expenseChart', expenses, 'Expense Breakdown', expenseChartRef, ref => expenseChartRef = ref);
  renderOverdue();
  renderTopClients(allPayments);
}

function groupByCategory(payments) {
  const groups = {};
  payments.forEach(p => {
    const cat = p.category || 'other';
    groups[cat] = (groups[cat] || 0) + Number(p.amount);
  });
  return groups;
}

const COLORS = ['#1a56db','#10b981','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#ec4899','#14b8a6'];

function renderCategoryChart(canvasId, payments, label, chartRef, setRef) {
  if (chartRef) chartRef.destroy();
  const groups = groupByCategory(payments);
  const labels = Object.keys(groups).map(k => k.charAt(0).toUpperCase() + k.slice(1));
  const data   = Object.values(groups);

  if (!data.length) {
    setRef(null);
    const ctx = document.getElementById(canvasId).getContext('2d');
    ctx.clearRect(0, 0, 9999, 9999);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('No data for this period', 160, 120);
    return;
  }

  const chart = new Chart(document.getElementById(canvasId), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: COLORS.slice(0, data.length),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'right', labels: { font: { size: 12 }, padding: 12 } },
        tooltip: { callbacks: { label: ctx => ` KES ${Number(ctx.raw).toLocaleString()}` } }
      }
    }
  });
  setRef(chart);
}

function renderOverdue() {
  const tbody = document.getElementById('overdueTable');
  const overdue = DB.getInvoices().filter(i => DB.isOverdue(i.dueDate, i.status) && i.status !== 'paid');
  document.getElementById('overdueCount').textContent = overdue.length ? `${overdue.length} overdue` : '';
  if (!overdue.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state" style="padding:30px 20px;">
      <div class="empty-icon">✅</div><h3>No overdue invoices</h3></div></td></tr>`;
    return;
  }
  tbody.innerHTML = overdue.map(inv => `
    <tr>
      <td><strong>${inv.number}</strong></td>
      <td>${inv.client}</td>
      <td style="color:var(--danger);font-weight:500">${DB.formatDate(inv.dueDate)}</td>
      <td><strong>${DB.fmt(inv.amount)}</strong></td>
    </tr>
  `).join('');
}

function renderTopClients(payments) {
  const tbody = document.getElementById('topClientsTable');
  const income = payments.filter(p => p.type === 'income' && p.client);
  const map = {};
  income.forEach(p => {
    if (!map[p.client]) map[p.client] = { count: 0, total: 0 };
    map[p.client].count++;
    map[p.client].total += Number(p.amount);
  });
  const sorted = Object.entries(map).sort((a,b) => b[1].total - a[1].total).slice(0, 6);
  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state" style="padding:30px 20px;">
      <div class="empty-icon">👥</div><h3>No client data yet</h3></div></td></tr>`;
    return;
  }
  tbody.innerHTML = sorted.map(([client, info], i) => `
    <tr>
      <td><span style="color:var(--text-muted);margin-right:8px">${i+1}.</span>${client}</td>
      <td>${info.count}</td>
      <td><strong>${DB.fmt(info.total)}</strong></td>
    </tr>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  buildMonthFilter();
  renderAll();
});
