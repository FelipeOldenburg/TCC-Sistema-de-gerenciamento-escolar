# 02: Relatar a partir de horário, sala, setor e mapa

**What to build:** abrir o mesmo fluxo rápido a partir do contexto consultado e registrar referências estáveis que o backend confirma como pertencentes à instituição.

**Blocked by:** 01: Enviar e administrar relato rápido.

**Status:** done

## Contexto e escopo

- Reutilizar um único diálogo de relato em horários, mapa/sala e setores.
- Exibir o resumo do contexto antes da confirmação.
- Persistir IDs relacionais; rótulos do frontend não são fonte de verdade.

## Áreas provavelmente afetadas

- Relatos MVC e schema.
- Página inicial e seções de horários, mapa e setores.
- Painel de Relatos.

## Regras de negócio

- Referências opcionais: horário, sala, setor e área do mapa.
- Cada referência é validada com `instituicao_id` no backend e protegida por FK composta quando aplicável.
- A origem da ação é registrada; data/hora vêm do servidor.

## Critérios de aceite

- [x] Um horário abre o relato já identificado.
- [x] Uma sala ou setor abre o relato já identificado.
- [x] Uma área do mapa pode originar o relato.
- [x] O painel mostra origem e contexto canônico.
- [x] IDs adulterados de outra instituição são recusados sem revelar dados.

## Validações e testes

- Testar cada tipo de contexto e IDs inexistentes/cross-tenant.
- Verificar foco, teclado, loading, erro e toque no diálogo.
- Confirmar no banco que as referências e a instituição estão corretas.
