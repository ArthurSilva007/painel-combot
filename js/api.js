const API = {
  getBaseUrl() {
    // Antes: URL duplicada aqui (ignorava config.js). Agora lê de um único lugar.
    return (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.API_URL)
      ? APP_CONFIG.API_URL
      : 'https://PromobotIA-main.vps9817.panel.icontainer.run';
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
    if (res.status === 401) { localStorage.clear(); window.location.href = 'index.html'; throw new Error('Sessão expirada'); }
    if (!res.ok) {
      let msg = 'Erro ' + res.status;
      try { const b = await res.json(); msg = b.message || msg; } catch(e) {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  },

  url(path) { return this.getBaseUrl() + path; },

  async get(path) { return this.handleResponse(await fetch(this.url(path), { headers: this.headers() })); },
  async post(path, data) { return this.handleResponse(await fetch(this.url(path), { method:'POST', headers:this.headers(), body:JSON.stringify(data) })); },
  async put(path, data) { return this.handleResponse(await fetch(this.url(path), { method:'PUT', headers:this.headers(), body:JSON.stringify(data) })); },
  async patch(path, data) {
    const opts = { method:'PATCH', headers:this.headers() };
    if (data) opts.body = JSON.stringify(data);
    return this.handleResponse(await fetch(this.url(path), opts));
  }
};
