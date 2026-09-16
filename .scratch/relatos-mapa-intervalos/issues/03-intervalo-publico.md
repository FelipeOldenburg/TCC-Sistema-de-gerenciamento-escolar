# 03: CPD cria intervalo e ele aparece no horário público

**What to build:** permitir que o CPD crie um intervalo associado a vários grupos acadêmicos e que o portal o mostre logo abaixo dos filtros da turma aplicável.

**Blocked by:** None (can start immediately).

**Status:** done

## Contexto e escopo

- Introduzir grupos acadêmicos genéricos e sincronizar curso, ano e turma encontrados nas importações.
- Criar intervalo com nome, início, fim e um ou mais grupos.
- Mostrar somente intervalos ativos aplicáveis à seleção pública.

## Áreas provavelmente afetadas

- Schema, checagem de banco e importação de horários.
- Horários MVC e rotas.
- Página pública de horários e painel CPD.

## Regras de negócio

- Grupo pertence à instituição e possui tipo curso, ano, série, turma ou nível.
- Intervalo exige ao menos um grupo da mesma instituição e `início < fim`.
- Ordenação é cronológica; não há dias, turnos ou exceções nesta entrega.

## Critérios de aceite

- [x] O CPD cria um intervalo com vários grupos.
- [x] A turma aplicável vê nome e faixa de horário.
- [x] Outra turma não vê o intervalo indevido.
- [x] A solução não depende exclusivamente de curso.
- [x] Grupo de outra instituição não pode ser associado.

## Validações e testes

- Model/controller: horário inválido, lista vazia, IDs repetidos e cross-tenant.
- Componente: estado vazio e filtragem por curso/ano/turma.
- Browser mobile: faixa legível sem rolagem horizontal obrigatória.
