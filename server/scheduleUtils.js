const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°]/g, "")
    .toLowerCase();

export const floorNumberFromRoom = (room = {}) => {
  const name = normalize(room.nome || room.ambiente);
  const codeFloor = name.match(/^[a-z]\s*([0-9])\d{2}/i);
  if (codeFloor) return Number(codeFloor[1]);

  const text = normalize(`${room.andar || ""} ${room.nome || ""} ${room.ambiente || ""}`);
  if (/\bterreo\b/.test(text)) return 0;

  const numericFloor = text.match(/\b([1-9])\s*(?:o\s*)?(?:andar|piso)\b/);
  if (numericFloor) return Number(numericFloor[1]);

  for (const [word, floor] of [
    ["primeiro", 1],
    ["segundo", 2],
    ["terceiro", 3],
    ["quarto", 4],
  ]) {
    if (text.includes(word)) return floor;
  }

  return null;
};

export const isFirstFloorRoom = (room) => {
  const floor = floorNumberFromRoom(room);
  return floor !== null && floor <= 1;
};

export const isUpperFloorRoom = (room) => {
  const floor = floorNumberFromRoom(room);
  return floor !== null && floor > 1;
};

const roomLabel = (schedule) => schedule.sala_nome || schedule.sala || schedule.ambiente || "";
const scheduleKey = (schedule) =>
  [schedule.categoria || "TURMA", schedule.turma, schedule.dia, schedule.periodo, schedule.hora_inicio || ""].join("|");
const scheduleFingerprint = (schedule) =>
  [schedule.disciplina || "", schedule.professor || "", roomLabel(schedule), schedule.tipo_disciplina || ""].join("|");
const summary = (schedule) => ({
  turma: schedule.turma,
  dia: schedule.dia,
  horario: schedule.hora_inicio || `${schedule.periodo}ª aula`,
  disciplina: schedule.disciplina,
  professor: schedule.professor || null,
  sala: roomLabel(schedule) || null,
});

export const buildScheduleComparison = (candidateSchedules, activeSchedules, activeImport) => {
  const activeByKey = new Map(activeSchedules.map((schedule) => [scheduleKey(schedule), schedule]));
  const candidateByKey = new Map(candidateSchedules.map((schedule) => [scheduleKey(schedule), schedule]));
  const added = [];
  const removed = [];
  const changed = [];

  for (const [key, schedule] of candidateByKey) {
    const previous = activeByKey.get(key);
    if (!previous) {
      added.push(schedule);
    } else if (scheduleFingerprint(previous) !== scheduleFingerprint(schedule)) {
      changed.push({
        antes: summary(previous),
        depois: summary(schedule),
        sala_alterada: roomLabel(previous) !== roomLabel(schedule),
        professor_alterado: (previous.professor || "") !== (schedule.professor || ""),
        disciplina_alterada: (previous.disciplina || "") !== (schedule.disciplina || ""),
      });
    }
  }

  for (const [key, schedule] of activeByKey) {
    if (!candidateByKey.has(key)) removed.push(schedule);
  }

  return {
    importacao_ativa_id: activeImport.id,
    importacao_ativa_titulo: activeImport.titulo,
    importacao_ativa_publicada_em: activeImport.publicado_em || null,
    aulas_adicionadas: added.length,
    aulas_removidas: removed.length,
    aulas_alteradas: changed.length,
    aulas_mudaram: added.length + removed.length + changed.length,
    salas_alteradas: changed.filter((item) => item.sala_alterada).length,
    professores_alterados: changed.filter((item) => item.professor_alterado).length,
    disciplinas_alteradas: changed.filter((item) => item.disciplina_alterada).length,
    amostras: {
      adicionadas: added.slice(0, 5).map(summary),
      removidas: removed.slice(0, 5).map(summary),
      alteradas: changed.slice(0, 5),
    },
  };
};
