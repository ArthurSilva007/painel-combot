(function() {
  if (!checkAuth()) return;

  document.addEventListener('DOMContentLoaded', function() {
    loadUserProfile();
    var form = document.getElementById('publishForm');
    var btn = document.getElementById('publishBtn');
    var imgUrl = document.getElementById('imgUrl');
    var preview = document.getElementById('imgPreview');

    if (imgUrl) {
      imgUrl.addEventListener('input', function() {
        if (imgUrl.value && imgUrl.value.startsWith('http')) {
          preview.src = imgUrl.value; preview.classList.add('show');
        } else { preview.classList.remove('show'); }
      });
      preview.addEventListener('error', function() { preview.classList.remove('show'); });
    }

    if (form) {
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var name = document.getElementById('productName').value.trim();
        var url = document.getElementById('productUrl').value.trim();
        var price = parseFloat(document.getElementById('price').value);
        var origPrice = document.getElementById('originalPrice').value;
        var source = document.getElementById('source').value;
        var img = document.getElementById('imgUrl').value.trim();

        if (!name || name.length < 3) { showToast('Nome do produto deve ter pelo menos 3 caracteres', 'error'); return; }
        if (!url || !url.startsWith('http')) { showToast('Link do produto deve começar com http:// ou https://', 'error'); return; }
        if (!price || price <= 0) { showToast('Preço deve ser maior que zero', 'error'); return; }

        btn.disabled = true;
        var btnText = btn.querySelector('span');
        var btnSpin = btn.querySelector('.spinner');
        if (btnText) btnText.style.display = 'none';
        if (btnSpin) btnSpin.classList.add('show');

        try {
          var payload = { productName: name, productUrl: url, price: price, source: source };
          if (img) payload.imageUrl = img;
          if (origPrice && parseFloat(origPrice) > 0) payload.originalPrice = parseFloat(origPrice);
          var res = await API.post('/api/v1/offers/publish', payload);
          var dest = (res.sentToTelegram ? 'Telegram' : '') + (res.sentToTelegram && res.sentToWhatsapp ? ' e ' : '') + (res.sentToWhatsapp ? 'WhatsApp' : '');
          showToast('Oferta publicada! ' + dest, 'success');
          form.reset(); preview.classList.remove('show');
        } catch(err) {
          showToast(err.message, 'error');
        } finally {
          btn.disabled = false;
          if (btnText) btnText.style.display = '';
          if (btnSpin) btnSpin.classList.remove('show');
        }
      });
    }
  });

  async function loadUserProfile() {
    try {
      var user = await loadUserInfo();
      if (user && user.client) {
        var name = user.client.name || 'Cliente';
        var el = document.getElementById('navUserName');
        var init = document.getElementById('navUserInitial');
        if (el) el.textContent = name;
        if (init) init.textContent = name.charAt(0).toUpperCase();
      }
    } catch(e) {}
  }
})();
