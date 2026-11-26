# painel-combot

Frontend estático independente do botIA, em HTML, CSS e JavaScript. A API é escolhida exclusivamente em `js/config.js`; as páginas não montam URLs de backend por conta própria.

## Ambientes

O arquivo central mantém configurações explícitas para `production`, `staging` e `development`. A configuração padrão versionada é `production` para preservar o uso atual. Uma implantação separada deve selecionar `staging` ou `development` explicitamente, antes de carregar `js/config.js`, por exemplo:

```html
<script>window.__BOTIA_API_ENV__ = 'staging';</script>
<script src="js/config.js"></script>
```

Se o ambiente não tiver uma URL válida, o frontend interrompe a chamada e mostra um erro de configuração. Não existe fallback silencioso para produção em `js/api.js`.

## Homologação isolada via túnel SSH

O backend de homologação do repositório `ArthurSilva007/promo_bot`, branch `feature/evolution-api`, deve estar acessível na VPS somente em `127.0.0.1:8084`. Na máquina de desenvolvimento, abra um túnel sem alterar produção:

```powershell
ssh -N -L 8084:127.0.0.1:8084 usuario@HOST_DA_VPS
```

Em outro terminal, sirva uma cópia local deste frontend. O exemplo abaixo usa apenas recursos do Python já instalado:

```powershell
cd C:\caminho\para\painel-combot
py -m http.server 5500
```

Na cópia usada para homologação, selecione `staging` antes de carregar `js/config.js` (como no exemplo da seção anterior) e acesse `http://127.0.0.1:5500`. As requisições irão somente para `http://127.0.0.1:8084`; não use credenciais de produção e não publique essa cópia.

Se o backend não aceitar a origem `http://127.0.0.1:5500`, a política CORS do ambiente de homologação precisa permitir essa origem no repositório `promo_bot`. Isso é uma configuração do backend de homologação, não uma dependência deste repositório. Uma alternativa é servir o frontend pelo próprio backend de homologação, desde que a cópia estática usada ali tenha sido atualizada de forma independente.

## Distribuição e cópia no JAR

Este repositório contém o frontend independente na raiz. O backend também possui uma cópia em `promo_bot/botIA.com/src/main/resources/static`; o Maven inclui essa cópia no JAR Spring Boot, e o Dockerfile do backend empacota o JAR. Portanto:

- alterar este repositório não altera um JAR já construído;
- alterar ou reconstruir o backend não atualiza automaticamente este repositório;
- publicar o frontend separado e servir a cópia do JAR são processos distintos;
- não há dependência de build entre os repositórios nesta correção.

Antes de usar a cópia embutida no backend, confirme que ela recebeu as mesmas alterações e que o JAR foi reconstruído. Não se deve presumir que o processo de publicação seja o mesmo.

## Testes

Node.js 18+ é suficiente e não há dependências npm de runtime:

```powershell
npm test
```

Os testes exercitam a seleção de ambiente, isolamento da base de URL, ausência de chamadas para produção, transporte JWT, respostas de login sem token e a presença dos fluxos de dashboard, canais, configurações, usuários e publicação de ofertas.
