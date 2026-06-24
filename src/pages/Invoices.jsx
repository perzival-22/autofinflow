import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import DB from '../js/data'
import { useToast } from '../components/Toast'

const EMPTY_FORM = { id:'', number:'', client:'', date:'', dueDate:'', subtotal:'', vatRate:16, vatAmt:'', amount:'', status:'pending', notes:'' }

export default function Invoices() {
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [invoices, setInvoices] = useState([])
  const [query, setQuery] = useState(searchParams.get('client') || '')
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => { setInvoices(DB.getInvoices()) }, [])

  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const inp = (k, extra={}) => ({ className:'form-control', value:form[k], onChange:e=>set(k,e.target.value), ...extra })

  function calcVAT(sub, rate) {
    const s = parseFloat(sub)||0, r = parseFloat(rate)||0
    const vatAmt = s*(r/100)
    setForm(f => ({...f, vatAmt: vatAmt.toFixed(2), amount: (s+vatAmt).toFixed(2)}))
  }

  function refresh() { setInvoices(DB.getInvoices()) }

  function openNew() {
    const s = DB.getSettings()
    const today = new Date().toISOString().slice(0,10)
    const due   = new Date(Date.now()+(s.paymentTerms||30)*86400000).toISOString().slice(0,10)
    setForm({ ...EMPTY_FORM, number: DB.nextInvoiceNumber(), date: today, dueDate: due, vatRate: s.vatRate||16 })
    setModal(true)
  }

  function openEdit(id) {
    const inv = DB.getInvoice(id)
    if (!inv) return
    const s = DB.getSettings()
    setForm({
      id: inv.id, number: inv.number, client: inv.client, date: inv.date, dueDate: inv.dueDate,
      subtotal: inv.subtotal||inv.amount, vatRate: inv.taxRate??s.vatRate,
      vatAmt: (inv.taxAmount||0).toFixed(2), amount: Number(inv.amount).toFixed(2),
      status: inv.status, notes: inv.notes||''
    })
    setModal(true)
  }

  function save() {
    if (!form.client.trim()) { toast('Client name is required.','error'); return }
    const sub = parseFloat(form.subtotal)
    if (!sub || sub <= 0) { toast('Enter a valid subtotal.','error'); return }
    if (!form.date || !form.dueDate) { toast('Both dates are required.','error'); return }
    const vatRate = parseFloat(form.vatRate)||0
    const taxAmount = sub*(vatRate/100)
    const total = sub+taxAmount
    DB.saveInvoice({
      id: form.id||DB.uuid(), number: form.number||DB.nextInvoiceNumber(),
      client: form.client.trim(), subtotal:sub, taxRate:vatRate, taxAmount, amount:total,
      date:form.date, dueDate:form.dueDate, status:form.status, notes:form.notes.trim(),
      items:[{description:form.notes.trim()||'Services',quantity:1,rate:sub,amount:sub}]
    })
    setModal(false)
    refresh()
    toast(form.id ? 'Invoice updated.' : 'Invoice created.','success')
  }

  function del(id) {
    if (!confirm('Delete this invoice? This cannot be undone.')) return
    DB.deleteInvoice(id); refresh(); toast('Invoice deleted.','info')
  }

  function markPaid(id) {
    const inv = DB.getInvoice(id)
    if (!inv) return
    inv.status = 'paid'; DB.saveInvoice(inv); refresh(); toast('Invoice marked as paid.','success')
  }

  function exportPDF(id) {
    const inv = DB.getInvoice(id)
    if (!inv) return
    const s = DB.getSettings()
    const doc = new jsPDF({ unit:'mm', format:'a4' })
    const W = 210, margin = 20
    let y = 20

    doc.setFillColor(26,86,219); doc.rect(0,0,W,45,'F')
    doc.setTextColor(255,255,255); doc.setFontSize(22); doc.setFont('helvetica','bold')
    doc.text(s.company||'My Business', margin, 20)
    doc.setFontSize(10); doc.setFont('helvetica','normal')
    if(s.tagline) doc.text(s.tagline, margin, 27)
    if(s.email)   doc.text(s.email,   margin, 33)
    if(s.phone)   doc.text(s.phone,   margin, 39)
    doc.setFontSize(28); doc.setFont('helvetica','bold')
    doc.text('INVOICE', W-margin, 20, {align:'right'})
    doc.setFontSize(11); doc.setFont('helvetica','normal')
    doc.text(inv.number, W-margin, 30, {align:'right'})
    doc.text('Date: '+DB.formatDate(inv.date),    W-margin, 37, {align:'right'})
    doc.text('Due:  '+DB.formatDate(inv.dueDate), W-margin, 44, {align:'right'})

    y = 60; doc.setTextColor(15,23,42)
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.text('BILL TO', margin, y)
    doc.setFont('helvetica','normal'); doc.setFontSize(12); doc.text(inv.client, margin, y+7); y+=22

    const statusColor = inv.status==='paid'?[16,185,129]:inv.status==='overdue'?[239,68,68]:[245,158,11]
    doc.setFillColor(...statusColor); doc.roundedRect(margin, y, 30, 8, 2, 2, 'F')
    doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold')
    doc.text(inv.status.toUpperCase(), margin+15, y+5.5, {align:'center'}); y+=16

    doc.setTextColor(15,23,42); doc.setFillColor(241,245,249); doc.rect(margin, y, W-2*margin, 9, 'F')
    doc.setFontSize(9); doc.setFont('helvetica','bold')
    doc.text('Description', margin+2, y+6); doc.text('Qty',130,y+6); doc.text('Rate',155,y+6); doc.text('Amount',W-margin,y+6,{align:'right'})
    y+=11; doc.setFont('helvetica','normal'); doc.setFontSize(10)
    const items = inv.items?.length ? inv.items : [{description:inv.notes||'Services',quantity:1,rate:inv.subtotal||inv.amount,amount:inv.subtotal||inv.amount}]
    items.forEach(item => {
      doc.text(item.description||'', margin+2, y+4)
      doc.text(String(item.quantity||1), 130, y+4)
      doc.text(DB.fmt(item.rate||0), 155, y+4)
      doc.text(DB.fmt(item.amount||0), W-margin, y+4, {align:'right'})
      doc.setDrawColor(226,232,240); doc.line(margin,y+7,W-margin,y+7); y+=9
    })

    y+=5
    const drawRow=(label,val,bold=false)=>{ if(bold){doc.setFont('helvetica','bold');doc.setFontSize(11)}else{doc.setFont('helvetica','normal');doc.setFontSize(10)}; doc.text(label,140,y); doc.text(val,W-margin,y,{align:'right'}); y+=7 }
    drawRow('Subtotal:', DB.fmt(inv.subtotal||inv.amount))
    drawRow(`VAT (${inv.taxRate||0}%):`, DB.fmt(inv.taxAmount||0))
    doc.setDrawColor(26,86,219); doc.line(130,y-1,W-margin,y-1)
    drawRow('TOTAL:', DB.fmt(inv.amount), true)

    if(inv.notes){y+=6;doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(100,116,139);doc.text('NOTES',margin,y);doc.setFont('helvetica','normal');doc.setTextColor(15,23,42);doc.text(inv.notes,margin,y+5)}
    doc.setFontSize(8);doc.setTextColor(148,163,184);doc.text('Generated by AutoFinFlow · '+new Date().toLocaleDateString(),W/2,285,{align:'center'})
    doc.save(`${inv.number}-${inv.client.replace(/\s+/g,'-')}.pdf`)
    toast('PDF downloaded.','success')
  }

  function exportCSV() {
    const rows = DB.getInvoices().map(inv=>({
      number:inv.number,client:inv.client,date:inv.date,dueDate:inv.dueDate,
      subtotal:inv.subtotal||inv.amount,vatRate:inv.taxRate||0,vatAmount:inv.taxAmount||0,
      total:inv.amount,status:DB.isOverdue(inv.dueDate,inv.status)&&inv.status!=='paid'?'overdue':inv.status,notes:inv.notes||''
    }))
    DB.downloadCSV('invoices-'+new Date().toISOString().slice(0,10)+'.csv', rows, ['number','client','date','dueDate','subtotal','vatRate','vatAmount','total','status','notes'])
    toast('CSV downloaded.','success')
  }

  const filtered = invoices.map(inv=>({...inv, _st: DB.isOverdue(inv.dueDate,inv.status)&&inv.status!=='paid'?'overdue':inv.status}))
    .filter(inv=>(!query||inv.client.toLowerCase().includes(query.toLowerCase())||inv.number.toLowerCase().includes(query.toLowerCase()))
             &&(!statusFilter||inv._st===statusFilter))

  return (
    <>
      <header className="topbar">
        <div className="topbar-left"><h1>Invoices</h1><p>Create and manage invoices</p></div>
        <div className="topbar-right">
          <button className="btn btn-outline btn-sm" onClick={exportCSV}>⬇ CSV</button>
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ New Invoice</button>
        </div>
      </header>
      <div className="page-body">
        <div className="filter-bar">
          <input className="search-input" placeholder="Search invoices…" value={query} onChange={e=>setQuery(e.target.value)} />
          <select className="filter-select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="draft">Draft</option>
          </select>
          <span style={{fontSize:13,color:'var(--text-secondary)'}}>{filtered.length} invoice(s)</span>
        </div>
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Number</th><th>Client</th><th>Date</th><th>Due</th><th>Subtotal</th><th>VAT</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.length===0
                  ? <tr><td colSpan="9"><div className="empty-state"><div className="empty-icon">🧾</div><h3>No invoices found</h3><p>Create your first invoice.</p></div></td></tr>
                  : filtered.map(inv=>(
                    <tr key={inv.id}>
                      <td><strong>{inv.number}</strong></td>
                      <td>{inv.client}</td>
                      <td>{DB.formatDate(inv.date)}</td>
                      <td>{DB.formatDate(inv.dueDate)}</td>
                      <td>{DB.fmt(inv.subtotal||inv.amount)}</td>
                      <td>{DB.fmt(inv.taxAmount||0)}</td>
                      <td><strong>{DB.fmt(inv.amount)}</strong></td>
                      <td><span className={`badge badge-${inv._st}`}>{inv._st}</span></td>
                      <td>
                        <div className="action-btns">
                          <button className="action-btn edit" title="Edit"   onClick={()=>openEdit(inv.id)}>✏️</button>
                          <button className="action-btn view" title="PDF"    onClick={()=>exportPDF(inv.id)}>📄</button>
                          <button className="action-btn del"  title="Delete" onClick={()=>del(inv.id)}>🗑️</button>
                          {inv._st!=='paid'&&<button className="action-btn view" title="Mark Paid" style={{background:'#dcfce7',color:'#15803d'}} onClick={()=>markPaid(inv.id)}>✅</button>}
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
            <span className="modal-title">{form.id?'Edit Invoice':'New Invoice'}</span>
            <button className="modal-close" onClick={()=>setModal(false)}>×</button>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group"><label className="form-label">Invoice #</label><input {...inp('number')} /></div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select {...inp('status')} className="form-control">
                  <option value="pending">Pending</option><option value="paid">Paid</option>
                  <option value="overdue">Overdue</option><option value="draft">Draft</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Client *</label><input {...inp('client')} placeholder="Client name" /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Date *</label><input {...inp('date')} type="date" /></div>
              <div className="form-group"><label className="form-label">Due Date *</label><input {...inp('dueDate')} type="date" /></div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Subtotal (excl. VAT) *</label>
                <input {...inp('subtotal')} type="number" min="0" step="0.01"
                  onChange={e=>{set('subtotal',e.target.value);calcVAT(e.target.value,form.vatRate)}} />
              </div>
              <div className="form-group">
                <label className="form-label">VAT Rate (%)</label>
                <input {...inp('vatRate')} type="number" min="0"
                  onChange={e=>{set('vatRate',e.target.value);calcVAT(form.subtotal,e.target.value)}} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">VAT Amount</label><input className="form-control" value={form.vatAmt} readOnly /></div>
              <div className="form-group"><label className="form-label">Total</label><input className="form-control" value={form.amount} readOnly /></div>
            </div>
            <div className="form-group"><label className="form-label">Notes</label><textarea {...inp('notes')} className="form-control" /></div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={()=>setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save Invoice</button>
          </div>
        </div>
      </div>
    </>
  )
}
