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

const normalizeMapPayload = (body = {}, asBoolean) => ({
  nome: String(body.nome || "").trim(),
  piso: String(body.piso || "").trim() || null,
  largura: Number(body.largura || 1000),
  altura: Number(body.altura || 700),
  ativo: body.ativo === undefined ? true : asBoolean(body.ativo),
  areas: Array.isArray(body.areas)
    ? body.areas.map((area) => ({
        id: area.id === null || area.id === undefined || area.id === "" ? null : Number(area.id),
        tipo: String(area.tipo || "").toUpperCase(),
        nome: String(area.nome || "").trim(),
        caminho_svg: String(area.caminho_svg || "").trim(),
        bloco_id: area.bloco_id ? Number(area.bloco_id) : null,
        sala_id: area.sala_id ? Number(area.sala_id) : null,
        setor_id: area.setor_id ? Number(area.setor_id) : null,
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
    const map = normalizeMapPayload(req.body, asBoolean);
    try {
      if (req.params.id && (!Number.isInteger(Number(req.params.id)) || Number(req.params.id) < 1)) {
        throw httpError(400, "Mapa inválido.");
      }
      if (!map.nome || !Number.isInteger(map.largura) || !Number.isInteger(map.altura) ||
          map.largura < 1 || map.altura < 1 || map.largura > 10000 || map.altura > 10000) {
        throw httpError(400, "Informe nome e dimensões válidas para o mapa.");
      }
      if (!Array.isArray(req.body?.areas)) throw httpError(400, "Informe as áreas do mapa.");
      if (map.areas.length > 500) throw httpError(400, "O mapa excede o limite de 500 áreas.");
      const areaIds = map.areas.map((area) => area.id).filter((id) => id !== null);
      if ((!req.params.id && areaIds.length) || areaIds.some((id) => !Number.isInteger(id) || id < 1) ||
          new Set(areaIds).size !== areaIds.length) {
        throw httpError(400, "Há um identificador de área inválido no mapa.");
      }
      for (const area of map.areas) {
        const references = [area.bloco_id, area.sala_id, area.setor_id].filter(Boolean);
        const expectedReference = area.tipo === "BLOCO" ? area.bloco_id
          : area.tipo === "SALA" ? area.sala_id
            : area.tipo === "SETOR" ? area.setor_id
              : area.tipo === "OUTRO" ? references.length === 0 : false;
        if (!area.nome || !expectedReference || references.length > 1 || area.caminho_svg.length > 8000 ||
            !/^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\-\s]+$/.test(area.caminho_svg)) {
          throw httpError(400, "Há uma área inválida no mapa.");
        }
      }
      const result = await facilitiesModel.saveMap({
        institutionId: req.institution.id,
        mapId: req.params.id,
        map,
      });
      if (result.invalidReference) throw httpError(400, "Bloco, sala ou setor não encontrado nesta instituição.");
      if (result.invalidArea) throw httpError(400, "Área não encontrada neste mapa e instituição.");
      if (result.notFound) throw httpError(404, "Mapa não encontrado.");
      return res.status(req.params.id ? 200 : 201).json({ id: result.id });
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
    updateBlock,
    updateRoom,
  };
};
