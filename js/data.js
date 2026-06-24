/* ============================================
   AutoFinFlow - Data Layer v2
   localStorage CRUD + clients + recurring + backup
   ============================================ */

const DB = {
  INVOICES_KEY:   'aff_invoices',
  PAYMENTS_KEY:   'aff_payments',
  CLIENTS_KEY:    'aff_clients',
  SETTINGS_KEY:   'aff_settings',
  RECURRING_KEY:  'aff_recurring',

  // ---- Helpers ----
  uuid() {
    return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  },

  set(key, data) { localStorage.setItem(key, JSON.stringify(data)); },

  // ---- Settings ----
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem(DB.SETTINGS_KEY)) || DB._defaultSettings();
    } catch { return DB._defaultSettings(); }
  },

  _defaultSettings() {
    return { currency: 'KES', company: 'My Business', tagline: '', email: '', phone: '',
             address: '', vatRate: 16, paymentTerms: 30, seeded: false };
  },

  saveSettings(s) { localStorage.setItem(DB.SETTINGS_KEY, JSON.stringify(s)); },

  fmt(amount) {
    const s = DB.getSettings();
    return s.currency + ' ' + Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  isOverdue(dueDate, status) {
    if (status === 'paid') return false;
    return new Date(dueDate) < new Date();
  },

  // ---- Invoices CRUD ----
  getInvoices() { return DB.get(DB.INVOICES_KEY); },
  saveInvoice(inv) {
    const list = DB.getInvoices();
    const idx = list.findIndex(i => i.id === inv.id);
    if (idx >= 0) list[idx] = inv; else list.unshift(inv);
    DB.set(DB.INVOICES_KEY, list); return inv;
  },
  deleteInvoice(id) { DB.set(DB.INVOICES_KEY, DB.getInvoices().filter(i => i.id !== id)); },
  getInvoice(id) { return DB.getInvoices().find(i => i.id === id); },
  nextInvoiceNumber() {
    const nums = DB.getInvoices().map(i => parseInt((i.number||'INV-000').replace('INV-',''),10)).filter(n=>!isNaN(n));
    return 'INV-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3,'0');
  },

  // ---- Payments CRUD ----
  getPayments() { return DB.get(DB.PAYMENTS_KEY); },
  savePayment(p) {
    const list = DB.getPayments();
    const idx = list.findIndex(x => x.id === p.id);
    if (idx >= 0) list[idx] = p; else list.unshift(p);
    DB.set(DB.PAYMENTS_KEY, list); return p;
  },
  deletePayment(id) { DB.set(DB.PAYMENTS_KEY, DB.getPayments().filter(p => p.id !== id)); },
  getPayment(id) { return DB.getPayments().find(p => p.id === id); },

  // ---- Clients CRUD ----
  getClients() { return DB.get(DB.CLIENTS_KEY); },
  saveClient(c) {
    const list = DB.getClients();
    const idx = list.findIndex(x => x.id === c.id);
    if (idx >= 0) list[idx] = c; else list.unshift(c);
    DB.set(DB.CLIENTS_KEY, list); return c;
  },
  deleteClient(id) { DB.set(DB.CLIENTS_KEY, DB.getClients().filter(c => c.id !== id)); },
  getClient(id) { return DB.getClients().find(c => c.id === id); },

  // ---- Recurring Templates ----
  getRecurring() { return DB.get(DB.RECURRING_KEY); },
  saveRecurring(r) {
    const list = DB.getRecurring();
    const idx = list.findIndex(x => x.id === r.id);
    if (idx >= 0) list[idx] = r; else list.unshift(r);
    DB.set(DB.RECURRING_KEY, list); return r;
  },
  deleteRecurring(id) { DB.set(DB.RECURRING_KEY, DB.getRecurring().filter(r => r.id !== id)); },

  // ---- Auto-log recurring transactions ----
  processRecurring() {
    const templates = DB.getRecurring();
    const today = new Date(); today.setHours(0,0,0,0);
    let added = 0;
    templates.forEach(tmpl => {
      if (!tmpl.active) return;
      const lastRun = tmpl.lastRun ? new Date(tmpl.lastRun) : null;
      const next = DB._nextDue(tmpl.frequency, lastRun, new Date(tmpl.startDate));
      next.setHours(0,0,0,0);
      if (next <= today) {
        const payment = {
          id: DB.uuid(), type: tmpl.type, date: next.toISOString().slice(0,10),
          client: tmpl.client, amount: tmpl.amount, method: tmpl.method,
          category: tmpl.category, notes: tmpl.notes + ' (auto)', recurringId: tmpl.id
        };
        DB.savePayment(payment);
        tmpl.lastRun = next.toISOString().slice(0,10);
        DB.saveRecurring(tmpl);
        added++;
      }
    });
    return added;
  },

  _nextDue(frequency, lastRun, startDate) {
    const base = lastRun ? new Date(lastRun) : new Date(startDate);
    const next = new Date(base);
    if (frequency === 'weekly')  next.setDate(next.getDate() + 7);
    else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
    else if (frequency === 'yearly')  next.setFullYear(next.getFullYear() + 1);
    return next;
  },

  // ---- Client stats ----
  clientStats(clientName) {
    const invoices = DB.getInvoices().filter(i => i.client === clientName);
    const payments = DB.getPayments().filter(p => p.client === clientName && p.type === 'income');
    const totalBilled    = invoices.reduce((s,i) => s + Number(i.amount), 0);
    const totalPaid      = payments.reduce((s,p) => s + Number(p.amount), 0);
    const outstanding    = invoices.filter(i => i.status !== 'paid').reduce((s,i) => s + Number(i.amount), 0);
    return { totalBilled, totalPaid, outstanding, invoiceCount: invoices.length };
  },

  // ---- Aggregate Stats ----
  getStats() {
    const payments = DB.getPayments();
    const invoices = DB.getInvoices();
    const now = new Date();
    const m = now.getMonth(), y = now.getFullYear();
    const monthly = payments.filter(p => { const d=new Date(p.date); return d.getMonth()===m && d.getFullYear()===y; });
    const totalIncome  = monthly.filter(p=>p.type==='income').reduce((s,p)=>s+Number(p.amount),0);
    const totalExpense = monthly.filter(p=>p.type==='expense').reduce((s,p)=>s+Number(p.amount),0);
    const outstanding  = invoices.filter(i=>i.status==='pending'||i.status==='overdue').reduce((s,i)=>s+Number(i.amount),0);
    const overdueCount = invoices.filter(i=>DB.isOverdue(i.dueDate,i.status)).length;
    return { totalIncome, totalExpense, netFlow: totalIncome-totalExpense, outstanding, overdueCount, invoiceCount: invoices.length };
  },

  // ---- Cash Flow Forecast ----
  getForecast(days = 90) {
    const today = new Date(); today.setHours(0,0,0,0);
    const end   = new Date(today); end.setDate(end.getDate() + days);
    const events = [];

    // Pending invoices due within window
    DB.getInvoices().filter(i => i.status !== 'paid' && i.status !== 'draft').forEach(inv => {
      const due = new Date(inv.dueDate); due.setHours(0,0,0,0);
      if (due >= today && due <= end) {
        events.push({ date: inv.dueDate, label: `Invoice ${inv.number} (${inv.client})`, amount: Number(inv.amount), type: 'income' });
      }
    });

    // Recurring templates projecting forward
    DB.getRecurring().filter(r => r.active).forEach(tmpl => {
      const lastRun = tmpl.lastRun ? new Date(tmpl.lastRun) : null;
      let next = DB._nextDue(tmpl.frequency, lastRun, new Date(tmpl.startDate));
      for (let i = 0; i < 52; i++) {
        next.setHours(0,0,0,0);
        if (next > end) break;
        if (next >= today) {
          events.push({ date: next.toISOString().slice(0,10), label: tmpl.notes || tmpl.category, amount: Number(tmpl.amount), type: tmpl.type });
        }
        next = DB._nextDue(tmpl.frequency, new Date(next), new Date(tmpl.startDate));
      }
    });

    events.sort((a,b) => new Date(a.date) - new Date(b.date));

    // Running balance from today's net
    const allPay  = DB.getPayments();
    let balance   = allPay.filter(p=>p.type==='income').reduce((s,p)=>s+Number(p.amount),0)
                  - allPay.filter(p=>p.type==='expense').reduce((s,p)=>s+Number(p.amount),0);

    return events.map(e => {
      balance += e.type === 'income' ? e.amount : -e.amount;
      return { ...e, runningBalance: balance };
    });
  },

  // ---- CSV Export ----
  toCSV(rows, headers) {
    const escape = v => `"${String(v==null?'':v).replace(/"/g,'""')}"`;
    return [headers.map(escape).join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
  },

  downloadCSV(filename, rows, headers) {
    const blob = new Blob([DB.toCSV(rows, headers)], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  },

  // ---- Backup & Restore ----
  exportBackup() {
    const data = {
      version: 2, exportedAt: new Date().toISOString(),
      invoices:  DB.getInvoices(),
      payments:  DB.getPayments(),
      clients:   DB.getClients(),
      recurring: DB.getRecurring(),
      settings:  DB.getSettings()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'autofinflow-backup-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
  },

  importBackup(jsonStr) {
    const data = JSON.parse(jsonStr);
    if (!data.version || !data.invoices) throw new Error('Invalid backup file.');
    DB.set(DB.INVOICES_KEY,  data.invoices  || []);
    DB.set(DB.PAYMENTS_KEY,  data.payments  || []);
    DB.set(DB.CLIENTS_KEY,   data.clients   || []);
    DB.set(DB.RECURRING_KEY, data.recurring || []);
    if (data.settings) {
      data.settings.seeded = true;
      DB.saveSettings(data.settings);
    }
  },

  // ---- Seed Data ----
  seed() {
    const s = DB.getSettings();
    if (s.seeded) return;
    const d = (offset) => { const x=new Date(); x.setDate(x.getDate()+offset); return x.toISOString().slice(0,10); };

    const clients = [
      { id: DB.uuid(), name: 'Safaricom Ltd',  email: 'ap@safaricom.co.ke', phone: '+254711000000', address: 'Westlands, Nairobi' },
      { id: DB.uuid(), name: 'KCB Bank Group', email: 'ap@kcb.co.ke',       phone: '+254711100000', address: 'Upper Hill, Nairobi' },
      { id: DB.uuid(), name: 'Equity Bank',    email: 'ap@equitybank.co.ke',phone: '+254711200000', address: 'Upperhill, Nairobi' },
      { id: DB.uuid(), name: 'Nairobi County', email: 'finance@nairobi.go.ke',phone: '+254202228000', address: 'City Hall, Nairobi' },
      { id: DB.uuid(), name: 'Bolt Kenya',     email: 'billing@bolt.eu',    phone: '+254711300000', address: 'Karen, Nairobi' },
    ];

    const invoices = [
      { id:DB.uuid(),number:'INV-001',client:'Safaricom Ltd', amount:120000,taxRate:16,taxAmount:19354,subtotal:100646,date:d(-20),dueDate:d(-5), status:'overdue', notes:'Consulting Services',items:[{description:'Consulting Services',quantity:1,rate:100646,amount:100646}] },
      { id:DB.uuid(),number:'INV-002',client:'KCB Bank Group',amount:85000, taxRate:16,taxAmount:11724,subtotal:73276, date:d(-10),dueDate:d(20),status:'pending', notes:'Web Development',   items:[{description:'Web Development',quantity:1,rate:73276,amount:73276}] },
      { id:DB.uuid(),number:'INV-003',client:'Equity Bank',   amount:55000, taxRate:16,taxAmount:7586, subtotal:47414, date:d(-15),dueDate:d(-2),status:'paid',    notes:'IT Support',        items:[{description:'IT Support',quantity:1,rate:47414,amount:47414}] },
      { id:DB.uuid(),number:'INV-004',client:'Nairobi County',amount:200000,taxRate:16,taxAmount:27586,subtotal:172414,date:d(-5), dueDate:d(25),status:'pending', notes:'Software License',  items:[{description:'Software License',quantity:1,rate:172414,amount:172414}] },
      { id:DB.uuid(),number:'INV-005',client:'Bolt Kenya',    amount:30000, taxRate:16,taxAmount:4138, subtotal:25862, date:d(-3), dueDate:d(27),status:'draft',   notes:'Design Services',   items:[{description:'Design Services',quantity:1,rate:25862,amount:25862}] },
    ];

    const payments = [
      { id:DB.uuid(),client:'Equity Bank',   amount:55000,date:d(-2), type:'income', method:'bank_transfer',category:'services', notes:'INV-003 payment' },
      { id:DB.uuid(),client:'',              amount:25000,date:d(-3), type:'expense',method:'bank_transfer',category:'rent',     notes:'Office rent' },
      { id:DB.uuid(),client:'Airtel Kenya',  amount:12000,date:d(-5), type:'income', method:'mpesa',        category:'services', notes:'Ad-hoc project' },
      { id:DB.uuid(),client:'',              amount:8500, date:d(-6), type:'expense',method:'cash',         category:'supplies', notes:'Office supplies' },
      { id:DB.uuid(),client:'Twiga Foods',   amount:40000,date:d(-8), type:'income', method:'bank_transfer',category:'services', notes:'Monthly retainer' },
      { id:DB.uuid(),client:'',              amount:15000,date:d(-10),type:'expense',method:'bank_transfer',category:'salaries', notes:'Staff wages' },
      { id:DB.uuid(),client:'',             amount:3200, date:d(-12),type:'expense',method:'mpesa',        category:'utilities',notes:'Electricity - KPLC' },
      { id:DB.uuid(),client:'',              amount:2100, date:d(-14),type:'expense',method:'mpesa',        category:'utilities',notes:'Water bill' },
    ];

    const recurring = [
      { id:DB.uuid(),type:'expense',client:'',amount:25000,method:'bank_transfer',category:'rent',    notes:'Office rent',    frequency:'monthly',startDate:d(-30),lastRun:d(-3), active:true },
      { id:DB.uuid(),type:'expense',client:'',amount:15000,method:'bank_transfer',category:'salaries',notes:'Staff wages',    frequency:'monthly',startDate:d(-30),lastRun:d(-10),active:true },
      { id:DB.uuid(),type:'income', client:'Twiga Foods',amount:40000,method:'bank_transfer',category:'services',notes:'Twiga retainer',frequency:'monthly',startDate:d(-60),lastRun:d(-8),active:true },
    ];

    DB.set(DB.CLIENTS_KEY,   clients);
    DB.set(DB.INVOICES_KEY,  invoices);
    DB.set(DB.PAYMENTS_KEY,  payments);
    DB.set(DB.RECURRING_KEY, recurring);
    s.seeded = true;
    DB.saveSettings(s);
  }
};

DB.seed();
DB.processRecurring();
