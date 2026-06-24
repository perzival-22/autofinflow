import { useState } from 'react'
import DB from '../js/data'
import { useToast } from '../components/Toast'

export default function Settings() {
  const toast = useToast()
  const s0 = DB.getSettings()
  const [form, setForm] = useState({
    company: s0.company || '',
    tagline: s0.tagline || '',
    email: s0.email || '',
    phone: s0.phone || '',
    address: s0.address || '',
    currency: s0.currency || 'KES',
    vatRate: s0.vatRate ?? 16,
    paymentTerms: s0.paymentTerms || 30
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function save() {
    const s = DB.getSettings()
    Object.assign(s, { ...form, company: form.company || 'My Business', vatRate: parseFloat(form.vatRate)||0, paymentTerms: parseInt(form.paymentTerms)||30 })
    DB.saveSettings(s)
    toast('Settings saved.', 'success')
  }

  function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        DB.importBackup(ev.target.result)
        toast('Backup restored. Reloading…', 'success')
        setTimeout(() => location.reload(), 1500)
      } catch (err) {
        toast('Import failed: ' + err.message, 'error')
      }
    }
    reader.readAsText(file)
  }

  function reset() {
    if (!confirm('This will permanently delete ALL your data. Are you absolutely sure?')) return
    if (!confirm('Last chance — this cannot be undone. Reset everything?')) return
    ['aff_invoices','aff_payments','aff_clients','aff_recurring','aff_settings'].forEach(k => localStorage.removeItem(k))
    toast('All data cleared. Reloading…', 'info')
    setTimeout(() => location.reload(), 1500)
  }

  const inp = (k, extra={}) => ({ className: 'form-control', value: form[k], onChange: e => set(k, e.target.value), ...extra })

  return (
    <>
      <header className="topbar">
        <div className="topbar-left"><h1>Settings</h1><p>Business profile and preferences</p></div>
      </header>
      <div className="page-body">
        <div className="grid-2" style={{alignItems:'start'}}>
          <div className="card">
            <div className="card-header"><span className="card-title">Business Profile</span></div>
            <div className="card-body">
              <div className="form-group"><label className="form-label">Company Name</label><input {...inp('company')} placeholder="My Business" /></div>
              <div className="form-group"><label className="form-label">Tagline</label><input {...inp('tagline')} placeholder="Your business tagline" /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Email</label><input {...inp('email')} type="email" /></div>
                <div className="form-group"><label className="form-label">Phone</label><input {...inp('phone')} /></div>
              </div>
              <div className="form-group"><label className="form-label">Address</label><textarea {...inp('address')} className="form-control" rows={2} /></div>
              <button className="btn btn-primary" onClick={save}>Save Settings</button>
            </div>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            <div className="card">
              <div className="card-header"><span className="card-title">Financial Defaults</span></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select {...inp('currency')} className="form-control">
                    <option value="KES">KES — Kenyan Shilling</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="UGX">UGX — Uganda Shilling</option>
                    <option value="TZS">TZS — Tanzania Shilling</option>
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Default VAT Rate (%)</label><input {...inp('vatRate')} type="number" min="0" max="100" /></div>
                  <div className="form-group"><label className="form-label">Payment Terms (days)</label><input {...inp('paymentTerms')} type="number" min="1" /></div>
                </div>
                <button className="btn btn-primary" onClick={save}>Save</button>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Data Management</span></div>
              <div className="card-body" style={{display:'flex',flexDirection:'column',gap:12}}>
                <button className="btn btn-outline" onClick={DB.exportBackup}>⬇ Export Backup (.json)</button>
                <label className="btn btn-outline" style={{cursor:'pointer'}}>
                  ⬆ Import Backup
                  <input type="file" accept=".json" style={{display:'none'}} onChange={handleImport} />
                </label>
                <button className="btn btn-danger" onClick={reset}>🗑 Reset All Data</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
