# Especificação: relatos rápidos, mapa escolar e intervalos

## Problem Statement

O portal possui uma ouvidoria longa e genérica, um mapa ilustrativo com posições artificiais e horários sem intervalos configuráveis. Esses comportamentos não representam a finalidade do produto, não permitem aproveitar o contexto da tela e não escalam corretamente para instituições com organizações acadêmicas e estruturas físicas diferentes.

O sistema precisa evoluir sem reescrita: preservar a API própria, o MVC em consolidação, a sessão por cookie, o isolamento por instituição, os componentes existentes e os dados atuais. O desenho definitivo do CIMOL permanece bloqueado até o recebimento das plantas e referências físicas.

## Solution

Substituir a experiência visível de ouvidoria por “Relatar problema”, mantendo a persistência existente compatível e permitindo envio com apenas uma categoria. O relato poderá referenciar por IDs validados um horário, sala, setor ou área do mapa; detalhes textuais serão opcionais. O CPD acompanhará os relatos como novos, em análise, resolvidos ou descartados.

Substituir a ilustração 3D e os marcadores artificiais por um mapa 2D dirigido por dados. Cada instituição terá suas próprias vistas e áreas SVG, e cada área poderá se relacionar por chave estável a um setor, sala ou bloco da mesma instituição. Enquanto não existirem dados reais, a interface exibirá um estado vazio honesto.

Introduzir “grupo acadêmico” como conceito genérico para curso, ano, série, turma ou nível. Intervalos serão configurações institucionais associadas a um ou mais desses grupos, administradas pelo CPD e exibidas junto aos filtros da página de horários.

## User Stories

1. Como aluno, quero relatar um problema escolhendo apenas uma categoria, para avisar a escola em poucos segundos.
2. Como professor, quero relatar um problema a partir de um horário, para que o horário envolvido seja identificado automaticamente.
3. Como usuário do mapa, quero relatar um problema a partir de uma área ou sala, para não precisar descrever manualmente o local.
4. Como usuário de setores, quero relatar um problema a partir de um setor, para que o CPD receba o contexto correto.
5. Como usuário, quero adicionar detalhes somente quando desejar, para que texto livre não seja uma barreira.
6. Como usuário, quero receber confirmação ou erro claro no envio, para saber se o relato foi registrado.
7. Como CPD, quero listar relatos da minha instituição, para tratar somente os avisos sob minha responsabilidade.
8. Como CPD, quero filtrar relatos por status e categoria, para priorizar o trabalho sem uma tela complexa.
9. Como CPD, quero ver categoria, origem, contexto, data e status, para compreender rapidamente cada relato.
10. Como CPD, quero mover um relato entre novo, em análise, resolvido e descartado, para registrar seu tratamento.
11. Como instituição, quero que IDs manipulados de outra instituição sejam recusados, para preservar o isolamento de dados.
12. Como usuário, quero consultar um mapa 2D responsivo, para me orientar no computador ou celular.
13. Como usuário de teclado ou leitor de tela, quero selecionar áreas do mapa por controles acessíveis, para consultar o mesmo conteúdo sem depender do mouse.
14. Como usuário, quero ver um estado vazio quando a instituição ainda não configurou o mapa, para não receber posições inventadas.
15. Como usuário, quero alternar entre vistas ou pisos disponíveis, para navegar pela estrutura real da instituição.
16. Como usuário, quero selecionar uma área e ver informações básicas do setor, sala ou bloco relacionado, para compreender o local.
17. Como usuário de setores, quero acionar “Ver no mapa”, para abrir e destacar a área associada ao setor.
18. Como usuário do mapa, quero abrir o setor associado à área selecionada, para consultar seus dados de atendimento.
19. Como instituição, quero possuir mapas e áreas próprios, para que nenhuma planta dependa da estrutura do CIMOL.
20. Como CPD, quero carregar uma vista e suas áreas por uma API administrativa, para preparar os dados reais sem um editor CAD.
21. Como CPD, quero que associações de mapa com setor, sala ou bloco de outra instituição sejam recusadas, para evitar vazamento entre instituições.
22. Como CPD, quero cadastrar um intervalo com nome, início, fim e grupos acadêmicos, para publicá-lo sem hardcode no frontend.
23. Como CPD, quero editar ou desativar um intervalo, para manter a configuração atualizada sem apagar histórico desnecessariamente.
24. Como CPD, quero selecionar vários grupos para o mesmo intervalo, para reutilizar uma pausa comum.
25. Como aluno, quero ver os intervalos aplicáveis à turma selecionada logo após os filtros de horários, para compreender a rotina do dia.
26. Como instituição sem cursos técnicos, quero associar intervalos a anos, séries, turmas ou níveis, para usar o recurso sem conceitos do CIMOL.
27. Como instituição, quero que grupos e intervalos permaneçam isolados, para impedir associação por IDs de outra escola.
28. Como operador do URÂNIA, quero continuar limitado ao envio de importações, para que as novas funções administrativas não ampliem meu papel.
29. Como CPD, quero continuar usando os padrões visuais e de formulário existentes, para ter uma experiência consistente.
30. Como mantenedor, quero validar os fluxos do navegador até o PostgreSQL, para detectar falhas que compilação isolada não encontra.

