# Frontend

Leia `../docs/agent-context/frontend.md` antes de alterar a interface.

- Páginas e componentes são views; estado persistido, efeitos e ações que coordenam dados pertencem a hooks em `src/controllers/`.
- Use `apiFetch` para novas chamadas institucionais, pois ele preserva o slug e as credenciais corretas.
- Reutilize os componentes em `src/components/ui` antes de criar novos componentes ou dependências.
