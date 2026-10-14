import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createFacilitiesController } from "./controllers/facilitiesController.js";
import { createFacilitiesModel } from "./models/facilitiesModel.js";
import { createContentModel } from "./models/contentModel.js";
import { cimolMapViews } from "./data/cimolMap.js";
import { registerFacilitiesRoutes } from "./routes/facilitiesRoutes.js";

const routes = [];
const app = Object.fromEntries(
  ["get", "post", "put", "patch", "delete"].map((method) => [method, (...args) => routes.push([method, ...args])])
);
const controller = Object.fromEntries(
  [
    "listMaps", "saveMap", "createMapBlockArea", "updateMapBlockArea", "deleteMapBlockArea", "restoreMapArea", "updateMapAreaAdjustment", "updateMapAreaAdjustments", "updateMapAreaLayers",
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
    "post /api/mapas/:mapId/areas",
    "patch /api/mapas/:mapId/areas/ajustes",
    "patch /api/mapas/:mapId/areas/camadas",
    "patch /api/mapas/:mapId/areas/:areaId",
    "delete /api/mapas/:mapId/areas/:areaId",
    "post /api/mapas/:mapId/areas/:areaId/restaurar",
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
assert.equal(routes.filter(([, , middleware]) => middleware === cpdOnly).length, 16);

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
let savedBatch;
let batchOutcome;
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
    updateMapAreaAdjustments: async (value) => {
      savedBatch = value;
      return batchOutcome;
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
const batchItem = { area_id: 31, ...adjustment, anterior: previous };
batchOutcome = { ok: true }; receivedError = undefined;
await mapController.updateMapAreaAdjustments({ params: { mapId: "12" }, institution: { id: 2 },
  body: { ajustes: [batchItem, { ...batchItem, area_id: 32 }] } }, adjustmentResponse,
  (error) => { receivedError = error; });
assert.equal(receivedError, undefined);
assert.deepEqual(savedBatch, { institutionId: 2, mapId: 12,
  adjustments: [batchItem, { ...batchItem, area_id: 32 }] });
for (const ajustes of [[], [batchItem, batchItem], [{ ...batchItem, area_id: 0 }],
  [{ ...batchItem, anterior: { ...previous, caminho_svg: "" } }],
  [{ ...batchItem, escala_x: 0 }]]) {
  savedBatch = null; receivedError = undefined;
  await mapController.updateMapAreaAdjustments({ params: { mapId: "12" }, institution: { id: 2 },
    body: { ajustes } }, adjustmentResponse, (error) => { receivedError = error; });
  assert.equal(receivedError?.statusCode, 400);
  assert.equal(savedBatch, null);
}
for (const [result, status] of [[{ conflict: true }, 409], [{ notFound: true }, 404]]) {
  batchOutcome = result; receivedError = undefined;
  await mapController.updateMapAreaAdjustments({ params: { mapId: "12" }, institution: { id: 2 },
    body: { ajustes: [batchItem] } }, adjustmentResponse, (error) => { receivedError = error; });
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
        if (sql.includes("SELECT nome FROM mapas")) return [[{ nome: "Térreo" }]];
        if (sql.includes("UPDATE mapas")) return [{ affectedRows: 1 }];
        if (sql.includes("FROM mapa_areas WHERE mapa_id")) return [[
          { id: 31, excluido_cpd: false }, { id: 32, excluido_cpd: true },
        ]];
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
assert.equal(mapQueries.some(({ sql }) => sql.includes("excluido_cpd = TRUE")), false,
  "Um PUT completo não deve apagar um bloco já ocultado pelo CPD.");
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
      assert.match(sql, /a.chave_publicacao/);
      assert.match(sql, /a.ajuste_x, a.ajuste_y, a.escala_x, a.escala_y/);
      assert.match(sql, /a.excluido_cpd = FALSE/);
      assert.match(sql, /ORDER BY a.ordem_camada ASC NULLS LAST, a.id/);
      return [[{ ...detailedMap.map.areas[0], id: 32, mapa_id: 12,
        chave_publicacao: "d202", ajuste_x: 0, ajuste_y: 0, escala_x: 1, escala_y: 1 }]];
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
assert.equal(listedMap.areas[0].chave_publicacao, "d202");
assert.deepEqual(
  [listedMap.areas[0].ajuste_x, listedMap.areas[0].ajuste_y, listedMap.areas[0].escala_x, listedMap.areas[0].escala_y],
  [0, 0, 1, 1]
);
const hiddenMapQueries = [];
const hiddenMapModel = createFacilitiesModel({
  db: { query: async (sql, params) => {
    hiddenMapQueries.push({ sql, params });
    if (sql.includes("FROM mapas m")) return [[{ id: 12, nome: "Mapa", ativo: true }]];
    const rows = [
      { ...detailedMap.map.areas[0], id: 31, mapa_id: 12, excluido_cpd: false },
      { ...detailedMap.map.areas[0], id: 32, mapa_id: 12, nome: "Escada", tipo: "OUTRO", categoria: "ESCADA", excluido_cpd: true },
    ];
    return [sql.includes("a.excluido_cpd = FALSE") ? rows.filter((row) => !row.excluido_cpd) : rows];
  } }, dayOrderSql: "h.dia",
});
const [cpdMap] = await hiddenMapModel.listMaps({ institutionId: 2, authenticated: true });
assert.deepEqual(cpdMap.areas.map((area) => area.id), [31]);
assert.deepEqual(cpdMap.areas_ocultas.map((area) => area.id), [32]);
assert.ok(!hiddenMapQueries.at(-1).sql.includes("a.excluido_cpd = FALSE"));
const [publicMap] = await hiddenMapModel.listMaps({ institutionId: 2, authenticated: false });
assert.equal("areas_ocultas" in publicMap, false);
assert.deepEqual(publicMap.areas.map((area) => area.id), [31]);
assert.match(hiddenMapQueries.at(-1).sql, /a.excluido_cpd = FALSE/);
const contentQueries = [];
const contentModel = createContentModel({ db: { query: async (sql, params) => {
  contentQueries.push({ sql, params });
  return [[{ id: 31, nome: "Área" }]];
} } });
await contentModel.listSectors({ institutionId: 2, includeInactive: false });
assert.match(contentQueries.at(-1).sql, /a.excluido_cpd = FALSE/);
await contentModel.resolveManifestationContext({ institutionId: 2,
  manifestation: { setor_id: null, sala_id: null, horario_id: null, mapa_area_id: 31 } });
assert.match(contentQueries.at(-1).sql, /a.excluido_cpd = FALSE/);
assert.deepEqual(contentQueries.at(-1).params, [31, 2]);

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

const batchQueries = [];
const batchSteps = [];
let batchAffected = [1, 1];
let batchMapExists = true;
let batchAreaExists = true;
const batchModel = createFacilitiesModel({
  db: { getConnection: async () => ({
    query: async (sql, params) => {
      batchQueries.push({ sql, params });
      if (sql.startsWith("SELECT id FROM mapas")) return [batchMapExists ? [{ id: 12 }] : []];
      if (sql.startsWith("UPDATE mapa_areas")) return [{ affectedRows: batchAffected.shift() ?? 1 }];
      return [batchAreaExists ? [{ id: 32 }] : []];
    },
    beginTransaction: async () => batchSteps.push("begin"),
    commit: async () => batchSteps.push("commit"),
    rollback: async () => batchSteps.push("rollback"),
    release: () => batchSteps.push("release"),
  }) }, dayOrderSql: "h.dia",
});
const batchArgs = { institutionId: 2, mapId: 12,
  adjustments: [
    { area_id: 31, ...adjustment, anterior: previous },
    { area_id: 32, ...adjustment, anterior: previous },
  ] };
assert.deepEqual(await batchModel.updateMapAreaAdjustments(batchArgs), { ok: true });
assert.deepEqual(batchSteps, ["begin", "commit", "release"]);
assert.equal(batchQueries.filter(({ sql }) => sql.startsWith("UPDATE mapa_areas")).length, 2);
assert.deepEqual(batchQueries[1].params, adjustmentQueries[0].params);
batchSteps.length = 0; batchAffected = [1, 0];
assert.deepEqual(await batchModel.updateMapAreaAdjustments(batchArgs), { conflict: true });
assert.deepEqual(batchSteps, ["begin", "rollback", "release"], "Conflito deve desfazer até o primeiro ajuste.");
batchSteps.length = 0; batchAffected = [1, 0]; batchAreaExists = false;
assert.deepEqual(await batchModel.updateMapAreaAdjustments(batchArgs), { notFound: true });
assert.deepEqual(batchSteps, ["begin", "rollback", "release"]);
batchSteps.length = 0; batchMapExists = false;
assert.deepEqual(await batchModel.updateMapAreaAdjustments(batchArgs), { notFound: true });
assert.deepEqual(batchSteps, ["begin", "rollback", "release"]);

const layerQueries = [];
const layerSteps = [];
let currentLayers = [31, 32, 33];
let layerAffected = 3;
const layerModel = createFacilitiesModel({
  db: { getConnection: async () => {
    const before = [...currentLayers];
    return {
      query: async (sql, params) => {
        layerQueries.push({ sql, params });
        if (sql.startsWith("SELECT id FROM mapas")) return [params[0] === 12 && params[1] === 2 ? [{ id: 12 }] : []];
        if (sql.startsWith("SELECT a.id FROM mapa_areas")) {
          assert.deepEqual(params, [12, 2]);
          assert.match(sql, /excluido_cpd = FALSE/);
          assert.match(sql, /ORDER BY a.ordem_camada ASC NULLS LAST, a.id FOR UPDATE OF a/);
          return [currentLayers.map((id) => ({ id }))];
        }
        if (sql.startsWith("UPDATE mapa_areas a SET ordem_camada")) {
          assert.deepEqual(params.slice(-2), [12, 2]);
          assert.doesNotMatch(sql, /editado_cpd/);
          assert.match(sql, /a.id = nova.id AND a.mapa_id = \? AND a.instituicao_id = \?/);
          if (layerAffected === 3) currentLayers = params.slice(0, -2).filter((_, index) => index % 2 === 0);
          return [{ affectedRows: layerAffected }];
        }
        assert.fail(`Unexpected layer query: ${sql}`);
      },
      beginTransaction: async () => layerSteps.push("begin"),
      commit: async () => layerSteps.push("commit"),
      rollback: async () => { currentLayers = before; layerSteps.push("rollback"); },
      release: () => layerSteps.push("release"),
    };
  } }, dayOrderSql: "h.dia",
});
const layerArgs = { institutionId: 2, mapId: 12, areaIds: [31, 33, 32], previousIds: [31, 32, 33] };
assert.deepEqual(await layerModel.updateMapAreaLayers(layerArgs), { ok: true });
assert.deepEqual(currentLayers, [31, 33, 32]);
assert.deepEqual(layerSteps, ["begin", "commit", "release"]);
assert.deepEqual(layerQueries.at(-1).params, [31, 0, 33, 1, 32, 2, 12, 2]);
layerSteps.length = 0;
assert.deepEqual(await layerModel.updateMapAreaLayers(layerArgs), { conflict: true }, "Ordem antiga não pode sobrescrever outra edição.");
assert.deepEqual(layerSteps, ["begin", "rollback", "release"]);
assert.deepEqual(currentLayers, [31, 33, 32]);
layerSteps.length = 0;
assert.deepEqual(await layerModel.updateMapAreaLayers({ ...layerArgs, previousIds: currentLayers,
  areaIds: [31, 33, 999] }), { conflict: true }, "IDs ocultos ou de outra vista não entram na camada.");
assert.deepEqual(layerSteps, ["begin", "rollback", "release"]);
layerSteps.length = 0;
assert.deepEqual(await layerModel.updateMapAreaLayers({ ...layerArgs, institutionId: 3 }), { notFound: true });
assert.deepEqual(layerSteps, ["begin", "rollback", "release"]);
layerSteps.length = 0; layerAffected = 0;
assert.deepEqual(await layerModel.updateMapAreaLayers({ ...layerArgs, previousIds: currentLayers }), { conflict: true });
assert.deepEqual(layerSteps, ["begin", "rollback", "release"]);
assert.deepEqual(currentLayers, [31, 33, 32]);

let layerCall;
let layerOutcome = { ok: true };
const layerController = createFacilitiesController({
  asBoolean: Boolean, cacheableJson: () => {},
  facilitiesModel: { updateMapAreaLayers: async (args) => { layerCall = args; return layerOutcome; } },
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
});
receivedError = undefined;
await layerController.updateMapAreaLayers({ params: { mapId: "12" }, institution: { id: 2 },
  body: { area_ids: [31, 33, 32], anterior: [31, 32, 33] } }, mapResponse,
  (error) => { receivedError = error; });
assert.equal(receivedError, undefined);
assert.deepEqual(layerCall, { institutionId: 2, mapId: 12, areaIds: [31, 33, 32], previousIds: [31, 32, 33] });
assert.deepEqual(mapResponse.payload, { ok: true });
for (const body of [
  { area_ids: [31, 31], anterior: [31, 32] },
  { area_ids: [31, "32"], anterior: [31, 32] },
  { area_ids: [31], anterior: [31, 32] },
  { area_ids: [], anterior: [] },
]) {
  layerCall = null; receivedError = undefined;
  await layerController.updateMapAreaLayers({ params: { mapId: "12" }, institution: { id: 2 }, body }, mapResponse,
    (error) => { receivedError = error; });
  assert.equal(receivedError?.statusCode, 400);
  assert.equal(layerCall, null);
}
layerOutcome = { conflict: true }; receivedError = undefined;
await layerController.updateMapAreaLayers({ params: { mapId: "12" }, institution: { id: 2 },
  body: { area_ids: [31], anterior: [31] } }, mapResponse,
  (error) => { receivedError = error; });
assert.equal(receivedError?.statusCode, 409);
layerOutcome = { notFound: true }; receivedError = undefined;
await layerController.updateMapAreaLayers({ params: { mapId: "12" }, institution: { id: 2 },
  body: { area_ids: [31], anterior: [31] } }, mapResponse,
  (error) => { receivedError = error; });
assert.equal(receivedError?.statusCode, 404);

const blockArea = {
  nome: "Bloco D", caminho_svg: "M 10 10 H 60 V 50 H 10 Z", bloco_id: 4,
  destino_mapa_id: 13, rotulo_x: 35, rotulo_y: 30, categoria: "AMBIENTE",
};
const areaSnapshot = { ...blockArea, tipo: "BLOCO", categoria: "AMBIENTE", sala_id: null, setor_id: null,
  descricao: null, ajuste_x: 0, ajuste_y: 0, escala_x: 1, escala_y: 1 };
let areaCall;
let areaOutcome = { id: 41 };
const areaController = createFacilitiesController({
  asBoolean: Boolean, cacheableJson: () => {},
  facilitiesModel: {
    createMapBlockArea: async (args) => { areaCall = args; return areaOutcome; },
    updateMapBlockArea: async (args) => { areaCall = args; return areaOutcome; },
    deleteMapBlockArea: async (args) => { areaCall = args; return areaOutcome; },
    restoreMapArea: async (args) => { areaCall = args; return areaOutcome; },
  },
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  isForeignKeyError: () => false, positiveInt: () => 1,
});
const areaRequest = { params: { mapId: "12", areaId: "41" }, institution: { id: 2 } };
receivedError = undefined;
await areaController.createMapBlockArea({ ...areaRequest, body: blockArea }, mapResponse,
  (error) => { receivedError = error; });
assert.equal(receivedError, undefined);
assert.deepEqual(areaCall, { institutionId: 2, mapId: 12, area: { ...blockArea, descricao: null } });
assert.equal(mapResponse.statusCode, 201);
assert.deepEqual(mapResponse.payload, { id: 41 });
for (const changed of [
  { destino_mapa_id: 12 }, { destino_mapa_id: 0 }, { caminho_svg: "M0 0\" onload=alert(1)" },
  { bloco_id: "not-an-id" }, { rotulo_x: 10001 }, { categoria: "OUTRA" },
]) {
  areaCall = null; receivedError = undefined;
  await areaController.createMapBlockArea({ ...areaRequest, body: { ...blockArea, ...changed } }, mapResponse,
    (error) => { receivedError = error; });
  assert.equal(receivedError?.statusCode, 400);
  assert.equal(areaCall, null);
}
const freeArea = { nome: "Caminho ao ginásio", caminho_svg: blockArea.caminho_svg,
  categoria: "CIRCULACAO", destino_mapa_id: null, rotulo_x: 35, rotulo_y: 30 };
areaOutcome = { id: 42 }; receivedError = undefined;
await areaController.createMapBlockArea({ ...areaRequest, body: freeArea }, mapResponse,
  (error) => { receivedError = error; });
assert.equal(receivedError, undefined);
assert.deepEqual(areaCall, { institutionId: 2, mapId: 12, area: {
  ...freeArea, bloco_id: null, descricao: null,
} });
assert.deepEqual(mapResponse.payload, { id: 42 });
areaOutcome = { conflict: true }; receivedError = undefined;
await areaController.createMapBlockArea({ ...areaRequest, body: blockArea }, mapResponse,
  (error) => { receivedError = error; });
assert.equal(receivedError?.statusCode, 409);
areaOutcome = { ok: true }; receivedError = undefined;
await areaController.updateMapBlockArea({ ...areaRequest,
  body: { destino_mapa_id: 14, anterior: areaSnapshot } }, mapResponse,
(error) => { receivedError = error; });
assert.equal(receivedError, undefined);
assert.deepEqual(areaCall, { institutionId: 2, mapId: 12, areaId: 41,
  destinationId: 14, previous: areaSnapshot });
receivedError = undefined;
await areaController.updateMapBlockArea({ ...areaRequest,
  body: { nome: "  Entrada para o pátio  ", anterior: areaSnapshot } }, mapResponse,
  (error) => { receivedError = error; });
assert.equal(receivedError, undefined, "Qualquer desenho pode ser renomeado sem alterar seu destino.");
assert.deepEqual(areaCall, { institutionId: 2, mapId: 12, areaId: 41,
  name: "Entrada para o pátio", previous: areaSnapshot });
for (const nome of ["", "   ", 123, "x".repeat(121)]) {
  areaCall = null; receivedError = undefined;
  await areaController.updateMapBlockArea({ ...areaRequest,
    body: { nome, anterior: areaSnapshot } }, mapResponse,
    (error) => { receivedError = error; });
  assert.equal(receivedError?.statusCode, 400);
  assert.equal(areaCall, null);
}
areaOutcome = { duplicateName: true }; receivedError = undefined;
await areaController.updateMapBlockArea({ ...areaRequest,
  body: { nome: "Bloco A", anterior: areaSnapshot } }, mapResponse,
  (error) => { receivedError = error; });
assert.equal(receivedError?.statusCode, 409);
assert.match(receivedError.message, /Já existe uma área com este nome/);
areaOutcome = { ok: true };
receivedError = undefined;
await areaController.updateMapBlockArea({ ...areaRequest,
  body: { destino_mapa_id: null, anterior: { ...areaSnapshot, tipo: "OUTRO", bloco_id: null } } }, mapResponse,
  (error) => { receivedError = error; });
assert.equal(receivedError, undefined, "Uma área livre pode perder sua função de navegação.");
assert.equal(areaCall.destinationId, null);
areaCall = null; receivedError = undefined;
await areaController.updateMapBlockArea({ ...areaRequest, body: { anterior: areaSnapshot } }, mapResponse,
  (error) => { receivedError = error; });
assert.equal(receivedError?.statusCode, 400);
assert.equal(areaCall, null);
receivedError = undefined;
await areaController.deleteMapBlockArea({ ...areaRequest, body: { anterior: areaSnapshot } }, mapResponse,
  (error) => { receivedError = error; });
assert.equal(receivedError, undefined);
assert.deepEqual(areaCall, { institutionId: 2, mapId: 12, areaId: 41, previous: areaSnapshot });
receivedError = undefined;
await areaController.restoreMapArea({ ...areaRequest, body: { anterior: areaSnapshot } }, mapResponse,
  (error) => { receivedError = error; });
assert.equal(receivedError, undefined);
assert.deepEqual(areaCall, { institutionId: 2, mapId: 12, areaId: 41, previous: areaSnapshot });
receivedError = undefined;
await areaController.deleteMapBlockArea({ ...areaRequest,
  body: { anterior: { ...areaSnapshot, escala_x: "1" } } }, mapResponse,
(error) => { receivedError = error; });
assert.equal(receivedError?.statusCode, 400);
receivedError = undefined;
await areaController.deleteMapBlockArea({ ...areaRequest,
  body: { anterior: { ...areaSnapshot, tipo: "OUTRO", bloco_id: null, sala_id: null } } }, mapResponse,
  (error) => { receivedError = error; });
assert.equal(receivedError, undefined, "O CPD pode ocultar uma área que não seja bloco.");

const editorQueries = [];
const editorSteps = [];
let duplicateArea = [{ id: 41, tipo: "BLOCO", categoria: "AMBIENTE", excluido_cpd: true }];
let destinationAvailable = true;
let editorAffected = 1;
let editorTargetExists = true;
let duplicateEditorName = false;
let uniqueViolation = false;
let editorMapExists = true;
let editorMapName = "Mapa";
const editorModel = createFacilitiesModel({
  db: {
    getConnection: async () => ({
      query: async (sql, params) => {
        editorQueries.push({ sql, params });
        if (sql.includes("SELECT largura, altura FROM mapas")) return [[{ largura: 800, altura: 600 }]];
        if (sql.includes("SELECT id FROM blocos")) return [[{ id: 4 }]];
        if (sql.includes("SELECT m.id, m.nome, i.slug FROM mapas m")) return [editorMapExists ? [
          { id: 12, nome: editorMapName, slug: "cimol" },
        ] : []];
        if (sql.includes("SELECT id FROM mapas WHERE id = ? AND instituicao_id = ? FOR UPDATE")) return [editorMapExists ? [{ id: 12 }] : []];
        if (sql.includes("SELECT id FROM mapas")) return [destinationAvailable ? [{ id: 13 }] : []];
        if (sql.includes("SELECT id, tipo, categoria, excluido_cpd FROM mapa_areas")) return [duplicateArea];
        if (sql.includes("SELECT id FROM mapa_areas WHERE mapa_id = ?")) return [duplicateEditorName ? [{ id: 42 }] : []];
        if (sql.includes("SELECT id FROM mapa_areas WHERE id = ?")) return [editorTargetExists ? [{ id: 41 }] : []];
        if (sql.includes("SELECT COUNT(*)::int")) return [[{ total: 8 }]];
        if (sql.includes("INSERT INTO mapa_areas")) return [{ insertId: 42 }];
        if (sql.includes("UPDATE mapa_areas")) {
          if (uniqueViolation) throw Object.assign(new Error("Chave duplicada"), {
            code: "23505", constraint: "uq_mapa_areas_chave_publicacao",
          });
          return [{ affectedRows: editorAffected }];
        }
        return [{ affectedRows: 1 }];
      },
      beginTransaction: async () => editorSteps.push("begin"),
      commit: async () => editorSteps.push("commit"),
      rollback: async () => editorSteps.push("rollback"),
      release: () => editorSteps.push("release"),
    }),
    query: async (sql, params) => {
      editorQueries.push({ sql, params });
      if (sql.includes("SELECT id FROM mapas")) return [destinationAvailable ? [{ id: 13 }] : []];
      if (sql.includes("UPDATE mapa_areas")) return [{ affectedRows: editorAffected }];
      return [editorTargetExists ? [{ id: 41 }] : []];
    },
  }, dayOrderSql: "h.dia",
});
assert.deepEqual(await editorModel.createMapBlockArea({ institutionId: 2, mapId: 12, area: blockArea }), { id: 41 });
assert.deepEqual(editorSteps, ["begin", "commit", "release"]);
assert.match(editorQueries.find(({ sql }) => sql.includes("UPDATE mapa_areas")).sql,
  /editado_cpd = TRUE, excluido_cpd = FALSE/);
assert.ok(editorQueries.every(({ sql }) => !sql.includes("DELETE FROM blocos") && !sql.includes("DELETE FROM salas")));
duplicateArea = [{ id: 41, tipo: "BLOCO", categoria: "AMBIENTE", excluido_cpd: false }];
assert.deepEqual(await editorModel.createMapBlockArea({ institutionId: 2, mapId: 12, area: blockArea }), { conflict: true });
duplicateArea = []; destinationAvailable = false;
assert.deepEqual(await editorModel.createMapBlockArea({ institutionId: 2, mapId: 12, area: blockArea }), { invalidReference: true });
destinationAvailable = true;
assert.deepEqual(await editorModel.createMapBlockArea({ institutionId: 2, mapId: 12, area: blockArea }), { id: 42 });
const freeAreaRecord = { ...freeArea, bloco_id: null, descricao: null };
const queriesBeforeFreeCreate = editorQueries.length;
assert.deepEqual(await editorModel.createMapBlockArea({ institutionId: 2, mapId: 12, area: freeAreaRecord }), { id: 42 });
const freeCreateQueries = editorQueries.slice(queriesBeforeFreeCreate);
assert.ok(!freeCreateQueries.some(({ sql }) => sql.includes("SELECT id FROM blocos") || sql.includes("SELECT id FROM mapas WHERE")));
assert.deepEqual(freeCreateQueries.find(({ sql }) => sql.includes("INSERT INTO mapa_areas")).params,
  [2, 12, "OUTRO", freeArea.nome, freeArea.caminho_svg, null, 35, 30, "CIRCULACAO", null, null]);
assert.deepEqual(await editorModel.updateMapBlockArea({ institutionId: 2, mapId: 12, areaId: 41,
  destinationId: 14, previous: areaSnapshot }), { ok: true });
assert.match(editorQueries.at(-1).sql, /a.tipo = \? AND a.categoria = \?/);
assert.deepEqual(editorQueries.at(-1).params, [14, null, 41, 12, 2, "BLOCO", "AMBIENTE", "Bloco D",
  blockArea.caminho_svg, 4, null, null, 13, 35, 30, null, 0, 0, 1, 1]);
const beforeRename = editorQueries.length;
const beforeRenameSteps = editorSteps.length;
assert.deepEqual(await editorModel.updateMapBlockArea({ institutionId: 2, mapId: 12, areaId: 41,
  name: "Entrada para o pátio", previous: areaSnapshot }), { ok: true });
assert.deepEqual(editorSteps.slice(beforeRenameSteps), ["begin", "commit", "release"]);
assert.match(editorQueries[beforeRename].sql, /FOR UPDATE/);
assert.match(editorQueries.at(-1).sql, /SET nome = \?, chave_publicacao = COALESCE\(a.chave_publicacao, \?\), editado_cpd = TRUE/);
assert.deepEqual(editorQueries.at(-1).params.slice(0, 5), ["Entrada para o pátio", null, 41, 12, 2]);
assert.match(editorQueries.at(-1).sql, /a.nome = \?/);
editorMapName = "CIMOL · Visão geral";
assert.deepEqual(await editorModel.updateMapBlockArea({ institutionId: 2, mapId: 12, areaId: 41,
  name: "Pavilhão D", previous: areaSnapshot }), { ok: true });
assert.match(editorQueries.at(-1).sql, /chave_publicacao = COALESCE\(a.chave_publicacao, \?\)/);
assert.deepEqual(editorQueries.at(-1).params.slice(0, 5), ["Pavilhão D", null, 41, 12, 2],
  "Um desenho criado pelo CPD não pode herdar uma chave publicada só por ter o mesmo nome.");
const canonicalD = cimolMapViews.find((view) => view.key === "campus").areas.find((area) => area.key === "d");
const publishedSnapshot = { ...areaSnapshot, caminho_svg: canonicalD.caminho_svg };
assert.deepEqual(await editorModel.updateMapBlockArea({ institutionId: 2, mapId: 12, areaId: 41,
  name: "Pavilhão D", previous: publishedSnapshot }), { ok: true });
assert.deepEqual(editorQueries.at(-1).params.slice(0, 5), ["Pavilhão D", "d", 41, 12, 2],
  "A área legada canônica recebe a chave antes de ser renomeada.");
editorMapName = "Mapa";
duplicateEditorName = true;
assert.deepEqual(await editorModel.updateMapBlockArea({ institutionId: 2, mapId: 12, areaId: 41,
  name: "Bloco B", previous: areaSnapshot }), { duplicateName: true });
duplicateEditorName = false;
assert.deepEqual(editorSteps.slice(-2), ["rollback", "release"]);
uniqueViolation = true;
assert.deepEqual(await editorModel.updateMapBlockArea({ institutionId: 2, mapId: 12, areaId: 41,
  name: "Bloco B", previous: publishedSnapshot }), { conflict: true },
"Colisões da chave de publicação devem ser tratadas como conflito de edição.");
uniqueViolation = false;
editorMapExists = false;
assert.deepEqual(await editorModel.updateMapBlockArea({ institutionId: 2, mapId: 12, areaId: 41,
  name: "Bloco B", previous: areaSnapshot }), { notFound: true });
editorMapExists = true;
assert.deepEqual(await editorModel.updateMapBlockArea({ institutionId: 2, mapId: 12, areaId: 41,
  destinationId: null, previous: { ...areaSnapshot, tipo: "OUTRO", bloco_id: null } }), { ok: true });
assert.equal(editorQueries.at(-1).params[0], null);
editorAffected = 0;
assert.deepEqual(await editorModel.updateMapBlockArea({ institutionId: 2, mapId: 12, areaId: 41,
  destinationId: 14, previous: areaSnapshot }), { conflict: true });
editorAffected = 1;
assert.deepEqual(await editorModel.deleteMapBlockArea({ institutionId: 2, mapId: 12, areaId: 41,
  previous: areaSnapshot }), { ok: true });
assert.match(editorQueries.at(-1).sql, /editado_cpd = TRUE, excluido_cpd = TRUE/);
assert.ok(!editorQueries.at(-1).sql.includes("DELETE FROM"));
assert.ok(!editorQueries.at(-1).sql.includes("a.tipo = 'BLOCO'"));
assert.match(editorQueries.at(-1).sql, /a.sala_id IS NOT DISTINCT FROM \?/);
assert.match(editorQueries.at(-1).sql, /a.rotulo_x::float8 IS NOT DISTINCT FROM \?/);
assert.deepEqual(editorQueries.at(-1).params, [41, 12, 2,
  "BLOCO", "AMBIENTE", "Bloco D", blockArea.caminho_svg, 4, null, null, 13, 35, 30, null, 0, 0, 1, 1]);
const beforeRestore = editorQueries.length;
const beforeRestoreSteps = editorSteps.length;
const deletedAreaParams = editorQueries.at(-1).params;
assert.deepEqual(await editorModel.restoreMapArea({ institutionId: 2, mapId: 12, areaId: 41,
  previous: areaSnapshot }), { ok: true });
assert.match(editorQueries[beforeRestore].sql, /FOR UPDATE/);
assert.deepEqual(editorSteps.slice(beforeRestoreSteps), ["begin", "commit", "release"]);
assert.match(editorQueries.at(-1).sql, /excluido_cpd = TRUE AND/);
assert.match(editorQueries.at(-1).sql, /destino.ativo = TRUE/);
assert.match(editorQueries.at(-1).sql, /LOWER\(outra.nome\) = LOWER\(a.nome\)/);
assert.deepEqual(editorQueries.at(-1).params, deletedAreaParams);
editorAffected = 0;
assert.deepEqual(await editorModel.restoreMapArea({ institutionId: 2, mapId: 12, areaId: 41,
  previous: areaSnapshot }), { conflict: true });
assert.deepEqual(editorSteps.slice(-2), ["rollback", "release"]);
editorTargetExists = false;
assert.deepEqual(await editorModel.restoreMapArea({ institutionId: 2, mapId: 12, areaId: 41,
  previous: areaSnapshot }), { notFound: true });
editorMapExists = false;
assert.deepEqual(await editorModel.restoreMapArea({ institutionId: 2, mapId: 12, areaId: 41,
  previous: areaSnapshot }), { notFound: true });
editorMapExists = true;

const fullMapArea = { id: 31, tipo: "OUTRO", nome: "Bloco D", caminho_svg: blockArea.caminho_svg,
  bloco_id: null, sala_id: null, setor_id: null, rotulo_x: 35, rotulo_y: 30,
  categoria: "AMBIENTE", destino_mapa_id: null, descricao: null };
const fullMap = { nome: "CIMOL · Campus", piso: null, largura: 800, altura: 600,
  ativo: true, bloco_id: null, visao_geral: true, descricao: null, areas: [fullMapArea] };
const fullPutQueries = [];
let storedAreas = [];
const protectedMap = createFacilitiesModel({
  db: { getConnection: async () => ({
    query: async (sql) => {
      fullPutQueries.push(sql);
      if (sql.includes("SELECT nome FROM mapas")) return [[{ nome: "CIMOL · Campus" }]];
      if (sql.includes("SELECT id, nome, excluido_cpd FROM mapa_areas")) return [storedAreas];
      return [{ affectedRows: 1 }];
    },
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
  }) }, dayOrderSql: "h.dia",
});
storedAreas = [{ id: 31, nome: "Bloco D", excluido_cpd: true }];
assert.deepEqual(await protectedMap.saveMap({ institutionId: 2, mapId: 12, map: fullMap }), { conflict: true },
  "Um PUT antigo não pode ressuscitar um desenho excluído pelo CPD.");
assert.ok(!fullPutQueries.some((sql) => sql.includes("UPDATE mapa_areas")));
storedAreas = [{ id: 31, nome: "Bloco D", excluido_cpd: false }];
assert.deepEqual(await protectedMap.saveMap({ institutionId: 2, mapId: 12,
  map: { ...fullMap, areas: [{ ...fullMapArea, nome: "Bloco D novo" }] } }), { conflict: true },
"Renomear uma área publicada faria o seed recriar o nome original.");
storedAreas = [{ id: 31, nome: "Bloco D", excluido_cpd: true }];
assert.deepEqual(await protectedMap.saveMap({ institutionId: 2, mapId: 12,
  map: { ...fullMap, areas: [{ ...fullMapArea, id: null }] } }), { conflict: true },
"Uma nova área não deve duplicar o nome de um tombstone reservado.");
assert.deepEqual(await protectedMap.saveMap({ institutionId: 2, mapId: 12,
  map: { ...fullMap, nome: "Campus renomeado", areas: [] } }), { conflict: true },
"Renomear a vista publicada faria o seed recriá-la.");

const protectedController = createFacilitiesController({
  asBoolean: Boolean, cacheableJson: () => {}, facilitiesModel: { saveMap: async () => ({ conflict: true }) },
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  isForeignKeyError: () => false, positiveInt: () => 1,
});
receivedError = undefined;
await protectedController.saveMap({ body: { ...fullMap, areas: [{ ...fullMapArea, id: null }] },
  params: { id: "12" }, institution: { id: 2 } }, mapResponse,
(error) => { receivedError = error; });
assert.equal(receivedError?.statusCode, 409);
receivedError = undefined;
await protectedController.saveMap({ body: { ...fullMap, areas: [
  { ...fullMapArea, id: null }, { ...fullMapArea, id: null, nome: "bloco d" },
] }, params: { id: "12" }, institution: { id: 2 } }, mapResponse,
(error) => { receivedError = error; });
assert.equal(receivedError?.statusCode, 400);

const schemaSql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
assert.match(schemaSql, /DROP INDEX IF EXISTS uq_mapa_areas_nome_visivel/);
assert.match(schemaSql, /ADD COLUMN IF NOT EXISTS ordem_camada INTEGER NULL/);
assert.doesNotMatch(schemaSql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_mapa_areas_nome_visivel/);
const swapAreas = [{ id: 51, nome: "Sala A", excluido_cpd: false },
  { id: 52, nome: "Sala B", excluido_cpd: false }];
const swapSteps = [];
const swapModel = createFacilitiesModel({ db: { getConnection: async () => ({
  query: async (sql, params) => {
    if (sql.includes("SELECT nome FROM mapas")) return [[{ nome: "Mapa livre" }]];
    if (sql.includes("SELECT id, nome, excluido_cpd FROM mapa_areas")) return [swapAreas.map((area) => ({ ...area }))];
    if (/UPDATE mapa_areas\s+SET tipo/.test(sql)) {
      swapAreas.find((area) => area.id === params.at(-3)).nome = params[1];
    }
    return [{ affectedRows: 1 }];
  },
  beginTransaction: async () => swapSteps.push("begin"),
  commit: async () => swapSteps.push("commit"),
  rollback: async () => swapSteps.push("rollback"),
  release: () => swapSteps.push("release"),
}) }, dayOrderSql: "h.dia" });
const swappedMap = { ...fullMap, nome: "Mapa livre", areas: [
  { ...fullMapArea, id: 51, nome: "Sala B" },
  { ...fullMapArea, id: 52, nome: "Sala A" },
] };
assert.deepEqual(await swapModel.saveMap({ institutionId: 2, mapId: 12, map: swappedMap }), { id: 12 });
assert.deepEqual(swapAreas.map((area) => area.nome), ["Sala B", "Sala A"]);
assert.deepEqual(swapSteps, ["begin", "commit", "release"]);
