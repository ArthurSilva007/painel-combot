(function() {
  if (!checkAuth()) return;

  var clientId = resolveClientId();

  document.addEventListener('DOMContentLoaded', function() {
    loadUserProfile();
    loadChannels();
    document.getElementById('addChannelBtn').addEventListener('click', toggleForm);
    document.getElementById('cancelAddBtn').addEventListener('click', toggleForm);
    document.getElementById('newChannelForm').addEventListener('submit', addChannel);
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

  async function loadChannels() {
    var container = document.getElementById('channelsList');
    if (!container || !clientId) return;
    try {
      var chs = await API.get('/api/v1/clients/' + clientId + '/channels');
      if (!chs || chs.length === 0) {
        container.innerHTML = '<div class="empty-state"><i data-lucide="radio-tower" class="icon"></i>Nenhum canal configurado</div>';
        if (window.lucide) window.lucide.createIcons();
        return;
      }
      container.innerHTML = chs.map(function(c) {
        var isWa = c.channelType === 'WHATSAPP';
        var icon = isWa ? 'message-circle' : 'send';
        var name = isWa ? 'WhatsApp' : 'Telegram';
        var id = c.telegramChatId || c.whatsappNumber || '-';
        var checked = c.enabled ? 'checked' : '';
        return '<div class="card channel-row">' +
          '<div class="ch-icon-wrap ' + (isWa ? 'whatsapp' : 'telegram') + '"><i data-lucide="' + icon + '" class="icon"></i></div>' +
          '<div class="ch-info">' +
          '<div class="ch-name">' + name + '</div>' +
          '<div class="ch-id">' + escapeHtml(id) + '</div>' +
          '</div>' +
          '<label class="toggle"><input type="checkbox" ' + checked + ' data-channel-id="' + c.id + '"><span class="slider"></span></label>' +
          '</div>';
      }).join('');
      if (window.lucide) window.lucide.createIcons();
      // Delegação de evento em vez de onchange inline no HTML gerado
      container.querySelectorAll('input[type=checkbox]').forEach(function(cb) {
        cb.addEventListener('change', function() { toggleChannel(this.getAttribute('data-channel-id'), this); });
      });
    } catch(e) {
      container.innerHTML = '<div class="empty-state is-error">Erro ao carregar canais</div>';
    }
  }

  function toggleForm() {
    var form = document.getElementById('newChannelForm');
    form.classList.toggle('open');
    if (!form.classList.contains('open')) form.querySelector('form').reset();
  }

  async function addChannel(e) {
    e.preventDefault();
    var type = document.getElementById('newChannelType').value;
    var chatId = document.getElementById('newChatId').value.trim();
    if (!chatId) { showToast('Informe o Chat ID ou Group ID', 'error'); return; }
    try {
      var payload = { channelType: type };
      if (type === 'TELEGRAM') payload.telegramChatId = chatId;
      else payload.whatsappNumber = chatId;
      await API.post('/api/v1/clients/' + clientId + '/channels', payload);
      showToast('Canal adicionado!', 'success');
      toggleForm();
      loadChannels();
    } catch(err) {
      showToast(err.message, 'error');
    }
  }

  async function toggleChannel(id, checkbox) {
    try {
      var res = await API.patch('/api/v1/clients/channels/' + id + '/toggle');
      checkbox.checked = res ? res.enabled : !checkbox.checked;
      showToast(checkbox.checked ? 'Canal ativado' : 'Canal desativado', 'success');
    } catch(err) {
      checkbox.checked = !checkbox.checked;
      showToast(err.message, 'error');
    }
  }
})();
