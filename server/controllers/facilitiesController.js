const serializeRoom = (row) => ({
  ...row,
  acessivel: Boolean(row.acessivel),
  possui_computadores: Boolean(row.possui_computadores),
  possui_data_show: Boolean(row.possui_data_show),
  possui_internet: Boolean(row.possui_internet),
  possui_ar_condicionado: Boolean(row.possui_ar_condicionado),
  softwares: row.softwares ? row.softwares.split("||") : [],
});

const normalizeRoomPayload = (body = {}, asBoolean) => {
  const softwares = Array.isArray(body.softwares)
    ? body.softwares
    : String(body.softwares || "").split(",");
  const rawCapacity = body.capacidade === null || body.capacidade === undefined || body.capacidade === "" ? null : Number(body.capacidade);
  return {
    bloco_id: Number(body.bloco_id),
    nome: String(body.nome || "").trim(),
    andar: String(body.andar || "").trim(),
    capacidade: rawCapacity,
    tipo: String(body.tipo || "").trim(),
    status: String(body.status || "ATIVA").trim().toUpperCase(),
    acessivel: asBoolean(body.acessivel),
    possui_computadores: asBoolean(body.possui_computadores),
    possui_data_show: asBoolean(body.possui_data_show),
    possui_internet: asBoolean(body.possui_internet),
    possui_ar_condicionado: asBoolean(body.possui_ar_condicionado),
    observacoes: String(body.observacoes || "").trim() || null,
    softwares: [...new Set(softwares.map((value) => String(value).trim()).filter(Boolean))],
  };
};

const nullableNumber = (value) => value === null || value === undefined || value === "" ? null : Number(value);

const svgPathPattern = /^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\-\s]+$/;
const validMapAdjustment = (value) => value && typeof value === "object" && !Array.isArray(value) &&
  Number.isFinite(value.ajuste_x) && Math.abs(value.ajuste_x) <= 200000 &&
  Number.isFinite(value.ajuste_y) && Math.abs(value.ajuste_y) <= 200000 &&
  Number.isFinite(value.escala_x) && value.escala_x >= 0.05 && value.escala_x <= 20 &&
  Number.isFinite(value.escala_y) && value.escala_y >= 0.05 && value.escala_y <= 20;

const normalizeMapPayload = (body = {}, asBoolean) => ({
  nome: String(body.nome || "").trim(),
  piso: String(body.piso || "").trim() || null,
  bloco_id: nullableNumber(body.bloco_id),
  visao_geral: asBoolean(body.visao_geral),
  descricao: String(body.descricao || "").trim() || null,
  largura: Number(body.largura ?? 1000),
  altura: Number(body.altura ?? 700),
  ativo: body.ativo === undefined ? true : asBoolean(body.ativo),
  areas: Array.isArray(body.areas)
    ? body.areas.map((area) => ({
        id: nullableNumber(area.id),
        tipo: String(area.tipo || "").toUpperCase(),
        nome: String(area.nome || "").trim(),
        caminho_svg: String(area.caminho_svg || "").trim(),
        bloco_id: nullableNumber(area.bloco_id),
        sala_id: nullableNumber(area.sala_id),
        setor_id: nullableNumber(area.setor_id),
        rotulo_x: nullableNumber(area.rotulo_x),
        rotulo_y: nullableNumber(area.rotulo_y),
        categoria: String(area.categoria || "AMBIENTE").toUpperCase(),
        destino_mapa_id: nullableNumber(area.destino_mapa_id),
        descricao: String(area.descricao || "").trim() || null,
      }))
    : [],
});