## Implementation Decisions

- A nomenclatura visível será “Relatar problema” no portal e “Relatos” no painel do CPD. Nomes internos legados poderão permanecer quando sua troca não trouxer benefício funcional.
- A tabela existente de manifestações será evoluída sem perda de dados. Perfil, assunto e mensagem deixarão de ser obrigatórios; as categorias específicas serão adicionadas, mantendo leitura compatível de categorias legadas.
- As categorias públicas serão: horário incorreto, sala/local incorreto, sala indisponível, mudança não atualizada, conflito de horário, localização incorreta e outra informação incorreta.
- Os estados internos existentes serão preservados por compatibilidade e apresentados como Novo, Em análise, Resolvido e Descartado.
- O contexto relacional do relato usará referências opcionais a horário, sala, setor e área do mapa. O backend resolverá e validará essas referências no escopo da instituição; rótulos enviados pelo frontend não serão fonte de verdade.
- Data e hora do relato serão geradas pelo banco/servidor.
- O endpoint público existente será mantido para compatibilidade, protegido pelo rate limit atual. Listagem e alteração de status continuarão exclusivas do CPD.
- O frontend utilizará um único formulário de relato rápido reutilizado pela aba pública e por um diálogo contextual. Categoria será a única entrada obrigatória.
- O papel institucional `ADMIN` não ganhará novas permissões. No contexto deste projeto, administração de relatos, mapas, setores e intervalos pertence ao CPD.
- Um mapa escolar será composto por vistas 2D; cada vista terá nome, piso opcional, dimensões do sistema de coordenadas, estado ativo e áreas.
- Uma área do mapa terá nome, tipo e um caminho SVG. Ela poderá referenciar no máximo um setor, sala ou bloco, sempre da mesma instituição.
- SVG nativo será utilizado porque oferece `viewBox`, foco, seleção, destaque e vínculo direto com dados sem nova dependência. Não haverá conversão automática ou desenho definitivo sem as fontes reais.
- A API pública retornará somente vistas ativas. O CPD poderá criar ou atualizar uma vista completa e suas áreas de forma transacional para posterior ingestão dos dados derivados das plantas.
- O mapa exibirá uma alternativa textual e controles por teclado. A ausência de vistas será tratada como estado vazio, não como erro.
- Setores manterão sua localização textual. Quando associados a uma área ativa, também retornarão os IDs estáveis necessários para “Ver no mapa”.
- Grupo acadêmico será uma entidade institucional com tipo e nome. Os tipos inicialmente reconhecidos serão curso, ano, série, turma e nível.
- Cursos, anos e turmas encontrados nas importações serão sincronizados como grupos acadêmicos da mesma instituição. O modelo não dependerá de imagens ou nomes específicos do CIMOL.
- Intervalos possuirão nome, hora inicial, hora final, estado ativo e associação muitos-para-muitos com grupos acadêmicos.
- Um intervalo deverá ter hora final posterior à inicial e ao menos um grupo da mesma instituição.
- Intervalos serão ordenados automaticamente pela hora inicial e nome. Dias da semana, turno, exceções e ordem manual ficam fora desta entrega por falta de necessidade concreta.
- A remoção na interface será uma desativação, preservando o registro.
- O portal receberá os grupos associados a cada intervalo e mostrará os que combinarem com curso, ano ou turma selecionados.
- Todas as novas consultas e escritas institucionais receberão a instituição resolvida no backend. Nenhuma API aceitará `instituicao_id` do cliente.
- As relações críticas terão chaves estrangeiras compostas com `instituicao_id`, além dos filtros dos models.
- As novas tabelas seguirão a configuração de RLS existente. A role atual da API é proprietária e não há policies; portanto, a proteção efetiva continuará sendo feita pelos filtros backend e constraints compostas, sem introduzir uma política parcial que bloqueie a aplicação.
- O schema idempotente continuará sendo aplicado apenas pelo comando explícito de migration; não haverá DDL no startup nem sistema paralelo de migrations.
- Não serão adicionadas dependências, novas rotas de página ou abstrações genéricas de formulário/CRUD.

