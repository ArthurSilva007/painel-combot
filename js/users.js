(function() {
  if (!checkAuth()) return;
  loadProfile();
  loadUsers();

  document.getElementById('createUserForm').addEventListener('submit', createUser);
  document.getElementById('toggleCredsBtn').addEventListener('click', toggleCredsForm);

  function toggleCredsForm() {
    var section = document.getElementById('credsFormSection');
    var icon = document.getElementById('toggleCredsIcon');
    section.classList.toggle('open');
    if (icon) icon.setAttribute('data-lucide', section.classList.contains('open') ? 'chevron-up' : 'chevron-down');
    if (window.lucide) window.lucide.createIcons();
  }

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
        // Credenciais de marketplace só existem por cliente — usuários ADMIN
        // sem clientId não têm o que mostrar aqui.
        var credsBtn = (u.role === 'CLIENT' && u.clientId)
          ? '<button type="button" class="btn btn-outline btn-sm" data-creds-toggle="' + escapeHtml(u.clientId) + '"><i data-lucide="key-round" class="icon icon-sm"></i> Credenciais</button>'
          : '';
        return '<div class="card" style="margin-bottom:10px;">' +
          '<div class="channel-row" style="background:transparent;padding:0;margin:0;">' +
          '<span class="ch-status ' + (u.active ? 'on' : 'off') + '"></span>' +
          '<div class="ch-info">' +
          '<div class="ch-name">' + escapeHtml(u.username) + ' <span class="' + badgeClass + '" style="margin-left:6px;">' + escapeHtml(u.role) + '</span></div>' +
          '<div class="ch-id">Cliente: ' + escapeHtml(client) + ' &middot; Criado: ' + escapeHtml(createdAt) + '</div>' +
          '</div>' + credsBtn +
          '</div>' +
          (u.clientId ? '<div class="expand-form" id="creds-panel-' + escapeHtml(u.clientId) + '" data-loaded="0"></div>' : '') +
          '</div>';
      }).join('');
      if (window.lucide) window.lucide.createIcons();

      container.querySelectorAll('[data-creds-toggle]').forEach(function(btn) {
        btn.addEventListener('click', function() { toggleCredentialsPanel(this.getAttribute('data-creds-toggle')); });
      });
    } catch(e) {
      container.innerHTML = '<div class="empty-state is-error">Erro ao carregar: ' + escapeHtml(e.message) + '</div>';
    }
  }

  async function toggleCredentialsPanel(clientId) {
    var panel = document.getElementById('creds-panel-' + clientId);
    if (!panel) return;
    panel.classList.toggle('open');
    if (!panel.classList.contains('open')) return;
    if (panel.getAttribute('data-loaded') === '1') return; // já carregado, só reabrir

    panel.innerHTML = '<div class="skeleton" style="height:140px;"></div>';
    try {
      var creds = await API.get('/api/v1/admin/clients/' + clientId + '/credentials');
      panel.innerHTML = renderCredentialsForm(clientId, creds || {});
      panel.setAttribute('data-loaded', '1');
      wireCredentialsForm(panel, clientId);
      if (window.lucide) window.lucide.createIcons();
    } catch(e) {
      panel.innerHTML = '<div class="empty-state is-error">Erro ao carregar credenciais: ' + escapeHtml(e.message) + '</div>';
    }
  }

  function renderCredentialsForm(clientId, creds) {
    function val(v) { return v ? escapeHtml(v) : ''; }
    return '' +
      '<div style="display:flex;justify-content:flex-end;margin-bottom:10px;">' +
      '<button type="button" class="btn btn-outline btn-sm" data-toggle-visibility="' + clientId + '"><i data-lucide="eye" class="icon icon-sm"></i> Mostrar</button>' +
      '</div>' +
      '<div class="section-title" style="font-size:12px;"><i data-lucide="shopping-bag" class="icon icon-sm"></i> AliExpress</div>' +
      '<div class="form-group"><label>App Key</label><input type="text" data-cred="aeAppKey" value="' + val(creds.aeAppKey) + '"></div>' +
      '<div class="form-group"><label>App Secret</label><input type="password" data-cred="aeAppSecret" value="' + val(creds.aeAppSecret) + '"></div>' +
      '<div class="form-group"><label>Access Token</label><input type="password" data-cred="aeAccessToken" value="' + val(creds.aeAccessToken) + '"></div>' +
      '<div class="form-group"><label>Refresh Token</label><input type="password" data-cred="aeRefreshToken" value="' + val(creds.aeRefreshToken) + '"></div>' +
      '<div class="section-title" style="font-size:12px;margin-top:8px;"><i data-lucide="shopping-bag" class="icon icon-sm"></i> Shopee</div>' +
      '<div class="form-group"><label>Partner ID</label><input type="text" data-cred="shopeePartnerId" value="' + val(creds.shopeePartnerId) + '"></div>' +
      '<div class="form-group"><label>Partner Key</label><input type="password" data-cred="shopeePartnerKey" value="' + val(creds.shopeePartnerKey) + '"></div>' +
      '<button type="button" class="btn btn-sm" data-save-creds="' + clientId + '"><i data-lucide="save" class="icon icon-sm"></i> Salvar credenciais</button>';
  }

  function wireCredentialsForm(panel, clientId) {
    var visBtn = panel.querySelector('[data-toggle-visibility]');
    if (visBtn) {
      visBtn.addEventListener('click', function() {
        var showing = visBtn.getAttribute('data-showing') === '1';
        panel.querySelectorAll('input[data-cred]').forEach(function(input) {
          var isSecretField = ['aeAppSecret', 'aeAccessToken', 'aeRefreshToken', 'shopeePartnerKey'].indexOf(input.getAttribute('data-cred')) !== -1;
          if (isSecretField) input.type = showing ? 'password' : 'text';
        });
        visBtn.setAttribute('data-showing', showing ? '0' : '1');
        visBtn.innerHTML = showing
          ? '<i data-lucide="eye" class="icon icon-sm"></i> Mostrar'
          : '<i data-lucide="eye-off" class="icon icon-sm"></i> Ocultar';
        if (window.lucide) window.lucide.createIcons();
      });
    }

    var saveBtn = panel.querySelector('[data-save-creds]');
    if (saveBtn) {
      saveBtn.addEventListener('click', async function() {
        var payload = {};
        panel.querySelectorAll('input[data-cred]').forEach(function(input) {
          var v = input.value.trim();
          if (v) payload[input.getAttribute('data-cred')] = v;
        });
        saveBtn.disabled = true;
        try {
          await API.put('/api/v1/admin/clients/' + clientId + '/credentials', payload);
          showToast('Credenciais salvas', 'success');
        } catch(err) {
          showToast(err.message, 'error');
        } finally {
          saveBtn.disabled = false;
        }
      });
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
      var payload = {
        username: username, password: password, role: 'CLIENT',
        clientName: clientName, telegramChatId: tg, whatsappNumber: wa
      };
      // Credenciais de marketplace são opcionais — só manda o que foi preenchido.
      var credFields = ['aeAppKey', 'aeAppSecret', 'aeAccessToken', 'shopeePartnerId', 'shopeePartnerKey'];
      credFields.forEach(function(id) {
        var el = document.getElementById(id);
        if (el && el.value.trim()) payload[id] = el.value.trim();
      });
      var resp = await API.post('/api/v1/admin/users', payload);
      showToast('Cliente ' + (resp.clientName || username) + ' criado! Acesse com: ' + username + ' / ' + password, 'success');
      document.getElementById('createUserForm').reset();
      document.getElementById('credsFormSection').classList.remove('open');
      document.getElementById('toggleCredsIcon').setAttribute('data-lucide', 'chevron-down');
      loadUsers();
    } catch(err) {
      showToast(err.message, 'error');
    }
  }
})();
