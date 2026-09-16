const roomSelect = `
  SELECT s.id, s.instituicao_id, s.nome, s.bloco_id, b.nome AS bloco_nome, s.andar, s.capacidade, s.tipo,
         s.status, s.acessivel, s.possui_computadores, s.possui_data_show, s.possui_internet,
         s.possui_ar_condicionado, s.observacoes, s.created_at, s.updated_at,
         STRING_AGG(sw.nome, '||' ORDER BY sw.nome) AS softwares
    FROM salas s
    JOIN blocos b ON b.id = s.bloco_id AND b.instituicao_id = s.instituicao_id
    LEFT JOIN sala_softwares ss ON ss.sala_id = s.id AND ss.instituicao_id = s.instituicao_id
    LEFT JOIN softwares sw ON sw.id = ss.software_id AND sw.instituicao_id = s.instituicao_id
`;

export const createFacilitiesModel = ({ db, dayOrderSql }) => {
  const ensureBlockBelongsToInstitution = async (conn, blockId, institutionId) => {
    const [rows] = await conn.query("SELECT id FROM blocos WHERE id = ? AND instituicao_id = ? LIMIT 1", [
      blockId,
      institutionId,
    ]);
    return rows.length > 0;
  };

  const saveRoomSoftwares = async (conn, roomId, softwares, institutionId) => {
    await conn.query("DELETE FROM sala_softwares WHERE sala_id = ? AND instituicao_id = ?", [roomId, institutionId]);
    for (const software of softwares) {
      const [result] = await conn.query(
        `INSERT INTO softwares (instituicao_id, nome) VALUES (?, ?)
         ON CONFLICT (instituicao_id, nome) DO UPDATE SET nome = EXCLUDED.nome
         RETURNING id`,
        [institutionId, software]
      );
      await conn.query("INSERT INTO sala_softwares (sala_id, software_id, instituicao_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", [
        roomId,
        result.insertId,
        institutionId,
      ]);
    }
    await conn.query(`DELETE FROM softwares WHERE NOT EXISTS (
      SELECT 1 FROM sala_softwares WHERE sala_softwares.software_id = softwares.id
    ) AND instituicao_id = ?`, [institutionId]);
  };

  const listBlocks = async (institutionId) => {
    const [rows] = await db.query(`
      SELECT b.id, b.nome, b.descricao, b.created_at, b.updated_at,
             COUNT(s.id)::int AS total_salas
        FROM blocos b
        LEFT JOIN salas s ON s.bloco_id = b.id AND s.instituicao_id = b.instituicao_id
       WHERE b.instituicao_id = ?
       GROUP BY b.id
       ORDER BY b.nome
    `, [institutionId]);
    return rows;
  };

  const createBlock = async ({ institutionId, nome, descricao }) => {
    const [result] = await db.query(
      "INSERT INTO blocos (instituicao_id, nome, descricao) VALUES (?, ?, ?) RETURNING id",
      [institutionId, nome, descricao]
    );
    return result;
  };

  const updateBlock = async ({ institutionId, blockId, nome, descricao }) => {
    const [result] = await db.query("UPDATE blocos SET nome = ?, descricao = ? WHERE id = ? AND instituicao_id = ?", [
      nome,
      descricao,
      blockId,
      institutionId,
    ]);
    return result;
  };

  const deleteBlock = async ({ institutionId, blockId }) => {
    const [result] = await db.query("DELETE FROM blocos WHERE id = ? AND instituicao_id = ?", [blockId, institutionId]);
    return result;
  };

  const listRooms = async ({ institutionId, query, authenticated, paginated, page, pageSize }) => {
    const conditions = ["s.instituicao_id = ?"];
    const params = [institutionId];
    if (query.bloco_id) {
      conditions.push("s.bloco_id = ?");
      params.push(query.bloco_id);
    }
    if (query.tipo) {
      conditions.push("s.tipo = ?");
      params.push(query.tipo);
    }
    if (query.capacidade_minima) {
      conditions.push("s.capacidade >= ?");
      params.push(Number(query.capacidade_minima));
    }
    if (query.status) {
      conditions.push("s.status = ?");
      params.push(String(query.status).toUpperCase());
    } else if (!authenticated) {
      conditions.push("s.status = 'ATIVA'");
    }
    for (const resource of [
      "possui_computadores",
      "possui_data_show",
      "possui_internet",
      "possui_ar_condicionado",
    ]) {
      if (query[resource] === "true" || query[resource] === "1") {
        conditions.push(`s.${resource} = TRUE`);
      }
    }
    if (query.software) {
      conditions.push(`EXISTS (
        SELECT 1 FROM sala_softwares filter_ss
        JOIN softwares filter_sw ON filter_sw.id = filter_ss.software_id
      WHERE filter_ss.sala_id = s.id AND filter_ss.instituicao_id = s.instituicao_id
        AND filter_sw.instituicao_id = s.instituicao_id AND filter_sw.nome ILIKE ?
      )`);
      params.push(`%${query.software}%`);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const limitClause = paginated ? "LIMIT ? OFFSET ?" : "";
    const queryParams = paginated ? [...params, pageSize, (page - 1) * pageSize] : params;
    const [rows] = await db.query(
      `${roomSelect} ${where} GROUP BY s.id, b.nome ORDER BY b.nome, s.nome ${limitClause}`,
      queryParams
    );
    if (!paginated) return { rows };

    const [countRows] = await db.query(
      `SELECT COUNT(DISTINCT s.id) AS total
         FROM salas s
         JOIN blocos b ON b.id = s.bloco_id
         LEFT JOIN sala_softwares ss ON ss.sala_id = s.id AND ss.instituicao_id = s.instituicao_id
         LEFT JOIN softwares sw ON sw.id = ss.software_id
       ${where}`,
      params
    );
    return { rows, total: Number(countRows[0].total) };
  };

  const listRoomOccupations = async ({ institutionId, authenticated }) => {
    const publicStatusFilter = authenticated ? "" : "AND s.status = 'ATIVA'";
    const [rows] = await db.query(
      `SELECT h.id, COALESCE(h.sala_id, s.id) AS sala_id, s.nome AS sala_nome, b.nome AS bloco_nome,
              h.turma, h.curso, h.ano, h.dia, h.periodo,
              TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
              h.disciplina, h.professor
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
         LEFT JOIN (
           SELECT MIN(id) AS id, REPLACE(LOWER(TRIM(nome)), ' ', '') AS nome_key
             FROM salas
            WHERE instituicao_id = ?
            GROUP BY nome_key
           HAVING COUNT(*) = 1
         ) sala_importada ON h.sala_id IS NULL
                          AND h.ambiente IS NOT NULL
                          AND sala_importada.nome_key = REPLACE(LOWER(TRIM(h.ambiente)), ' ', '')
         JOIN salas s ON s.id = COALESCE(h.sala_id, sala_importada.id) AND s.instituicao_id = i.instituicao_id
         JOIN blocos b ON b.id = s.bloco_id
        WHERE i.status = 'APROVADA'
          AND i.ativa = TRUE
          AND i.instituicao_id = ?
          AND h.categoria = 'TURMA'
          ${publicStatusFilter}
        ORDER BY b.nome, s.nome, ${dayOrderSql}, h.periodo, h.turma`,
      [institutionId, institutionId]
    );
    return rows;
  };

  const findRoom = async ({ institutionId, roomId, authenticated }) => {
    const publicStatusFilter = authenticated ? "" : "AND s.status = 'ATIVA'";
    const [rows] = await db.query(
      `${roomSelect} WHERE s.instituicao_id = ? AND s.id = ? ${publicStatusFilter} GROUP BY s.id, b.nome`,
      [institutionId, roomId]
    );
    return rows[0] || null;
  };

  const listRoomOccupation = async ({ institutionId, roomId, authenticated }) => {
    const publicStatusFilter = authenticated ? "" : "AND s.status = 'ATIVA'";
    const [rows] = await db.query(
      `SELECT h.id, h.turma, h.curso, h.ano, h.dia, h.periodo,
              TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
              h.disciplina, h.professor
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
         JOIN salas s ON s.id = h.sala_id
        WHERE i.status = 'APROVADA'
          AND i.ativa = TRUE
          AND i.instituicao_id = ?
          AND h.categoria = 'TURMA'
          AND h.sala_id = ?
          AND s.instituicao_id = ?
          ${publicStatusFilter}
        ORDER BY ${dayOrderSql}, h.periodo, h.turma`,
      [institutionId, roomId, institutionId]
    );
    return rows;
  };

  const listRoomChanges = async ({ institutionId, limit }) => {
    const [rows] = await db.query(
      `SELECT a.id, a.horario_id, a.turma, a.dia, a.periodo, a.quantidade_alunos,
              TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
              a.motivo, a.created_at,
              anterior.nome AS sala_anterior,
              nova.nome AS sala_nova,
              u.nome AS usuario_nome
         FROM sala_alteracoes a
         JOIN usuarios u ON u.id = a.usuario_id
         JOIN horarios_importados h ON h.id = a.horario_id
         JOIN importacoes_horarios i ON i.id = h.importacao_id
         LEFT JOIN salas anterior ON anterior.id = a.sala_anterior_id AND anterior.instituicao_id = i.instituicao_id
         LEFT JOIN salas nova ON nova.id = a.sala_nova_id AND nova.instituicao_id = i.instituicao_id
        WHERE i.instituicao_id = ?
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ?`,
      [institutionId, limit]
    );
    return rows;
  };

  const createRoom = async ({ institutionId, room }) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      if (!(await ensureBlockBelongsToInstitution(conn, room.bloco_id, institutionId))) {
        await conn.rollback();
        return null;
      }
      const [result] = await conn.query(
        `INSERT INTO salas
         (instituicao_id, bloco_id, nome, andar, capacidade, tipo, status, acessivel, possui_computadores, possui_data_show,
          possui_internet, possui_ar_condicionado, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        [
          institutionId,
          room.bloco_id,
          room.nome,
          room.andar,
          room.capacidade,
          room.tipo,
          room.status,
          room.acessivel,
          room.possui_computadores,
          room.possui_data_show,
          room.possui_internet,
          room.possui_ar_condicionado,
          room.observacoes,
        ]
      );
      await saveRoomSoftwares(conn, result.insertId, room.softwares, institutionId);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  };

  const updateRoom = async ({ institutionId, roomId, room }) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      if (!(await ensureBlockBelongsToInstitution(conn, room.bloco_id, institutionId))) {
        await conn.rollback();
        return { blockFound: false };
      }
      const [result] = await conn.query(
        `UPDATE salas SET bloco_id = ?, nome = ?, andar = ?, capacidade = ?, tipo = ?, status = ?, acessivel = ?,
         possui_computadores = ?, possui_data_show = ?, possui_internet = ?,
         possui_ar_condicionado = ?, observacoes = ? WHERE id = ? AND instituicao_id = ?`,
        [
          room.bloco_id,
          room.nome,
          room.andar,
          room.capacidade,
          room.tipo,
          room.status,
          room.acessivel,
          room.possui_computadores,
          room.possui_data_show,
          room.possui_internet,
          room.possui_ar_condicionado,
          room.observacoes,
          roomId,
          institutionId,
        ]
      );
      if (!result.affectedRows) {
        await conn.rollback();
        return { result };
      }
      await saveRoomSoftwares(conn, roomId, room.softwares, institutionId);
      await conn.commit();
      return { result };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  };

  const countActiveSchedules = async ({ institutionId, roomId }) => {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS total
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
        WHERE h.sala_id = ?
          AND i.status = 'APROVADA'
          AND i.ativa = TRUE
          AND i.instituicao_id = ?`,
      [roomId, institutionId]
    );
    return Number(rows[0]?.total || 0);
  };

  const deleteRoom = async ({ institutionId, roomId }) => {
    const [result] = await db.query("DELETE FROM salas WHERE id = ? AND instituicao_id = ?", [roomId, institutionId]);
    return result;
  };

  const deactivateRoom = async ({ institutionId, roomId }) => {
    const [result] = await db.query("UPDATE salas SET status = 'INATIVA' WHERE id = ? AND instituicao_id = ?", [
      roomId,
      institutionId,
    ]);
    return result;
  };

  const listMaps = async ({ institutionId, authenticated }) => {
    const [maps] = await db.query(
      `SELECT id, nome, piso, largura, altura, ativo
         FROM mapas
        WHERE instituicao_id = ? ${authenticated ? "" : "AND ativo = TRUE"}
        ORDER BY nome`,
      [institutionId]
    );
    if (!maps.length) return [];
    const [areas] = await db.query(
      `SELECT a.id, a.mapa_id, a.tipo, a.nome, a.caminho_svg, a.bloco_id, a.sala_id, a.setor_id,
              b.nome AS bloco_nome, s.nome AS sala_nome, st.nome AS setor_nome
         FROM mapa_areas a
         JOIN mapas m ON m.id = a.mapa_id AND m.instituicao_id = a.instituicao_id
         LEFT JOIN blocos b ON b.id = a.bloco_id AND b.instituicao_id = a.instituicao_id
         LEFT JOIN salas s ON s.id = a.sala_id AND s.instituicao_id = a.instituicao_id
         LEFT JOIN setores st ON st.id = a.setor_id AND st.instituicao_id = a.instituicao_id
        WHERE a.instituicao_id = ? ${authenticated ? "" : "AND m.ativo = TRUE"}
        ORDER BY a.id`,
      [institutionId]
    );
    return maps.map((map) => ({
      ...map,
      ativo: Boolean(map.ativo),
      areas: areas.filter((area) => Number(area.mapa_id) === Number(map.id)),
    }));
  };

  const saveMap = async ({ institutionId, mapId, map }) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (const area of map.areas) {
        const reference = area.bloco_id
          ? ["blocos", area.bloco_id]
          : area.sala_id
            ? ["salas", area.sala_id]
            : area.setor_id
              ? ["setores", area.setor_id]
              : null;
        if (reference) {
          const [rows] = await conn.query(
            `SELECT id FROM ${reference[0]} WHERE id = ? AND instituicao_id = ? LIMIT 1`,
            [reference[1], institutionId]
          );
          if (!rows.length) {
            await conn.rollback();
            return { invalidReference: true };
          }
        }
      }

      let id = Number(mapId) || null;
      if (id) {
        const [result] = await conn.query(
          `UPDATE mapas SET nome = ?, piso = ?, largura = ?, altura = ?, ativo = ?
            WHERE id = ? AND instituicao_id = ?`,
          [map.nome, map.piso, map.largura, map.altura, map.ativo, id, institutionId]
        );
        if (!result.affectedRows) {
          await conn.rollback();
          return { notFound: true };
        }
        const [existingAreas] = await conn.query(
          "SELECT id FROM mapa_areas WHERE mapa_id = ? AND instituicao_id = ?",
          [id, institutionId]
        );
        const existingAreaIds = new Set(existingAreas.map((area) => Number(area.id)));
        const retainedAreaIds = new Set(map.areas.flatMap((area) => area.id === null ? [] : [area.id]));
        if ([...retainedAreaIds].some((areaId) => !existingAreaIds.has(areaId))) {
          await conn.rollback();
          return { invalidArea: true };
        }
        for (const areaId of existingAreaIds) {
          if (!retainedAreaIds.has(areaId)) {
            await conn.query(
              "DELETE FROM mapa_areas WHERE id = ? AND mapa_id = ? AND instituicao_id = ?",
              [areaId, id, institutionId]
            );
          }
        }
      } else {
        const [result] = await conn.query(
          `INSERT INTO mapas (instituicao_id, nome, piso, largura, altura, ativo)
           VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
          [institutionId, map.nome, map.piso, map.largura, map.altura, map.ativo]
        );
        id = result.insertId;
      }
      for (const area of map.areas) {
        if (area.id !== null) {
          await conn.query(
            `UPDATE mapa_areas
                SET tipo = ?, nome = ?, caminho_svg = ?, bloco_id = ?, sala_id = ?, setor_id = ?
              WHERE id = ? AND mapa_id = ? AND instituicao_id = ?`,
            [area.tipo, area.nome, area.caminho_svg, area.bloco_id, area.sala_id, area.setor_id,
              area.id, id, institutionId]
          );
        } else {
          await conn.query(
            `INSERT INTO mapa_areas
             (instituicao_id, mapa_id, tipo, nome, caminho_svg, bloco_id, sala_id, setor_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [institutionId, id, area.tipo, area.nome, area.caminho_svg, area.bloco_id, area.sala_id, area.setor_id]
          );
        }
      }
      await conn.commit();
      return { id };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  };

  return {
    createBlock,
    createRoom,
    deactivateRoom,
    deleteBlock,
    deleteRoom,
    findRoom,
    listBlocks,
    listRoomChanges,
    listRoomOccupation,
    listRoomOccupations,
    listRooms,
    listMaps,
    countActiveSchedules,
    saveMap,
    updateBlock,
    updateRoom,
  };
};
