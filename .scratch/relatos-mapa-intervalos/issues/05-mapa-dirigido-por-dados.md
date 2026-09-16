# 05: Preparar mapa 2D dirigido por dados reais

**What to build:** substituir a imagem 3D e os marcadores artificiais por uma visualização SVG que usa somente vistas e áreas institucionais fornecidas pela API, com estado vazio enquanto as plantas não foram processadas.

**Blocked by:** None (can start immediately).

**Status:** done

## Contexto e escopo

- Criar vistas de mapa e áreas interativas com geometria SVG validada.
- Disponibilizar leitura pública e escrita transacional CPD para posterior ingestão.
- Não inserir qualquer geometria ou seed do CIMOL.

## Áreas provavelmente afetadas

- Schema e facilities MVC.
- Componente público do mapa e testes.

## Regras de negócio

- Mapa, área e qualquer entidade associada pertencem à mesma instituição.
- Uma área referencia no máximo um setor, sala ou bloco.
- Não renderizar markup vindo do banco; somente atributos geométricos validados.
- Vistas inativas não aparecem ao público.

## Critérios de aceite

- [x] Instituição sem dados vê um estado vazio honesto.
- [x] Uma vista criada via API renderiza áreas SVG selecionáveis.
- [x] Áreas funcionam por clique, toque, Enter e Espaço.
- [x] Outra instituição não consulta nem altera a vista por ID.
- [x] Não existe posição, dimensão ou conexão inventada do CIMOL.

## Validações e testes

- API: payload geométrico inválido, referências cross-tenant e atualização transacional.
- Componente: vazio, erro, seleção e teclado.
- Browser: responsividade e console sem erros.
