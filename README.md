# GPGC — Arquivo musical e player experimental

> Documentação funcional e técnica do projeto `gpgc-vue-v2`, baseada no código da branch principal consultado em 17/11/2026.

## Visão geral

**GPGC** é um arquivo digital interativo da produção musical de Gabriel Pessoa Guerra Cavalcanti. Reúne lançamentos, projetos e artistas, participações em gravações (*featurings*), trilhas sonoras e informações biográficas em uma experiência de navegação espacial, com reprodução de áudio integrada.

A proposta combina **discografia, catálogo, portfólio e laboratório de áudio**: além de explorar obras e créditos, o visitante pode ouvir faixas em um player persistente, ajustar características sonoras e acessar uma ferramenta experimental de separação de instrumentos com inteligência artificial.

O frontend é desenvolvido em **Vue 3**, conectado a uma **API Ruby on Rails**.

## Principais funcionalidades

### 1. Catálogo musical

O conteúdo é organizado em cinco seções públicas:

| Seção | Conteúdo |
| --- | --- |
| **Releases** | Lançamentos musicais, artistas, capas, faixas, metadados e créditos |
| **Artists** | Projetos, grupos e identidades artísticas, com seus lançamentos associados |
| **Featurings** | Participações em obras de outros artistas, créditos, datas e links externos |
| **Soundtracks** | Trabalhos de trilha sonora, empresas, anos e links externos |
| **About** | Apresentação do artista, trajetória e contexto do arquivo |

O catálogo busca dados reais da API. Em caso de falha ou ausência de registros, a interface oferece um estado vazio e opção de tentar novamente.

### 2. Navegação espacial

A página `SpatialPage.vue` apresenta os itens em uma composição tipográfica tridimensional simulada por transformações e animações de interface.

- Navegação em profundidade por rolagem do mouse ou gesto de toque.
- Controles de seta para avançar e retroceder no catálogo.
- Navegação por teclado (`↑`, `↓`, `PageUp` e `PageDown`).
- Barra deslizante para saltar entre posições do catálogo e contador de itens.
- Transições de escala, posição, opacidade e perspectiva.
- Resposta visual à posição do ponteiro.
- Tratamento de preferência do sistema por movimento reduzido.
- Itens apresentados por nome e subtítulo, sem capas na cena principal.

**Direção da navegação:** subir avança para registros mais antigos; descer retorna aos mais recentes. A capa aparece dentro do modal do lançamento, não na navegação principal.

### 3. Modais de conteúdo

O componente `EntryModal.vue` concentra a visualização de detalhes:

**Releases**
- Nome do lançamento e artista.
- Capa e navegação entre múltiplas imagens, quando disponíveis.
- Lista de faixas com reprodução por clique.
- Botões de reprodução e download, quando há URLs válidas.
- Tipo de lançamento, data, selo, formato, notas e créditos.
- Link de edição para usuários autenticados.

**Artists**
- Nome e identificação como grupo ou projeto solo.
- Lista de lançamentos associados, ordenados por data.
- Abertura do lançamento selecionado.

**Featurings e Soundtracks**
- Informações específicas de cada categoria.
- Links externos em nova aba, representados por ícones de seta diagonal.
- Links de edição quando autenticado.

**About**
- Texto de apresentação e links para os repositórios do projeto.

Os modais têm animações de entrada e saída, fechamento por botão, clique fora e tecla `Escape`, além de atributos de acessibilidade.

### 4. Player de áudio persistente

O componente `PlayerBar.vue` permanece montado no componente principal da aplicação, permitindo continuar a reprodução ao navegar entre as seções públicas.

Recursos:
- Exibição da faixa e artista atuais.
- Link de retorno ao lançamento associado, quando disponível.
- **Play/Pause**, faixa anterior e próxima faixa.
- Barra de progresso com busca (*seek*).
- Tempo atual e duração.
- Volume.
- Mensagens de erro de reprodução.
- Painel expansível **Sound settings**.

### 5. Processamento de áudio

O painel de configurações oferece:

| Controle | Função |
| --- | --- |
| **Bass** | Ajuste de graves, de -12 a +12 dB |
| **Treble** | Ajuste de agudos, de -12 a +12 dB |
| **Pan** | Distribuição estéreo entre esquerda e direita |
| **Echo** | Controle de efeito de eco |
| **Speed** | Velocidade de reprodução entre 0,50× e 1,50× |
| **Reset** | Restaura as configurações de áudio |

**Modos de velocidade e afinação:**

- **Vinyl:** velocidade e afinação variam juntas, simulando o comportamento de um toca-discos.
- **Independent:** altera a velocidade com preservação de afinação, quando o navegador oferece suporte.

A interface exibe a variação de afinação em **semitons**.

### 6. Detecção automática de BPM

O utilitário `src/utils/detect-bpm.js` analisa o arquivo de áudio original para estimar seu andamento.

