# Backend

Carregue este contexto para mudanças em `server/**`, endpoints, banco de dados ou autorização.

## Estrutura

- `server/index.js` apenas compõe aplicação, middleware e registro de rotas.
- Arquivos em `server/routes/` associam URL, upload, rate limit e autorização ao controller.
- Controllers validam a entrada, coordenam o caso de uso e formatam a resposta; não concentram SQL.
- Models em `server/models/` executam consultas PostgreSQL. Serviços cobrem regras que usam várias operações ou transações.

## Fluxo de requisição

O middleware adiciona ID da requisição, segurança, compressão, CORS, JSON e rate limit. Em `/api`, autenticação institucional e de plataforma são opcionais primeiro; em seguida a instituição é resolvida para rotas institucionais. A ordem importa: uma sessão cuja `instituicao_id` não corresponde à instituição resolvida é descartada.

## Regras práticas

- Receba a instituição do controller por `req.institution` e use `req.institution.id` em toda consulta ou escrita institucional. Não confie em um ID vindo do cliente para cruzar tenants.
- Rotas `/api/plataforma/**` e `/api/instituicoes/**` usam autenticação de plataforma, separada do usuário da escola.
- Use `requireRole("ADMIN")` somente para envio do URÂNIA; use `requireRole("CPD")` para revisão e administração institucional.
- Alterações compostas de importações, horários ou salas devem usar a transação já exposta pelo pool. Mantenha `commit`, `rollback` e `release` no mesmo fluxo.
- O schema é aplicado explicitamente com `npm run db:migrate`; a API não executa DDL no startup. Uma mudança de modelo exige revisar `server/schema.sql`, queries do model e testes relacionados.

## Verificação

Execute as validações indicadas em `AGENTS.md`. Se a alteração tocar o parser, rode também `python server/parsers/test_urania_up.py`.
