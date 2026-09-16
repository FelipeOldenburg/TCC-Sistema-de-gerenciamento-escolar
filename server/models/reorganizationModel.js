export const createReorganizationModel = ({ db }) => ({
  list: async ({ institutionId, paginated, page, pageSize }) => {
    const limitClause = paginated ? "LIMIT ? OFFSET ?" : "";
    const params = paginated ? [institutionId, pageSize, (page - 1) * pageSize] : [institutionId];
    const [rows] = await db.query(
      `SELECT r.id, a.nome AS aluno, a.ano, a.turma, a.curso, r.problema,
              r.arquivo_nome, TO_CHAR(r.data, 'YYYY-MM-DD') AS data,
              STRING_AGG(sr.sala, ', ' ORDER BY sr.sala) AS salas
         FROM reorganizacoes r
         JOIN alunos a ON r.aluno_id = a.id
         LEFT JOIN reorganizacao_salas_relacionadas sr ON r.id = sr.reorganizacao_id
        WHERE a.instituicao_id = ?
        GROUP BY r.id, a.id
        ORDER BY r.id DESC
        ${limitClause}`,
      params
    );
    if (!paginated) return { rows };
    const [countRows] = await db.query(
      "SELECT COUNT(*) AS total FROM reorganizacoes r JOIN alunos a ON a.id = r.aluno_id WHERE a.instituicao_id = ?",
      [institutionId]
    );
    return { rows, total: Number(countRows[0].total) };
  },

  findOrCreateStudent: async (conn, { institutionId, aluno, ano, turma, curso }) => {
    const [existingStudents] = await conn.query(
      "SELECT id FROM alunos WHERE instituicao_id = ? AND nome = ? AND ano = ? AND turma = ? AND curso = ?",
      [institutionId, aluno, ano, turma, curso]
    );
    if (existingStudents[0]?.id) return existingStudents[0].id;
    const [newStudent] = await conn.query(
      "INSERT INTO alunos (instituicao_id, nome, ano, turma, curso) VALUES (?, ?, ?, ?, ?) RETURNING id",
      [institutionId, aluno, ano, turma, curso]
    );
    return newStudent.insertId;
  },

  create: async (conn, { studentId, problema, file }) => {
    const [result] = await conn.query(
      `INSERT INTO reorganizacoes (aluno_id, problema, arquivo_nome, arquivo_dados, data)
       VALUES (?, ?, ?, ?, CURRENT_DATE)
       RETURNING id`,
      [studentId, problema, file?.originalname || null, file?.buffer || null]
    );
    return result.insertId;
  },

  addRooms: async (conn, requestId, rooms) => {
    const names = [...new Set(rooms.map((value) => String(value || "").trim().slice(0, 50)).filter(Boolean))];
    for (const room of names) {
      await conn.query(
        "INSERT INTO reorganizacao_salas_relacionadas (reorganizacao_id, sala) VALUES (?, ?) ON CONFLICT DO NOTHING",
        [requestId, room]
      );
    }
  },

  findAttachment: async ({ id, institutionId }) => {
    const [rows] = await db.query(
      `SELECT r.arquivo_nome, r.arquivo_dados
         FROM reorganizacoes r
         JOIN alunos a ON a.id = r.aluno_id
        WHERE r.id = ? AND a.instituicao_id = ?`,
      [id, institutionId]
    );
    return rows[0] || null;
  },

  delete: ({ id, institutionId }) =>
    db.query(
      `DELETE FROM reorganizacoes r
        USING alunos a
       WHERE a.id = r.aluno_id
         AND r.id = ?
         AND a.instituicao_id = ?`,
      [id, institutionId]
    ),
});
