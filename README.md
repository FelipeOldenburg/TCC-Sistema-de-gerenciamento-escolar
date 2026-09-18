# CIMOL — Sistema de Gestão Escolar

Aplicação React/Express/PostgreSQL para consulta de horários, integração com o URÂNIA UP, gerenciamento de blocos e salas e solicitações de reorganização por acessibilidade.

## Funcionalidades

### Integração URÂNIA UP

- Upload em lote de relatórios `.html`/`.htm` e arquivos oficiais `.xml`.
- Parser HTML com BeautifulSoup, incluindo ISO-8859-1, `&nbsp;`, `rowspan` e professores com parênteses no nome.
- Compatibilidade com `IMPORT_URANIA.XML`; quando enviado junto, `URANEXP.XML` resolve os códigos de turmas, disciplinas e professores.
- Área temporária com status `PENDENTE`.
- Prévia por turma antes da publicação.
- Aprovação ou rejeição pelo CPD, com registro do usuário e motivo.
- Histórico de importações e apenas uma publicação ativa por escopo.
- Endpoint público consumido pela página de horários, alunos, professores e totens.

### Blocos e salas

- CRUD completo de blocos.
- CRUD completo de salas, com bloco, andar, capacidade, tipo, recursos, softwares e observações.
- Softwares normalizados em relacionamento muitos-para-muitos.
- Filtros públicos por bloco, tipo, capacidade, software e recursos.
- Ambientes vindos do XML do URÂNIA são associados automaticamente a salas com o mesmo nome.

### Segurança

- Usuários persistidos com papéis `ADMIN` e `CPD`.
- Senhas derivadas com `scrypt` e salt individual.
- Sessões opacas em cookies `HttpOnly` e expiração de oito horas.
- `ADMIN` (operador URÂNIA): somente upload de arquivos; não acessa histórico nem outros módulos administrativos.
- `CPD`: visualização, aprovação/rejeição, histórico e acesso às demais páginas, incluindo blocos, salas e reorganização.

## Tecnologias

- React, TypeScript, Vite, TailwindCSS e Shadcn UI.
- Node.js, Express, Multer e PostgreSQL.
- Python 3 e BeautifulSoup 4 para os relatórios HTML do URÂNIA.
- Swagger/OpenAPI em `/api-CIMOL/docs`.

## Organização MVC

```text
src/
  pages/ e components/  views React
  controllers/          hooks com estado, efeitos e ações de tela
  lib/                  transporte HTTP e utilitários compartilhados

server/
  index.js              composição da aplicação, middleware e inicialização
  routes/               URL e autorização de cada domínio
  controllers/          entrada HTTP e regras de coordenação
  models/               consultas e persistência PostgreSQL
```

Novas funcionalidades devem ficar no domínio correspondente: a rota só liga URL, middleware e controller; o controller não contém SQL; o model recebe os dados já validados. Componentes React permanecem views; fluxos que coordenam autenticação, estado persistido ou múltiplas chamadas de dados usam um hook em `src/controllers/`.

## Pré-requisitos

1. Node.js 18 ou superior.
2. PostgreSQL.
3. Python 3.10 ou superior.

## Instalação

```bash
npm install
python -m pip install -r server/requirements.txt
```

Copie `.env.example` para `.env` e configure banco, usuários iniciais e senhas. Em Windows, se Python não estiver no `PATH`, informe o caminho em `PYTHON_BIN`.

Para um banco já existente, valide as relações entre instituições, aplique o schema e valide novamente antes de iniciar a API:

```bash
npm run db:preflight
npm run db:migrate
npm run db:check
```

Para um ambiente vazio, execute `npm run db:bootstrap` no lugar de `db:migrate`: ele aplica o schema e cria usuários, conteúdo e salas iniciais. Não o execute rotineiramente em produção, pois ele pode redefinir as senhas de bootstrap configuradas no ambiente.

`db:migrate` aplica o schema idempotente de forma explícita; a API nunca executa DDL no startup. Se a API estiver no pooler transacional do Supabase (porta 6543), o comando de migração usa a porta 5432 somente nesse processo. Ela corresponde ao pooler de sessão em redes IPv4; uma conexão direta ao banco continua preferível quando houver IPv6 ou o complemento IPv4.

