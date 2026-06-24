import { useState, useEffect } from 'react'
import DB from '../js/data'
import { useToast } from '../components/Toast'

const METHOD_LABELS = { bank_transfer:'Bank Transfer', mpesa:'M-Pesa', cash:'Cash', card:'Card' }
const EMPTY = { id:'', type:'income', date:'', client:'', amount:'', method:'bank_transfer', category:'services', notes:'' }

export default function Payments() {
  const toast = useToast()
  const [payments, setPayments] = useState([])
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    const added = DB.processRecurring()
    if (added > 0) toast(`${added} recurring transaction(s) auto-logged.`, 'info')
    setPayments(DB.getPayments())
  }, [])

  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const inp = (k) => ({ className:'form-control', value:form[k], onChange:e=>set(k,e.target.value) })

  function refresh() { setPayments(DB.getPayments()) }

  function openNew() {
    setForm({ ...EMPTY, date: new Date().toISOString().slice(0,10) })
    setModal(true)
  }

  function openEdit(id) {
    const p = DB.getPayment(id)
    if (p) { setForm({ ...EMPTY, ...p }); setModal(true) }
  }

  function save() {
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) { toast('Enter a valid amount.', 'error'); return }
    if (!form.date) { toast('Date is required.', 'error'); return }
    DB.savePayment({ ...form, id: form.id || DB.uuid(), amount })
    setModal(false)
    refresh()
    toast(form.id ? 'Transaction updated.' : 'Transaction recorded.', 'success')
  }

  function del(id) {
    if (!confirm('Delete this transaction? This cannot be undone.')) return
    DB.deletePayment(id)
    refresh()
    toast('Transaction deleted.', 'info')
  }

  function exportCSV() {
    DB.downloadCSV('payments-'+new Date().toISOString().slice(0,10)+'.csv', DB.getPayments(), ['date','client','notes','category','method','type','amount'])
    toast('CSV downloaded.', 'success')
  }

  const filtered = payments.filter(p => {
    const q = query.toLowerCase()
    return (!q || (p.client+p.notes+p.category).toLowerCase().includes(q))
        && (!typeFilter || p.type === typeFilter)
        && (!methodFilter || p.method === methodFilter)
  })

  const income  = payments.filter(p=>p.type==='income').reduce((s,p)=>s+Number(p.amount),0)
  const expense = payments.filter(p=>p.type==='expense').reduce((s,p)=>s+Number(p.amount),0)
  const net     = income - expense

  return (
    <>
      <header className="topbar">
        <div className="topbar-left"><h1>Payments</h1><p>Income and expense tracker</p></div>
        <div className="topbar-right">
          <button className="btn btn-outline btn-sm" onClick={exportCSV}>⬇ CSV</button>
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ Record Payment</button>
        </div>
      </header>
      <div className="page-body">
        <div className="kpi-grid" style={{marginBottom:20}}>
          <div className="kpi-card">
            <div className="kpi-icon green">💰</div>
            <div className="kpi-info"><div className="kpi-label">Total Income</div><div className="kpi-value">{DB.fmt(income)}</div></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon red">💸</div>
            <div className="kpi-info"><div className="kpi-label">Total Expenses</div><div className="kpi-value">{DB.fmt(expense)}</div></div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon blue">🏦</div>
            <div className="kpi-info">
              <div className="kpi-label">Net Balance</div>
              <div className="kpi-value" style={{color:net>=0?'var(--success)':'var(--danger)'}}>{DB.fmt(net)}</div>
            </div>
          </div>
        </div>

        <div className="filter-bar">
          <input className="search-input" placeholder="Search transactions…" value={query} onChange={e=>setQuery(e.target.value)} />
          <select className="filter-select" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select className="filter-select" value={methodFilter} onChange={e=>setMethodFilter(e.target.value)}>
            <option value="">All Methods</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="mpesa">M-Pesa</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
          <span style={{fontSize:13,color:'var(--text-secondary)'}}>{filtered.length} record(s)</span>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Client</th><th>Notes</th><th>Category</th><th>Method</th><th>Type</th><th>Amount</th><th>Auto</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan="9"><div className="empty-state"><div className="empty-icon">💳</div><h3>No transactions found</h3><p>Record your first income or expense.</p></div></td></tr>
                  : filtered.map(p => (
                    <tr key={p.id}>
                      <td>{DB.formatDate(p.date)}</td>
                      <td>{p.client || <span style={{color:'var(--text-muted)'}}>—</span>}</td>
                      <td>{p.notes || '—'}</td>
                      <td style={{textTransform:'capitalize'}}>{p.category || '—'}</td>
                      <td>{METHOD_LABELS[p.method] || p.method}</td>
                      <td><span className={`badge badge-${p.type}`}>{p.type}</span></td>
                      <td style={{fontWeight:600,color:p.type==='income'?'var(--success)':'var(--danger)'}}>
                        {p.type==='income'?'+':'-'}{DB.fmt(p.amount)}
                      </td>
                      <td>{p.recurringId ? <span className="badge" style={{background:'#ede9fe',color:'#6d28d9'}}>🔁</span> : ''}</td>
                      <td>
                        <div className="action-btns">
                          <button className="action-btn edit" onClick={()=>openEdit(p.id)}>✏️</button>
                          <button className="action-btn del"  onClick={()=>del(p.id)}>🗑️</button>
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
            <span className="modal-title">{form.id ? 'Edit Transaction' : 'Record Payment'}</span>
            <button className="modal-close" onClick={()=>setModal(false)}>×</button>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Type</label>
                <select {...inp('type')} className="form-control">
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Date *</label><input {...inp('date')} type="date" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Client / Vendor</label><input {...inp('client')} placeholder="Optional" /></div>
              <div className="form-group"><label className="form-label">Amount (pre-tax) *</label><input {...inp('amount')} type="number" min="0" step="0.01" /></div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select {...inp('method')} className="form-control">
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select {...inp('category')} className="form-control">
                  <option value="services">Services</option>
                  <option value="rent">Rent</option>
                  <option value="salaries">Salaries</option>
                  <option value="utilities">Utilities</option>
                  <option value="supplies">Supplies</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Notes</label><input {...inp('notes')} placeholder="Description" /></div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </>
  )
}
