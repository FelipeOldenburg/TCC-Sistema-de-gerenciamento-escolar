export const createRoomAssignmentService = ({ dayOrderSql, httpError, isFirstFloorRoom, isUpperFloorRoom }) => {
  const updatePublishedScheduleRoom = async (conn, { institutionId, scheduleId, roomId, userId, studentCount, reason }) => {
    const [schedules] = await conn.query(
      `SELECT h.id, h.importacao_id, h.turma, h.dia, h.periodo, h.hora_inicio, h.sala_id,
              h.disciplina, h.professor, h.ambiente, s.nome AS sala_nome
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
         LEFT JOIN salas s ON s.id = h.sala_id AND s.instituicao_id = i.instituicao_id
        WHERE h.id = ?
          AND i.instituicao_id = ?
          AND h.categoria = 'TURMA'
          AND i.status = 'APROVADA'
          AND i.ativa = TRUE
        FOR UPDATE`,
      [scheduleId, institutionId]
    );
    if (!schedules.length) throw httpError(404, "Horário publicado não encontrado.");
    const schedule = schedules[0];

    let roomName = null;

    if (roomId !== null) {
      const [rooms] = await conn.query(
        "SELECT id, nome, capacidade, status FROM salas WHERE id = ? AND instituicao_id = ? LIMIT 1",
        [roomId, institutionId]
      );
      if (!rooms.length) throw httpError(400, "Sala não encontrada.");
      if (rooms[0].status !== "ATIVA") throw httpError(409, `A sala ${rooms[0].nome} não está ativa.`);
      if (studentCount !== null && rooms[0].capacidade !== null && studentCount > Number(rooms[0].capacidade)) {
        throw httpError(409, `A sala ${rooms[0].nome} comporta ${rooms[0].capacidade} alunos.`);
      }
      roomName = rooms[0].nome;

      const [conflicts] = await conn.query(
        `SELECT turma, disciplina, professor
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
        [schedule.importacao_id, scheduleId, schedule.dia, schedule.periodo, roomId, roomName]
      );
      if (conflicts.length) {
        const conflict = conflicts[0];
        throw httpError(
          409,
          `A sala já está ocupada por ${conflict.turma} em ${conflict.disciplina}${conflict.professor ? ` (${conflict.professor})` : ""}.`
        );
      }
    }

    const changed = Number(schedule.sala_id || 0) !== Number(roomId || 0);
    if (changed) {
      await conn.query("UPDATE horarios_importados SET sala_id = ? WHERE id = ?", [roomId, scheduleId]);
      await conn.query(
        `INSERT INTO sala_alteracoes
         (instituicao_id, horario_id, usuario_id, turma, dia, periodo, sala_anterior_id, sala_nova_id, quantidade_alunos, motivo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          institutionId,
          scheduleId,
          userId,
          schedule.turma,
          schedule.dia,
          schedule.periodo,
          schedule.sala_id || null,
          roomId,
          studentCount,
          reason,
        ]
      );
    }

    return {
      ok: true,
      id: scheduleId,
      sala_id: roomId,
      turma: schedule.turma,
      updated: changed ? 1 : 0,
      changed,
      alteracoes: changed
        ? [
            {
              horario_id: schedule.id,
              dia: schedule.dia,
              periodo: schedule.periodo,
              hora_inicio: schedule.hora_inicio,
              disciplina: schedule.disciplina,
              sala_anterior: schedule.sala_nome || schedule.ambiente || null,
              sala_nova: roomName,
            },
          ]
        : [],
    };
  };

  const applyGroundFloorReorganization = async (conn, { institutionId, turma, userId, studentCount, reason }) => {
    const [schedules] = await conn.query(
      `SELECT h.id, h.turma, h.dia, h.periodo, TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
              h.disciplina, h.professor, h.sala_id, h.ambiente,
              s.nome AS sala_nome, s.andar AS sala_andar
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
         LEFT JOIN salas s ON s.id = h.sala_id AND s.instituicao_id = i.instituicao_id
        WHERE i.status = 'APROVADA'
          AND i.ativa = TRUE
          AND i.instituicao_id = ?
          AND h.categoria = 'TURMA'
          AND h.turma = ?
        ORDER BY ${dayOrderSql}, h.periodo`,
      [institutionId, turma]
    );
    const upperSchedules = schedules.filter((schedule) =>
      isUpperFloorRoom({ nome: schedule.sala_nome || schedule.ambiente, andar: schedule.sala_andar })
    );
    const [rooms] = await conn.query(
      `SELECT s.id, s.nome, s.andar, s.capacidade, s.acessivel, s.tipo, b.nome AS bloco_nome
         FROM salas s
         JOIN blocos b ON b.id = s.bloco_id
        WHERE s.instituicao_id = ?
          AND s.status = 'ATIVA'
        ORDER BY s.acessivel DESC,
                 CASE WHEN LOWER(s.tipo) LIKE '%sala%' THEN 0 ELSE 1 END,
                 b.nome, s.nome`,
      [institutionId]
    );
    const candidates = rooms.filter(isFirstFloorRoom);
    if (!upperSchedules.length) {
      return { avaliadas: 0, candidatas: candidates.length, aplicadas: [], nao_aplicadas: [] };
    }

    const applied = [];
    const skipped = [];

    for (const schedule of upperSchedules) {
      let lastError = "";
      for (const room of candidates) {
        if (Number(room.id) === Number(schedule.sala_id || 0)) continue;
        try {
          const result = await updatePublishedScheduleRoom(conn, {
            institutionId,
            scheduleId: schedule.id,
            roomId: room.id,
            userId,
            studentCount,
            reason,
          });
          applied.push(...result.alteracoes);
          break;
        } catch (error) {
          if (![400, 409].includes(error.statusCode)) throw error;
          lastError = error.message;
        }
      }
      if (!applied.some((item) => item.horario_id === schedule.id)) {
        skipped.push({
          horario_id: schedule.id,
          dia: schedule.dia,
          periodo: schedule.periodo,
          hora_inicio: schedule.hora_inicio,
          disciplina: schedule.disciplina,
          sala_anterior: schedule.sala_nome || schedule.ambiente || null,
          motivo: lastError || "Nenhuma sala de primeiro andar livre para este horário.",
        });
      }
    }

    return { avaliadas: upperSchedules.length, candidatas: candidates.length, aplicadas: applied, nao_aplicadas: skipped };
  };

  return { updatePublishedScheduleRoom, applyGroundFloorReorganization };
};
