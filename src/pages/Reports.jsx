import { useState, useEffect, useRef } from 'react'
import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js'
import DB from '../js/data'

Chart.register(DoughnutController, ArcElement, Tooltip, Legend)

const COLORS = ['#1a56db','#10b981','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#ec4899','#14b8a6']

function buildMonths() {
  const now = new Date(), months = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1)
    months.push({
      val: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      label: d.toLocaleDateString('en-GB', {month:'long', year:'numeric'})
    })
  }
  return months
}

export default function Reports() {
  const months = buildMonths()
  const [month, setMonth] = useState(months[0].val)
  const incomeRef = useRef(null); const expenseRef = useRef(null)
  const incomeChart = useRef(null); const expenseChart = useRef(null)
  const [data, setData] = useState(null)

  useEffect(() => {
    const [y,m] = month.split('-').map(Number)
    const allPay = DB.getPayments()
    const monthly = allPay.filter(p => { const d=new Date(p.date); return d.getFullYear()===y && d.getMonth()===(m-1) })
    const income  = monthly.filter(p=>p.type==='income')
    const expense = monthly.filter(p=>p.type==='expense')
    const totalIncome  = income.reduce((s,p)=>s+Number(p.amount),0)
    const totalExpense = expense.reduce((s,p)=>s+Number(p.amount),0)
    const invCount = DB.getInvoices().filter(inv=>{ const d=new Date(inv.date); return d.getFullYear()===y&&d.getMonth()===(m-1) }).length
    const overdue  = DB.getInvoices().filter(i=>DB.isOverdue(i.dueDate,i.status)&&i.status!=='paid')
    const incMap={}, expMap={}
    income.forEach(p=>{ const c=p.category||'other'; incMap[c]=(incMap[c]||0)+Number(p.amount) })
    expense.forEach(p=>{ const c=p.category||'other'; expMap[c]=(expMap[c]||0)+Number(p.amount) })
    const incMap2={}, topClients={}
    allPay.filter(p=>p.type==='income'&&p.client).forEach(p=>{
      if(!topClients[p.client]) topClients[p.client]={count:0,total:0}
      topClients[p.client].count++; topClients[p.client].total+=Number(p.amount)
    })
    setData({ totalIncome, totalExpense, net:totalIncome-totalExpense, invCount, overdue, incMap, expMap, topClients })
  }, [month])

  useEffect(() => {
    if (!data || !incomeRef.current) return
    if (incomeChart.current) incomeChart.current.destroy()
    const labels = Object.keys(data.incMap).map(k=>k.charAt(0).toUpperCase()+k.slice(1))
    const vals   = Object.values(data.incMap)
    if (vals.length) {
      try {
        incomeChart.current = new Chart(incomeRef.current, {
          type:'doughnut',
          data:{ labels, datasets:[{ data:vals, backgroundColor:COLORS.slice(0,vals.length), borderWidth:2, borderColor:'#fff' }] },
          options:{ responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{ legend:{position:'right',labels:{font:{size:12},padding:12}}, tooltip:{callbacks:{label:ctx=>` KES ${Number(ctx.raw).toLocaleString()}`}} } }
        })
      } catch(e) { console.error('Income chart error:', e) }
    } else {
      const ctx = incomeRef.current.getContext('2d'); ctx.clearRect(0,0,9999,9999)
      ctx.fillStyle='#94a3b8'; ctx.font='14px Segoe UI'; ctx.textAlign='center'; ctx.fillText('No data for this period',160,120)
    }
    return () => { incomeChart.current?.destroy(); incomeChart.current=null }
  }, [data])

  useEffect(() => {
    if (!data || !expenseRef.current) return
    if (expenseChart.current) expenseChart.current.destroy()
    const labels = Object.keys(data.expMap).map(k=>k.charAt(0).toUpperCase()+k.slice(1))
    const vals   = Object.values(data.expMap)
    if (vals.length) {
      try {
        expenseChart.current = new Chart(expenseRef.current, {
          type:'doughnut',
          data:{ labels, datasets:[{ data:vals, backgroundColor:COLORS.slice(0,vals.length), borderWidth:2, borderColor:'#fff' }] },
          options:{ responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{ legend:{position:'right',labels:{font:{size:12},padding:12}}, tooltip:{callbacks:{label:ctx=>` KES ${Number(ctx.raw).toLocaleString()}`}} } }
        })
      } catch(e) { console.error('Expense chart error:', e) }
    } else {
      const ctx = expenseRef.current.getContext('2d'); ctx.clearRect(0,0,9999,9999)
      ctx.fillStyle='#94a3b8'; ctx.font='14px Segoe UI'; ctx.textAlign='center'; ctx.fillText('No data for this period',160,120)
    }
    return () => { expenseChart.current?.destroy(); expenseChart.current=null }
  }, [data])

  if (!data) return null
  const sorted = Object.entries(data.topClients).sort((a,b)=>b[1].total-a[1].total).slice(0,6)

  return (
    <>
      <header className="topbar">
        <div className="topbar-left"><h1>Reports</h1><p>Monthly financial summary</p></div>
        <div className="topbar-right">
          <select className="filter-select" value={month} onChange={e=>setMonth(e.target.value)}>
            {months.map(m=><option key={m.val} value={m.val}>{m.label}</option>)}
          </select>
        </div>
      </header>
      <div className="page-body">
        <div className="kpi-grid" style={{marginBottom:24}}>
          <div className="kpi-card"><div className="kpi-icon green">💰</div><div className="kpi-info"><div className="kpi-label">Total Income</div><div className="kpi-value">{DB.fmt(data.totalIncome)}</div></div></div>
          <div className="kpi-card"><div className="kpi-icon red">💸</div><div className="kpi-info"><div className="kpi-label">Total Expenses</div><div className="kpi-value">{DB.fmt(data.totalExpense)}</div></div></div>
          <div className="kpi-card"><div className="kpi-icon blue">🏦</div><div className="kpi-info"><div className="kpi-label">Net Cash Flow</div><div className="kpi-value" style={{color:data.net>=0?'var(--success)':'var(--danger)'}}>{DB.fmt(data.net)}</div></div></div>
          <div className="kpi-card"><div className="kpi-icon amber">🧾</div><div className="kpi-info"><div className="kpi-label">Invoices Issued</div><div className="kpi-value">{data.invCount}</div></div></div>
        </div>

        <div className="grid-2" style={{marginBottom:24}}>
          <div className="card">
            <div className="card-header"><span className="card-title">Income by Category</span></div>
            <div className="card-body"><div className="chart-container"><canvas ref={incomeRef} /></div></div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Expense Breakdown</span></div>
            <div className="card-body"><div className="chart-container"><canvas ref={expenseRef} /></div></div>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Overdue Invoices</span>
              {data.overdue.length>0&&<span style={{fontSize:13,color:'var(--danger)',fontWeight:600}}>{data.overdue.length} overdue</span>}
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Invoice</th><th>Client</th><th>Due Date</th><th>Amount</th></tr></thead>
                <tbody>
                  {data.overdue.length===0
                    ? <tr><td colSpan="4"><div className="empty-state" style={{padding:'30px 20px'}}><div className="empty-icon">✅</div><h3>No overdue invoices</h3></div></td></tr>
                    : data.overdue.map(inv=>(
                      <tr key={inv.id}>
                        <td><strong>{inv.number}</strong></td>
                        <td>{inv.client}</td>
                        <td style={{color:'var(--danger)',fontWeight:500}}>{DB.formatDate(inv.dueDate)}</td>
                        <td><strong>{DB.fmt(inv.amount)}</strong></td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Top Clients by Revenue</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Client</th><th>Transactions</th><th>Revenue</th></tr></thead>
                <tbody>
                  {sorted.length===0
                    ? <tr><td colSpan="3"><div className="empty-state" style={{padding:'30px 20px'}}><div className="empty-icon">👥</div><h3>No client data yet</h3></div></td></tr>
                    : sorted.map(([client,info],i)=>(
                      <tr key={client}>
                        <td><span style={{color:'var(--text-muted)',marginRight:8}}>{i+1}.</span>{client}</td>
                        <td>{info.count}</td>
                        <td><strong>{DB.fmt(info.total)}</strong></td>
                      </tr>
                    ))
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
