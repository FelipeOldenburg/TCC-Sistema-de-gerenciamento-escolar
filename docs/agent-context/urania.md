# URÂNIA UP

Carregue este contexto para arquivos em `server/uraniaParser.js`, `server/parsers/**` e rotas/modelos de importação.

## Fontes e responsabilidade

- `server/uraniaParser.js` é chamado pela API e define o comportamento em produção.
- `server/parsers/urania_up.py` documenta os casos do formato HTML e possui o teste de referência; não o trate como caminho de execução da aplicação.

## Contrato de importação

O relatório HTML “Turmas Geral” traz turmas, dias, horários e células como `Disciplina (Professor)`, mas não contém salas. O `IMPORT_URANIA.XML` traz ambiente, dia, período e códigos; quando acompanhado de `URANEXP.XML`, os códigos de turma, disciplina e professor podem ser resolvidos para nomes.

Aceite arquivos na área temporária, mantenha-os como `PENDENTE` e só publique após a revisão do CPD. A aprovação ou rejeição deve preservar usuário e motivo. Não remova atribuições de sala existentes ao trocar uma versão se elas ainda corresponderem ao horário importado.

Após mudar a lógica do parser, execute `python server/parsers/test_urania_up.py` além das verificações JavaScript aplicáveis.
