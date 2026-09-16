# 06: Navegar entre setor e sua área no mapa

**What to build:** permitir que um setor associado abra e destaque sua área e que a área selecionada leve de volta às informações do setor.

**Blocked by:** 05: Preparar mapa 2D dirigido por dados reais.

**Status:** done

## Contexto e escopo

- Manter a localização textual do setor.
- Expor IDs de mapa/área na listagem pública quando houver vínculo ativo.
- Coordenar as abas públicas sem criar novas páginas.

## Áreas provavelmente afetadas

- Conteúdo e facilities MVC.
- Página inicial, Setores e Mapa.

## Regras de negócio

- O vínculo é por FK/ID, nunca por nome.
- Setor ou área inativos não geram ação pública.
- Associação de tenants diferentes é recusada.

## Critérios de aceite

- [x] “Ver no mapa” aparece somente para setor associado.
- [x] A ação abre o mapa e destaca a área correta.
- [x] A área mostra dados básicos e abre o setor correspondente.
- [x] O fluxo funciona em desktop, mobile e teclado.
- [x] Associação setor A + área de instituição B falha.

## Validações e testes

- Testes de resposta pública, coordenação de abas e destaque.
- Browser nos dois sentidos e nas duas larguras.
