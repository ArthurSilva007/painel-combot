(function (root) {
  'use strict';

  // deployment.js must select the environment explicitly before this file.
  var configuredEnvironment = root.__BOTIA_API_ENV__;
  if (typeof configuredEnvironment !== 'string' || !configuredEnvironment.trim()) {
    throw new Error(
      'API não configurada. Defina explicitamente window.__BOTIA_API_ENV__ ' +
      'em js/deployment.js antes de carregar js/config.js.'
    );
  }

  var apiUrls = {
    production: 'https://PromobotIA-main.vps9817.panel.icontainer.run',
    staging: 'http://127.0.0.1:8084',
    development: 'http://127.0.0.1:8084'
  };

  function getApiUrl() {
    var url = apiUrls[configuredEnvironment.trim()];
    if (typeof url !== 'string' || !url.trim()) {
      throw new Error(
        'API não configurada para o ambiente "' + configuredEnvironment +
        '". Defina uma URL explícita para esta implantação.'
      );
    }

    url = url.trim().replace(/\/+$/, '');
    try {
      var parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
    } catch (e) {
      throw new Error('A URL da API deve usar HTTP ou HTTPS e estar corretamente configurada.');
    }
    return url;
  }

  root.APP_CONFIG = Object.freeze({
    environment: configuredEnvironment.trim(),
    apiUrls: Object.freeze(apiUrls),
    getApiUrl: getApiUrl
  });
})(window);
