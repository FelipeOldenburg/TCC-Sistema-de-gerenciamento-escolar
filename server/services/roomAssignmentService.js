export const createRoomAssignmentService = ({ dayOrderSql, httpError, isFirstFloorRoom, isUpperFloorRoom }) => {
  const normalizeRoomText = (value) => String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  const roomType = (room) => normalizeRoomText(room?.tipo)
    .replace(/^(?:laboratorio|lab\.?)(?:\s+de)?(?=\s|$)/, "laboratorio");
  const resources = ["possui_computadores", "possui_data_show", "possui_internet", "possui_ar_condicionado"];

  const lockRoomAssignments = (conn, institutionId) =>
    // ponytail: serialize room changes per institution; use per-slot locks if CPD throughput requires it.
    conn.query("SELECT id FROM instituicoes WHERE id = ? FOR UPDATE", [institutionId]);

  const updatePublishedScheduleRoom = async (conn, { institutionId, scheduleId, roomId, userId, studentCount, reason }) => {
    await lockRoomAssignments(conn, institutionId);
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
        FOR UPDATE OF h`,
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
           FROM horarios_importados h
           JOIN importacoes_horarios i ON i.id = h.importacao_id
          WHERE i.instituicao_id = ?
            AND i.status = 'APROVADA'
            AND i.ativa = TRUE
            AND h.categoria = 'TURMA'
            AND h.id <> ?
            AND h.dia = ?
            AND h.periodo = ?
            AND (
              h.sala_id = ?
              OR (
                h.sala_id IS NULL
                AND h.ambiente IS NOT NULL
                AND REPLACE(LOWER(TRIM(h.ambiente)), ' ', '') = REPLACE(LOWER(TRIM(?)), ' ', '')
              )
            )
          LIMIT 1`,
        [institutionId, scheduleId, schedule.dia, schedule.periodo, roomId, roomName]
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
    let changeResult = null;
    if (changed) {
      await conn.query("UPDATE horarios_importados SET sala_id = ? WHERE id = ?", [roomId, scheduleId]);
      const [changeResult] = await conn.query(
        `INSERT INTO sala_alteracoes
         (instituicao_id, horario_id, usuario_id, turma, dia, periodo, sala_anterior_id, sala_nova_id, quantidade_alunos, motivo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
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
              alteracao_id: changeResult?.insertId || null,
              turma: schedule.turma,
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

  const updatePublishedScheduleRooms = async (conn, { institutionId, scheduleIds, roomId, assignments, userId, reason }) => {
    const targets = assignments || (Array.isArray(scheduleIds)
      ? scheduleIds.map((scheduleId) => ({ scheduleId, roomId }))
      : null);
    if (!Array.isArray(targets) || !targets.length || targets.length > 100
      || targets.some((target) => !target || !Number.isInteger(target.scheduleId) || target.scheduleId < 1
        || !Number.isInteger(target.roomId) || target.roomId < 1
        || (target.studentCount != null && (!Number.isInteger(target.studentCount) || target.studentCount < 1)))
      || new Set(targets.map(({ scheduleId }) => scheduleId)).size !== targets.length) {
      throw httpError(400, "Selecione de 1 a 100 alocações válidas, sem horários duplicados.");
    }

    const orderedTargets = [...targets].sort((a, b) => a.scheduleId - b.scheduleId);
    const alteracoes = [];
    for (const { scheduleId, roomId: targetRoomId, studentCount } of orderedTargets) {
      const result = await updatePublishedScheduleRoom(conn, {
        institutionId,
        scheduleId,
        roomId: targetRoomId,
        userId,
        studentCount: studentCount ?? null,
        reason,
      });
      alteracoes.push(...result.alteracoes);
    }
    return {
      ok: true,
      sala_id: orderedTargets.every(({ roomId: targetRoomId }) => targetRoomId === orderedTargets[0].roomId)
        ? orderedTargets[0].roomId
        : null,
      updated: alteracoes.length,
      changed: alteracoes.length > 0,
      horarios: orderedTargets.map(({ scheduleId }) => scheduleId),
      alteracoes,
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
    const [rooms] = await conn.query(
      `SELECT s.id, s.nome, s.andar, s.capacidade, s.acessivel, s.tipo, s.status,
              s.possui_computadores, s.possui_data_show, s.possui_internet, s.possui_ar_condicionado,
              b.nome AS bloco_nome
         FROM salas s
         JOIN blocos b ON b.id = s.bloco_id
        WHERE s.instituicao_id = ?
        ORDER BY s.acessivel DESC,
                 CASE WHEN LOWER(s.tipo) LIKE '%sala%' THEN 0 ELSE 1 END,
                 b.nome, s.nome`,
      [institutionId]
    );
    const candidates = rooms.filter((room) => room.status === "ATIVA" && isFirstFloorRoom(room));
    const upperSchedules = schedules.filter((schedule) =>
      isUpperFloorRoom({ nome: String(schedule.sala_nome || schedule.ambiente || "").trim(), andar: schedule.sala_andar })
    );
    if (!upperSchedules.length) {
      return { avaliadas: 0, candidatas: candidates.length, aplicadas: [], nao_aplicadas: [] };
    }

    const applied = [];
    const skipped = [];

    for (const schedule of upperSchedules) {
      const sourceRooms = rooms.filter((room) => schedule.sala_id != null
        ? Number(room.id) === Number(schedule.sala_id)
        : normalizeRoomText(room.nome) === normalizeRoomText(schedule.ambiente));
      const source = sourceRooms.length === 1 ? sourceRooms[0] : null;
      const type = roomType(source);
      let lastError = !source ? "Não foi possível identificar a sala de origem com segurança."
        : !type || type === "laboratorio" ? "Informe o tipo e a especialidade da sala de origem antes da troca automática."
          : "Nenhuma sala de primeiro andar compatível com o tipo e os recursos da sala de origem está disponível.";
      const compatibleRooms = source && type && type !== "laboratorio" ? candidates.filter((room) =>
        roomType(room) === type && resources.every((resource) => !source[resource] || room[resource])
      ) : [];
      for (const room of compatibleRooms) {
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
          motivo: lastError,
        });
      }
    }

    return { avaliadas: upperSchedules.length, candidatas: candidates.length, aplicadas: applied, nao_aplicadas: skipped };
  };

  return { updatePublishedScheduleRoom, updatePublishedScheduleRooms, applyGroundFloorReorganization };
};
