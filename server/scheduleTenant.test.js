import assert from "node:assert/strict";
import { createScheduleModel } from "./models/scheduleModel.js";

const queries = [];
const connection = {
  query: async (sql, params = []) => {
    queries.push({ sql, params });
    if (sql.includes("INSERT INTO importacoes_horarios")) return [{ insertId: 3 }];
    if (sql.includes("SELECT id, nome FROM salas")) return [[]];
    return [{ affectedRows: 0 }];
  },
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release: () => {},
};
const model = createScheduleModel({
  db: { getConnection: async () => connection },
  dayOrderSql: "h.dia",
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  normalizeLookup: (value) => String(value).trim().toLowerCase(),
});

await model.createImport({
  files: [],
  institutionId: 2,
  observations: null,
  parsed: {
    avisos: [], fonte: "HTML", titulo: "Horário", escopo_chave: "manha", codigo_escola: null, codigo_turno: null,
    nome_turno: null, lote_hash: "a".repeat(64), total_turmas: 1,
    horarios: [{ categoria: "TURMA", turma: "1A", curso: null, ano: null, dia: "SEG", periodo: 1, hora_inicio: null, disciplina: "Matemática", professor: null, ambiente: null }],
  },
  userId: 8,
});

const schedules = queries.find(({ sql }) => sql.includes("INSERT INTO horarios_importados"));
assert.match(schedules.sql, /instituicao_id/);
assert.deepEqual(schedules.params.slice(0, 2), [3, 2]);
