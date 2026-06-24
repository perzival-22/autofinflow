import { useState, useEffect, useRef } from 'react'
import { Chart, LineController, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js'
import DB from '../js/data'

Chart.register(LineController, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

export default function Forecast() {
  const [days, setDays] = useState(90)
  const [data, setData] = useState(() => {
    const pays = DB.getPayments()
    const curBal = pays.filter(p=>p.type==='income').reduce((s,p)=>s+Number(p.amount),0)
                 - pays.filter(p=>p.type==='expense').reduce((s,p)=>s+Number(p.amount),0)
    const events = DB.getForecast(90)
    const expectedIn  = events.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0)
    const expectedOut = events.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0)
    const endBal = events.length ? events[events.length-1].runningBalance : curBal
    const endDate = new Date(); endDate.setDate(endDate.getDate()+90)
    return { curBal, events, expectedIn, expectedOut, endBal, endDate }
  })
  const canvasRef = useRef(null)
  const chartRef  = useRef(null)

  useEffect(() => {
    const pays = DB.getPayments()
    const curBal = pays.filter(p=>p.type==='income').reduce((s,p)=>s+Number(p.amount),0)
                 - pays.filter(p=>p.type==='expense').reduce((s,p)=>s+Number(p.amount),0)
    const events = DB.getForecast(days)
    const expectedIn  = events.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0)
    const expectedOut = events.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0)
    const endBal = events.length ? events[events.length-1].runningBalance : curBal
    const endDate = new Date(); endDate.setDate(endDate.getDate()+days)
    setData({ curBal, events, expectedIn, expectedOut, endBal, endDate })
  }, [days])

  useEffect(() => {
    if (!data || !canvasRef.current) return
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

    const { curBal, events } = data
    const today = new Date(); today.setHours(0,0,0,0)
    const labels=[], balances=[]
    let running = curBal
    const weeks = Math.ceil(days/7)+1
    for (let w=0; w<weeks; w++) {
      const wStart = new Date(today); wStart.setDate(wStart.getDate()+w*7)
      const wEnd   = new Date(wStart); wEnd.setDate(wEnd.getDate()+7)
      labels.push(wStart.toLocaleDateString('en-GB',{month:'short',day:'numeric'}))
      events.filter(e=>{ const d=new Date(e.date); d.setHours(0,0,0,0); return d>=wStart&&d<wEnd }).forEach(e=>{ running+=e.type==='income'?e.amount:-e.amount })
      balances.push(running)
    }

    try { chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels, datasets: [{ label:'Projected Balance', data:balances, borderColor:'#1a56db', backgroundColor:'rgba(16,185,129,0.08)', borderWidth:2.5, pointRadius:4, pointBackgroundColor:balances.map(b=>b>=0?'#10b981':'#ef4444'), tension:0.35, fill:true }] },
      options: {
        responsive:true, maintainAspectRatio:false,
        interaction:{ mode:'index', intersect:false },
        plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>' '+DB.fmt(ctx.raw)}} },
        scales:{ x:{grid:{display:false}}, y:{ticks:{callback:v=>DB.getSettings().currency+' '+(v/1000).toFixed(0)+'k'},grid:{color:'#f1f5f9'}} }
      }
    }) } catch(e) { console.error('Forecast chart error:', e) }
    return () => { chartRef.current?.destroy(); chartRef.current=null }
  }, [data])

  if (!data) return null

  return (
    <>
      <header className="topbar">
        <div className="topbar-left"><h1>Forecast</h1><p>Projected cash flow</p></div>
        <div className="topbar-right">
          <select className="filter-select" value={days} onChange={e=>setDays(Number(e.target.value))}>
            <option value={30}>Next 30 days</option>
            <option value={60}>Next 60 days</option>
            <option value={90}>Next 90 days</option>
            <option value={180}>Next 180 days</option>
          </select>
        </div>
      </header>
      <div className="page-body">
        <div className="kpi-grid" style={{marginBottom:24}}>
          <div className="kpi-card"><div className="kpi-icon blue">🏦</div><div className="kpi-info"><div className="kpi-label">Current Balance</div><div className="kpi-value">{DB.fmt(data.curBal)}</div><div className="kpi-sub">As of today</div></div></div>
          <div className="kpi-card"><div className="kpi-icon green">💰</div><div className="kpi-info"><div className="kpi-label">Expected Income</div><div className="kpi-value">{DB.fmt(data.expectedIn)}</div><div className="kpi-sub">Next {days} days</div></div></div>
          <div className="kpi-card"><div className="kpi-icon red">💸</div><div className="kpi-info"><div className="kpi-label">Expected Expenses</div><div className="kpi-value">{DB.fmt(data.expectedOut)}</div><div className="kpi-sub">Next {days} days</div></div></div>
          <div className="kpi-card"><div className="kpi-icon amber">🔮</div><div className="kpi-info"><div className="kpi-label">Projected End Balance</div><div className="kpi-value" style={{color:data.endBal>=0?'var(--success)':'var(--danger)'}}>{DB.fmt(data.endBal)}</div><div className="kpi-sub">By {DB.formatDate(data.endDate.toISOString().slice(0,10))}</div></div></div>
        </div>

        <div className="card" style={{marginBottom:24}}>
          <div className="card-header"><span className="card-title">Projected Balance</span></div>
          <div className="card-body"><div className="chart-container" style={{height:280}}><canvas ref={canvasRef} /></div></div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Upcoming Events</span>
            <span style={{fontSize:13,color:'var(--text-secondary)'}}>{data.events.length} event(s)</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th>Running Balance</th></tr></thead>
              <tbody>
                {data.events.length===0
                  ? <tr><td colSpan="5"><div className="empty-state"><div className="empty-icon">🔮</div><h3>No upcoming events</h3><p>Add pending invoices or recurring schedules to see your forecast.</p></div></td></tr>
                  : <>
                      <tr style={{background:'#f8fafc'}}>
                        <td colSpan="3" style={{fontWeight:600,color:'var(--text-secondary)'}}>Opening Balance (Today)</td>
                        <td>—</td>
                        <td style={{fontWeight:700}}>{DB.fmt(data.curBal)}</td>
                      </tr>
                      {data.events.map((e,i)=>(
                        <tr key={i}>
                          <td>{DB.formatDate(e.date)}</td>
                          <td>{e.label}</td>
                          <td><span className={`badge badge-${e.type}`}>{e.type}</span></td>
                          <td style={{fontWeight:600,color:e.type==='income'?'var(--success)':'var(--danger)'}}>
                            {e.type==='income'?'+':'-'}{DB.fmt(e.amount)}
                          </td>
                          <td style={{fontWeight:700,color:e.runningBalance>=0?'var(--success)':'var(--danger)'}}>{DB.fmt(e.runningBalance)}</td>
                        </tr>
                      ))}
                    </>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