export const createFacilitiesController = ({
  asBoolean,
  cacheableJson,
  facilitiesModel,
  httpError,
  isForeignKeyError,
  positiveInt,
}) => {
  const validateRoom = (room) => {
    if (!room.bloco_id || !room.nome || !room.andar || !room.tipo) {
      throw httpError(400, "Preencha bloco, nome, andar e tipo da sala.");
    }
    if (room.capacidade !== null && (!Number.isInteger(room.capacidade) || room.capacidade < 1)) {
      throw httpError(400, "Informe uma capacidade válida ou deixe em branco para conferência.");
    }
    if (!["ATIVA", "INATIVA", "MANUTENCAO"].includes(room.status)) {
      throw httpError(400, "Status da sala inválido.");
    }
  };

  const sendPublicResponse = (req, res, payload) => {
    if (req.user) return res.json(payload);
    return cacheableJson(req, res, payload, { maxAge: 60, staleWhileRevalidate: 300 });
  };

  const listBlocks = async (req, res, next) => {
    try {
      const rows = await facilitiesModel.listBlocks(req.institution.id);
      return sendPublicResponse(req, res, rows);
    } catch (error) {
      next(error);
    }
  };

  const createBlock = async (req, res, next) => {
    try {
      const nome = String(req.body?.nome || "").trim();
      const descricao = String(req.body?.descricao || "").trim() || null;
      if (!nome) throw httpError(400, "Informe o nome do bloco.");
      const result = await facilitiesModel.createBlock({ institutionId: req.institution.id, nome, descricao });
      res.status(201).json({ id: result.insertId });
    } catch (error) {
      next(error);
    }
  };

  const updateBlock = async (req, res, next) => {
    try {
      const nome = String(req.body?.nome || "").trim();
      const descricao = String(req.body?.descricao || "").trim() || null;
      if (!nome) throw httpError(400, "Informe o nome do bloco.");
      const result = await facilitiesModel.updateBlock({
        institutionId: req.institution.id,
        blockId: req.params.id,
        nome,
        descricao,
      });
      if (!result.affectedRows) throw httpError(404, "Bloco não encontrado.");
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  };

  const deleteBlock = async (req, res, next) => {
    try {
      const result = await facilitiesModel.deleteBlock({ institutionId: req.institution.id, blockId: req.params.id });
      if (!result.affectedRows) throw httpError(404, "Bloco não encontrado.");
      res.json({ ok: true });
    } catch (error) {
      if (isForeignKeyError(error)) {
        next(httpError(409, "O bloco possui salas e não pode ser excluído."));
      } else next(error);
    }
  };

  const listRooms = async (req, res, next) => {
    try {
      const paginated = req.query.page || req.query.page_size;
      const page = positiveInt(req.query.page, 1, { max: 100000 });
      const pageSize = positiveInt(req.query.page_size, 100, { min: 10, max: 500 });
      const { rows, total } = await facilitiesModel.listRooms({
        institutionId: req.institution.id,
        query: req.query,
        authenticated: Boolean(req.user),
        paginated,
        page,
        pageSize,
      });
      const items = rows.map(serializeRoom);
      if (!paginated) return sendPublicResponse(req, res, items);
      return sendPublicResponse(req, res, {
        items,
        paginacao: { pagina: page, por_pagina: pageSize, total },
      });
    } catch (error) {
      next(error);
    }
  };

  const listRoomOccupations = async (req, res, next) => {
    try {
      const rows = await facilitiesModel.listRoomOccupations({
        institutionId: req.institution.id,
        authenticated: Boolean(req.user),
      });
      return sendPublicResponse(req, res, { horarios: rows });
    } catch (error) {
      next(error);
    }
  };

  const getRoom = async (req, res, next) => {
    try {
      const room = await facilitiesModel.findRoom({
        institutionId: req.institution.id,
        roomId: req.params.id,
        authenticated: Boolean(req.user),
      });
      if (!room) throw httpError(404, "Sala não encontrada.");
      res.json(serializeRoom(room));
    } catch (error) {
      next(error);
    }
  };

  const getRoomOccupation = async (req, res, next) => {
    const roomId = Number(req.params.id);
    if (!Number.isInteger(roomId) || roomId < 1) return next(httpError(400, "Sala inválida."));

    try {
      const rows = await facilitiesModel.listRoomOccupation({
        institutionId: req.institution.id,
        roomId,
        authenticated: Boolean(req.user),
      });
      return sendPublicResponse(req, res, { horarios: rows });
    } catch (error) {
      next(error);
    }
  };

  const listRoomChanges = async (req, res, next) => {
    try {
      const limit = positiveInt(req.query.limit, 50, { min: 1, max: 200 });
      res.json(await facilitiesModel.listRoomChanges({ institutionId: req.institution.id, limit }));
    } catch (error) {
      next(error);
    }
  };

  const createRoom = async (req, res, next) => {
    const room = normalizeRoomPayload(req.body, asBoolean);
    try {
      validateRoom(room);
    } catch (error) {
      return next(error);
    }

    try {
      const result = await facilitiesModel.createRoom({ institutionId: req.institution.id, room });
      if (!result) throw httpError(400, "Bloco não encontrado.");
      res.status(201).json({ id: result.insertId });
    } catch (error) {
      next(error);
    }
  };

  const updateRoom = async (req, res, next) => {
    const room = normalizeRoomPayload(req.body, asBoolean);
    try {
      validateRoom(room);
    } catch (error) {
      return next(error);
    }

    try {
      const outcome = await facilitiesModel.updateRoom({
        institutionId: req.institution.id,
        roomId: req.params.id,
        room,
      });
      if (outcome.blockFound === false) throw httpError(400, "Bloco não encontrado.");
      if (!outcome.result.affectedRows) throw httpError(404, "Sala não encontrada.");
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  };

  const deleteRoom = async (req, res, next) => {
    try {
      const institutionId = req.institution.id;
      if (asBoolean(req.query.definitivo)) {
        const activeSchedules = await facilitiesModel.countActiveSchedules({ institutionId, roomId: req.params.id });
        if (activeSchedules > 0) {
          throw httpError(409, "Remova a sala dos horários publicados antes de excluir definitivamente.");
        }
        const result = await facilitiesModel.deleteRoom({ institutionId, roomId: req.params.id });
        if (!result.affectedRows) throw httpError(404, "Sala não encontrada.");
        return res.json({ ok: true, deleted: true });
      }
      const result = await facilitiesModel.deactivateRoom({ institutionId, roomId: req.params.id });
      if (!result.affectedRows) throw httpError(404, "Sala não encontrada.");
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  };

  const listMaps = async (req, res, next) => {
    try {
      const maps = await facilitiesModel.listMaps({
        institutionId: req.institution.id,
        authenticated: req.user?.papel === "CPD",
      });
      return sendPublicResponse(req, res, maps);
    } catch (error) {
      return next(error);
    }
  };

  const saveMap = async (req, res, next) => {
    try {
      if (!Array.isArray(req.body?.areas) || req.body.areas.some((area) => !area || typeof area !== "object" || Array.isArray(area))) {
        throw httpError(400, "Informe as áreas do mapa.");
      }
      const map = normalizeMapPayload(req.body, asBoolean);
      if (req.params.id && (!Number.isInteger(Number(req.params.id)) || Number(req.params.id) < 1)) {
        throw httpError(400, "Mapa inválido.");
      }
      if (!map.nome || map.nome.length > 120 || (map.piso?.length || 0) > 80 ||
          (map.descricao?.length || 0) > 2000 ||
          (map.bloco_id !== null && (!Number.isInteger(map.bloco_id) || map.bloco_id < 1)) ||
          !Number.isInteger(map.largura) || !Number.isInteger(map.altura) ||
          map.largura < 1 || map.altura < 1 || map.largura > 10000 || map.altura > 10000) {
        throw httpError(400, "Informe nome e dimensões válidas para o mapa.");
      }
      if (map.areas.length > 500) throw httpError(400, "O mapa excede o limite de 500 áreas.");
      const areaIds = map.areas.map((area) => area.id).filter((id) => id !== null);
      if ((!req.params.id && areaIds.length) || areaIds.some((id) => !Number.isInteger(id) || id < 1) ||
          new Set(areaIds).size !== areaIds.length) {
        throw httpError(400, "Há um identificador de área inválido no mapa.");
      }
      for (const area of map.areas) {
        const references = [area.bloco_id, area.sala_id, area.setor_id].filter((id) => id !== null);
        const expectedReference = area.tipo === "BLOCO" ? area.bloco_id !== null && references.length === 1
          : area.tipo === "SALA" ? area.sala_id !== null && area.bloco_id === null
            : area.tipo === "SETOR" ? area.setor_id !== null && references.length === 1
              : area.tipo === "OUTRO" ? references.length === 0 : false;
        const invalidCoordinates = (area.rotulo_x === null) !== (area.rotulo_y === null) ||
          (area.rotulo_x !== null && (!Number.isFinite(area.rotulo_x) || !Number.isFinite(area.rotulo_y) ||
            area.rotulo_x < 0 || area.rotulo_y < 0 || area.rotulo_x > map.largura || area.rotulo_y > map.altura));
        if (!area.nome || area.nome.length > 120 || !expectedReference ||
            [...references, area.destino_mapa_id].some((id) => id !== null && (!Number.isInteger(id) || id < 1)) ||
            !["AMBIENTE", "CIRCULACAO", "ESCADA", "ACESSO", "PATIO"].includes(area.categoria) ||
            (area.descricao?.length || 0) > 2000 || invalidCoordinates || area.caminho_svg.length > 8000 ||
            !svgPathPattern.test(area.caminho_svg)) {
          throw httpError(400, "Há uma área inválida no mapa.");
        }
      }
      const result = await facilitiesModel.saveMap({
        institutionId: req.institution.id,
        mapId: req.params.id,
        map,
      });
      if (result.invalidReference) throw httpError(400, "Bloco, sala, setor ou mapa de destino não encontrado nesta instituição.");
      if (result.invalidArea) throw httpError(400, "Área não encontrada neste mapa e instituição.");
      if (result.notFound) throw httpError(404, "Mapa não encontrado.");
      return res.status(req.params.id ? 200 : 201).json({ id: result.id });
    } catch (error) {
      return next(error);
    }
  };

  const updateMapAreaAdjustment = async (req, res, next) => {
    try {
      const mapId = Number(req.params.mapId);
      const areaId = Number(req.params.areaId);
      const { ajuste_x, ajuste_y, escala_x, escala_y, anterior } = req.body || {};
      const adjustment = { ajuste_x, ajuste_y, escala_x, escala_y };
      if (!Number.isSafeInteger(mapId) || mapId < 1 || !Number.isSafeInteger(areaId) || areaId < 1 ||
          !validMapAdjustment(adjustment) || !validMapAdjustment(anterior) ||
          typeof anterior.caminho_svg !== "string" || !anterior.caminho_svg.trim() ||
          anterior.caminho_svg.length > 8000 || !svgPathPattern.test(anterior.caminho_svg)) {
        throw httpError(400, "Informe um ajuste válido para a área do mapa.");
      }
      const result = await facilitiesModel.updateMapAreaAdjustment({
        institutionId: req.institution.id, mapId, areaId, adjustment, previous: anterior,
      });
      if (result.notFound) throw httpError(404, "Área não encontrada neste mapa e instituição.");
      if (result.conflict) throw httpError(409, "A área mudou. Recarregue o mapa antes de salvar.");
      return res.json(result.adjustment);
    } catch (error) {
      return next(error);
    }
  };

  return {
    createBlock,
    createRoom,
    deleteBlock,
    deleteRoom,
    getRoom,
    getRoomOccupation,
    listBlocks,
    listRoomChanges,
    listRoomOccupations,
    listRooms,
    listMaps,
    saveMap,
    updateMapAreaAdjustment,
    updateBlock,
    updateRoom,
  };
};
