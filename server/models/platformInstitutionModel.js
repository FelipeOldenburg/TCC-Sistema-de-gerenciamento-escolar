export const createPlatformInstitutionModel = ({ db }) => {
  const withTransaction = async (work) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const result = await work(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  };

  return {
    withTransaction,

    listInstitutions: async () => {
      const [rows] = await db.query(
        `SELECT i.id, i.slug, i.nome, i.nome_admin, i.nome_sistema, i.subtitulo_admin, i.logo_url,
                i.cor_primaria_hsl, i.cor_acento_hsl, i.cor_header_hsl, i.cor_nav_hsl, i.cor_nav_ativa_hsl,
                i.ativo, i.created_at, i.updated_at,
                (SELECT COUNT(*) FROM usuarios u WHERE u.instituicao_id = i.id)::int AS total_usuarios,
                (SELECT COUNT(*) FROM salas s WHERE s.instituicao_id = i.id)::int AS total_salas,
                (SELECT COUNT(*) FROM importacoes_horarios h WHERE h.instituicao_id = i.id)::int AS total_importacoes
           FROM instituicoes i
          ORDER BY i.ativo DESC, i.nome`
      );
      return rows;
    },

    createInstitution: async ({ institution, targetDb = db }) => {
      const [result] = await targetDb.query(
        `INSERT INTO instituicoes
         (slug, nome, nome_admin, nome_sistema, subtitulo_admin, logo_url,
          cor_primaria_hsl, cor_acento_hsl, cor_header_hsl, cor_nav_hsl, cor_nav_ativa_hsl, ativo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        [
          institution.slug,
          institution.nome,
          institution.nome_admin,
          institution.nome_sistema,
          institution.subtitulo_admin,
          institution.logo_url,
          institution.cor_primaria_hsl,
          institution.cor_acento_hsl,
          institution.cor_header_hsl,
          institution.cor_nav_hsl,
          institution.cor_nav_ativa_hsl,
          institution.ativo,
        ]
      );
      return result;
    },

    updateInstitution: async ({ id, institution }) => {
      const [result] = await db.query(
        `UPDATE instituicoes
            SET slug = ?, nome = ?, nome_admin = ?, nome_sistema = ?, subtitulo_admin = ?, logo_url = ?,
                cor_primaria_hsl = ?, cor_acento_hsl = ?, cor_header_hsl = ?, cor_nav_hsl = ?,
                cor_nav_ativa_hsl = ?, ativo = ?
          WHERE id = ?`,
        [
          institution.slug,
          institution.nome,
          institution.nome_admin,
          institution.nome_sistema,
          institution.subtitulo_admin,
          institution.logo_url,
          institution.cor_primaria_hsl,
          institution.cor_acento_hsl,
          institution.cor_header_hsl,
          institution.cor_nav_hsl,
          institution.cor_nav_ativa_hsl,
          institution.ativo,
          id,
        ]
      );
      return result;
    },

    institutionExists: async (institutionId) => {
      const [rows] = await db.query("SELECT id FROM instituicoes WHERE id = ? LIMIT 1", [institutionId]);
      return rows.length > 0;
    },

    listUsers: async (institutionId) => {
      const [rows] = await db.query(
        `SELECT id, instituicao_id, nome, usuario, papel, ativo, created_at, updated_at
           FROM usuarios
          WHERE instituicao_id = ?
          ORDER BY ativo DESC, papel DESC, nome`,
        [institutionId]
      );
      return rows;
    },

    createUser: async ({ institutionId, user, password, targetDb = db }) => {
      const [result] = await targetDb.query(
        `INSERT INTO usuarios
         (instituicao_id, nome, usuario, senha_hash, senha_salt, papel, gerencia_instituicoes, ativo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        [institutionId, user.nome, user.usuario, password.hash, password.salt, user.papel, false, user.ativo]
      );
      return result;
    },

    updateUser: async ({ institutionId, userId, user, password, targetDb = db }) => {
      const updates = ["nome = ?", "usuario = ?", "papel = ?", "gerencia_instituicoes = FALSE", "ativo = ?"];
      const params = [user.nome, user.usuario, user.papel, user.ativo];
      if (password) {
        updates.push("senha_hash = ?", "senha_salt = ?");
        params.push(password.hash, password.salt);
      }
      params.push(userId, institutionId);

      const [result] = await targetDb.query(
        `UPDATE usuarios SET ${updates.join(", ")} WHERE id = ? AND instituicao_id = ?`,
        params
      );
      return result;
    },

    deleteUserSessions: (userId, targetDb = db) => targetDb.query("DELETE FROM sessoes WHERE usuario_id = ?", [userId]),
  };
};
