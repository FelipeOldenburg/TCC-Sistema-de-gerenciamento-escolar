import assert from "node:assert/strict";
import { test } from "node:test";
import { createRoomAssignmentService } from "./services/roomAssignmentService.js";
import { isFirstFloorRoom, isUpperFloorRoom } from "./scheduleUtils.js";

const room = (id, nome, tipo, extra = {}) => ({
  id, nome, tipo, andar: nome[1], status: "ATIVA", capacidade: 40, acessivel: true,
  possui_computadores: false, possui_data_show: false, possui_internet: false,
  possui_ar_condicionado: false, ...extra,
});
const lesson = (id, source, extra = {}) => ({
  id, importacao_id: 30, turma: "1A", dia: "SEG", periodo: id,
  hora_inicio: "07:30", disciplina: "Prática", professor: "Ana",
  sala_id: source?.id ?? null, sala_nome: source?.nome ?? null,
  sala_andar: source?.andar ?? null, ambiente: source?.nome ?? "C299", ...extra,
});
const reorganize = async (rooms, schedules, { occupied = [], studentCount = 25 } = {}) => {
  const writes = [];
  const queries = [];
  const service = createRoomAssignmentService({
    dayOrderSql: "h.dia", isFirstFloorRoom, isUpperFloorRoom,
    httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  });
  const conn = { query: async (sql, params = []) => {
    queries.push({ sql, params });
    if (sql.includes("FROM instituicoes")) return [[]];
    if (sql.includes("SELECT h.id")) {
      return [sql.includes("FOR UPDATE") ? schedules.filter(({ id }) => id === params[0]) : schedules];
    }
    if (sql.includes("SELECT s.id")) return [rooms];
    if (sql.includes("SELECT id, nome, capacidade, status")) return [rooms.filter(({ id }) => id === params[0])];
    if (sql.includes("SELECT turma, disciplina, professor")) {
      return [occupied.includes(params[4]) ? [{ turma: "2A", disciplina: "Outra aula" }] : []];
    }
    if (sql.startsWith("UPDATE horarios_importados")) writes.push(params);
    return [{ insertId: 1 }];
  } };
  const result = await service.applyGroundFloorReorganization(conn, {
    institutionId: 2, turma: "1A", userId: 8, studentCount, reason: "Acessibilidade",
  });
  return { result, writes, queries };
};

test("laboratório mantém especialidade e recursos em vez de usar sala comum ou outro laboratório", async () => {
  const source = room(20, "C207", "Lab. informatica", { possui_computadores: true, possui_internet: true });
  const target = room(5, "E101", "Laboratório de Informática", { possui_computadores: true, possui_internet: true });
  const { result, writes } = await reorganize([
    room(1, "B101", "Sala de aula"), room(2, "B102", "Lab. quimica"),
    room(3, "C108", "Lab. informatica", { possui_computadores: true }), target, source,
  ], [lesson(10, source)]);
  assert.deepEqual(writes, [[target.id, 10]]);
  assert.equal(result.aplicadas[0].sala_nova, "E101");
});

test("aula comum não vai para oficina só porque seu tipo contém sala", async () => {
  const source = room(20, "A201", "Sala de aula");
  const { writes } = await reorganize([
    room(1, "D101(B)", "Sala of. mecanica"), room(2, "B101", "Sala de aula"), source,
  ], [lesson(10, source)]);
  assert.deepEqual(writes, [[2, 10]]);
});

test("cada aula usa seu tipo e fica pendente se não houver ambiente equivalente", async () => {
  const computerLab = room(20, "C207", "Lab. informatica");
  const electricityLab = room(21, "C201", "Lab. eletricidade");
  const { result, writes } = await reorganize([
    room(1, "B101", "Sala de aula"), room(2, "E101", "Lab. informatica"), computerLab, electricityLab,
  ], [lesson(10, computerLab), lesson(11, electricityLab)]);
  assert.deepEqual(writes, [[2, 10]]);
  assert.equal(result.nao_aplicadas[0].horario_id, 11);
  assert.match(result.nao_aplicadas[0].motivo, /compatível/i);
});

test("origem sem sala_id é resolvida somente por nome cadastral único", async () => {
  const source = room(20, "C207", "Lab. informatica");
  const { writes } = await reorganize([
    room(1, "B101", "Sala de aula"), room(2, "E101", "Lab. informatica"), source,
  ], [lesson(10, source, { sala_id: null, sala_nome: null, ambiente: " c207 " })]);
  assert.deepEqual(writes, [[2, 10]]);
});

test("origem ausente, ambígua ou sem especialidade não provoca troca aleatória", async (t) => {
  for (const [name, sources, schedule] of [
    ["sem cadastro", [], lesson(10, null)],
    ["nome duplicado", [room(20, "C207", "Lab. informatica"), room(21, "C207", "Lab. quimica")], lesson(10, null, { ambiente: "C207" })],
    ["laboratório genérico", [room(20, "C207", "Laboratório")], lesson(10, room(20, "C207", "Laboratório"))],
    ["sem tipo", [room(20, "C207", "")], lesson(10, room(20, "C207", ""))],
  ]) {
    await t.test(name, async () => {
      const { result, writes } = await reorganize([
        room(1, "B101", "Sala de aula"), room(2, "E101", "Laboratório"), ...sources,
      ], [schedule]);
      assert.deepEqual(writes, []);
      assert.equal(result.nao_aplicadas.length, 1);
      assert.match(result.nao_aplicadas[0].motivo, /identificar|especialidade|tipo/i);
    });
  }
});

test("origem inativa é analisada mas destinos inativos são descartados", async () => {
  const source = room(20, "C207", "Lab. informatica", { status: "INATIVA" });
  const { writes } = await reorganize([
    room(1, "C108", "Lab. informatica", { status: "MANUTENCAO" }),
    room(2, "E101", "Lab. informatica"), source,
  ], [lesson(10, source)]);
  assert.deepEqual(writes, [[2, 10]]);
});

test("capacidade e ocupação continuam valendo entre os destinos compatíveis", async () => {
  const source = room(20, "C207", "Lab. informatica");
  const { writes } = await reorganize([
    room(1, "C108", "Lab. informatica", { capacidade: 20 }),
    room(2, "E101", "Lab. informatica"), room(3, "E102", "Lab. informatica"), source,
  ], [lesson(10, source)], { occupied: [2] });
  assert.deepEqual(writes, [[3, 10]]);
});

test("subdivisões cadastrais preservam identificação e especialidade na alocação", async () => {
  const source = room(20, "D201(B)", "Sala of. mecanica");
  const { result, writes } = await reorganize([
    room(1, "D101", "Of. mecanica"), room(2, "D101(A)", "Soldagem"),
    room(3, "D101(B)", "Sala of. mecanica"), room(4, "D101(C)", "CNC"), source,
  ], [lesson(10, source, { sala_id: null, sala_nome: null })]);
  assert.deepEqual(writes, [[3, 10]]);
  assert.equal(result.aplicadas[0].sala_nova, "D101(B)");
});
