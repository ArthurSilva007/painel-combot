const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const configSource = fs.readFileSync(path.join(root, 'js/config.js'), 'utf8');
const apiSource = fs.readFileSync(path.join(root, 'js/api.js'), 'utf8');
const authSource = fs.readFileSync(path.join(root, 'js/auth.js'), 'utf8');
const productionUrl = loadProductionUrl();

function loadProductionUrl() {
  return loadContext({ environment: 'production' }).__API.getBaseUrl();
}

function createStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); }
  };
}

function loadContext({ environment = 'staging', fetchImpl = null, withConfig = true } = {}) {
  const context = {
    URL,
    localStorage: createStorage(),
    window: {
      __BOTIA_API_ENV__: environment,
      location: { href: '', origin: 'http://frontend.test' }
    },
    fetch: fetchImpl || (async () => ({ ok: true, status: 200, json: async () => ({}) }))
  };
  vm.createContext(context);
  if (withConfig) vm.runInContext(configSource, context);
  vm.runInContext(apiSource + '\nthis.__API = API;', context);
  vm.runInContext(authSource + '\nthis.__login = login;', context);
  return context;
}

test('configura homologação e desenvolvimento sem depender da URL de produção', () => {
  for (const environment of ['staging', 'development']) {
    const context = loadContext({ environment });
    assert.equal(context.window.APP_CONFIG.environment, environment);
    assert.equal(context.__API.getBaseUrl(), 'http://127.0.0.1:8084');
  }
});

test('falha claramente quando o ambiente não possui URL configurada', async () => {
  const context = loadContext({ environment: 'isolated-review' });
  await assert.rejects(
    context.__API.get('/api/auth/me'),
    /API não configurada para o ambiente/
  );
});

test('todas as operações HTTP usam apenas a base centralizada de homologação', async () => {
  const requests = [];
  const context = loadContext({
    environment: 'staging',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }
  });

  await context.__API.get('/api/auth/me');
  await context.__API.post('/api/auth/login', { username: 'test', password: 'test' });
  await context.__API.put('/api/v1/client/settings', { key: 'value' });
  await context.__API.patch('/api/v1/clients/channels/1/toggle');

  assert.equal(requests.length, 4);
  assert.ok(requests.every(({ url }) => url.startsWith('http://127.0.0.1:8084/')));
  assert.ok(requests.every(({ url }) => url !== productionUrl));
});

test('não persiste token ausente, null ou undefined na resposta de login', async () => {
  const context = loadContext({ environment: 'staging' });
  for (const response of [{}, { accessToken: null }, { token: undefined }, { token: 'null' }]) {
    context.__API.post = async () => response;
    await assert.rejects(context.__login('user', 'password'), /token de acesso ausente/);
    assert.equal(context.localStorage.getItem('token'), null);
  }
});

test('mantém o fluxo JWT atual quando o backend retorna accessToken', async () => {
  const context = loadContext({ environment: 'staging' });
  context.__API.post = async () => ({
    accessToken: 'jwt-staging-only',
    clientId: null,
    username: 'user@example.test',
    role: 'CLIENT',
    userId: 42
  });

  await context.__login('user@example.test', 'password');
  assert.equal(context.localStorage.getItem('token'), 'jwt-staging-only');
  assert.equal(context.localStorage.getItem('clientId'), null);
  assert.equal(context.localStorage.getItem('userId'), '42');
});

test('todas as páginas carregam config.js antes de api.js e cobrem os fluxos principais', () => {
  const htmlFiles = fs.readdirSync(root).filter(file => file.endsWith('.html'));
  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(html.indexOf('src="js/config.js"') < html.indexOf('src="js/api.js"'), file);
  }

  const jsFiles = fs.readdirSync(path.join(root, 'js')).filter(file => file.endsWith('.js'));
  const nonConfigSources = jsFiles
    .filter(file => file !== 'config.js')
    .map(file => fs.readFileSync(path.join(root, 'js', file), 'utf8'))
    .join('\n');
  assert.equal(nonConfigSources.includes(productionUrl), false);
  assert.equal(jsFiles.filter(file => fs.readFileSync(path.join(root, 'js', file), 'utf8').includes('fetch(')).length, 1);

  for (const route of [
    '/api/auth/login',
    '/api/v1/dashboard/stats',
    '/api/v1/clients/',
    '/api/v1/client/settings',
    '/api/v1/admin/users',
    '/api/v1/offers/publish'
  ]) {
    assert.match(nonConfigSources, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
