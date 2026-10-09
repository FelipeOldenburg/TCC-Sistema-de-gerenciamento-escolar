import assert from "node:assert/strict";
import { createFacilitiesController } from "./controllers/facilitiesController.js";
import { createFacilitiesModel } from "./models/facilitiesModel.js";
import { registerFacilitiesRoutes } from "./routes/facilitiesRoutes.js";

const routes = [];
const app = Object.fromEntries(
  ["get", "post", "put", "patch", "delete"].map((method) => [method, (...args) => routes.push([method, ...args])])
);
const controller = Object.fromEntries(
  [
    "listMaps", "saveMap", "updateMapAreaAdjustment",
    "listBlocks", "createBlock", "updateBlock", "deleteBlock", "listRooms", "listRoomOccupations", "getRoom",
    "getRoomOccupation", "listRoomChanges", "createRoom", "updateRoom", "deleteRoom",
  ].map((name) => [name, () => {}])
);
const cpdOnly = () => {};
const requireRole = (role) => {
  assert.equal(role, "CPD");
  return cpdOnly;
};

registerFacilitiesRoutes(app, controller, { requireRole });
assert.deepEqual(
  routes.map(([method, path]) => `${method} ${path}`),
  [
    "get /api/mapas",
    "post /api/mapas",
    "put /api/mapas/:id",
    "patch /api/mapas/:mapId/areas/:areaId/ajuste",
    "get /api/blocos",
    "post /api/blocos",
    "put /api/blocos/:id",
    "delete /api/blocos/:id",
    "get /api/salas",
    "get /api/salas/ocupacoes",
    "get /api/salas/:id",
    "get /api/salas/:id/ocupacao",
    "get /api/sala-alteracoes",
    "post /api/salas",
    "put /api/salas/:id",
    "delete /api/salas/:id",
  ]
);
assert.equal(routes.filter(([, , middleware]) => middleware === cpdOnly).length, 10);

let savedRoom;
let savedSoftwareLink;
const facilitiesController = createFacilitiesController({
  asBoolean: (value) => value === true || value === "true",
  cacheableJson: () => {},
  facilitiesModel: {
    createRoom: async (value) => {
      savedRoom = value;
      return { insertId: 9 };
    },
  },
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  isForeignKeyError: () => false,
  positiveInt: () => 1,
});
const response = {
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
};
let receivedError;
await facilitiesController.createRoom(
  {
    body: {
      bloco_id: "4",
      nome: " A101 ",
      andar: "Térreo",
      capacidade: "30",
      tipo: "Laboratório",
      acessivel: "true",
      softwares: ["LibreOffice", "LibreOffice", ""],
    },
    institution: { id: 2 },
  },
  response,
  (error) => {
    receivedError = error;
  }
);
assert.equal(receivedError, undefined);
assert.deepEqual(savedRoom, {
  institutionId: 2,
  room: {
    bloco_id: 4,
    nome: "A101",
    andar: "Térreo",
    capacidade: 30,
    tipo: "Laboratório",
    status: "ATIVA",
    acessivel: true,
    possui_computadores: false,
    possui_data_show: false,
    possui_internet: false,
    possui_ar_condicionado: false,
    observacoes: null,
    softwares: ["LibreOffice"],
  },
});
assert.equal(response.statusCode, 201);
assert.deepEqual(response.payload, { id: 9 });

const transaction = [];
const facilitiesModel = createFacilitiesModel({
  db: {
    getConnection: async () => ({
      query: async (sql, params) => {
        if (sql.includes("SELECT id FROM blocos")) return [[{ id: 4 }]];
        if (sql.includes("INSERT INTO salas")) return [{ insertId: 9 }];
        if (sql.includes("INSERT INTO softwares")) return [{ insertId: 10 }];
        if (sql.includes("INSERT INTO sala_softwares")) {
          savedSoftwareLink = params;
          return [{}];
        }
        return [{}];
      },
      beginTransaction: async () => transaction.push("begin"),
      commit: async () => transaction.push("commit"),
      rollback: async () => transaction.push("rollback"),
      release: () => transaction.push("release"),
    }),
  },
  dayOrderSql: "h.dia",
});
assert.equal((await facilitiesModel.createRoom(savedRoom)).insertId, 9);
assert.deepEqual(transaction, ["begin", "commit", "release"]);
assert.deepEqual(savedSoftwareLink, [9, 10, 2]);