Para criar um banco local do zero, defina `DB_CREATE_DATABASE=true` apenas durante `db:bootstrap` e volte-o para `false` em seguida. Em Supabase, mantenha-o sempre como `false`.

## Execução

```bash
npm run dev
```

- Site local: `http://localhost/` com a configuração de descoberta em rede presente em `scripts/dev-web.mjs`.
- API: `http://localhost:3001`.
- Swagger: `http://localhost:3001/api-CIMOL/docs`.

O frontend usa rotas `/api` relativas, encaminhadas ao Express pelo proxy do Vite.

## Deploy em subdominio publico

Para producao, publique o frontend gerado por `npm run build` no subdominio HTTPS, por exemplo `https://horarios.seudominio.edu.br`, e encaminhe `/api` para o processo Node/Express. Esse modelo mantem o frontend e a API no mesmo origin visto pelo navegador e simplifica cookies e CORS.

Variaveis recomendadas no servidor:

```bash
NODE_ENV=production
PUBLIC_ORIGIN=https://horarios.seudominio.edu.br
TRUST_PROXY=1
COOKIE_SECURE=true
COOKIE_SAMESITE=Lax
```

Em Vercel ou qualquer ambiente publico, `DB_HOST` deve apontar para um PostgreSQL gerenciado/acessivel pela internet. `localhost` funciona apenas na maquina de desenvolvimento. Em Supabase, configure uma `DATABASE_URL` exclusiva do servidor, `DB_SSL=true`, `DB_SSL_REJECT_UNAUTHORIZED=true`, a CA PEM baixada em **Database Settings → SSL Configuration** (em `DB_SSL_CA`, ou em `DB_SSL_CA_FILE` no desenvolvimento) e `DB_CREATE_DATABASE=false`. Em Vercel, o pool da aplicação usa uma conexão por instância por padrão.

Execute `npm run db:preflight`, `npm run db:migrate` e `npm run db:check` antes de trocar o tráfego para uma nova versão. O preflight detecta relações entre instituições diferentes; a verificação final também exige as constraints compostas. Não exponha a URL do PostgreSQL, chaves Supabase ou credenciais de banco em variáveis `VITE_*`. O schema mantém RLS habilitado como bloqueio de acesso direto; a role usada pelo Express e as policies devem ser verificadas em homologação antes do corte.

As operações de reorganização exigem uma sessão de CPD; a antiga chave `x-api-key` não é mais aceita.

O cadastro base de instituicao fica em `instituicoes`. Em localhost a API usa `DEFAULT_INSTITUTION_SLUG=cimol`; em dominio real, o primeiro subdominio pode identificar a escola. A configuracao publica da marca esta em `GET /api/instituicao`.

O painel administrativo da escola fica em `/admin` e usa usuarios `ADMIN`/`CPD` da propria instituicao. A gestao central das instituicoes fica separada em `/plataforma` e usa `PLATFORM_ADMIN_USER`/`PLATFORM_ADMIN_PASSWORD`.

Se a API ficar em outro subdominio, configure `ALLOWED_ORIGINS` no backend e `VITE_API_BASE_URL` no build do frontend. Em sites diferentes, use `COOKIE_SAMESITE=None` junto de `COOKIE_SECURE=true`; mutações com sessão rejeitam origens que não estejam permitidas. Se quiser rodar tudo em um unico processo Express, execute `npm run build` e use `SERVE_STATIC=true`; nesse modo o Express serve o `dist/` e mantem as rotas `/api`.

Nao use o servidor Vite (`npm run dev` ou `npm run dev:web`) como servidor publico. Ele existe apenas para desenvolvimento.

## Formatos URÂNIA

O relatório HTML esperado é “Turmas Geral”: primeira linha com turmas, primeira coluna com dias, segunda com horários e células no formato `Disciplina (Professor)`. Colunas `Coord` e `Reun` são preservadas para auditoria, mas não aparecem como turmas públicas. O HTML não contém salas.

O formato oficial `IMPORT_URANIA.XML` inclui `AMBIENTE`, dia, período e códigos de turma, professor e disciplina. Para exibir nomes em vez de códigos, envie também o `URANEXP.XML` correspondente.

## Testes e validação

```bash
npm test
npm run build
python server/parsers/test_urania_up.py
```

A API pública de salas está em `GET /api/salas`; horários aprovados estão em `GET /api/horarios/publicados`.
