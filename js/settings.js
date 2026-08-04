(function() {
  if (!checkAuth()) return;

  document.addEventListener('DOMContentLoaded', async function() {
    await loadUserProfile();
    await loadProfile();
    await loadSettings();

    document.getElementById('passwordForm').addEventListener('submit', changePassword);
    document.getElementById('settingsForm').addEventListener('submit', saveSettings);

    var range = document.getElementById('minDiscountRange');
    var num = document.getElementById('minDiscountNum');
    if (range && num) {
      range.addEventListener('input', function() { num.value = this.value; });
      num.addEventListener('input', function() { range.value = this.value; });
    }
  });

  async function loadUserProfile() {
    try {
      var user = await loadUserInfo();
      if (user) {
        var name = (user.client && user.client.name) || user.username || 'Cliente';
        document.getElementById('navUserName').textContent = name; document.getElementById('navUserName').title = name;
        document.getElementById('navUserInitial').textContent = name.charAt(0).toUpperCase();
        applyAdminNav(user);
      }
    } catch(e) {}
  }

  async function loadProfile() {
    try {
      var user = await API.get('/api/auth/me');
      if (user && user.client) {
        document.getElementById('profileName').textContent = user.client.name || '-';
        document.getElementById('profileEmail').textContent = user.client.email || '-';
      }
    } catch(e) {
      document.getElementById('profileName').textContent = 'Erro';
      document.getElementById('profileEmail').textContent = 'Erro';
    }
  }

  async function loadSettings() {
    try {
      var s = await API.get('/api/v1/client/settings');
      if (s) {
        var kw = s['aliexpress-keywords'] || '';
        document.getElementById('keywordsInput').value = kw.replace(/,/g, '\n');
        document.getElementById('minDiscountNum').value = s['min-discount'] || 10;
        document.getElementById('minDiscountRange').value = s['min-discount'] || 10;
        document.getElementById('cooldownInput').value = s['cooldown-minutes'] || 60;
      }
    } catch(e) {}
  }

  async function changePassword(e) {
    e.preventDefault();
    var current = document.getElementById('currentPassword').value;
    var newP = document.getElementById('newPassword').value;
    var confirm = document.getElementById('confirmPassword').value;
    if (!current || !newP || !confirm) { showToast('Preencha todos os campos', 'error'); return; }
    if (newP.length < 6) { showToast('Nova senha deve ter no mínimo 6 caracteres', 'error'); return; }
    if (newP !== confirm) { showToast('Senhas não conferem', 'error'); return; }

    var btn = document.getElementById('passwordBtn');
    btn.disabled = true;
    try {
      await API.post('/api/auth/change-password', { currentPassword: current, newPassword: newP });
      showToast('Senha alterada com sucesso!', 'success');
      document.getElementById('passwordForm').reset();
    } catch(err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  async function saveSettings(e) {
    e.preventDefault();
    var keywords = document.getElementById('keywordsInput').value
      .split('\n').map(function(k) { return k.trim(); }).filter(function(k) { return k; }).join(',');
    var minDiscount = document.getElementById('minDiscountNum').value;
    var cooldown = document.getElementById('cooldownInput').value;

    var btn = document.getElementById('settingsBtn');
    btn.disabled = true;
    try {
      await API.put('/api/v1/client/settings', {
        'aliexpress-keywords': keywords,
        'min-discount': minDiscount,
        'cooldown-minutes': cooldown
      });
      showToast('Configurações salvas!', 'success');
    } catch(err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }
})();
