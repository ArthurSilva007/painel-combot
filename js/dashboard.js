(function() {
  if (!checkAuth()) return;

  var autoRefresh, fastPoll;

  var DAYS_LABEL = { 1: 'hoje', 7: 'nos últimos 7 dias', 30: 'nos últimos 30 dias' };
  var TABLE_LIMIT = 10; // agora que o backend aceita ?limit=, buscamos mais que 5 pra busca/ordenação valerem a pena

  var state = {
    days: 7,
    topDiscountsRaw: [],
    recentOffersRaw: [],
    selectedMarketplace: null, // setado ao clicar numa fatia do doughnut
    discountSearch: '',
    feedSearch: '',
    sortKey: null,
    sortDir: 1,
    knownOfferKeys: null // Set() usado pelo polling pra detectar ofertas novas
  };

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function offerKey(d) {
    // Backend agora manda "id" único (RecentOfferResponse). Mantemos o
    // fallback antigo só por segurança, caso algum ambiente ainda rode a
    // versão anterior da API sem o campo.
    return d.id != null ? ('id:' + d.id) : (d.productName + '|' + d.time + '|' + d.source);
  }

  function formatDateBr(iso) {
    if (!iso) return '';
    var parts = iso.split('-'); // YYYY-MM-DD
    return parts.length === 3 ? (parts[2] + '/' + parts[1] + '/' + parts[0]) : iso;
  }

  async function loadAll() {
    loadUserProfile();
    await Promise.all([loadStats(), loadTopDiscounts(), loadRecentOffers(true)]);
    startAutoRefresh();
    startFastPoll();
  }

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

  async function loadStats() {
    var container = document.getElementById('metricsContainer');
    if (!container) return;
    try {
      // offersToday/offersWeek continuam fixos (são métricas com nome
      // próprio); "days" aqui recorta byMarketplace e dailyVolume, que
      // alimentam os dois gráficos.
      var s = await API.get('/api/v1/dashboard/stats?days=' + state.days);
      document.getElementById('metricToday').textContent = s.offersToday;
      document.getElementById('metricTodayTrend').innerHTML = formatTrend(s.todayTrend);
      document.getElementById('metricWeek').textContent = s.offersWeek;
      document.getElementById('metricWeekTrend').innerHTML = formatTrend(s.weekTrend);
      document.getElementById('metricAvg').textContent = s.avgDiscount.toFixed(1) + '%';
      document.getElementById('metricAvgTrend').innerHTML =
        '<span style="color:var(--text-faint);" title="Métrica ainda não calculada pelo backend">— sem histórico ainda</span>';

      document.getElementById('marketplaceTitle').textContent = 'Ofertas por Marketplace (' + DAYS_LABEL[state.days] + ')';
      document.getElementById('volumeTitle').textContent = 'Volume de ofertas (' + DAYS_LABEL[state.days] + ')';

      buildDoughnutChart(s.byMarketplace);
      buildBarChart(s.dailyVolume);
      if (window.lucide) window.lucide.createIcons();
    } catch(e) {
      showToast('Erro ao carregar métricas: ' + e.message, 'error');
    }
  }

  function buildDoughnutChart(data) {
    var canvas = document.getElementById('doughnutChart');
    if (!canvas) return;
    if (window._doughnut) window._doughnut.destroy();
    var ali = data.ALIEXPRESS || 0;
    var sp = data.SHOPEE || 0;
    window._doughnut = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['AliExpress', 'Shopee'],
        datasets: [{
          data: [ali, sp],
          backgroundColor: [cssVar('--aliexpress'), cssVar('--shopee')],
          borderColor: cssVar('--surface-1'),
          borderWidth: 3,
          cutout: '68%'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: cssVar('--text'), padding: 14, font: { size: 11 }, usePointStyle: true } },
          tooltip: { callbacks: { label: function(ctx) { return ctx.label + ': ' + ctx.parsed + ' ofertas'; } } }
        },
        onClick: function(evt, elements) {
          if (!elements.length) return;
          var idx = elements[0].index;
          var source = idx === 0 ? 'ALIEXPRESS' : 'SHOPEE';
          state.selectedMarketplace = (state.selectedMarketplace === source) ? null : source;
          renderFilterChips();
          renderTopDiscounts();
          renderRecentFeed();
        }
      }
    });
  }

  function buildBarChart(data) {
    var canvas = document.getElementById('barChart');
    if (!canvas) return;
    if (window._bar) window._bar.destroy();
    var labels = data.map(function(d) { return d.day; });
    var values = data.map(function(d) { return d.count; });
    var accent = cssVar('--accent');
    window._bar = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: function(ctx) {
            var g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 250);
            g.addColorStop(0, accent); g.addColorStop(1, accent + '99'); return g;
          },
          borderRadius: 6, borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              // Agora que a API manda "date" (ISO), mostramos a data real no
              // hover em vez de só a abreviação do dia.
              title: function(items) {
                var d = data[items[0].dataIndex];
                return d.date ? (d.day + ' · ' + formatDateBr(d.date)) : d.day;
              }
            }
          }
        },
        onClick: function(evt, elements) {
          if (!elements.length) return;
          var item = data[elements[0].index];
          // "date" já existe no dailyVolume, mas top-discounts e
          // recent-offers ainda não têm data por item — então dá pra
          // informar a data exata da barra, mas não filtrar as tabelas por
          // ela ainda. Isso precisa de um campo de data nesses dois
          // endpoints também.
          showToast(
            (item.date ? formatDateBr(item.date) : item.day) + ': ' + item.count + ' ofertas. ' +
            'Filtro por dia exato nas tabelas ainda depende de um campo de data em top-discounts/recent-offers.',
            'warning'
          );
        }
      }
    });
  }

  async function loadTopDiscounts() {
    var tbody = document.getElementById('topDiscountsBody');
    if (!tbody) return;
    var titleEl = document.getElementById('topDiscountsTitle');
    if (titleEl) titleEl.textContent = 'Top ' + TABLE_LIMIT + ' descontos (' + DAYS_LABEL[state.days] + ')';
    try {
      var list = await API.get('/api/v1/dashboard/top-discounts?days=' + state.days + '&limit=' + TABLE_LIMIT);
      state.topDiscountsRaw = list || [];
      renderTopDiscounts();
    } catch(e) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--danger);">Erro ao carregar</td></tr>';
    }
  }

  function applyMarketplaceFilter(list) {
    if (!state.selectedMarketplace) return list;
    return list.filter(function(d) { return d.source === state.selectedMarketplace; });
  }

  function renderTopDiscounts() {
    var tbody = document.getElementById('topDiscountsBody');
    if (!tbody) return;
    var list = applyMarketplaceFilter(state.topDiscountsRaw.slice());

    if (state.discountSearch) {
      var q = state.discountSearch.toLowerCase();
      list = list.filter(function(d) { return d.productName.toLowerCase().indexOf(q) !== -1; });
    }
    if (state.sortKey) {
      list.sort(function(a, b) { return (a[state.sortKey] - b[state.sortKey]) * state.sortDir; });
    }

    updateSortHeaders();

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">Nenhuma oferta encontrada</td></tr>';
      return;
    }

    var cls = ['', 'gold', 'silver', 'bronze'];
    tbody.innerHTML = list.map(function(d, i) {
      var r = state.sortKey ? (i + 1) : (d.rank || (i + 1));
      var rankHtml = (!state.sortKey && r <= 3)
        ? '<span class="rank ' + cls[r] + '"><i data-lucide="medal" class="icon"></i></span>'
        : '<span class="rank">' + r + '</span>';
      var name = d.productName.length > 40 ? d.productName.substring(0, 37) + '...' : d.productName;
      var badge = d.source === 'ALIEXPRESS' ? 'badge badge-ae' : 'badge badge-sp';
      return '<tr>' +
        '<td>' + rankHtml + '</td>' +
        '<td>' + escapeHtml(name) + '</td>' +
        '<td>' + formatCurrency(d.price) + '</td>' +
        '<td class="discount-pct">-' + formatPct(d.discountPercent) + '</td>' +
        '<td><span class="' + badge + '">' + escapeHtml(d.source) + '</span></td>' +
        '<td><a href="' + encodeURI(d.productUrl) + '" target="_blank" rel="noopener" class="link-icon" title="Ver oferta"><i data-lucide="external-link" class="icon icon-sm"></i></a></td>' +
      '</tr>';
    }).join('');
    if (window.lucide) window.lucide.createIcons();
  }

  function updateSortHeaders() {
    document.querySelectorAll('th.sortable').forEach(function(th) {
      var key = th.getAttribute('data-sort');
      th.classList.toggle('sort-active', state.sortKey === key);
      var icon = th.querySelector('i');
      if (icon) icon.setAttribute('data-lucide', state.sortKey === key ? (state.sortDir === 1 ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down');
    });
  }

  async function loadRecentOffers(isInitialLoad) {
    var feed = document.getElementById('recentFeed');
    if (!feed) return;
    var titleEl = document.getElementById('feedTitle');
    if (titleEl) titleEl.textContent = 'Últimas ofertas (' + DAYS_LABEL[state.days] + ')';
    try {
      var list = await API.get('/api/v1/dashboard/recent-offers?days=' + state.days + '&limit=' + TABLE_LIMIT);
      state.recentOffersRaw = list || [];
      if (isInitialLoad) {
        state.knownOfferKeys = new Set(state.recentOffersRaw.map(offerKey));
      }
      renderRecentFeed();
    } catch(e) {
      feed.innerHTML = '<div class="empty-state is-error">Erro ao carregar</div>';
    }
  }

  function renderRecentFeed(newKeys) {
    var feed = document.getElementById('recentFeed');
    if (!feed) return;
    var list = applyMarketplaceFilter(state.recentOffersRaw.slice());
    if (state.feedSearch) {
      var q = state.feedSearch.toLowerCase();
      list = list.filter(function(d) { return d.productName.toLowerCase().indexOf(q) !== -1 || d.source.toLowerCase().indexOf(q) !== -1; });
    }
    if (!list.length) {
      feed.innerHTML = '<div class="empty-state"><i data-lucide="inbox" class="icon"></i>Nenhuma oferta encontrada</div>';
      if (window.lucide) window.lucide.createIcons();
      return;
    }
    feed.innerHTML = list.map(function(d) {
      var badge = d.source === 'ALIEXPRESS' ? 'badge badge-ae' : 'badge badge-sp';
      var isNew = newKeys && newKeys.indexOf(offerKey(d)) !== -1;
      return '<div class="feed-item' + (isNew ? ' is-new' : '') + '">' +
        (isNew ? '<span class="new-dot"></span>' : '') +
        '<span class="time">' + escapeHtml(d.time) + '</span>' +
        '<span class="item-name">' + escapeHtml(d.productName) + '</span>' +
        '<span class="' + badge + '">' + escapeHtml(d.source) + '</span></div>';
    }).join('');
  }

  async function loadChannelsMini() {
    var container = document.getElementById('channelsMini');
    if (!container) return;
    var cid = resolveClientId();
    if (!cid) return;
    try {
      var chs = await API.get('/api/v1/clients/' + cid + '/channels');
      if (!chs || chs.length === 0) {
        container.innerHTML = '<div class="empty-state"><i data-lucide="radio-tower" class="icon"></i>Nenhum canal configurado</div>';
        if (window.lucide) window.lucide.createIcons();
        return;
      }
      container.innerHTML = chs.map(function(c) {
        var isWa = c.channelType === 'WHATSAPP';
        var icon = isWa ? 'message-circle' : 'send';
        var status = c.enabled ? 'on' : 'off';
        var name = isWa ? 'WhatsApp' : 'Telegram';
        var id = c.telegramChatId || c.whatsappNumber || '-';
        return '<div class="channel-row"><span class="ch-status ' + status + '"></span>' +
          '<div class="ch-icon-wrap ' + (isWa ? 'whatsapp' : 'telegram') + '"><i data-lucide="' + icon + '" class="icon"></i></div>' +
          '<div class="ch-info"><div class="ch-name">' + name + '</div><div class="ch-id">' + escapeHtml(id) + '</div></div></div>';
      }).join('');
      if (window.lucide) window.lucide.createIcons();
    } catch(e) {}
  }

  function renderFilterChips() {
    var container = document.getElementById('activeFilters');
    if (!container) return;
    if (!state.selectedMarketplace) { container.innerHTML = ''; return; }
    container.innerHTML =
      '<span class="filter-chip" id="clearMarketplaceChip"><i data-lucide="filter" class="icon"></i>Marketplace: ' +
      escapeHtml(state.selectedMarketplace) + ' <i data-lucide="x" class="icon"></i></span>';
    var chip = document.getElementById('clearMarketplaceChip');
    if (chip) chip.addEventListener('click', function() {
      state.selectedMarketplace = null;
      renderFilterChips();
      renderTopDiscounts();
      renderRecentFeed();
    });
    if (window.lucide) window.lucide.createIcons();
  }

  // Feed quase em tempo real: a cada 15s verifica só as ofertas recentes
  // (chamada leve) e avisa se algo novo chegou. Agora com "id" real vindo do
  // backend, a deduplicação é 100% confiável (antes era um combo de campos).
  function startFastPoll() {
    if (fastPoll) clearInterval(fastPoll);
    fastPoll = setInterval(async function() {
      try {
        var fresh = (await API.get('/api/v1/dashboard/recent-offers?days=' + state.days + '&limit=' + TABLE_LIMIT)) || [];
        var newOnes = fresh.filter(function(d) { return !state.knownOfferKeys.has(offerKey(d)); });
        if (newOnes.length) {
          newOnes.forEach(function(d) { state.knownOfferKeys.add(offerKey(d)); });
          state.recentOffersRaw = fresh;
          renderRecentFeed(newOnes.map(offerKey));
          var first = newOnes[0];
          showToast(newOnes.length > 1 ? (newOnes.length + ' novas ofertas enviadas') : ('Nova oferta enviada: ' + first.productName), 'success');
          var metricEl = document.getElementById('metricToday');
          if (metricEl) {
            var current = parseInt(metricEl.textContent, 10);
            if (!isNaN(current)) metricEl.textContent = current + newOnes.length;
          }
        }
      } catch(e) {}
    }, 15000);
  }

  function startAutoRefresh() {
    if (autoRefresh) clearInterval(autoRefresh);
    loadChannelsMini();
    var el = document.getElementById('updateTimer');
    var secs = 0;
    if (el) el.innerHTML = '<span class="live-dot"></span> Atualizado agora';
    autoRefresh = setInterval(function() {
      secs++;
      var label = secs < 60 ? 'Atualizado há ' + secs + ' min' : 'Atualizado há ' + Math.floor(secs/60) + ' min';
      if (el) el.innerHTML = '<span class="live-dot"></span> ' + label;
      if (secs >= 60) { loadAll(); secs = 0; }
    }, 60000);
  }

  function setupControls() {
    document.getElementById('periodTabs').addEventListener('click', function(e) {
      var btn = e.target.closest('.period-tab');
      if (!btn) return;
      document.querySelectorAll('.period-tab').forEach(function(t) { t.classList.remove('active'); });
      btn.classList.add('active');
      state.days = parseInt(btn.getAttribute('data-days'), 10);
      loadStats();
      loadTopDiscounts();
      loadRecentOffers(true);
    });

    document.querySelectorAll('th.sortable').forEach(function(th) {
      th.addEventListener('click', function() {
        var key = th.getAttribute('data-sort');
        if (state.sortKey === key) { state.sortDir *= -1; }
        else { state.sortKey = key; state.sortDir = 1; }
        renderTopDiscounts();
      });
    });

    var discountSearchEl = document.getElementById('discountSearch');
    var debounceTimer;
    discountSearchEl.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      var val = this.value;
      debounceTimer = setTimeout(function() { state.discountSearch = val.trim(); renderTopDiscounts(); }, 150);
    });

    var feedSearchEl = document.getElementById('feedSearch');
    var debounceTimer2;
    feedSearchEl.addEventListener('input', function() {
      clearTimeout(debounceTimer2);
      var val = this.value;
      debounceTimer2 = setTimeout(function() { state.feedSearch = val.trim(); renderRecentFeed(); }, 150);
    });

    document.getElementById('refreshBtn').addEventListener('click', function() {
      var icon = this.querySelector('i');
      if (icon) icon.style.animation = 'spin .6s linear';
      loadAll();
      showToast('Dashboard atualizado', 'success');
      setTimeout(function() { if (icon) icon.style.animation = ''; }, 600);
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    setupControls();
    loadAll();
  });
})();
