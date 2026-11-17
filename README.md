# GPGC — Spatial v3 (Vue 3)

Implementação da **versão 03 aprovada**, usando o projeto Vue original como base: Vue 3, Vue Router 4, Vuex 4 e Vue CLI 5.

## Iniciar no Mac

Requer Node.js 18+.

```bash
npm install
npm run serve
```

Abra a URL local exibida no terminal (normalmente `http://localhost:8080`).

Para gerar a versão de produção:

```bash
npm run build
```

## API

O projeto usa o backend original por padrão:

```dotenv
VUE_APP_API_BASE_URL=https://gpgc-api.onrender.com
```

Altere a variável em `.env` se quiser apontar para uma API local. Reinicie o servidor depois de alterar `.env`.

Os endpoints utilizados pelo store original são `GET /api/v1/releases`, `GET /api/v1/releases/:slug`, `GET /api/v1/artists`, `GET /api/v1/artists/:slug`, `GET /api/v1/featurings`, `GET /api/v1/soundtracks` e `GET /api/v1/songs`. Não há dados falsos escondendo problemas de conexão: se a API falhar, aparece uma mensagem com opção Retry.

A API precisa permitir CORS para o domínio em que o front estiver hospedado. O navegador também precisa conseguir acessar os URLs das faixas e das capas.

## Estrutura

- `src/pages/SpatialPage.vue`: navegação em profundidade da v3, com scroll para cima levando aos lançamentos antigos, posição distinta para cada item e cross-fade; não há ano, skew ou zoom da v4.
- `src/components/NavBar.vue`: menu pequeno e vertical no canto inferior direito.
- `src/components/EntryModal.vue`: detalhes por seção; **capa apenas dentro do disco**, com faixas, créditos, links, colaboração e página About.
- `src/components/PlayerBar.vue`: player persistente no canto inferior esquerdo, com seek, volume, graves, agudos, pan, echo e velocidade.
- `src/router/index.js`: rotas espaciais públicas e rotas originais de login e administração.
- `src/store/index.js`: store original preservado, com correção da atualização de `currentTrack`.

## Comportamento

- Os discos **não têm capas na navegação**, apenas nome e artista.
- Scroll para cima: segue para itens mais antigos; scroll para baixo: volta aos mais novos.
- As entradas têm profundidade própria mesmo quando compartilham o ano.
- Clique no título: abre a página em modal. Você pode abrir o link direto `/releases/:slug` ou `/artists/:slug`.
- O player não reinicia ao trocar entre Artists, Releases, Featurings, Soundtracks e About.
- As rotas originais para criar e editar conteúdo permanecem no projeto.

## Nota sobre áudio

As faixas precisam ter um endereço de áudio acessível em `track.url`. Os filtros do Web Audio API funcionam apenas quando o servidor do áudio autoriza o uso entre origens (CORS). Se um host não enviar o cabeçalho correto, o áudio de terceiros pode não passar pelos filtros. Consulte a configuração do host se isso ocorrer.

## Deploy e URLs diretas

O Vue Router usa `createWebHistory`, como no site original. Em hospedagem estática (por exemplo Nginx ou Netlify), configure fallback para `index.html` para que `/releases/:slug` abra também após atualizar a página. `npm run serve` já oferece esse comportamento durante o desenvolvimento.

## Validação

O build de produção e o lint dos novos componentes foram executados com sucesso. O teste automatizado com navegador ficou bloqueado pelas políticas de rede deste ambiente; portanto, recomenda-se testar a conexão real com a API e as faixas de áudio no navegador local antes de publicar.