Fluxo:
1. Busca a URL da faixa.
2. Decodifica o áudio pela Web Audio API.
3. Analisa energia e variações de ataque em um trecho da gravação.
4. Compara periodicidades candidatas entre **60 e 180 BPM**.
5. Exibe o resultado aproximado no player.

O BPM apresentado é ajustado proporcionalmente à velocidade de reprodução. Por exemplo, uma estimativa original de 120 BPM passa a 90 BPM em 0,75×.

**Limitação:** trata-se de uma estimativa, não de medição garantida. Faixas sem pulso regular, com andamento variável ou ritmos complexos podem gerar resultados imprecisos. A leitura depende de acesso ao arquivo de áudio, inclusive das permissões CORS.

### 7. Separação de stems com IA — recurso experimental

O componente `StemSeparator.vue` integra uma ferramenta de separação de fontes sonoras com **HTDemucs**, utilizando um modelo ONNX e execução no navegador.

Os quatro stems previstos são:

- **Drums** — bateria e percussão.
- **Bass** — baixo.
- **Vocals** — vozes.
- **Other** — demais instrumentos e sons.

O fluxo implementado:
1. O usuário escolhe uma faixa e aciona **AI Separation**.
2. O navegador baixa e decodifica o áudio.
3. Um **Web Worker** carrega o modelo HTDemucs.
4. O processamento gera quatro arquivos WAV.
5. Cada stem recebe um player individual.
6. Os stems podem ser baixados como **WAV**.

A interface apresenta mensagens de status, progresso, erros e prévias. As prévias acompanham as configurações de velocidade e modo Vinyl/Independent. O download renderiza o stem na velocidade escolhida.

**Importante:** a separação é um recurso implementado no código, mas sua operação depende de disponibilidade do modelo, capacidade de memória/processamento do dispositivo, compatibilidade do navegador e acesso às URLs. Não há garantia de funcionamento em todos os ambientes.

### 8. Modelo HTDemucs, cache e build

O worker `src/workers/demucs.worker.js` procura o modelo em `demucs/htdemucs.onnx`, relativo ao endereço do worker. O modelo tem aproximadamente **166 MB**.

O código tenta reutilizar o download via **Cache API** (`gpgc-demucs-v1`), reduzindo a necessidade de baixar o modelo em sessões posteriores quando o cache está disponível.

O script `scripts/build-demucs.cjs`, executado antes de `serve` e `build`, faz:
- Empacotamento do worker com **esbuild**.
- Cópia do arquivo ONNX do pacote `node_modules/demucs` para `public/demucs/`.
- Cópia de arquivos WebAssembly do ONNX Runtime.

**Atenção ao deploy:** o arquivo ONNX foi retirado do histórico do Git por ultrapassar o limite de 100 MB do GitHub. O script de build ainda tenta copiá-lo a partir de `node_modules`. Portanto, o fato de o arquivo estar no `.gitignore` **não significa, por si só, que ele ficará ausente do artefato de produção**. É necessário verificar os limites do provedor de hospedagem, a disponibilidade do modelo durante o build e o acesso ao arquivo publicado. Hospedagem externa é uma opção futura, mas **não está configurada no worker consultado**.

### 9. Autenticação e gestão do catálogo

O projeto mantém rotas para login e administração de conteúdo.

Operações previstas nas páginas existentes:
- Criar e editar **releases**.
- Criar e editar **artists**.
- Criar e editar **featurings**.
- Criar e editar **soundtracks**.

As rotas de criação e edição possuem a marcação `requiresAuth` no roteador. A interface também utiliza o estado de autenticação para mostrar links de edição. A efetividade do controle de acesso deve ser garantida pela lógica de autenticação e pela API, não apenas pela visibilidade dos botões.

Existe também a rota `/discos`, preservada do projeto.

## Arquitetura e tecnologias

| Camada | Tecnologia |
| --- | --- |
| Interface | Vue 3 |
| Roteamento | Vue Router 4 |
| Estado global | Vuex 4 |
| Build do frontend | Vue CLI 5 |
| Comunicação HTTP | Axios / Fetch |
| Áudio | HTMLAudioElement, Web Audio API |
| BPM | Análise de sinal em JavaScript |
| Separação de stems | Demucs, ONNX Runtime Web |
| Processamento em segundo plano | Web Workers |
| Empacotamento do worker | esbuild |
| Backend | Ruby on Rails API |

### Componentes e arquivos relevantes

```text
src/
├── App.vue
├── components/
│   ├── NavBar.vue
│   ├── CreateBar.vue
│   ├── EntryModal.vue
│   ├── PlayerBar.vue
│   └── StemSeparator.vue
├── pages/
│   ├── SpatialPage.vue
│   ├── DiscosPage.vue
│   ├── LoginPage.vue
│   ├── CreateReleasePage.vue
│   ├── CreateArtistPage.vue
│   ├── CreateFeaturingPage.vue
│   ├── CreateSoundtrackPage.vue
│   └── Update*.vue
├── router/
│   └── index.js
├── store/
│   └── index.js
├── utils/
│   └── detect-bpm.js
└── workers/
    └── demucs.worker.js

scripts/
└── build-demucs.cjs

public/
└── demucs/          # assets gerados durante o build
```

