const ouvidoriaStatusOrderSql =
  "CASE o.status WHEN 'NOVA' THEN 1 WHEN 'EM_ANALISE' THEN 2 WHEN 'RESOLVIDA' THEN 3 WHEN 'ARQUIVADA' THEN 4 ELSE 99 END";

export const createContentModel = ({ db }) => ({
  listEvents: async ({ institutionId, includeInactive }) => {
    const where = includeInactive
      ? "WHERE instituicao_id = ?"
      : "WHERE instituicao_id = ? AND ativo = TRUE AND data_evento >= CURRENT_DATE";
    const [rows] = await db.query(
      `SELECT id, titulo, descricao, data_evento, TO_CHAR(hora_evento, 'HH24:MI') AS hora_evento,
              local, imagem_url, ativo, created_at, updated_at
         FROM eventos
         ${where}
        ORDER BY data_evento ASC, hora_evento IS NULL, hora_evento ASC, id ASC`,
      [institutionId]
    );
    return rows;
  },

  createEvent: async ({ institutionId, event }) => {
    const [result] = await db.query(
      `INSERT INTO eventos (instituicao_id, titulo, descricao, data_evento, hora_evento, local, imagem_url, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [institutionId, event.titulo, event.descricao, event.data_evento, event.hora_evento, event.local, event.imagem_url, event.ativo]
    );
    return result;
  },

  updateEvent: async ({ id, institutionId, event }) => {
    const [result] = await db.query(
      `UPDATE eventos
          SET titulo = ?, descricao = ?, data_evento = ?, hora_evento = ?, local = ?, imagem_url = ?, ativo = ?
        WHERE id = ? AND instituicao_id = ?`,
      [
        event.titulo,
        event.descricao,
        event.data_evento,
        event.hora_evento,
        event.local,
        event.imagem_url,
        event.ativo,
        id,
        institutionId,
      ]
    );
    return result;
  },

  deleteEvent: async ({ id, institutionId }) => {
    const [result] = await db.query("DELETE FROM eventos WHERE id = ? AND instituicao_id = ?", [id, institutionId]);
    return result;
  },

  listSectors: async ({ institutionId, includeInactive }) => {
    const where = includeInactive ? "WHERE s.instituicao_id = ?" : "WHERE s.instituicao_id = ? AND s.ativo = TRUE";
    const [rows] = await db.query(
      `SELECT s.id, s.nome, s.descricao, s.responsavel, s.localizacao, s.contato, s.horario_atendimento,
              s.icone, s.cor, s.ativo, s.created_at, s.updated_at,
              area.mapa_id, area.id AS mapa_area_id, area.mapa_nome
         FROM setores s
         LEFT JOIN LATERAL (
           SELECT a.id, a.mapa_id, m.nome AS mapa_nome
             FROM mapa_areas a
             JOIN mapas m ON m.id = a.mapa_id AND m.instituicao_id = a.instituicao_id AND m.ativo = TRUE
            WHERE a.setor_id = s.id AND a.instituicao_id = s.instituicao_id
            ORDER BY a.id
            LIMIT 1
         ) area ON TRUE
         ${where}
        ORDER BY s.nome`,
      [institutionId]
    );
    return rows;
  },

  createSector: async ({ institutionId, sector }) => {
    const [result] = await db.query(
      `INSERT INTO setores
       (instituicao_id, nome, descricao, responsavel, localizacao, contato, horario_atendimento, icone, cor, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        institutionId,
        sector.nome,
        sector.descricao,
        sector.responsavel,
        sector.localizacao,
        sector.contato,
        sector.horario_atendimento,
        sector.icone,
        sector.cor,
        sector.ativo,
      ]
    );
    return result;
  },

  updateSector: async ({ id, institutionId, sector }) => {
    const [result] = await db.query(
      `UPDATE setores
          SET nome = ?, descricao = ?, responsavel = ?, localizacao = ?, contato = ?,
              horario_atendimento = ?, icone = ?, cor = ?, ativo = ?
        WHERE id = ? AND instituicao_id = ?`,
      [
        sector.nome,
        sector.descricao,
        sector.responsavel,
        sector.localizacao,
        sector.contato,
        sector.horario_atendimento,
        sector.icone,
        sector.cor,
        sector.ativo,
        id,
        institutionId,
      ]
    );
    return result;
  },

  deleteSector: async ({ id, institutionId }) => {
    const [result] = await db.query("DELETE FROM setores WHERE id = ? AND instituicao_id = ?", [id, institutionId]);
    return result;
  },

  findActiveSector: async ({ id, institutionId }) => {
    const [rows] = await db.query(
      "SELECT id FROM setores WHERE id = ? AND instituicao_id = ? AND ativo = TRUE LIMIT 1",
      [id, institutionId]
    );
    return rows[0] || null;
  },

  resolveManifestationContext: async ({ institutionId, manifestation }) => {
    const context = {};
    for (const [field, query] of [
      ["setor_id", "SELECT id, nome FROM setores WHERE id = ? AND instituicao_id = ? AND ativo = TRUE LIMIT 1"],
      ["sala_id", `SELECT s.id, s.nome, b.nome AS bloco FROM salas s
                    JOIN blocos b ON b.id = s.bloco_id AND b.instituicao_id = s.instituicao_id
                   WHERE s.id = ? AND s.instituicao_id = ? AND s.status = 'ATIVA' LIMIT 1`],
      ["horario_id", `SELECT h.id, h.turma, h.curso, h.ano, h.dia, h.periodo,
                              TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
                              h.disciplina, h.professor, COALESCE(s.nome, h.ambiente) AS sala
                         FROM horarios_importados h
                         JOIN importacoes_horarios i ON i.id = h.importacao_id
                         LEFT JOIN salas s ON s.id = h.sala_id AND s.instituicao_id = h.instituicao_id
                        WHERE h.id = ? AND h.instituicao_id = ? AND i.status = 'APROVADA' AND i.ativa = TRUE
                        LIMIT 1`],
      ["mapa_area_id", `SELECT a.id, a.nome, a.tipo, a.setor_id, a.sala_id, a.bloco_id,
                                m.id AS mapa_id, m.nome AS mapa
                           FROM mapa_areas a
                           JOIN mapas m ON m.id = a.mapa_id AND m.instituicao_id = a.instituicao_id
                          WHERE a.id = ? AND a.instituicao_id = ? AND m.ativo = TRUE LIMIT 1`],
    ]) {
      if (manifestation[field] === null) continue;
      const [rows] = await db.query(query, [manifestation[field], institutionId]);
      if (!rows.length) return null;
      context[field.replace("_id", "")] = rows[0];
    }
    return context;
  },

  createManifestation: async ({ institutionId, manifestation }) => {
    const [result] = await db.query(
      `INSERT INTO ouvidoria_manifestacoes
       (instituicao_id, nome, perfil, categoria, setor_id, sala_id, horario_id, mapa_area_id,
        origem, contexto_json, assunto, mensagem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        institutionId,
        manifestation.nome,
        manifestation.perfil,
        manifestation.categoria,
        manifestation.setor_id,
        manifestation.sala_id,
        manifestation.horario_id,
        manifestation.mapa_area_id,
        manifestation.origem,
        JSON.stringify(manifestation.contexto),
        manifestation.assunto,
        manifestation.mensagem,
      ]
    );
    return result;
  },

  listManifestations: async ({ institutionId, status, category, page, pageSize }) => {
    const params = [institutionId];
    const conditions = ["o.instituicao_id = ?"];
    if (status) {
      conditions.push("o.status = ?");
      params.push(status);
    }
    if (category) {
      conditions.push("o.categoria = ?");
      params.push(category);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const [rows] = await db.query(
      `SELECT o.id, o.nome, o.perfil, o.categoria, o.setor_id, s.nome AS setor_nome,
              o.sala_id, sala.nome AS sala_nome, o.horario_id, o.mapa_area_id,
              area.nome AS mapa_area_nome, mapa.nome AS mapa_nome, o.origem, o.contexto_json,
              o.assunto, o.mensagem, o.status, o.created_at, o.updated_at
         FROM ouvidoria_manifestacoes o
         LEFT JOIN setores s ON s.id = o.setor_id AND s.instituicao_id = o.instituicao_id
         LEFT JOIN salas sala ON sala.id = o.sala_id AND sala.instituicao_id = o.instituicao_id
         LEFT JOIN mapa_areas area ON area.id = o.mapa_area_id AND area.instituicao_id = o.instituicao_id
         LEFT JOIN mapas mapa ON mapa.id = area.mapa_id AND mapa.instituicao_id = o.instituicao_id
         ${where}
        ORDER BY ${ouvidoriaStatusOrderSql}, o.created_at DESC
        LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );
    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM ouvidoria_manifestacoes o ${where}`, params);
    return { rows, total: Number(countRows[0].total) };
  },

  updateManifestationStatus: async ({ id, institutionId, status }) => {
    const [result] = await db.query("UPDATE ouvidoria_manifestacoes SET status = ? WHERE id = ? AND instituicao_id = ?", [
      status,
      id,
      institutionId,
    ]);
    return result;
  },
});
