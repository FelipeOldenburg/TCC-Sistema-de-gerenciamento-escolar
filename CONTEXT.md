# Gestão Escolar Multi-instituição

Vocabulário canônico dos domínios compartilhados pela consulta pública e pela administração institucional.

## Instituição e acesso

**Instituição**:
Escola cujos usuários, configurações, espaços e dados acadêmicos formam um domínio isolado das demais escolas.
_Evitar_: tenant, conta

**Usuário institucional**:
Pessoa autenticada que atua em uma única instituição com um papel institucional.
_Evitar_: usuário da plataforma

**CPD**:
Papel institucional responsável por revisar publicações e administrar conteúdo, espaços e configurações da escola.
_Evitar_: ADMIN, administrador da plataforma

**Operador do URÂNIA**:
Papel institucional que envia arquivos de horários para revisão, identificado no sistema pelo código `ADMIN`.
_Evitar_: CPD, gestor institucional

**Gestor da plataforma**:
Usuário da administração central que gerencia instituições e seus usuários, separado dos usuários institucionais.
_Evitar_: CPD, operador do URÂNIA

## Organização acadêmica

**Grupo acadêmico**:
Agrupamento institucional ao qual uma configuração escolar pode se aplicar, como curso, ano, série, turma ou nível de ensino.
_Evitar_: curso, quando o conceito também abrange escolas sem cursos

**Intervalo**:
Pausa configurada pela instituição, definida por nome, início, fim e um ou mais grupos acadêmicos aplicáveis.
_Evitar_: intervalo do curso, recreio hardcoded

**Horário publicado**:
Aula de uma publicação de horários aprovada e ativa para sua instituição e escopo.
_Evitar_: horário importado, quando a importação ainda não foi aprovada

## Espaços e localização

**Bloco**:
Agrupamento físico institucional que contém salas.
_Evitar_: mapa, prédio quando a instituição usa outra nomenclatura

**Sala**:
Ambiente institucional localizado em um bloco e utilizável pelos horários escolares.
_Evitar_: setor, área do mapa

**Setor**:
Unidade de atendimento ou organização da instituição que pode possuir uma localização no mapa.
_Evitar_: sala, bloco

**Mapa escolar**:
Conjunto de vistas 2D que representa os espaços de uma instituição para orientação do público.
_Evitar_: planta técnica, mapa 3D

**Vista do mapa**:
Representação 2D de uma parte ou piso do mapa escolar.
_Evitar_: mapa completo, quando existem vários pisos ou vistas

**Área do mapa**:
Região interativa de uma vista, opcionalmente associada a um setor, sala ou bloco da mesma instituição.
_Evitar_: posição inventada, associação por nome

## Relatos

**Relato rápido**:
Aviso categorizado sobre uma informação ou condição escolar que pode ser enviado sem texto livre.
_Evitar_: ouvidoria, reclamação, manifestação

**Contexto do relato**:
Referências disponíveis no ponto de origem do relato, como horário, sala, setor, área do mapa, turma ou página.
_Evitar_: descrição obrigatória

**Status do relato**:
Etapa de tratamento do relato: novo, em análise, resolvido ou descartado.
_Evitar_: status da publicação
