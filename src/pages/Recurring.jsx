import { useState, useEffect } from 'react'
import DB from '../js/data'
import { useToast } from '../components/Toast'

const FREQ = { weekly:'Weekly', monthly:'Monthly', yearly:'Yearly' }
const METHOD = { bank_transfer:'Bank Transfer', mpesa:'M-Pesa', cash:'Cash', card:'Card' }
const EMPTY = { id:'', type:'expense', frequency:'monthly', client:'', amount:'', method:'bank_transfer', category:'rent', startDate:'', notes:'' }

export default function Recurring() {
  const toast = useToast()
  const [list, setList] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    const added = DB.processRecurring()
    if (added > 0) toast(`${added} recurring transaction(s) auto-logged.`, 'info')
    setList(DB.getRecurring())
  }, [])

  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const inp = (k) => ({ className:'form-control', value:form[k], onChange:e=>set(k,e.target.value) })

  function refresh() { setList(DB.getRecurring()) }

  function openNew() {
    setForm({...EMPTY, startDate: new Date().toISOString().slice(0,10)})
    setModal(true)
  }

  function openEdit(id) {
    const r = DB.getRecurring().find(x=>x.id===id)
    if (r) { setForm({...EMPTY,...r}); setModal(true) }
  }

  function save() {
    const amount = parseFloat(form.amount)
    if (!amount || amount<=0) { toast('Enter a valid amount.','error'); return }
    if (!form.startDate) { toast('Start date is required.','error'); return }
    const existing = form.id ? DB.getRecurring().find(x=>x.id===form.id) : null
    DB.saveRecurring({
      ...form, id: form.id||DB.uuid(), amount, active: existing?.active ?? true,
      lastRun: existing?.lastRun || null
    })
    setModal(false); refresh()
    toast(form.id?'Schedule updated.':'Recurring schedule created.','success')
  }

  function toggleActive(id) {
    const r = DB.getRecurring().find(x=>x.id===id)
    if (!r) return
    r.active = !r.active; DB.saveRecurring(r); refresh()
    toast(r.active?'Schedule resumed.':'Schedule paused.','info')
  }

  function del(id) {
    if (!confirm('Delete this recurring schedule? Past auto-logged entries remain.')) return
    DB.deleteRecurring(id); refresh(); toast('Schedule deleted.','info')
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-left"><h1>Recurring</h1><p>Auto-log repeating income and expenses</p></div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ New Schedule</button>
        </div>
      </header>
      <div className="page-body">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recurring Schedules</span>
            <span style={{fontSize:13,color:'var(--text-secondary)'}}>{list.length} schedule(s)</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Description</th><th>Type</th><th>Amount</th><th>Frequency</th><th>Category</th><th>Method</th><th>Last Run</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {list.length===0
                  ? <tr><td colSpan="9"><div className="empty-state"><div className="empty-icon">🔁</div><h3>No recurring transactions</h3><p>Set up auto-logging for rent, salaries, retainers, and more.</p></div></td></tr>
                  : list.map(r=>(
                    <tr key={r.id}>
                      <td>
                        <strong>{r.notes||r.category}</strong>
                        {r.client&&<><br/><span style={{fontSize:12,color:'var(--text-muted)'}}>{r.client}</span></>}
                      </td>
                      <td><span className={`badge badge-${r.type}`}>{r.type}</span></td>
                      <td style={{fontWeight:600,color:r.type==='income'?'var(--success)':'var(--danger)'}}>{DB.fmt(r.amount)}</td>
                      <td>{FREQ[r.frequency]||r.frequency}</td>
                      <td style={{textTransform:'capitalize'}}>{r.category}</td>
                      <td>{METHOD[r.method]||r.method}</td>
                      <td>{r.lastRun?DB.formatDate(r.lastRun):<span style={{color:'var(--text-muted)'}}>Never</span>}</td>
                      <td>
                        <span className="badge" style={r.active?{background:'#dcfce7',color:'#15803d'}:{background:'#f1f5f9',color:'#64748b'}}>
                          {r.active?'Active':'Paused'}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="action-btn edit" title="Edit"         onClick={()=>openEdit(r.id)}>✏️</button>
                          <button className="action-btn view" title={r.active?'Pause':'Resume'} onClick={()=>toggleActive(r.id)}>{r.active?'⏸️':'▶️'}</button>
                          <button className="action-btn del"  title="Delete"       onClick={()=>del(r.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={`modal-overlay${modal?' open':''}`} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">{form.id?'Edit Recurring':'New Recurring Transaction'}</span>
            <button className="modal-close" onClick={()=>setModal(false)}>×</button>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Type</label>
                <select {...inp('type')} className="form-control"><option value="expense">Expense</option><option value="income">Income</option></select>
              </div>
              <div className="form-group">
                <label className="form-label">Frequency</label>
                <select {...inp('frequency')} className="form-control"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Client / Vendor</label><input {...inp('client')} placeholder="Optional" /></div>
              <div className="form-group"><label className="form-label">Amount *</label><input {...inp('amount')} type="number" min="0" step="0.01" /></div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Method</label>
                <select {...inp('method')} className="form-control"><option value="bank_transfer">Bank Transfer</option><option value="mpesa">M-Pesa</option><option value="cash">Cash</option><option value="card">Card</option></select>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select {...inp('category')} className="form-control"><option value="rent">Rent</option><option value="salaries">Salaries</option><option value="utilities">Utilities</option><option value="services">Services</option><option value="supplies">Supplies</option><option value="other">Other</option></select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Start Date *</label><input {...inp('startDate')} type="date" /></div>
              <div className="form-group"><label className="form-label">Notes / Label</label><input {...inp('notes')} placeholder="e.g. Office rent" /></div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save Schedule</button>
          </div>
        </div>
      </div>
    </>
  )
}
