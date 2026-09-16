import assert from "node:assert/strict";
import { createRoomAssignmentService } from "./services/roomAssignmentService.js";

const queries = [];
const service = createRoomAssignmentService({
  dayOrderSql: "h.dia",
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  isFirstFloorRoom: () => true,
  isUpperFloorRoom: () => false,
});
const connection = {
  query: async (sql, params = []) => {
    queries.push({ sql, params });
    if (sql.includes("FOR UPDATE")) {
      return [[{ id: 20, importacao_id: 30, turma: "1A", dia: "SEG", periodo: 1, hora_inicio: "07:30", sala_id: null, disciplina: "Matemática", professor: null, ambiente: null, sala_nome: null }]];
    }
    if (sql.includes("SELECT id, nome, capacidade, status")) return [[{ id: 4, nome: "A101", capacidade: null, status: "ATIVA" }]];
    if (sql.includes("SELECT turma, disciplina, professor")) return [[]];
    return [{}];
  },
};

await service.updatePublishedScheduleRoom(connection, {
  institutionId: 2,
  scheduleId: 20,
  roomId: 4,
  userId: 8,
  studentCount: 25,
  reason: "Ajuste",
});

const change = queries.find(({ sql }) => sql.includes("INSERT INTO sala_alteracoes"));
assert.match(change.sql, /instituicao_id/);
assert.deepEqual(change.params, [2, 20, 8, "1A", "SEG", 1, null, 4, 25, "Ajuste"]);
