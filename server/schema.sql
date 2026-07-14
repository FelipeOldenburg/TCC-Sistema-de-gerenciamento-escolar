CREATE DATABASE IF NOT EXISTS cimol
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE cimol;

-- =========================================================================
-- 3FN: Criamos uma tabela para Alunos.
-- Isso remove a dependência transitiva: ano, turma e curso dependem do aluno,
-- e não diretamente do registro de reorganização.
-- =========================================================================
CREATE TABLE IF NOT EXISTS alunos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  ano         VARCHAR(20)  NOT NULL,
  turma       VARCHAR(30)  NOT NULL,
  curso       VARCHAR(80)  NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_alunos_lookup (nome, ano, turma, curso)
);

-- =========================================================================
-- 2FN/3FN: Tabela de restrições de acessibilidade / solicitações de reorganização.
-- Agora armazena o id do aluno (chave estrangeira) em vez de duplicar os dados dele.
-- =========================================================================
CREATE TABLE IF NOT EXISTS reorganizacoes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  aluno_id      INT NOT NULL,
  problema      TEXT NOT NULL,
  arquivo_nome  VARCHAR(255) NULL,
  arquivo_dados LONGBLOB NULL,
  data          DATE NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reorganizacoes_data (data, id),
  FOREIGN KEY (aluno_id) REFERENCES alunos(id) ON DELETE CASCADE
);

-- =========================================================================
-- 1FN: Remove o atributo multivalorado (lista de salas separada por vírgula).
-- Cada sala a reorganizar vira uma linha associada ao registro principal.
-- =========================================================================
CREATE TABLE IF NOT EXISTS reorganizacao_salas_relacionadas (
  reorganizacao_id INT NOT NULL,
  sala             VARCHAR(50) NOT NULL,
  PRIMARY KEY (reorganizacao_id, sala),
  FOREIGN KEY (reorganizacao_id) REFERENCES reorganizacoes(id) ON DELETE CASCADE
);

