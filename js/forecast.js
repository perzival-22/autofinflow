/* ============================================
   AutoFinFlow - Cash Flow Forecast Logic
   ============================================ */

let chartRef = null;

function currentBalance() {
  const pays = DB.getPayments();
  return pays.filter(p=>p.type==='income').reduce((s,p)=>s+Number(p.amount),0)
       - pays.filter(p=>p.type==='expense').reduce((s,p)=>s+Number(p.amount),0);
}

function renderForecast() {
  const days   = parseInt(document.getElementById('horizonFilter').value) || 90;
  const events = DB.getForecast(days);
  const curBal = currentBalance();

  // KPIs
  const expectedIn  = events.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0);
  const expectedOut = events.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0);
  const endBal      = events.length ? events[events.length-1].runningBalance : curBal;
  const endDate     = new Date(); endDate.setDate(endDate.getDate()+days);

  document.getElementById('fcCurrentBal').textContent = DB.fmt(curBal);
  document.getElementById('fcExpectedIn').textContent  = DB.fmt(expectedIn);
  document.getElementById('fcExpectedOut').textContent = DB.fmt(expectedOut);
  const endBalEl = document.getElementById('fcEndBal');
  endBalEl.textContent = DB.fmt(endBal);
  endBalEl.style.color = endBal >= 0 ? 'var(--success)' : 'var(--danger)';
  document.getElementById('fcHorizonSub').textContent  = `Next ${days} days`;
  document.getElementById('fcHorizonSub2').textContent = `Next ${days} days`;
  document.getElementById('fcEndDate').textContent = 'By ' + DB.formatDate(endDate.toISOString().slice(0,10));
  document.getElementById('fcEventCount').textContent = `${events.length} event(s)`;

  renderChart(events, curBal, days);
  renderTable(events, curBal);
}

function renderChart(events, curBal, days) {
  if (chartRef) { chartRef.destroy(); chartRef = null; }

  // Build weekly buckets for readability
  const today = new Date(); today.setHours(0,0,0,0);
  const labels = [], balances = [];
  let running = curBal;

  // Group events by week
  const weeks = Math.ceil(days / 7) + 1;
  for (let w = 0; w < weeks; w++) {
    const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() + w*7);
    const weekEnd   = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
    labels.push(weekStart.toLocaleDateString('en-GB', { month:'short', day:'numeric' }));
    const weekEvents = events.filter(e => {
      const d = new Date(e.date); d.setHours(0,0,0,0);
      return d >= weekStart && d < weekEnd;
    });
    weekEvents.forEach(e => { running += e.type==='income' ? e.amount : -e.amount; });
    balances.push(running);
  }

  const positiveColor = 'rgba(16,185,129,0.15)';
  const negativeColor = 'rgba(239,68,68,0.15)';

  chartRef = new Chart(document.getElementById('forecastChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Projected Balance',
        data: balances,
        borderColor: '#1a56db',
        backgroundColor: ctx => {
          const v = ctx.dataset.data[ctx.dataIndex] || 0;
          return v >= 0 ? positiveColor : negativeColor;
        },
        borderWidth: 2.5,
        pointRadius: 4,
        pointBackgroundColor: balances.map(b => b >= 0 ? '#10b981' : '#ef4444'),
        tension: 0.35,
        fill: true
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + DB.fmt(ctx.raw) } }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          ticks: { callback: v => DB.getSettings().currency + ' ' + (v/1000).toFixed(0) + 'k' },
          grid: { color: '#f1f5f9' }
        }
      }
    }
  });
}

function renderTable(events, curBal) {
  const tbody = document.getElementById('forecastTable');
  if (!events.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">
      <div class="empty-icon">🔮</div>
      <h3>No upcoming events</h3>
      <p>Add pending invoices or recurring schedules to see your forecast.</p>
    </div></td></tr>`;
    return;
  }

  // Starting balance row
  let rows = `<tr style="background:#f8fafc;">
    <td colspan="3" style="font-weight:600;color:var(--text-secondary)">Opening Balance (Today)</td>
    <td>—</td>
    <td style="font-weight:700">${DB.fmt(curBal)}</td>
  </tr>`;

  rows += events.map(e => {
    const balColor = e.runningBalance >= 0 ? 'var(--success)' : 'var(--danger)';
    return `<tr>
      <td>${DB.formatDate(e.date)}</td>
      <td>${e.label}</td>
      <td><span class="badge badge-${e.type}">${e.type}</span></td>
      <td style="font-weight:600;color:${e.type==='income'?'var(--success)':'var(--danger)'}">
        ${e.type==='income'?'+':'-'}${DB.fmt(e.amount)}
      </td>
      <td style="font-weight:700;color:${balColor}">${DB.fmt(e.runningBalance)}</td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows;
}

document.addEventListener('DOMContentLoaded', renderForecast);
