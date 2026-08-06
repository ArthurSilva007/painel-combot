(function() {
  if (!checkAuth()) return;

  var PRESETS = [
    { id: 'chamativo', label: '🔥 Chamativo', template: '🔥 *{productName}*\n\n💰 De ~{originalPrice}~ por *{price}*\n📉 {discountPercent} de desconto\n🛒 Loja: {source}\n\n👉 {productUrl}' },
    { id: 'direto', label: '📦 Direto ao ponto', template: '{productName}\n\n{price} — {discountPercent} de desconto\n\n{productUrl}' },
    { id: 'conversa', label: '💬 Estilo conversa', template: 'Olha essa oferta: *{productName}*\nDe {originalPrice} por apenas {price} ({discountPercent} OFF)!\n{productUrl}' }
  ];
  var CUSTOM_ID = 'custom';
  var DEFAULT_TEMPLATE = PRESETS[0].template;
  var selectedPresetId = PRESETS[0].id;

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
    renderPresetList();
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
        document.getElementById('navUserName').textContent = name;
        document.getElementById('navUserName').title = name;
        document.getElementById('navUserInitial').textContent = name.charAt(0).toUpperCase();
        applyAdminNav(user);
      }
    } catch (e) {}
  }

  async function loadProfile() {
    try {
      var user = await API.get('/api/auth/me');
      if (user && user.client) {
        document.getElementById('profileName').textContent = user.client.name || '-';
        document.getElementById('profileEmail').textContent = user.client.email || '-';
      }
    } catch (e) {
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
    } catch (e) {}
  }

  function renderPresetList() {
    var list = document.getElementById('presetList');
    if (!list) return;

    var options = PRESETS.concat([{ id: CUSTOM_ID, label: '✏️ Escrever a minha própria mensagem', template: null }]);
    list.innerHTML = options.map(function(opt) {
      var sample = opt.template ? applyTemplate(opt.template) : 'Você escreve o texto e escolhe onde entram o nome do produto, o preço, etc.';
      return '' +
        '<label class="preset-card" data-preset-id="' + opt.id + '">' +
        '<input type="radio" name="messagePreset" value="' + opt.id + '">' +
        '<div><div class="preset-title">' + opt.label + '</div>' +
        '<div class="preset-sample">' + escapeHtml(sample) + '</div></div>' +
        '</label>';
    }).join('');

    list.querySelectorAll('.preset-card').forEach(function(card) {
      card.addEventListener('click', function() {
        selectPreset(card.getAttribute('data-preset-id'));
      });
    });

    list.querySelectorAll('input[type="radio"]').forEach(function(input) {
      input.addEventListener('change', function() {
        selectPreset(this.value);
      });
    });
  }

  function selectPreset(id) {
    selectedPresetId = id;
    document.querySelectorAll('.preset-card').forEach(function(card) {
      var isSelected = card.getAttribute('data-preset-id') === id;
      card.classList.toggle('selected', isSelected);
      var radio = card.querySelector('input');
      if (radio) radio.checked = isSelected;
    });

    var isCustom = id === CUSTOM_ID;
    var customSection = document.getElementById('customEditorSection');
    if (customSection) customSection.style.display = isCustom ? '' : 'none';
    renderMessagePreview();
  }

  function currentTemplate() {
    if (selectedPresetId === CUSTOM_ID) {
      var textarea = document.getElementById('customMessageTemplate');
      return (textarea && textarea.value) || DEFAULT_TEMPLATE;
    }

    var preset = PRESETS.filter(function(p) { return p.id === selectedPresetId; })[0];
    return preset ? preset.template : DEFAULT_TEMPLATE;
  }

  function applyTemplate(tpl) {
    return tpl.replace(/\{(\w+)\}/g, function(match, key) {
      return Object.prototype.hasOwnProperty.call(PREVIEW_SAMPLE, key) ? PREVIEW_SAMPLE[key] : match;
    });
  }

  async function loadCustomMessage() {
    var toggle = document.getElementById('customMessageEnabled');
    var textarea = document.getElementById('customMessageTemplate');
    var savedTemplate = null;

    try {
      var s = await API.get('/api/v1/client/settings');
      toggle.checked = !!(s && s['custom-message-enabled'] === 'true');
      savedTemplate = s && s['custom-message-template'];
    } catch (e) {}

    var matched = PRESETS.filter(function(p) { return p.template === savedTemplate; })[0];
    if (savedTemplate && !matched) {
      textarea.value = savedTemplate;
      selectPreset(CUSTOM_ID);
    } else {
      textarea.value = savedTemplate || DEFAULT_TEMPLATE;
      selectPreset(matched ? matched.id : PRESETS[0].id);
    }

    applyCustomMessageVisibility();
    renderMessagePreview();
  }

  function applyCustomMessageVisibility() {
    var enabled = document.getElementById('customMessageEnabled').checked;
    document.getElementById('customMessageFields').style.display = enabled ? '' : 'none';
  }

  function renderMessagePreview() {
    var preview = document.getElementById('messagePreview');
    if (!preview) return;
    preview.textContent = applyTemplate(currentTemplate());
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
    document.getElementById('customMessageEnabled').addEventListener('change', applyCustomMessageVisibility);
    document.getElementById('customMessageTemplate').addEventListener('input', renderMessagePreview);

    document.querySelectorAll('[data-insert]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        insertPlaceholder(this.getAttribute('data-insert'));
      });
    });

    document.getElementById('saveMessageBtn').addEventListener('click', saveCustomMessage);
  }

  async function saveCustomMessage() {
    var btn = document.getElementById('saveMessageBtn');
    var enabled = document.getElementById('customMessageEnabled').checked;
    var template = currentTemplate();

    if (enabled && selectedPresetId === CUSTOM_ID && !document.getElementById('customMessageTemplate').value.trim()) {
      showToast('Escreva sua mensagem, ou escolha um dos estilos prontos', 'error');
      return;
    }

    btn.disabled = true;
    try {
      await API.put('/api/v1/client/settings', {
        'custom-message-enabled': enabled ? 'true' : 'false',
        'custom-message-template': template
      });
      showToast('Mensagem de notificação salva!', 'success');
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }
})();