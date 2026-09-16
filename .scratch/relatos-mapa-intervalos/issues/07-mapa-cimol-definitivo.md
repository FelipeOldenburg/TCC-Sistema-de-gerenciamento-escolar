# 07: Publicar o mapa físico definitivo do CIMOL

**What to build:** transformar as plantas e a referência consolidada fornecidas pelo usuário em vistas e áreas verificadas do CIMOL, incluindo pátios e conexões confirmadas.

**Blocked by:** 05: Preparar mapa 2D dirigido por dados reais; 06: Navegar entre setor e sua área no mapa; recebimento dos PDFs, montagem consolidada, dados dos dois pátios e correções da planta.

**Status:** blocked

## Contexto e escopo

- Inventariar somente elementos comprovados pelas fontes.
- Registrar lacunas como pendentes em vez de inferir geometria.
- Associar setores/salas/blocos somente após conferência dos IDs existentes.

## Áreas provavelmente afetadas

- Dados institucionais de mapa e eventual material visual derivado.

## Regras de negócio

- Nenhuma posição, dimensão, conexão ou ambiente pode ser inventado.
- Os dois pátios dependem da referência complementar do usuário.

## Critérios de aceite

- [ ] Todas as áreas publicadas possuem fonte verificável.
- [ ] Pátios e conexões foram conferidos pelo usuário.
- [ ] Desktop e mobile permanecem legíveis e acessíveis.
- [ ] Nenhum detalhe técnico desnecessário foi incorporado.

## Validações e testes

- Conferência visual contra cada planta e referência consolidada.
- Teste dos vínculos por ID e do isolamento institucional.
- Validação final em desktop e celular.