const missingBlockTransaction = [];
const missingBlockModel = createFacilitiesModel({
  db: {
    getConnection: async () => ({
      query: async () => [[]],
      beginTransaction: async () => missingBlockTransaction.push("begin"),
      commit: async () => missingBlockTransaction.push("commit"),
      rollback: async () => missingBlockTransaction.push("rollback"),
      release: () => missingBlockTransaction.push("release"),
    }),
  },
  dayOrderSql: "h.dia",
});
assert.equal(await missingBlockModel.createRoom(savedRoom), null);
assert.deepEqual(missingBlockTransaction, ["begin", "rollback", "release"]);

let savedMap;
let savedAdjustment;
let adjustmentOutcome;
const mapController = createFacilitiesController({
  asBoolean: (value) => value === true,
  cacheableJson: () => {},
  facilitiesModel: {
    saveMap: async (value) => {
      savedMap = value;
      return { id: 12 };
    },
    updateMapAreaAdjustment: async (value) => {
      savedAdjustment = value;
      return adjustmentOutcome;
    },
  },
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  isForeignKeyError: () => false,
  positiveInt: () => 1,
});
const mapResponse = { ...response };
await mapController.saveMap(
  {
    body: {
      nome: "Térreo",
      largura: 800,
      altura: 600,
      areas: [{ tipo: "SETOR", nome: "Biblioteca", caminho_svg: "M 0 0 L 50 0 L 50 50 Z", setor_id: 7 }],
    },
    params: {},
    institution: { id: 2 },
  },
  mapResponse,
  (error) => { receivedError = error; }
);
assert.equal(savedMap.institutionId, 2);
assert.equal(savedMap.map.areas[0].setor_id, 7);
assert.equal(mapResponse.statusCode, 201);
assert.equal(savedMap.map.areas[0].id, null);

const adjustment = { ajuste_x: -25, ajuste_y: 16, escala_x: 1.5, escala_y: 0.8 };
const previous = { ajuste_x: 0, ajuste_y: 0, escala_x: 1, escala_y: 1, caminho_svg: "M 0 0 L 50 0 L 50 50 Z" };
const adjustmentRequest = {
  body: { ...adjustment, anterior: previous },
  params: { mapId: "12", areaId: "31" },
  institution: { id: 2 },
};
const adjustmentResponse = { ...response };
adjustmentOutcome = { adjustment };
await mapController.updateMapAreaAdjustment(adjustmentRequest, adjustmentResponse, (error) => { receivedError = error; });
assert.equal(receivedError, undefined);
assert.deepEqual(savedAdjustment, { institutionId: 2, mapId: 12, areaId: 31, adjustment, previous });
assert.deepEqual(adjustmentResponse.payload, adjustment);

for (const request of [
  { ...adjustmentRequest, params: { ...adjustmentRequest.params, areaId: "0" } },
  { ...adjustmentRequest, body: { ...adjustmentRequest.body, ajuste_x: 200001 } },
  { ...adjustmentRequest, body: { ...adjustmentRequest.body, escala_y: 0 } },
  { ...adjustmentRequest, body: { ...adjustmentRequest.body, anterior: { ...previous, escala_x: "1" } } },
  { ...adjustmentRequest, body: { ...adjustmentRequest.body, anterior: { ...previous, caminho_svg: "" } } },
]) {
  savedAdjustment = null;
  receivedError = undefined;
  await mapController.updateMapAreaAdjustment(request, adjustmentResponse, (error) => { receivedError = error; });
  assert.equal(receivedError?.statusCode, 400);
  assert.equal(savedAdjustment, null);
}
for (const [result, status] of [[{ conflict: true }, 409], [{ notFound: true }, 404]]) {
  adjustmentOutcome = result;
  receivedError = undefined;
  await mapController.updateMapAreaAdjustment(adjustmentRequest, adjustmentResponse, (error) => { receivedError = error; });
  assert.equal(receivedError?.statusCode, status);
}

receivedError = undefined;
await mapController.saveMap(
  {
    body: { nome: "Inválido", areas: [{ tipo: "OUTRO", nome: "Área", caminho_svg: "M0 0\" onload=alert(1)" }] },
    params: {},
    institution: { id: 2 },
  },
  mapResponse,
  (error) => { receivedError = error; }
);
assert.equal(receivedError.statusCode, 400);

const visibilityCalls = [];
const visibilityController = createFacilitiesController({
  asBoolean: Boolean,
  cacheableJson: (_req, res, payload) => res.json(payload),
  facilitiesModel: {
    listMaps: async (value) => { visibilityCalls.push(value); return []; },
  },
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  isForeignKeyError: () => false,
  positiveInt: () => 1,
});
for (const user of [{ papel: "ADMIN" }, { papel: "CPD" }, null]) {
  await visibilityController.listMaps(
    { institution: { id: 2 }, user },
    { json: () => {} },
    (error) => assert.fail(error)
  );
}
assert.deepEqual(visibilityCalls, [
  { institutionId: 2, authenticated: false },
  { institutionId: 2, authenticated: true },
  { institutionId: 2, authenticated: false },
]);

