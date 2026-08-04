(function() {
  if (!checkAuth()) return;

  var DEFAULT_TEMPLATE = '🔥 *{productName}*\n\n💰 De ~{originalPrice}~ por *{price}*\n📉 {discountPercent} de desconto\n🛒 Loja: {source}\n\n👉 {productUrl}';

  var PREVIEW_SAMPLE = {
    productName: 'Fone Bluetooth XYZ',
    price: formatCurrency(49.90),
    originalPrice: formatCurrency(89.90),
    discountPercent: formatPct(44.5),
    source: 'SHOPEE',
    productUrl: 'https://exemplo.com/produto-123'
  };

  document.addEventListener('DOMContentLoaded', async function() {
    await loadUserProfile();
    await loadProfile();
    await loadSettings();
    await loadCustomMessage();

    document.getElementById('passwordForm').addEventListener('submit', changePassword);
    document.getElementById('settingsForm').addEventListener('submit', saveSettings);

    var range = document.getElementById('minDiscountRange');
    var num = document.getElementById('minDiscountNum');
    if (range && num) {
      range.addEventListener('input', function() { num.value = this.value; });
      num.addEventListener('input', function() { range.value = this.value; });
    }

    setupCustomMessageControls();
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

  // --- Mensagem personalizada de notificação ---

  async function loadCustomMessage() {
    var toggle = document.getElementById('customMessageEnabled');
    var textarea = document.getElementById('customMessageTemplate');
    try {
      var s = await API.get('/api/v1/client/settings');
      var enabled = s && s['custom-message-enabled'] === 'true';
      var template = (s && s['custom-message-template']) || DEFAULT_TEMPLATE;
      toggle.checked = enabled;
      textarea.value = template;
    } catch(e) {
      textarea.value = DEFAULT_TEMPLATE;
    }
    applyCustomMessageVisibility();
    renderMessagePreview();
  }

  function applyCustomMessageVisibility() {
    var enabled = document.getElementById('customMessageEnabled').checked;
    document.getElementById('customMessageFields').style.display = enabled ? '' : 'none';
  }

  function renderMessagePreview() {
    var tpl = document.getElementById('customMessageTemplate').value || DEFAULT_TEMPLATE;
    var rendered = tpl.replace(/\{(\w+)\}/g, function(match, key) {
      return PREVIEW_SAMPLE.hasOwnProperty(key) ? PREVIEW_SAMPLE[key] : match;
    });
    document.getElementById('messagePreview').textContent = rendered;
  }

  function insertPlaceholder(token) {
    var textarea = document.getElementById('customMessageTemplate');
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var value = textarea.value;
    textarea.value = value.substring(0, start) + token + value.substring(end);
    var newPos = start + token.length;
    textarea.focus();
    textarea.setSelectionRange(newPos, newPos);
    renderMessagePreview();
  }

  function setupCustomMessageControls() {
    var toggle = document.getElementById('customMessageEnabled');
    toggle.addEventListener('change', applyCustomMessageVisibility);

    document.getElementById('customMessageTemplate').addEventListener('input', renderMessagePreview);

    document.querySelectorAll('[data-insert]').forEach(function(btn) {
      btn.addEventListener('click', function() { insertPlaceholder(this.getAttribute('data-insert')); });
    });

    document.getElementById('resetMessageBtn').addEventListener('click', function() {
      document.getElementById('customMessageTemplate').value = DEFAULT_TEMPLATE;
      renderMessagePreview();
    });

    document.getElementById('saveMessageBtn').addEventListener('click', saveCustomMessage);
  }

  async function saveCustomMessage() {
    var btn = document.getElementById('saveMessageBtn');
    var enabled = document.getElementById('customMessageEnabled').checked;
    var template = document.getElementById('customMessageTemplate').value.trim();
    if (enabled && !template) { showToast('Escreva um modelo de mensagem, ou desligue a personalização', 'error'); return; }

    btn.disabled = true;
    try {
      await API.put('/api/v1/client/settings', {
        'custom-message-enabled': enabled ? 'true' : 'false',
        'custom-message-template': template || DEFAULT_TEMPLATE
      });
      showToast('Mensagem de notificação salva!', 'success');
    } catch(err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
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
