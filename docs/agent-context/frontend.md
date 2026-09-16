# Frontend

Carregue este contexto para mudanças em `src/**`, interface, chamadas HTTP ou marca institucional.

## Estrutura

- `src/pages/` e `src/components/` renderizam views.
- `src/controllers/` contém hooks para estado persistido, efeitos e ações que coordenam uma tela.
- `src/models/` guarda modelos locais simples; `src/lib/` concentra API, marca institucional e utilitários.

## Comunicação com a API

Use `apiFetch` de `src/lib/api.ts` em novas chamadas. Ele inclui credenciais, aplica `VITE_API_BASE_URL` e envia `x-institution-slug` nas rotas institucionais. Rotas da plataforma e de gestão central não recebem esse cabeçalho.

Ao enviar `FormData`, não fixe `Content-Type`: o navegador inclui o boundary. Para payload JSON, `apiFetch` define o cabeçalho automaticamente. Erros HTTP chegam como `ApiError` com status e mensagem da API.

## Marca e interface

`src/lib/institution.ts` busca `GET /api/instituicao`, atualiza o título e as variáveis de tema. Preserve esse fluxo ao adicionar campos de marca. Reuse os componentes de `src/components/ui` e os padrões visuais existentes; não adicione bibliotecas ou wrappers globais sem uso imediato.

Para um fluxo novo que misture estado persistido, efeitos ou várias chamadas, mantenha a página como view e crie um hook em `src/controllers/`.
