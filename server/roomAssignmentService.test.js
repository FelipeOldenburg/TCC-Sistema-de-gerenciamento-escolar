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
const scheduleQuery = queries.find(({ sql }) => sql.includes("SELECT h.id"));
assert.match(scheduleQuery.sql, /FOR UPDATE OF h/);
assert.match(change.sql, /instituicao_id/);
assert.deepEqual(change.params, [2, 20, 8, "1A", "SEG", 1, null, 4, 25, "Ajuste"]);

const scheduleById = new Map([
  [20, { id: 20, importacao_id: 30, turma: "1A", dia: "SEG", periodo: 1, hora_inicio: "07:30", sala_id: null, disciplina: "Matemática", professor: null, ambiente: null, sala_nome: null }],
  [22, { id: 22, importacao_id: 31, turma: "2B", dia: "TER", periodo: 2, hora_inicio: "09:00", sala_id: null, disciplina: "Física", professor: "Ana", ambiente: null, sala_nome: null }],
]);
const makeBatchService = (conflictAt = null, roomCapacity = null) => {
  const batchQueries = [];
  let changeId = 0;
  const batchConnection = {
    query: async (sql, params = []) => {
      batchQueries.push({ sql, params });
      if (sql.includes("FROM instituicoes")) return [[]];
      if (sql.includes("SELECT h.id")) return [[scheduleById.get(params[0])].filter(Boolean)];
      if (sql.includes("SELECT id, nome, capacidade, status")) return [[{ id: Number(params[0]), nome: `Sala ${params[0]}`, capacidade: roomCapacity, status: "ATIVA" }]];
      if (sql.includes("SELECT turma, disciplina, professor")) {
        return params[1] === conflictAt ? [[{ turma: "Outra", disciplina: "Química", professor: null }]] : [[]];
      }
      if (sql.includes("INSERT INTO sala_alteracoes")) return [{ insertId: ++changeId }];
      return [{}];
    },
  };
  return { batchConnection, batchQueries, batchService: createRoomAssignmentService({
    dayOrderSql: "h.dia",
    httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
    isFirstFloorRoom: () => true,
    isUpperFloorRoom: () => false,
  }) };
};

const { batchConnection, batchQueries, batchService } = makeBatchService();
const batchResult = await batchService.updatePublishedScheduleRooms(batchConnection, {
  institutionId: 2,
  scheduleIds: [22, 20],
  roomId: 4,
  userId: 8,
  reason: "Ajuste geral",
});
assert.deepEqual(batchResult.horarios, [20, 22]);
assert.equal(batchResult.updated, 2);
assert.deepEqual(batchResult.alteracoes.map(({ turma }) => turma), ["1A", "2B"]);
assert.deepEqual(batchQueries.filter(({ sql }) => sql.startsWith("UPDATE horarios_importados")).map(({ params }) => params[1]), [20, 22]);
assert.ok(batchQueries.filter(({ sql }) => sql.includes("SELECT turma, disciplina, professor")).every(({ sql, params }) =>
  sql.includes("i.instituicao_id = ?") && params[0] === 2 && sql.includes("i.ativa = TRUE")
));

const { batchConnection: allocationConnection, batchQueries: allocationQueries, batchService: allocationService } = makeBatchService();
const allocationResult = await allocationService.updatePublishedScheduleRooms(allocationConnection, {
  institutionId: 2,
  assignments: [{ scheduleId: 20, roomId: 7 }, { scheduleId: 22, roomId: 9 }],
  userId: 8,
  reason: "Alocação em lote",
});
assert.equal(allocationResult.sala_id, null);
assert.deepEqual(allocationQueries.filter(({ sql }) => sql.startsWith("UPDATE horarios_importados")).map(({ params }) => params), [[7, 20], [9, 22]]);
assert.deepEqual(allocationResult.alteracoes.map(({ sala_nova }) => sala_nova), ["Sala 7", "Sala 9"]);

const { batchConnection: capacityConnection, batchQueries: capacityQueries, batchService: capacityService } = makeBatchService(null, 20);
await assert.rejects(
  capacityService.updatePublishedScheduleRooms(capacityConnection, {
    institutionId: 2,
    assignments: [{ scheduleId: 20, roomId: 7, studentCount: 25 }],
    userId: 8,
    reason: null,
  }),
  (error) => error.statusCode === 409
);
assert.equal(capacityQueries.some(({ sql }) => sql.includes("INSERT INTO sala_alteracoes")), false);

const { batchConnection: conflictConnection, batchService: conflictService } = makeBatchService(22);
await assert.rejects(
  conflictService.updatePublishedScheduleRooms(conflictConnection, {
    institutionId: 2,
    scheduleIds: [20, 22],
    roomId: 4,
    userId: 8,
    reason: null,
  }),
  (error) => error.statusCode === 409
);
await assert.rejects(
  batchService.updatePublishedScheduleRooms(batchConnection, {
    institutionId: 2,
    scheduleIds: [20, 20],
    roomId: 4,
    userId: 8,
    reason: null,
  }),
  (error) => error.statusCode === 400
);
