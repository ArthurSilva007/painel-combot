const API = {
  getBaseUrl() {
    if (typeof window === 'undefined' || !window.APP_CONFIG || typeof window.APP_CONFIG.getApiUrl !== 'function') {
      throw new Error('API não configurada. Carregue js/config.js com um ambiente explícito antes de usar a API.');
    }
    return window.APP_CONFIG.getApiUrl();
  },

  getToken() { return localStorage.getItem('token'); },
  getClientId() { return localStorage.getItem('clientId'); },

  headers() {
    const h = { 'Content-Type': 'application/json' };
    const t = this.getToken();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  },

  async handleResponse(res) {
    if (res.status === 401) {
      localStorage.clear();
      window.location.href = 'index.html';
      throw new Error('Sessão expirada');
    }
    if (!res.ok) {
      let msg = 'Erro ' + res.status;
      try {
        const body = await res.json();
        msg = (body && (body.message || body.error || body.detail)) || msg;
      } catch (e) {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  },

  url(path) {
    const normalizedPath = String(path || '');
    if (!normalizedPath.startsWith('/')) {
      throw new Error('O caminho da API deve ser relativo e começar com /.');
    }
    return this.getBaseUrl() + normalizedPath;
  },

  async get(path) { return this.handleResponse(await fetch(this.url(path), { headers: this.headers() })); },
  async post(path, data) { return this.handleResponse(await fetch(this.url(path), { method: 'POST', headers: this.headers(), body: JSON.stringify(data) })); },
  async put(path, data) { return this.handleResponse(await fetch(this.url(path), { method: 'PUT', headers: this.headers(), body: JSON.stringify(data) })); },
  async patch(path, data) {
    const opts = { method: 'PATCH', headers: this.headers() };
    if (data) opts.body = JSON.stringify(data);
    return this.handleResponse(await fetch(this.url(path), opts));
  }
};
