# Backend

Leia `../docs/agent-context/backend.md` antes de alterar a API.

- Mantenha URL e autorização nas rotas, coordenação nos controllers e SQL nos models.
- Preserve o escopo de `req.institution.id` e `instituicao_id` em toda leitura ou escrita institucional.
- Use transação para alterações compostas de horários, salas ou importações; a autenticação da plataforma é separada da institucional.
