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
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