const mapQueries = [];
const mapTransaction = [];
const stableMapModel = createFacilitiesModel({
  db: {
    getConnection: async () => ({
      query: async (sql, params) => {
        mapQueries.push({ sql, params });
        if (sql.includes("UPDATE mapas")) return [{ affectedRows: 1 }];
        if (sql.includes("SELECT id FROM mapa_areas")) return [[{ id: 31 }]];
        return [{ affectedRows: 1 }];
      },
      beginTransaction: async () => mapTransaction.push("begin"),
      commit: async () => mapTransaction.push("commit"),
      rollback: async () => mapTransaction.push("rollback"),
      release: () => mapTransaction.push("release"),
    }),
  },
  dayOrderSql: "h.dia",
});
assert.deepEqual(await stableMapModel.saveMap({
  institutionId: 2,
  mapId: 12,
  map: {
    nome: "Térreo",
    piso: null,
    largura: 800,
    altura: 600,
    ativo: true,
    areas: [{ id: 31, tipo: "OUTRO", nome: "Pátio", caminho_svg: "M0 0 L50 0 L50 50 Z", bloco_id: null, sala_id: null, setor_id: null }],
  },
}), { id: 12 });
assert.deepEqual(mapTransaction, ["begin", "commit", "release"]);
assert.equal(mapQueries.some(({ sql }) => sql.includes("DELETE FROM mapa_areas")), false);
assert.deepEqual(
  mapQueries.find(({ sql }) => sql.includes("UPDATE mapa_areas")).params.slice(-3),
  [31, 12, 2]
);

const detailedMapPayload = {
  nome: "Bloco D · 2º andar", piso: "2º andar", largura: 800, altura: 600,
  bloco_id: "4", visao_geral: true, descricao: "Acesso pela escada do bloco D.",
  areas: [{
    tipo: "SALA", nome: "D202", caminho_svg: "M0 0 L50 0 L50 50 Z",
    sala_id: "9", setor_id: "7", rotulo_x: "0", rotulo_y: "25",
    categoria: "ambiente", destino_mapa_id: "13", descricao: "Laboratório de informática.",
  }],
};
receivedError = undefined;
await mapController.saveMap(
  { body: detailedMapPayload, params: {}, institution: { id: 2 } }, mapResponse,
  (error) => { receivedError = error; }
);
assert.equal(receivedError, undefined);
const detailedMap = savedMap;
assert.equal(detailedMap.map.bloco_id, 4);
assert.equal(detailedMap.map.visao_geral, true);
assert.equal(detailedMap.map.descricao, detailedMapPayload.descricao);
assert.deepEqual(detailedMap.map.areas[0], {
  id: null, tipo: "SALA", nome: "D202", caminho_svg: "M0 0 L50 0 L50 50 Z",
  bloco_id: null, sala_id: 9, setor_id: 7, rotulo_x: 0, rotulo_y: 25,
  categoria: "AMBIENTE", destino_mapa_id: 13, descricao: "Laboratório de informática.",
});

for (const invalidPayload of [
  { largura: 0 },
  { bloco_id: -1 },
  { descricao: "x".repeat(2001) },
  { areas: [null] },
  ...[
    { rotulo_y: null }, { rotulo_x: "Infinity" }, { rotulo_x: 801 },
    { categoria: "INVENTADA" }, { destino_mapa_id: "NaN" },
    { bloco_id: 4 }, { tipo: "SETOR" },
  ].map((area) => ({ areas: [{ ...detailedMapPayload.areas[0], ...area }] })),
]) {
  receivedError = undefined;
  await mapController.saveMap(
    { body: { ...detailedMapPayload, ...invalidPayload }, params: {}, institution: { id: 2 } },
    mapResponse, (error) => { receivedError = error; }
  );
  assert.equal(receivedError?.statusCode, 400);
}

for (const missingTable of ["blocos", "salas", "setores", "mapas"]) {
  const calls = [];
  const steps = [];
  const isolatedModel = createFacilitiesModel({
    db: {
      getConnection: async () => ({
        query: async (sql, params) => {
          calls.push({ sql, params });
          assert.match(sql, /SELECT id FROM \w+ WHERE id = \? AND instituicao_id = \? LIMIT 1/);
          assert.equal(params[1], 2);
          return [sql.includes(`FROM ${missingTable} `) ? [] : [{ id: params[0] }]];
        },
        beginTransaction: async () => steps.push("begin"),
        commit: async () => steps.push("commit"),
        rollback: async () => steps.push("rollback"),
        release: () => steps.push("release"),
      }),
    },
    dayOrderSql: "h.dia",
  });
  assert.deepEqual(await isolatedModel.saveMap(detailedMap), { invalidReference: true });
  assert.deepEqual(steps, ["begin", "rollback", "release"]);
  assert.equal(calls.at(-1).sql.includes(`FROM ${missingTable} `), true);
}

