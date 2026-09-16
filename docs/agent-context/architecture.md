# Arquitetura e invariantes

Carregue este contexto para mudanças que cruzem frontend e backend, mexam em autenticação, instituições ou banco de dados.

## Finalidade

O CIMOL permite consultar horários públicos, administrar salas e blocos, publicar conteúdo escolar e importar horários do URÂNIA UP. A aplicação é multi-instituição: cada escola compartilha a plataforma, mas seus dados e usuários permanecem isolados.

## Mapa do sistema

- `src/`: React/TypeScript/Vite. Páginas e componentes renderizam a interface; `src/controllers/` concentra fluxos de tela; `src/lib/api.ts` é o transporte HTTP; `src/lib/institution.ts` carrega e aplica a marca.
- `server/index.js`: composição, middleware e registro de rotas.
- `server/routes/`, `server/controllers/`, `server/models/`: MVC da API. `server/services/` contém lógica que cruza persistência, como atribuição de sala.
- `server/schema.sql`: schema idempotente do PostgreSQL, aplicado por comando explícito.
- `server/uraniaParser.js`: parser em produção; `server/parsers/urania_up.py` é referência para testes.

## Regras que não podem ser quebradas

1. A instituição é resolvida pelo cabeçalho `x-institution-slug`, subdomínio ou padrão. Consultas e escritas institucionais devem filtrar e gravar `instituicao_id`; uma sessão de outra instituição não pode autorizar a requisição.
2. `ADMIN` somente envia arquivos do URÂNIA. `CPD` revisa importações e administra os módulos da instituição. A plataforma central usa sessão e rotas próprias.
3. Horários importados só ficam públicos após aprovação. Há uma importação ativa por instituição e escopo, e atribuições de sala precisam sobreviver à troca de versão quando ainda forem válidas.
4. Salas usadas por horário publicado não são apagadas definitivamente; o fluxo seguro é desativá-las.

Para regras de um domínio, volte ao arquivo de roteamento em `AGENTS.md` em vez de carregar todos os documentos deste diretório.
