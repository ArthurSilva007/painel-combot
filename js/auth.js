async function login(username, password) {
  const data = await API.post('/api/auth/login', { username, password });
  localStorage.setItem('token', data.accessToken || data.token);
  // data.clientId pode vir null (ex: ADMIN sem cliente associado). Sem este
  // fallback, localStorage.setItem grava a STRING "null", que é "verdadeira"
  // pro JS e passa por checagens tipo `if (!cid)` — causando chamadas do tipo
  // /api/v1/clients/null/channels (400).
  localStorage.setItem('clientId', data.clientId || '');
  localStorage.setItem('username', data.username);
  localStorage.setItem('role', data.role);
  localStorage.setItem('userId', data.userId);
  return data;
}

async function loadUserInfo() {
  try { return await API.get('/api/auth/me'); }
  catch { return null; }
}

function logout() { localStorage.clear(); window.location.href = 'index.html'; }

function checkAuth() {
  if (!localStorage.getItem('token')) { window.location.href = 'index.html'; return false; }
  return true;
}

function showToast(msg, type) {
  type = type || 'success';
  var icons = { success:'circle-check', error:'circle-x', warning:'triangle-alert' };
  let c = document.querySelector('.toast-container');
  if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  var icon = document.createElement('i');
  icon.setAttribute('data-lucide', icons[type] || 'info');
  icon.className = 'icon';
  var text = document.createElement('span');
  text.textContent = msg; // textContent = sempre seguro contra XSS
  t.appendChild(icon); t.appendChild(text);
  c.appendChild(t);
  if (window.lucide) window.lucide.createIcons();
  setTimeout(function() { t.remove(); }, 4000);
}

// Escapa HTML antes de injetar dados vindos da API em innerHTML (evita XSS
// caso um nome de produto/canal raspado contenha marcação maliciosa).
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(v) { return Number(v).toFixed(1) + '%'; }

function formatTrend(v) {
  if (v === 0) return '<span class="trend-up">0,0%</span>';
  var cls = v > 0 ? 'trend-up' : 'trend-down';
  var icon = v > 0 ? 'trending-up' : 'trending-down';
  return '<span class="' + cls + '"><i data-lucide="' + icon + '" class="icon icon-sm"></i> ' + Math.abs(v).toFixed(1) + '%</span>';
}

function resolveClientId() { return localStorage.getItem('clientId'); }

function resolveUserId() { return localStorage.getItem('userId'); }
