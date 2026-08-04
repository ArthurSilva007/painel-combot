(function() {
  if (!checkAuth()) return;
  loadProfile();
  loadUsers();

  document.getElementById('createUserForm').addEventListener('submit', createUser);

  async function loadProfile() {
    try {
      var user = await loadUserInfo();
      if (user) {
        var displayName = user.client ? user.client.name : user.username;
        document.getElementById('navUserName').textContent = displayName;
        document.getElementById('navUserInitial').textContent = displayName.charAt(0).toUpperCase();
        document.getElementById('navRole').textContent = user.role;
        if (user.role === 'ADMIN') {
          document.getElementById('adminNav').style.display = '';
        }
      }
    } catch(e) {}
  }

  async function loadUsers() {
    var container = document.getElementById('usersList');
    try {
      var users = await API.get('/api/v1/admin/users');
      if (!users || users.length === 0) {
        container.innerHTML = '<div class="empty-state"><i data-lucide="users" class="icon"></i>Nenhum usuário cadastrado</div>';
        if (window.lucide) window.lucide.createIcons();
        return;
      }
      container.innerHTML = users.map(function(u) {
        var badgeClass = u.role === 'ADMIN' ? 'badge-admin' : 'badge-pro';
        var client = u.clientName || 'Sem cliente';
        var createdAt = (u.createdAt || '-').substring(0, 10);
        return '<div class="card channel-row" style="margin-bottom:10px;">' +
          '<span class="ch-status ' + (u.active ? 'on' : 'off') + '"></span>' +
          '<div class="ch-info">' +
          '<div class="ch-name">' + escapeHtml(u.username) + ' <span class="' + badgeClass + '" style="margin-left:6px;">' + escapeHtml(u.role) + '</span></div>' +
          '<div class="ch-id">Cliente: ' + escapeHtml(client) + ' &middot; Criado: ' + escapeHtml(createdAt) + '</div>' +
          '</div></div>';
      }).join('');
      if (window.lucide) window.lucide.createIcons();
    } catch(e) {
      container.innerHTML = '<div class="empty-state is-error">Erro ao carregar: ' + escapeHtml(e.message) + '</div>';
    }
  }

  async function createUser(e) {
    e.preventDefault();
    var username = document.getElementById('newUsername').value.trim();
    var password = document.getElementById('newPassword').value;
    var clientName = document.getElementById('clientName').value.trim();
    var tg = document.getElementById('telegramChatId').value.trim();
    var wa = document.getElementById('whatsappNumber').value.trim();
    if (!username || password.length < 6) { showToast('Preencha email e senha com no mínimo 6 caracteres', 'error'); return; }
    try {
      var resp = await API.post('/api/v1/admin/users', {
        username: username, password: password, role: 'CLIENT',
        clientName: clientName, telegramChatId: tg, whatsappNumber: wa
      });
      showToast('Cliente ' + (resp.clientName || username) + ' criado! Acesse com: ' + username + ' / ' + password, 'success');
      document.getElementById('createUserForm').reset();
      loadUsers();
    } catch(err) {
      showToast(err.message, 'error');
    }
  }
})();