## Testing Decisions

- Testes observarão comportamento externo nos mesmos seams já usados: registro de rotas, controllers com models falsos, models com banco falso, componentes com `fetch` simulado e verificação real do schema PostgreSQL.
- Relatos serão testados enviando apenas categoria, preservando contexto por ID e recusando IDs interinstitucionais ou mudança de status sem CPD.
- Mapas serão testados no estado vazio, na seleção acessível de área, nos dois sentidos setor ↔ mapa e na recusa de associação com entidade de outra instituição.
- Intervalos serão testados em criação/edição/desativação, validação de horários, múltiplos grupos, associação interinstitucional recusada e exibição filtrada na página pública.
- O fluxo real será validado em navegador nas larguras desktop e mobile, incluindo loading, vazio, sucesso, erro, console e rede.
- As validações finais serão executadas separadamente: lint, testes, build e checagem do banco. A verificação TypeScript explícita também será executada porque o build atual não faz typecheck.
- O schema será aplicado no PostgreSQL de desenvolvimento e a checagem de constraints institucionais será ampliada para as novas relações.

## Out of Scope

- Desenho definitivo do mapa do CIMOL antes dos PDFs, da referência consolidada dos blocos e das informações dos pátios.
- Invenção de posição, dimensão, conexão, sala, bloco, corredor, pátio ou setor.
- Editor visual, drag-and-drop, CAD, roteamento interno, pan/zoom avançado ou mapa 3D.
- Reconhecimento automático de plantas em PDF nesta etapa.
- Configuração de intervalo por dia da semana, turno, exceção de calendário ou ordem manual.
- Reestruturação geral do frontend, backend, autenticação, importador do URÂNIA ou navegação.
- Nova biblioteca de mapas, formulários ou gerenciamento de estado.
- Acesso direto do frontend ao banco.

## Further Notes

- O repositório já possui blocos, salas, setores, horários publicados, ouvidoria, sessão institucional, papéis, factories MVC, componentes de interface e testes que serão reutilizados.
- O mapa atual usa uma imagem 3D e marcadores por posição fixa; esses elementos não podem continuar como representação oficial.
- O PostgreSQL local contém múltiplas instituições e dados reais de horários, o que permite validar migration e isolamento sem criar conteúdo de mapa.
- Não há PDFs ou referência física anexados ao repositório. A infraestrutura do mapa pode ser concluída, mas seus dados visuais permanecerão pendentes.
- Não há tracker/triagem configurado no repositório; esta especificação foi publicada localmente. Para publicação externa automatizada, configure o tracker antes de executar novamente a skill.
