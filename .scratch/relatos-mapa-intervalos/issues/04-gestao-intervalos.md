# 04: Editar e desativar intervalos

**What to build:** completar o ciclo de gestão para que o CPD altere dados/grupos e desative um intervalo sem apagar o registro.

**Blocked by:** 03: CPD cria intervalo e ele aparece no horário público.

**Status:** done

## Contexto e escopo

- Reutilizar o mesmo formulário de criação no modo de edição.
- Oferecer desativação e reativação por edição; “remover” desativa.

## Áreas provavelmente afetadas

- Horários MVC e painel CPD de Intervalos.

## Regras de negócio

- Edição e desativação sempre filtram `id + instituicao_id`.
- Intervalo inativo permanece no painel e não aparece no portal.

## Critérios de aceite

- [x] O CPD edita nome, horários, estado e grupos.
- [x] O CPD desativa um intervalo e ele deixa de aparecer publicamente.
- [x] ID de outra instituição resulta em não encontrado.
- [x] Loading, erro e estado vazio são claros.

## Validações e testes

- Controller/model: edição, desativação, not-found tenant-safe.
- Interface: criação, edição e desativação em desktop/mobile.
