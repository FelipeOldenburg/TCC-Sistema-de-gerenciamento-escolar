import crypto from "crypto";
import { buildScheduleComparison } from "../scheduleUtils.js";

export const createScheduleModel = ({ db, dayOrderSql, httpError, normalizeLookup }) => {
  const scheduleComparisonSelect = `
    SELECT h.categoria, h.turma, h.dia, h.periodo,
           TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
           h.disciplina, h.professor, h.ambiente,
           s.nome AS sala_nome, h.tipo_disciplina
      FROM horarios_importados h
      LEFT JOIN salas s ON s.id = h.sala_id
     WHERE h.importacao_id = ?
       AND h.categoria = 'TURMA'
     ORDER BY h.turma, ${dayOrderSql}, h.periodo`;

  const insertScheduleChunks = async (conn, importId, institutionId, schedules, roomByName) => {
    const columns = [
      "importacao_id",
      "instituicao_id",
      "categoria",
      "turma",
      "curso",
      "ano",
      "dia",
      "periodo",
      "hora_inicio",
      "disciplina",
      "professor",
      "ambiente",
      "sala_id",
      "tipo_turma",
      "tipo_disciplina",
      "valor_original",
    ];
    for (let offset = 0; offset < schedules.length; offset += 200) {
      const values = [];
      const placeholders = schedules.slice(offset, offset + 200).map((schedule) => {
        const roomId = schedule.ambiente ? roomByName.get(normalizeLookup(schedule.ambiente)) || null : null;
        values.push(
          importId,
          institutionId,
          schedule.categoria,
          schedule.turma,
          schedule.curso || null,
          schedule.ano || null,
          schedule.dia,
          schedule.periodo,
          schedule.hora_inicio || null,
          schedule.disciplina,
          schedule.professor || null,
          schedule.ambiente || null,
          roomId,
          schedule.tipo_turma || null,
          schedule.tipo_disciplina || null,
          schedule.valor_original || null
        );
        return `(${columns.map(() => "?").join(",")})`;
      });
      await conn.query(`INSERT INTO horarios_importados (${columns.join(",")}) VALUES ${placeholders.join(",")}`, values);
    }
  };

  const syncAcademicGroups = async (conn, institutionId, schedules) => {
    const groups = new Map();
    for (const schedule of schedules) {
      if (schedule.categoria !== "TURMA") continue;
      for (const [type, value] of [["CURSO", schedule.curso], ["ANO", schedule.ano], ["TURMA", schedule.turma]]) {
        const name = String(value || "").trim();
        if (name) groups.set(`${type}\0${name}`, [type, name]);
      }
    }
    if (!groups.size) return;
    const params = [];
    const placeholders = [...groups.values()].map(([type, name]) => {
      params.push(institutionId, type, name);
      return "(?, ?, ?)";
    });
    await conn.query(
      `INSERT INTO grupos_academicos (instituicao_id, tipo, nome)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (instituicao_id, tipo, nome) DO UPDATE SET ativo = TRUE`,
      params
    );
  };

  const preserveRoomsFromActiveImport = async (conn, importId, scopeKey, institutionId) => {
    const [result] = await conn.query(
      `UPDATE horarios_importados AS candidate
          SET sala_id = active.sala_id
         FROM importacoes_horarios AS active_import, horarios_importados AS active
        WHERE active_import.escopo_chave = ?
          AND active_import.instituicao_id = ?
          AND active_import.status = 'APROVADA'
          AND active_import.ativa = TRUE
          AND active_import.id <> candidate.importacao_id
          AND active.importacao_id = active_import.id
          AND active.categoria = candidate.categoria
          AND active.turma = candidate.turma
          AND active.dia = candidate.dia
          AND active.periodo = candidate.periodo
          AND active.sala_id IS NOT NULL
          AND candidate.importacao_id = ?
          AND candidate.categoria = 'TURMA'
          AND candidate.sala_id IS NULL`,
      [scopeKey, institutionId, importId]
    );
    return result.affectedRows || 0;
  };

  const loadScheduleComparison = async (conn, importId, scopeKey, institutionId) => {
    const [activeImports] = await conn.query(
      `SELECT id, titulo, publicado_em
         FROM importacoes_horarios
        WHERE escopo_chave = ?
          AND instituicao_id = ?
          AND status = 'APROVADA'
          AND ativa = TRUE
          AND id <> ?
        ORDER BY publicado_em DESC, id DESC
        LIMIT 1`,
      [scopeKey, institutionId, importId]
    );
    if (!activeImports.length) return null;
    const [candidateSchedules] = await conn.query(scheduleComparisonSelect, [importId]);
    const [activeSchedules] = await conn.query(scheduleComparisonSelect, [activeImports[0].id]);
    return buildScheduleComparison(candidateSchedules, activeSchedules, activeImports[0]);
  };

  const loadScheduleNotificationSubscribers = async (conn, classes, institutionId) => {
    if (!classes.length) return [];
    const [rows] = await conn.query(
      `SELECT email, turma
         FROM horario_notificacoes
        WHERE ativo = TRUE
          AND instituicao_id = ?
          AND turma IN (${classes.map(() => "?").join(",")})`,
      [institutionId, ...classes]
    );
    return rows;
  };

  const createImport = async ({ files, institutionId, observations, parsed, userId }) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO importacoes_horarios
         (instituicao_id, fonte, titulo, escopo_chave, codigo_escola, codigo_turno, nome_turno, lote_hash,
          total_arquivos, total_horarios, total_turmas, avisos_json, observacoes_envio, enviado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        [
          institutionId,
          parsed.fonte,
          parsed.titulo,
          parsed.escopo_chave,
          parsed.codigo_escola,
          parsed.codigo_turno,
          parsed.nome_turno,
          parsed.lote_hash,
          files.length,
          parsed.horarios.length,
          parsed.total_turmas,
          JSON.stringify(parsed.avisos || []),
          observations,
          userId,
        ]
      );
      const importId = result.insertId;
      for (const file of files) {
        await conn.query(
          `INSERT INTO importacao_arquivos
           (importacao_id, nome, mime_type, tamanho, sha256, conteudo)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            importId,
            file.originalname,
            file.mimetype || "application/octet-stream",
            file.size,
            crypto.createHash("sha256").update(file.buffer).digest("hex"),
            file.buffer,
          ]
        );
      }
      const [rooms] = await conn.query("SELECT id, nome FROM salas WHERE instituicao_id = ?", [institutionId]);
      const roomByName = new Map();
      for (const room of rooms) {
        const key = normalizeLookup(room.nome);
        roomByName.set(key, roomByName.has(key) ? null : room.id);
      }
      const importedEnvironments = [...new Set(parsed.horarios.map((schedule) => schedule.ambiente).filter(Boolean))];
      const unmappedEnvironments = importedEnvironments.filter(
        (environment) => !roomByName.get(normalizeLookup(environment))
      );
      if (unmappedEnvironments.length) {
        parsed.avisos.push(
          `${unmappedEnvironments.length} ambientes não foram vinculados a uma sala cadastrada: ${unmappedEnvironments.join(", ")}`
        );
        await conn.query("UPDATE importacoes_horarios SET avisos_json = ? WHERE id = ?", [
          JSON.stringify(parsed.avisos),
          importId,
        ]);
      }
      await insertScheduleChunks(conn, importId, institutionId, parsed.horarios, roomByName);
      await syncAcademicGroups(conn, institutionId, parsed.horarios);
      await preserveRoomsFromActiveImport(conn, importId, parsed.escopo_chave, institutionId);
      await conn.commit();
      return {
        id: importId,
        status: "PENDENTE",
        resumo: {
          fonte: parsed.fonte,
          total_horarios: parsed.horarios.length,
          total_turmas: parsed.total_turmas,
          avisos: parsed.avisos,
        },
      };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  };

  const listImports = async ({ institutionId, status, paginated, page, pageSize }) => {
    const params = [institutionId];
    const conditions = ["i.instituicao_id = ?"];
    if (status) {
      conditions.push("i.status = ?");
      params.push(status);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const limitClause = paginated ? "LIMIT ? OFFSET ?" : "";
    const queryParams = paginated ? [...params, pageSize, (page - 1) * pageSize] : params;
    const [rows] = await db.query(
      `SELECT i.id, i.fonte, i.titulo, i.escopo_chave, i.codigo_escola, i.codigo_turno,
              i.nome_turno, i.status, i.ativa, i.total_arquivos, i.total_horarios,
              i.total_turmas, i.avisos_json, i.observacoes_envio, i.motivo_rejeicao,
              i.created_at, i.revisado_em, i.publicado_em,
              sender.nome AS enviado_por_nome, sender.usuario AS enviado_por_usuario,
              reviewer.nome AS revisado_por_nome, reviewer.usuario AS revisado_por_usuario
         FROM importacoes_horarios i
         JOIN usuarios sender ON sender.id = i.enviado_por
         LEFT JOIN usuarios reviewer ON reviewer.id = i.revisado_por
         ${where}
        ORDER BY i.created_at DESC
        ${limitClause}`,
      queryParams
    );
    if (!paginated) return { rows };
    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM importacoes_horarios i ${where}`, params);
    return { rows, total: Number(countRows[0].total) };
  };

  const getImportDetail = async ({ importId, institutionId, page, pageSize, turma }) => {
    const [imports] = await db.query(
      `SELECT i.*, sender.nome AS enviado_por_nome, sender.usuario AS enviado_por_usuario,
              reviewer.nome AS revisado_por_nome, reviewer.usuario AS revisado_por_usuario
         FROM importacoes_horarios i
         JOIN usuarios sender ON sender.id = i.enviado_por
         LEFT JOIN usuarios reviewer ON reviewer.id = i.revisado_por
        WHERE i.id = ? AND i.instituicao_id = ?`,
      [importId, institutionId]
    );
    if (!imports.length) return null;

    const scheduleParams = [importId];
    const turmaWhere = turma ? "AND h.turma = ?" : "";
    if (turma) scheduleParams.push(turma);
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM horarios_importados h WHERE h.importacao_id = ? ${turmaWhere}`,
      scheduleParams
    );
    const [schedules] = await db.query(
      `SELECT h.id, h.categoria, h.turma, h.curso, h.ano, h.dia, h.periodo,
              TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio, h.disciplina, h.professor,
              h.ambiente, h.sala_id, s.nome AS sala_nome, b.nome AS bloco_nome,
              h.tipo_turma, h.tipo_disciplina, h.valor_original
         FROM horarios_importados h
         LEFT JOIN salas s ON s.id = h.sala_id
         LEFT JOIN blocos b ON b.id = s.bloco_id
        WHERE h.importacao_id = ? ${turmaWhere}
        ORDER BY ${dayOrderSql}, h.periodo, h.turma
        LIMIT ? OFFSET ?`,
      [...scheduleParams, pageSize, (page - 1) * pageSize]
    );
    const [classes] = await db.query(
      `SELECT DISTINCT turma, curso, ano, categoria
         FROM horarios_importados WHERE importacao_id = ? ORDER BY categoria, turma`,
      [importId]
    );
    const [files] = await db.query(
      `SELECT id, nome, mime_type, tamanho, sha256, created_at
         FROM importacao_arquivos WHERE importacao_id = ? ORDER BY id`,
      [importId]
    );
    const item = imports[0];
    const comparison =
      item.status === "PENDENTE" ? await loadScheduleComparison(db, item.id, item.escopo_chave, institutionId) : null;
    return {
      item,
      files,
      classes,
      schedules,
      comparison,
      total: Number(countRows[0].total),
    };
  };

  const assignPendingRoom = async ({ institutionId, roomId, scheduleId }) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [schedules] = await conn.query(
        `SELECT h.id, h.importacao_id, h.turma, h.dia, h.periodo, h.disciplina
           FROM horarios_importados h
           JOIN importacoes_horarios i ON i.id = h.importacao_id
          WHERE h.id = ?
            AND i.instituicao_id = ?
            AND h.categoria = 'TURMA'
            AND i.status = 'PENDENTE'
          FOR UPDATE`,
        [scheduleId, institutionId]
      );
      if (!schedules.length) throw httpError(404, "Horário pendente não encontrado.");

      let room = null;
      if (roomId !== null) {
        const [rooms] = await conn.query(
          `SELECT s.id, s.nome, s.status, b.nome AS bloco_nome
             FROM salas s
             JOIN blocos b ON b.id = s.bloco_id AND b.instituicao_id = s.instituicao_id
            WHERE s.id = ? AND s.instituicao_id = ?
            LIMIT 1`,
          [roomId, institutionId]
        );
        if (!rooms.length) throw httpError(400, "Sala não encontrada.");
        if (rooms[0].status !== "ATIVA") throw httpError(409, `A sala ${rooms[0].nome} não está ativa.`);
        room = rooms[0];
        const [conflicts] = await conn.query(
          `SELECT turma, disciplina
             FROM horarios_importados
            WHERE importacao_id = ?
              AND id <> ?
              AND categoria = 'TURMA'
              AND dia = ?
              AND periodo = ?
              AND (
                sala_id = ?
                OR (
                  sala_id IS NULL
                  AND ambiente IS NOT NULL
                  AND REPLACE(LOWER(TRIM(ambiente)), ' ', '') = REPLACE(LOWER(TRIM(?)), ' ', '')
                )
              )
            LIMIT 1`,
          [schedules[0].importacao_id, scheduleId, schedules[0].dia, schedules[0].periodo, roomId, room.nome]
        );
        if (conflicts.length) {
          throw httpError(409, `A sala já está ocupada por ${conflicts[0].turma} em ${conflicts[0].disciplina}.`);
        }
      }

      await conn.query("UPDATE horarios_importados SET sala_id = ? WHERE id = ?", [roomId, scheduleId]);
      await conn.commit();
      return {
        ok: true,
        id: scheduleId,
        sala_id: roomId,
        sala_nome: room?.nome || null,
        bloco_nome: room?.bloco_nome || null,
      };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  };

  const approveImport = async ({ importId, institutionId, userId }) => {
    const conn = await db.getConnection();
    let committed = false;
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        "SELECT id, status, escopo_chave FROM importacoes_horarios WHERE id = ? AND instituicao_id = ? FOR UPDATE",
        [importId, institutionId]
      );
      if (!rows.length) throw httpError(404, "Importação não encontrada.");
      if (rows[0].status !== "PENDENTE") throw httpError(409, "Somente importações pendentes podem ser aprovadas.");
      await preserveRoomsFromActiveImport(conn, rows[0].id, rows[0].escopo_chave, institutionId);
      const comparison = await loadScheduleComparison(conn, rows[0].id, rows[0].escopo_chave, institutionId);
      const notificationSubscribers = comparison?.aulas_mudaram
        ? await loadScheduleNotificationSubscribers(conn, comparison.turmas_afetadas, institutionId)
        : [];
      await conn.query(
        `UPDATE importacoes_horarios
            SET ativa = FALSE
          WHERE instituicao_id = ? AND ativa = TRUE AND status = 'APROVADA' AND escopo_chave = ?`,
        [institutionId, rows[0].escopo_chave]
      );
      await conn.query(
        `UPDATE importacoes_horarios
            SET status = 'APROVADA', ativa = TRUE, revisado_por = ?, revisado_em = NOW(),
                publicado_em = NOW(), motivo_rejeicao = NULL
          WHERE id = ? AND instituicao_id = ?`,
        [userId, importId, institutionId]
      );
      await conn.commit();
      committed = true;
      return { comparison, notificationSubscribers };
    } catch (error) {
      if (!committed) await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  };

  const rejectImport = async ({ importId, institutionId, reason, userId }) => {
    const [result] = await db.query(
      `UPDATE importacoes_horarios
          SET status = 'REJEITADA', ativa = FALSE, revisado_por = ?, revisado_em = NOW(),
              motivo_rejeicao = ?
        WHERE id = ? AND instituicao_id = ? AND status = 'PENDENTE'`,
      [userId, reason, importId, institutionId]
    );
    return result;
  };

  const createNotificationSubscription = async ({ email, institutionId, tokenHash, turma }) => {
    const [classes] = await db.query(
      `SELECT 1
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
        WHERE i.status = 'APROVADA'
          AND i.ativa = TRUE
          AND i.instituicao_id = ?
          AND h.categoria = 'TURMA'
          AND h.turma = ?
        LIMIT 1`,
      [institutionId, turma]
    );
    if (!classes.length) throw httpError(400, "Turma não encontrada nos horários publicados.");
    await db.query(
      `INSERT INTO horario_notificacoes (instituicao_id, email, turma, ativo, confirmacao_token_hash, confirmacao_expira_em)
       VALUES (?, ?, ?, FALSE, ?, NOW() + INTERVAL '2 days')
       ON CONFLICT (instituicao_id, email, turma) DO UPDATE
         SET ativo = FALSE,
             confirmacao_token_hash = EXCLUDED.confirmacao_token_hash,
             confirmacao_expira_em = EXCLUDED.confirmacao_expira_em,
             updated_at = CURRENT_TIMESTAMP`,
      [institutionId, email, turma, tokenHash]
    );
  };

  const confirmNotificationSubscription = async ({ institutionId, tokenHash }) => {
    const [result] = await db.query(
      `UPDATE horario_notificacoes
          SET ativo = TRUE, confirmacao_token_hash = NULL, confirmacao_expira_em = NULL
        WHERE confirmacao_token_hash = ?
          AND instituicao_id = ?
          AND confirmacao_expira_em > NOW()`,
      [tokenHash, institutionId]
    );
    return result;
  };

  const listPublishedSchedules = async ({ institutionId, onlyOptions, query }) => {
    const [options] = await db.query(
      `SELECT DISTINCT h.turma, h.curso, h.ano
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
        WHERE i.instituicao_id = ? AND i.status = 'APROVADA' AND i.ativa = TRUE AND h.categoria = 'TURMA'
        ORDER BY h.curso, h.ano, h.turma`,
      [institutionId]
    );
    const [academicGroups] = await db.query(
      "SELECT id, tipo, nome FROM grupos_academicos WHERE instituicao_id = ? AND ativo = TRUE",
      [institutionId]
    );
    const groupByKey = new Map(academicGroups.map((group) => [`${group.tipo}\0${group.nome}`, group.id]));
    const resolvedOptions = options.map((option) => ({
      ...option,
      grupo_ids: [
        groupByKey.get(`CURSO\0${option.curso}`),
        groupByKey.get(`ANO\0${option.ano}`),
        groupByKey.get(`TURMA\0${option.turma}`),
      ].filter(Boolean),
    }));
    if (onlyOptions) {
      const [teachers] = await db.query(
        `SELECT DISTINCT h.professor
           FROM horarios_importados h
           JOIN importacoes_horarios i ON i.id = h.importacao_id
          WHERE i.instituicao_id = ? AND i.status = 'APROVADA' AND i.ativa = TRUE AND h.categoria = 'TURMA'
            AND h.professor IS NOT NULL AND h.professor <> ''
          ORDER BY h.professor`,
        [institutionId]
      );
      return { turmas: resolvedOptions, professores: teachers.map((item) => item.professor), horarios: [] };
    }

    const conditions = ["i.instituicao_id = ?", "i.status = 'APROVADA'", "i.ativa = TRUE", "h.categoria = 'TURMA'"];
    const params = [institutionId];
    for (const [queryName, column] of [
      ["turma", "h.turma"],
      ["curso", "h.curso"],
      ["ano", "h.ano"],
      ["dia", "h.dia"],
    ]) {
      if (query[queryName]) {
        conditions.push(`${column} = ?`);
        params.push(String(query[queryName]));
      }
    }
    const teacher = String(query.professor || "").trim();
    if (teacher) {
      conditions.push("h.professor ILIKE ?");
      params.push(`%${teacher}%`);
    }
    const [schedules] = await db.query(
      `SELECT h.id, h.turma, h.curso, h.ano, h.dia, h.periodo,
              TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
              h.disciplina, h.professor, h.sala_id, h.ambiente,
              COALESCE(s.nome, h.ambiente) AS sala,
              b.nome AS bloco, i.id AS importacao_id, i.publicado_em
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
         LEFT JOIN salas s ON s.id = h.sala_id AND s.instituicao_id = i.instituicao_id
         LEFT JOIN blocos b ON b.id = s.bloco_id AND b.instituicao_id = i.instituicao_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY ${dayOrderSql}, h.periodo, h.turma`,
      params
    );
    return { turmas: resolvedOptions, horarios: schedules };
  };

  const listAcademicGroups = async (institutionId) => {
    const [rows] = await db.query(
      `SELECT id, tipo, nome, ativo FROM grupos_academicos
        WHERE instituicao_id = ? AND ativo = TRUE
        ORDER BY tipo, nome`,
      [institutionId]
    );
    return rows.map((row) => ({ ...row, ativo: Boolean(row.ativo) }));
  };

  const listIntervals = async ({ institutionId, includeInactive }) => {
    const [intervals] = await db.query(
      `SELECT id, nome, TO_CHAR(hora_inicio, 'HH24:MI') AS hora_inicio,
              TO_CHAR(hora_fim, 'HH24:MI') AS hora_fim, ativo
         FROM intervalos
        WHERE instituicao_id = ? ${includeInactive ? "" : "AND ativo = TRUE"}
        ORDER BY hora_inicio, nome`,
      [institutionId]
    );
    if (!intervals.length) return [];
    const [groups] = await db.query(
      `SELECT ig.intervalo_id, g.id, g.tipo, g.nome
         FROM intervalo_grupos ig
         JOIN grupos_academicos g ON g.id = ig.grupo_id AND g.instituicao_id = ig.instituicao_id
        WHERE ig.instituicao_id = ?
        ORDER BY g.tipo, g.nome`,
      [institutionId]
    );
    return intervals.map((interval) => ({
      ...interval,
      ativo: Boolean(interval.ativo),
      grupos: groups.filter((group) => Number(group.intervalo_id) === Number(interval.id))
        .map(({ intervalo_id: _intervalId, ...group }) => group),
    }));
  };

  const saveInterval = async ({ institutionId, intervalId, interval }) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const placeholders = interval.grupo_ids.map(() => "?").join(",");
      const [groups] = await conn.query(
        `SELECT id FROM grupos_academicos
          WHERE instituicao_id = ? AND ativo = TRUE AND id IN (${placeholders})`,
        [institutionId, ...interval.grupo_ids]
      );
      if (groups.length !== interval.grupo_ids.length) {
        await conn.rollback();
        return { invalidGroups: true };
      }
      let id = Number(intervalId) || null;
      if (id) {
        const [result] = await conn.query(
          `UPDATE intervalos SET nome = ?, hora_inicio = ?, hora_fim = ?, ativo = ?
            WHERE id = ? AND instituicao_id = ?`,
          [interval.nome, interval.hora_inicio, interval.hora_fim, interval.ativo, id, institutionId]
        );
        if (!result.affectedRows) {
          await conn.rollback();
          return { notFound: true };
        }
        await conn.query("DELETE FROM intervalo_grupos WHERE intervalo_id = ? AND instituicao_id = ?", [id, institutionId]);
      } else {
        const [result] = await conn.query(
          `INSERT INTO intervalos (instituicao_id, nome, hora_inicio, hora_fim, ativo)
           VALUES (?, ?, ?, ?, ?) RETURNING id`,
          [institutionId, interval.nome, interval.hora_inicio, interval.hora_fim, interval.ativo]
        );
        id = result.insertId;
      }
      for (const groupId of interval.grupo_ids) {
        await conn.query(
          "INSERT INTO intervalo_grupos (instituicao_id, intervalo_id, grupo_id) VALUES (?, ?, ?)",
          [institutionId, id, groupId]
        );
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

  const deactivateInterval = async ({ institutionId, intervalId }) => {
    const [result] = await db.query(
      "UPDATE intervalos SET ativo = FALSE WHERE id = ? AND instituicao_id = ?",
      [intervalId, institutionId]
    );
    return result;
  };

  return {
    approveImport,
    assignPendingRoom,
    confirmNotificationSubscription,
    createImport,
    createNotificationSubscription,
    deactivateInterval,
    getImportDetail,
    listImports,
    listAcademicGroups,
    listIntervals,
    listPublishedSchedules,
    rejectImport,
    saveInterval,
  };
};
