# 01: Enviar e administrar relato rápido

**What to build:** permitir que qualquer usuário registre um relato escolhendo somente uma categoria e que o CPD da mesma instituição consulte, filtre e altere seu status.

**Blocked by:** None (can start immediately).

**Status:** done

## Contexto e escopo

- Reutilizar a persistência, rate limit e fluxo administrativo da ouvidoria existente.
- Preservar registros e contrato legado enquanto a interface passa a usar “Relatar problema” e “Relatos”.
- Tornar perfil, assunto e detalhes opcionais; categoria permanece obrigatória.
- Manter `ADMIN` sem acesso administrativo.

## Áreas provavelmente afetadas

- Schema idempotente e checagem de banco.
- Conteúdo MVC e rotas públicas/CPD.
- Navegação pública, formulário de relato e painel administrativo.

## Regras de negócio

- Estado inicial Novo.
- Categorias específicas e compactas.
- Texto opcional continua sanitizado e moderado quando fornecido.
- Toda leitura e atualização filtra a instituição resolvida no backend.

## Critérios de aceite

- [x] Um relato é criado apenas com categoria e confirmação.
- [x] Detalhes livres são opcionais e limitados.
- [x] O CPD lista por status/categoria e muda o estado.
- [x] Usuário sem CPD não lista nem altera relatos.
- [x] Registro de outra instituição não é visível nem alterável.
- [x] Registros legados continuam legíveis.

## Validações e testes

- Controller/model: payload mínimo, categoria inválida, filtro tenant e alteração inexistente.
- Componente: envio sem texto, loading, erro e sucesso.
- Browser desktop/mobile: seleção de categoria e confirmação.
