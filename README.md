# CIMOL — Sistema de Gestão Escolar

Aplicação React/Express/MySQL para consulta de horários, integração com o URÂNIA UP, gerenciamento de blocos e salas e solicitações de reorganização por acessibilidade.

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
- Node.js, Express, Multer e MySQL2.
- Python 3 e BeautifulSoup 4 para os relatórios HTML do URÂNIA.
- Swagger/OpenAPI em `/api-CIMOL/docs`.

## Pré-requisitos

1. Node.js 18 ou superior.
2. MySQL Server.
3. Python 3.10 ou superior.

## Instalação

```bash
npm install
python -m pip install -r server/requirements.txt
```

Copie `.env.example` para `.env` e configure banco, usuários iniciais e senhas. Em Windows, se Python não estiver no `PATH`, informe o caminho em `PYTHON_BIN`.

O servidor aplica o conteúdo idempotente de `server/schema.sql` ao iniciar. O arquivo também pode ser executado manualmente pelo MySQL Workbench.

## Execução

```bash
npm run dev
```

- Site local: `http://localhost/` com a configuração de descoberta em rede presente em `scripts/dev-web.mjs`.
- API: `http://localhost:3001`.
- Swagger: `http://localhost:3001/api-CIMOL/docs`.

O frontend usa rotas `/api` relativas, encaminhadas ao Express pelo proxy do Vite.

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