const createdMapQueries = [];
const metadataModel = createFacilitiesModel({
  db: {
    getConnection: async () => ({
      query: async (sql, params) => {
        createdMapQueries.push({ sql, params });
        if (sql.includes("SELECT id FROM")) return [[{ id: params[0] }]];
        if (sql.includes("INSERT INTO mapas")) return [{ insertId: 12 }];
        return [{ affectedRows: 1 }];
      },
      beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
    }),
    query: async (sql, params) => {
      assert.deepEqual(params, [2]);
      if (sql.includes("FROM mapas m")) {
        assert.match(sql, /b.instituicao_id = m.instituicao_id/);
        assert.match(sql, /m.instituicao_id = \? AND m.ativo = TRUE/);
        return [[{ ...detailedMap.map, id: 12, bloco_nome: "Bloco D" }]];
      }
      assert.match(sql, /a.rotulo_x::float8 AS rotulo_x/);
      assert.match(sql, /a.ajuste_x, a.ajuste_y, a.escala_x, a.escala_y/);
      return [[{ ...detailedMap.map.areas[0], id: 32, mapa_id: 12,
        ajuste_x: 0, ajuste_y: 0, escala_x: 1, escala_y: 1 }]];
    },
  },
  dayOrderSql: "h.dia",
});
assert.deepEqual(await metadataModel.saveMap(detailedMap), { id: 12 });
assert.deepEqual(createdMapQueries.find(({ sql }) => sql.includes("INSERT INTO mapas")).params, [
  2, "Bloco D · 2º andar", "2º andar", 800, 600, true, 4, true, "Acesso pela escada do bloco D.",
]);
assert.deepEqual(createdMapQueries.find(({ sql }) => sql.includes("INSERT INTO mapa_areas")).params, [
  2, 12, "SALA", "D202", "M0 0 L50 0 L50 50 Z", null, 9, 7,
  0, 25, "AMBIENTE", 13, "Laboratório de informática.",
]);
const [listedMap] = await metadataModel.listMaps({ institutionId: 2, authenticated: false });
assert.equal(listedMap.bloco_nome, "Bloco D");
assert.equal(listedMap.visao_geral, true);
assert.equal(listedMap.areas[0].rotulo_x, 0);
assert.equal(listedMap.areas[0].destino_mapa_id, 13);
assert.deepEqual(
  [listedMap.areas[0].ajuste_x, listedMap.areas[0].ajuste_y, listedMap.areas[0].escala_x, listedMap.areas[0].escala_y],
  [0, 0, 1, 1]
);

const adjustmentQueries = [];
let affectedRows = 1;
let targetExists = true;
const adjustmentModel = createFacilitiesModel({
  db: {
    query: async (sql, params) => {
      adjustmentQueries.push({ sql, params });
      if (sql.startsWith("UPDATE mapa_areas")) return [{ affectedRows }];
      return [targetExists ? [{ id: 31 }] : []];
    },
  },
  dayOrderSql: "h.dia",
});
const adjustmentArgs = { institutionId: 2, mapId: 12, areaId: 31, adjustment, previous };
assert.deepEqual(await adjustmentModel.updateMapAreaAdjustment(adjustmentArgs), { adjustment });
assert.equal(adjustmentQueries.length, 1);
assert.match(adjustmentQueries[0].sql, /SET ajuste_x = \?, ajuste_y = \?, escala_x = \?, escala_y = \?/);
assert.match(adjustmentQueries[0].sql, /a.id = \? AND a.mapa_id = \? AND a.instituicao_id = \?/);
assert.match(adjustmentQueries[0].sql, /a.caminho_svg = \?/);
assert.deepEqual(adjustmentQueries[0].params, [
  -25, 16, 1.5, 0.8, 31, 12, 2, previous.caminho_svg, 0, 0, 1, 1,
]);
affectedRows = 0;
assert.deepEqual(await adjustmentModel.updateMapAreaAdjustment(adjustmentArgs), { conflict: true });
assert.deepEqual(adjustmentQueries.at(-1).params, [31, 12, 2]);
targetExists = false;
assert.deepEqual(await adjustmentModel.updateMapAreaAdjustment(adjustmentArgs), { notFound: true });
