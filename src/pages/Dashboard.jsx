import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chart, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend } from 'chart.js'
import DB from '../js/data'

Chart.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const barRef = useRef(null)
  const pieRef = useRef(null)
  const barChart = useRef(null)
  const pieChart = useRef(null)

  useEffect(() => {
    setStats(DB.getStats())
    setPayments(DB.getPayments().slice(0, 8))
    setInvoices(DB.getInvoices().slice(0, 6))
  }, [])

  useEffect(() => {
    if (!stats || !barRef.current) return
    if (barChart.current) barChart.current.destroy()
    const allPay = DB.getPayments()
    const now = new Date()
    const months = [], income = [], expense = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }))
      const m = d.getMonth(), y = d.getFullYear()
      const f = allPay.filter(p => { const pd = new Date(p.date); return pd.getMonth()===m && pd.getFullYear()===y })
      income.push(f.filter(p=>p.type==='income').reduce((s,p)=>s+Number(p.amount),0))
      expense.push(f.filter(p=>p.type==='expense').reduce((s,p)=>s+Number(p.amount),0))
    }
    barChart.current = new Chart(barRef.current, {
      type: 'bar',
      data: { labels: months, datasets: [
        { label: 'Income',   data: income,  backgroundColor: 'rgba(16,185,129,0.75)', borderRadius: 5 },
        { label: 'Expenses', data: expense, backgroundColor: 'rgba(239,68,68,0.65)',  borderRadius: 5 }
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 12 } } } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: v => 'KES '+(v/1000).toFixed(0)+'k' } } }
      }
    })
    return () => { barChart.current?.destroy(); barChart.current = null }
  }, [stats])

  useEffect(() => {
    if (!stats || !pieRef.current) return
    if (pieChart.current) pieChart.current.destroy()
    pieChart.current = new Chart(pieRef.current, {
      type: 'doughnut',
      data: { labels: ['Income','Expenses'], datasets: [{ data: [stats.totalIncome||1, stats.totalExpense||1], backgroundColor: ['rgba(16,185,129,0.8)','rgba(239,68,68,0.75)'], borderWidth:2, borderColor:'#fff' }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { legend: { position:'bottom', labels:{ font:{size:13}, padding:16 } }, tooltip:{ callbacks:{ label: ctx => ' KES '+Number(ctx.raw).toLocaleString() } } }
      }
    })
    return () => { pieChart.current?.destroy(); pieChart.current = null }
  }, [stats])

  if (!stats) return null
  const date = new Date().toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'long', year:'numeric' })

  return (
    <>
      <header className="topbar">
        <div className="topbar-left"><h1>Dashboard</h1><p>Business cash flow overview</p></div>
        <div className="topbar-right">
          <span className="topbar-date">{date}</span>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/invoices')}>+ New Invoice</button>
        </div>
      </header>
      <div className="page-body">
        <div className="kpi-grid">
          <KPI icon="💰" color="green" label="Income (This Month)"    value={DB.fmt(stats.totalIncome)}  sub="This month" subCls="up" />
          <KPI icon="💸" color="red"   label="Expenses (This Month)"  value={DB.fmt(stats.totalExpense)} sub="This month" subCls="down" />
          <KPI icon="🏦" color="blue"  label="Net Cash Flow"          value={DB.fmt(stats.netFlow)}      sub={stats.netFlow>=0?'▲ Positive flow':'▼ Negative flow'} subCls={stats.netFlow>=0?'up':'down'} />
          <KPI icon="⏳" color="amber" label="Outstanding Invoices"   value={DB.fmt(stats.outstanding)}  sub={`${stats.overdueCount} overdue invoice(s)`} />
        </div>

        <div className="grid-2" style={{marginBottom:24}}>
          <div className="card">
            <div className="card-header"><span className="card-title">Cash Flow — Last 6 Months</span></div>
            <div className="card-body"><div className="chart-container"><canvas ref={barRef} /></div></div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Income vs Expenses</span></div>
            <div className="card-body"><div className="chart-container"><canvas ref={pieRef} /></div></div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Transactions</span>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/payments')}>View All</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th></tr></thead>
                <tbody>
                  {payments.length === 0
                    ? <tr><td colSpan="4"><div className="empty-state"><div className="empty-icon">💳</div><h3>No transactions yet</h3></div></td></tr>
                    : payments.map(p => (
                      <tr key={p.id}>
                        <td>{DB.formatDate(p.date)}</td>
                        <td>{p.notes || p.client || '—'}</td>
                        <td><span className={`badge badge-${p.type}`}>{p.type}</span></td>
                        <td style={{fontWeight:600,color:p.type==='income'?'var(--success)':'var(--danger)'}}>
                          {p.type==='income'?'+':'-'}{DB.fmt(p.amount)}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent Invoices</span>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/invoices')}>View All</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {invoices.length === 0
                    ? <tr><td colSpan="4"><div className="empty-state"><div className="empty-icon">🧾</div><h3>No invoices yet</h3></div></td></tr>
                    : invoices.map(inv => {
                        const st = DB.isOverdue(inv.dueDate,inv.status) && inv.status!=='paid' ? 'overdue' : inv.status
                        return (
                          <tr key={inv.id}>
                            <td style={{fontWeight:600}}>{inv.number}</td>
                            <td>{inv.client}</td>
                            <td>{DB.fmt(inv.amount)}</td>
                            <td><span className={`badge badge-${st}`}>{st}</span></td>
                          </tr>
                        )
                      })
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function KPI({ icon, color, label, value, sub, subCls }) {
  return (
    <div className="kpi-card">
      <div className={`kpi-icon ${color}`}>{icon}</div>
      <div className="kpi-info">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        <div className={`kpi-sub ${subCls||''}`}>{sub}</div>
      </div>
    </div>
  )
}