## API

Por padrão, o frontend utiliza:

```dotenv
VUE_APP_API_BASE_URL=https://gpgc-api.onrender.com
```

Endpoints documentados no projeto:

```text
GET /api/v1/releases
GET /api/v1/releases/:slug
GET /api/v1/artists
GET /api/v1/artists/:slug
GET /api/v1/featurings
GET /api/v1/soundtracks
GET /api/v1/songs
```

Os dados vêm da API; a aplicação não deve depender de conteúdo fictício como substituto silencioso de falhas de conexão.

**Repositórios:**
- Frontend atual: https://github.com/guerrinharj/gpgc-vue-v2
- Backend: https://github.com/guerrinharj/gpgc-api

## Instalação e desenvolvimento

### Requisitos

- Node.js **18 ou superior**, conforme documentação do projeto.
- npm.
- Acesso à API e às URLs de mídia.

### Executar localmente

```bash
git clone https://github.com/guerrinharj/gpgc-vue-v2.git
cd gpgc-vue-v2
npm install
npm run serve
```

O servidor normalmente estará disponível em `http://localhost:8080`, salvo indicação diferente do terminal.

### Comandos

```bash
npm run serve          # gera os assets Demucs e inicia o servidor
npm run build          # gera os assets Demucs e compila para produção
npm run lint           # executa o lint
npm run demucs:build   # gera o worker e copia os assets do Demucs
```

### Configuração de ambiente

A URL da API pode ser alterada em `.env`:

```dotenv
VUE_APP_API_BASE_URL=https://gpgc-api.onrender.com
```

Reinicie o servidor após alterações no ambiente.

## Rotas públicas

| Rota | Destino |
| --- | --- |
| `/` | Releases |
| `/releases` | Releases |
| `/releases/:slug` | Detalhes de um lançamento |
| `/artists` | Artists |
| `/artists/:slug` | Detalhes de artista |
| `/featurings` | Featurings |
| `/featurings/:slug` | Detalhes de participação |
| `/soundtracks` | Soundtracks |
| `/soundtracks/:slug` | Detalhes de trilha |
| `/about` | About |
| `/discos` | Página Discos |
| `/login` | Login |

As rotas administrativas de criação e atualização existem em paralelo.

## Requisitos de hospedagem

1. **Fallback SPA:** como o projeto utiliza `createWebHistory`, o servidor deve encaminhar URLs diretas para `index.html`.
2. **CORS:** a API, as capas e os arquivos de áudio precisam ser acessíveis a partir do domínio do frontend. Recursos que buscam e decodificam áudio exigem permissões adequadas.
3. **Assets do Demucs:** verificar se `worker.js`, os arquivos do ONNX Runtime e `htdemucs.onnx` estão presentes e acessíveis no deploy.
4. **Recursos do dispositivo:** o modelo de IA é grande e pode exigir memória e processamento significativos.
5. **Links externos:** algumas obras podem permanecer documentadas mesmo quando seus arquivos ou links originais não estão mais disponíveis.

## Estado e limitações conhecidas

- A detecção de BPM é **aproximada**.
- A preservação de afinação no modo Independent depende do navegador.
- Os efeitos de áudio dependem de suporte à Web Audio API e, para mídia remota, de CORS.
- A separação de stems pode ser lenta ou falhar em dispositivos com poucos recursos.
- O download e o cache do modelo de IA precisam ser testados no ambiente de produção.
- A geração dos assets do Demucs acontece durante o build, mas a publicação do arquivo ONNX precisa ser verificada.
- Não foi confirmada nesta revisão a cobertura por testes automatizados de todos os fluxos.
- O catálogo depende da disponibilidade do backend e dos arquivos de mídia.

## Próximos passos sugeridos

- Validar o deploy completo da separação de stems.
- Decidir entre servir o ONNX junto ao site ou hospedá-lo externamente.
- Adicionar testes para navegação, reprodução, BPM e processamento de stems.
- Melhorar feedback e recuperação de erros de rede e processamento.
- Medir desempenho e consumo de memória da separação no navegador.
- Documentar os contratos da API e o processo de publicação do backend.

---

## Filosofia do projeto

O GPGC parte da ideia de que uma discografia não é apenas uma lista de discos. Ela pode ser um **arquivo navegável de identidades, colaborações, contextos e experimentações sonoras**.

A navegação espacial transforma a consulta ao catálogo em exploração; o player persistente permite ouvir sem interromper essa exploração; e as ferramentas de áudio aproximam o arquivo de um espaço de escuta ativa.

O resultado é um projeto pessoal que funciona simultaneamente como **memória musical, portfólio público e experimento de interface e processamento de áudio**.

---

*Documentação preparada a partir dos arquivos do repositório consultados em 17/11/2026. Algumas funcionalidades dependem de condições externas e devem ser validadas em execução.*
