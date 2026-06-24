/* ============================================
   AutoFinFlow - Settings Logic
   ============================================ */

function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function loadSettings() {
  const s = DB.getSettings();
  document.getElementById('sCompany').value  = s.company  || '';
  document.getElementById('sTagline').value  = s.tagline  || '';
  document.getElementById('sEmail').value    = s.email    || '';
  document.getElementById('sPhone').value    = s.phone    || '';
  document.getElementById('sAddress').value  = s.address  || '';
  document.getElementById('sCurrency').value = s.currency || 'KES';
  document.getElementById('sVat').value      = s.vatRate  != null ? s.vatRate : 16;
  document.getElementById('sTerms').value    = s.paymentTerms || 30;
}

function saveSettings() {
  const s = DB.getSettings();
  s.company      = document.getElementById('sCompany').value.trim() || 'My Business';
  s.tagline      = document.getElementById('sTagline').value.trim();
  s.email        = document.getElementById('sEmail').value.trim();
  s.phone        = document.getElementById('sPhone').value.trim();
  s.address      = document.getElementById('sAddress').value.trim();
  s.currency     = document.getElementById('sCurrency').value;
  s.vatRate      = parseFloat(document.getElementById('sVat').value) || 0;
  s.paymentTerms = parseInt(document.getElementById('sTerms').value) || 30;
  DB.saveSettings(s);
  toast('Settings saved.', 'success');
}

function importBackup(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      DB.importBackup(e.target.result);
      toast('Backup restored successfully. Reloading…', 'success');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      toast('Import failed: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function resetData() {
  if (!confirm('This will permanently delete ALL your data. Are you absolutely sure?')) return;
  if (!confirm('Last chance — this cannot be undone. Reset everything?')) return;
  ['aff_invoices','aff_payments','aff_clients','aff_recurring','aff_settings'].forEach(k => localStorage.removeItem(k));
  toast('All data cleared. Reloading…', 'info');
  setTimeout(() => location.reload(), 1500);
}

document.addEventListener('DOMContentLoaded', loadSettings);
