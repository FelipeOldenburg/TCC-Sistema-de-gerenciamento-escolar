import assert from "node:assert/strict";
import { createFacilitiesController } from "./controllers/facilitiesController.js";
import { createFacilitiesModel } from "./models/facilitiesModel.js";
import { registerFacilitiesRoutes } from "./routes/facilitiesRoutes.js";

const routes = [];
const app = Object.fromEntries(
  ["get", "post", "put", "delete"].map((method) => [method, (...args) => routes.push([method, ...args])])
);
const controller = Object.fromEntries(
  [
    "listMaps", "saveMap",
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
assert.equal(routes.filter(([, , middleware]) => middleware === cpdOnly).length, 9);

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
const mapController = createFacilitiesController({
  asBoolean: (value) => value === true,
  cacheableJson: () => {},
  facilitiesModel: {
    saveMap: async (value) => {
      savedMap = value;
      return { id: 12 };
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
