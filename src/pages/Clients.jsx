import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DB from '../js/data'
import { useToast } from '../components/Toast'

const EMPTY = { id:'', name:'', email:'', phone:'', address:'', notes:'' }

export default function Clients() {
  const toast = useToast()
  const navigate = useNavigate()
  const [clients, setClients] = useState(DB.getClients())
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const set = (k,v) => setForm(f => ({...f,[k]:v}))
  const inp = (k) => ({ className:'form-control', value:form[k], onChange:e=>set(k,e.target.value) })

  function refresh() { setClients(DB.getClients()) }

  function openNew() { setForm(EMPTY); setModal(true) }
  function openEdit(id) { const c = DB.getClient(id); if(c) { setForm({...EMPTY,...c}); setModal(true) } }

  function save() {
    if (!form.name.trim()) { toast('Client name is required.','error'); return }
    DB.saveClient({ ...form, id: form.id || DB.uuid() })
    setModal(false)
    refresh()
    toast(form.id ? 'Client updated.' : 'Client added.','success')
  }

  function del(id) {
    if (!confirm('Delete this client? Their invoices and payments will remain.')) return
    DB.deleteClient(id)
    refresh()
    toast('Client deleted.','info')
  }

  const filtered = clients.filter(c =>
    !query || c.name.toLowerCase().includes(query.toLowerCase()) || (c.email||'').toLowerCase().includes(query.toLowerCase())
  )

  return (
    <>
      <header className="topbar">
        <div className="topbar-left"><h1>Clients</h1><p>Manage your client directory</p></div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ Add Client</button>
        </div>
      </header>
      <div className="page-body">
        <div className="filter-bar">
          <input className="search-input" placeholder="Search clients…" value={query} onChange={e=>setQuery(e.target.value)} />
          <span style={{fontSize:13,color:'var(--text-secondary)'}}>{filtered.length} client(s)</span>
        </div>
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Billed</th><th>Paid</th><th>Outstanding</th><th>Invoices</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan="8"><div className="empty-state"><div className="empty-icon">👥</div><h3>No clients yet</h3><p>Add your first client above.</p></div></td></tr>
                  : filtered.map(c => {
                      const st = DB.clientStats(c.name)
                      return (
                        <tr key={c.id}>
                          <td><strong>{c.name}</strong></td>
                          <td>{c.email || <span style={{color:'var(--text-muted)'}}>—</span>}</td>
                          <td>{c.phone || <span style={{color:'var(--text-muted)'}}>—</span>}</td>
                          <td>{DB.fmt(st.totalBilled)}</td>
                          <td style={{color:'var(--success)',fontWeight:500}}>{DB.fmt(st.totalPaid)}</td>
                          <td style={{color:st.outstanding>0?'var(--warning)':'var(--success)',fontWeight:500}}>{DB.fmt(st.outstanding)}</td>
                          <td>{st.invoiceCount}</td>
                          <td>
                            <div className="action-btns">
                              <button className="action-btn edit" title="Edit" onClick={()=>openEdit(c.id)}>✏️</button>
                              <button className="action-btn view" title="View Invoices" onClick={()=>navigate(`/invoices?client=${encodeURIComponent(c.name)}`)}>🧾</button>
                              <button className="action-btn del" title="Delete" onClick={()=>del(c.id)}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={`modal-overlay${modal?' open':''}`} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">{form.id ? 'Edit Client' : 'Add Client'}</span>
            <button className="modal-close" onClick={()=>setModal(false)}>×</button>
          </div>
          <div className="modal-body">
            <div className="form-group"><label className="form-label">Name *</label><input {...inp('name')} placeholder="Client or company name" /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Email</label><input {...inp('email')} type="email" /></div>
              <div className="form-group"><label className="form-label">Phone</label><input {...inp('phone')} /></div>
            </div>
            <div className="form-group"><label className="form-label">Address</label><textarea {...inp('address')} className="form-control" rows={2} /></div>
            <div className="form-group"><label className="form-label">Notes</label><textarea {...inp('notes')} className="form-control" rows={2} /></div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save Client</button>
          </div>
        </div>
      </div>
    </>
  )
}