-- =========================================================================
-- Usuários e sessões do painel administrativo.
-- Os usuários iniciais são criados pelo servidor a partir das variáveis de
-- ambiente, pois senhas nunca devem ser mantidas em texto puro neste arquivo.
-- =========================================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  usuario     VARCHAR(80) NOT NULL UNIQUE,
  senha_hash  VARCHAR(128) NOT NULL,
  senha_salt  VARCHAR(64) NOT NULL,
  papel       ENUM('ADMIN', 'CPD') NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessoes (
  token_hash  CHAR(64) PRIMARY KEY,
  usuario_id  INT NOT NULL,
  expires_at  DATETIME NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sessoes_usuario (usuario_id),
  INDEX idx_sessoes_expiracao (expires_at),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- =========================================================================
-- Blocos, salas e softwares instalados.
-- =========================================================================
CREATE TABLE IF NOT EXISTS blocos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL UNIQUE,
  descricao   TEXT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS salas (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  bloco_id              INT NOT NULL,
  nome                   VARCHAR(120) NOT NULL,
  andar                  VARCHAR(40) NOT NULL,
  capacidade             INT UNSIGNED NULL,
  tipo                   VARCHAR(80) NOT NULL,
  status                 ENUM('ATIVA', 'INATIVA', 'MANUTENCAO') NOT NULL DEFAULT 'ATIVA',
  acessivel              BOOLEAN NOT NULL DEFAULT FALSE,
  possui_computadores    BOOLEAN NOT NULL DEFAULT FALSE,
  possui_data_show       BOOLEAN NOT NULL DEFAULT FALSE,
  possui_internet        BOOLEAN NOT NULL DEFAULT FALSE,
  possui_ar_condicionado BOOLEAN NOT NULL DEFAULT FALSE,
  observacoes            TEXT NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_salas_bloco_nome (bloco_id, nome),
  INDEX idx_salas_recursos (possui_computadores, possui_data_show, possui_internet, possui_ar_condicionado),
  INDEX idx_salas_capacidade (capacidade),
  INDEX idx_salas_bloco_andar_nome (bloco_id, andar, nome),
  INDEX idx_salas_tipo (tipo),
  FOREIGN KEY (bloco_id) REFERENCES blocos(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS softwares (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL UNIQUE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sala_softwares (
  sala_id      INT NOT NULL,
  software_id  INT NOT NULL,
  PRIMARY KEY (sala_id, software_id),
  FOREIGN KEY (sala_id) REFERENCES salas(id) ON DELETE CASCADE,
  FOREIGN KEY (software_id) REFERENCES softwares(id) ON DELETE CASCADE
);

-- =========================================================================
-- Conteudo publico administrado pelo CPD: eventos e setores.
-- =========================================================================
CREATE TABLE IF NOT EXISTS eventos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  titulo       VARCHAR(140) NOT NULL,
  descricao    TEXT NULL,
  data_evento  DATE NOT NULL,
  hora_evento  TIME NULL,
  local        VARCHAR(140) NULL,
  imagem_url   VARCHAR(500) NULL,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_eventos_publicos (ativo, data_evento, id)
);

CREATE TABLE IF NOT EXISTS setores (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  nome                 VARCHAR(120) NOT NULL,
  descricao            VARCHAR(255) NOT NULL,
  responsavel          VARCHAR(120) NULL,
  localizacao          VARCHAR(160) NULL,
  contato              VARCHAR(160) NULL,
  horario_atendimento  VARCHAR(160) NULL,
  icone                VARCHAR(40) NOT NULL DEFAULT 'building',
  cor                  VARCHAR(40) NOT NULL DEFAULT 'blue',
  ativo                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_setores_publicos (ativo, nome)
);

CREATE TABLE IF NOT EXISTS ouvidoria_manifestacoes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nome         VARCHAR(120) NULL,
  perfil       ENUM('ALUNO', 'DOCENTE', 'RESPONSAVEL', 'COMUNIDADE') NOT NULL,
  categoria    ENUM('IDEIA', 'MELHORIA', 'PROBLEMA', 'AVISO') NOT NULL,
  setor_id     INT NULL,
  assunto      VARCHAR(120) NOT NULL,
  mensagem     TEXT NOT NULL,
  status       ENUM('NOVA', 'EM_ANALISE', 'RESOLVIDA', 'ARQUIVADA') NOT NULL DEFAULT 'NOVA',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ouvidoria_status_data (status, created_at),
  INDEX idx_ouvidoria_categoria (categoria, created_at),
  FOREIGN KEY (setor_id) REFERENCES setores(id) ON DELETE SET NULL
);

-- =========================================================================
-- Importações do URÂNIA UP e área temporária de horários.
-- Cada lote é revisado antes de se tornar a versão pública ativa.
-- =========================================================================
CREATE TABLE IF NOT EXISTS importacoes_horarios (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  fonte              ENUM('HTML', 'XML', 'MISTO') NOT NULL,
  titulo             VARCHAR(255) NOT NULL,
  escopo_chave       VARCHAR(255) NOT NULL,
  codigo_escola      VARCHAR(25) NULL,
  codigo_turno       VARCHAR(3) NULL,
  nome_turno         VARCHAR(80) NULL,
  status             ENUM('PENDENTE', 'APROVADA', 'REJEITADA') NOT NULL DEFAULT 'PENDENTE',
  ativa              BOOLEAN NOT NULL DEFAULT FALSE,
  lote_hash          CHAR(64) NOT NULL,
  total_arquivos     INT UNSIGNED NOT NULL DEFAULT 0,
  total_horarios     INT UNSIGNED NOT NULL DEFAULT 0,
  total_turmas       INT UNSIGNED NOT NULL DEFAULT 0,
  avisos_json        JSON NULL,
  observacoes_envio  TEXT NULL,
  motivo_rejeicao    TEXT NULL,
  enviado_por        INT NOT NULL,
  revisado_por       INT NULL,
  revisado_em        DATETIME NULL,
  publicado_em       DATETIME NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_importacoes_status_data (status, created_at),
  INDEX idx_importacoes_publicacao (ativa, status, escopo_chave),
  INDEX idx_importacoes_hash (lote_hash),
  FOREIGN KEY (enviado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
  FOREIGN KEY (revisado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS importacao_arquivos (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  importacao_id  INT NOT NULL,
  nome           VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(120) NOT NULL,
  tamanho        INT UNSIGNED NOT NULL,
  sha256         CHAR(64) NOT NULL,
  conteudo       LONGBLOB NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_importacao_arquivos_importacao (importacao_id),
  FOREIGN KEY (importacao_id) REFERENCES importacoes_horarios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS horarios_importados (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  importacao_id   INT NOT NULL,
  categoria       ENUM('TURMA', 'COORDENACAO', 'REUNIAO', 'OUTRO') NOT NULL DEFAULT 'TURMA',
  turma           VARCHAR(120) NOT NULL,
  curso           VARCHAR(120) NULL,
  ano             VARCHAR(20) NULL,
  dia             VARCHAR(3) NOT NULL,
  periodo         TINYINT UNSIGNED NOT NULL,
  hora_inicio     TIME NULL,
  disciplina      VARCHAR(255) NOT NULL,
  professor       VARCHAR(255) NULL,
  ambiente        VARCHAR(120) NULL,
  sala_id         INT NULL,
  tipo_turma      VARCHAR(20) NULL,
  tipo_disciplina VARCHAR(30) NULL,
  valor_original  TEXT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_horarios_importacao (importacao_id),
  INDEX idx_horarios_publicos (categoria, turma, dia, periodo),
  INDEX idx_horarios_publicos_importacao (importacao_id, categoria, turma, dia, periodo),
  INDEX idx_horarios_sala (sala_id),
  FOREIGN KEY (importacao_id) REFERENCES importacoes_horarios(id) ON DELETE CASCADE,
  FOREIGN KEY (sala_id) REFERENCES salas(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sala_alteracoes (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  horario_id          BIGINT NOT NULL,
  usuario_id          INT NOT NULL,
  turma               VARCHAR(120) NOT NULL,
  dia                 VARCHAR(3) NOT NULL,
  periodo             TINYINT UNSIGNED NOT NULL,
  sala_anterior_id    INT NULL,
  sala_nova_id        INT NULL,
  quantidade_alunos   INT UNSIGNED NULL,
  motivo              VARCHAR(255) NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sala_alteracoes_data (created_at, id),
  INDEX idx_sala_alteracoes_horario (horario_id),
  FOREIGN KEY (horario_id) REFERENCES horarios_importados(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
  FOREIGN KEY (sala_anterior_id) REFERENCES salas(id) ON DELETE SET NULL,
  FOREIGN KEY (sala_nova_id) REFERENCES salas(id) ON DELETE SET NULL
);
