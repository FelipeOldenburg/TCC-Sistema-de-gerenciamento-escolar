const allowedSectorIcons = new Set(["building", "graduation", "book", "flask", "wrench", "coffee", "shield", "monitor", "users"]);
const allowedSectorColors = new Set(["blue", "violet", "amber", "emerald", "slate", "orange", "indigo", "cyan", "rose"]);
const allowedOuvidoriaProfiles = new Set(["ALUNO", "DOCENTE", "RESPONSAVEL", "COMUNIDADE"]);
const allowedOuvidoriaCategories = new Set([
  "IDEIA", "MELHORIA", "PROBLEMA", "AVISO", "HORARIO_INCORRETO", "SALA_LOCAL_INCORRETO",
  "SALA_INDISPONIVEL", "MUDANCA_NAO_ATUALIZADA", "CONFLITO_HORARIO", "LOCALIZACAO_INCORRETA",
  "INFORMACAO_INCORRETA",
]);
const allowedOuvidoriaStatuses = new Set(["NOVA", "EM_ANALISE", "RESOLVIDA", "ARQUIVADA"]);
const allowedReportOrigins = new Set(["FORMULARIO", "HORARIO", "SALA", "SETOR", "MAPA"]);

export const createContentController = ({
  contentModel,
  asBoolean,
  cacheableJson,
  hasInappropriateContent,
  httpError,
  positiveInt,
  sanitizeFreeText,
}) => {
  const serializeEvent = (row) => ({
    ...row,
    ativo: Boolean(row.ativo),
    data_evento: row.data_evento instanceof Date ? row.data_evento.toISOString().slice(0, 10) : row.data_evento,
    hora_evento: row.hora_evento ? String(row.hora_evento).slice(0, 5) : null,
  });

  const normalizeEventPayload = (body = {}) => ({
    titulo: sanitizeFreeText(body.titulo, 140),
    descricao: sanitizeFreeText(body.descricao, 1000) || null,
    data_evento: String(body.data_evento || "").trim(),
    hora_evento: String(body.hora_evento || "").trim() || null,
    local: sanitizeFreeText(body.local, 140) || null,
    imagem_url: sanitizeFreeText(body.imagem_url, 500) || null,
    ativo: body.ativo == null ? true : asBoolean(body.ativo),
  });

  const validateEvent = (event) => {
    if (!event.titulo || !event.data_evento) throw httpError(400, "Informe título e data do evento.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.data_evento)) throw httpError(400, "Data do evento inválida.");
    if (event.hora_evento && !/^\d{2}:\d{2}$/.test(event.hora_evento)) throw httpError(400, "Horário do evento inválido.");
    if (event.imagem_url && !/^https?:\/\//i.test(event.imagem_url)) {
      throw httpError(400, "Informe uma URL de imagem iniciando com http:// ou https://.");
    }
  };

  const serializeSector = (row) => ({ ...row, ativo: Boolean(row.ativo) });

  const normalizeSectorPayload = (body = {}) => ({
    nome: sanitizeFreeText(body.nome, 120),
    descricao: sanitizeFreeText(body.descricao, 255),
    responsavel: sanitizeFreeText(body.responsavel, 120) || null,
    localizacao: sanitizeFreeText(body.localizacao, 160) || null,
    contato: sanitizeFreeText(body.contato, 160) || null,
    horario_atendimento: sanitizeFreeText(body.horario_atendimento, 160) || null,
    icone: allowedSectorIcons.has(String(body.icone || "")) ? String(body.icone) : "building",
    cor: allowedSectorColors.has(String(body.cor || "")) ? String(body.cor) : "blue",
    ativo: body.ativo == null ? true : asBoolean(body.ativo),
  });

  const validateSector = (sector) => {
    if (!sector.nome || !sector.descricao) throw httpError(400, "Informe nome e descrição do setor.");
  };

  const normalizeOuvidoriaPayload = (body = {}) => ({
    nome: sanitizeFreeText(body.nome, 120) || null,
    perfil: String(body.perfil || "").toUpperCase() || null,
    categoria: String(body.categoria || "").toUpperCase(),
    setor_id: body.setor_id ? Number(body.setor_id) : null,
    sala_id: body.sala_id ? Number(body.sala_id) : null,
    horario_id: body.horario_id ? Number(body.horario_id) : null,
    mapa_area_id: body.mapa_area_id ? Number(body.mapa_area_id) : null,
    origem: String(body.origem || "FORMULARIO").toUpperCase(),
    assunto: sanitizeFreeText(body.assunto, 120) || null,
    mensagem: sanitizeFreeText(body.mensagem, 700) || null,
  });

  const validateOuvidoria = async (manifestation, institutionId) => {
    if (manifestation.perfil && !allowedOuvidoriaProfiles.has(manifestation.perfil)) {
      throw httpError(400, "Perfil inválido.");
    }
    if (!allowedOuvidoriaCategories.has(manifestation.categoria)) {
      throw httpError(400, "Selecione uma categoria válida.");
    }
    if (!allowedReportOrigins.has(manifestation.origem)) throw httpError(400, "Origem do relato inválida.");
    const requiredContext = { HORARIO: "horario_id", SALA: "sala_id", SETOR: "setor_id", MAPA: "mapa_area_id" };
    if (requiredContext[manifestation.origem] && manifestation[requiredContext[manifestation.origem]] === null) {
      throw httpError(400, "O contexto do relato está incompleto.");
    }
    if (/https?:\/\/|www\./i.test(`${manifestation.assunto} ${manifestation.mensagem}`)) {
      throw httpError(400, "Não envie links no relato.");
    }
    if (/(.)\1{7,}/i.test(`${manifestation.assunto} ${manifestation.mensagem}`)) {
      throw httpError(400, "Revise o texto antes de enviar.");
    }
    if (hasInappropriateContent(manifestation.nome, manifestation.assunto, manifestation.mensagem)) {
      throw httpError(400, "Revise o texto: o relato não aceita termos ofensivos ou impróprios.");
    }
    for (const field of ["setor_id", "sala_id", "horario_id", "mapa_area_id"]) {
      if (manifestation[field] !== null && (!Number.isInteger(manifestation[field]) || manifestation[field] < 1)) {
        throw httpError(400, "Contexto do relato inválido.");
      }
    }
    const context = await contentModel.resolveManifestationContext({ institutionId, manifestation });
    if (!context) throw httpError(400, "Contexto não encontrado nesta instituição.");
    manifestation.contexto = context;
  };

  return {
    listEvents: async (req, res, next) => {
      try {
        const includeInactive = req.user?.papel === "CPD" && asBoolean(req.query.incluir_inativos);
        const rows = await contentModel.listEvents({ institutionId: req.institution.id, includeInactive });
        const payload = rows.map(serializeEvent);
        if (req.user) return res.json(payload);
        return cacheableJson(req, res, payload, { maxAge: 60, staleWhileRevalidate: 300 });
      } catch (error) {
        return next(error);
      }
    },

    createEvent: async (req, res, next) => {
      const event = normalizeEventPayload(req.body);
      try {
        validateEvent(event);
        const result = await contentModel.createEvent({ institutionId: req.institution.id, event });
        return res.status(201).json({ id: result.insertId });
      } catch (error) {
        return next(error);
      }
    },

    updateEvent: async (req, res, next) => {
      const event = normalizeEventPayload(req.body);
      try {
        validateEvent(event);
        const result = await contentModel.updateEvent({ id: req.params.id, institutionId: req.institution.id, event });
        if (!result.affectedRows) throw httpError(404, "Evento não encontrado.");
        return res.json({ ok: true });
      } catch (error) {
        return next(error);
      }
    },

    deleteEvent: async (req, res, next) => {
      try {
        const result = await contentModel.deleteEvent({ id: req.params.id, institutionId: req.institution.id });
        if (!result.affectedRows) throw httpError(404, "Evento não encontrado.");
        return res.json({ ok: true });
      } catch (error) {
        return next(error);
      }
    },

    listSectors: async (req, res, next) => {
      try {
        const includeInactive = req.user?.papel === "CPD" && asBoolean(req.query.incluir_inativos);
        const rows = await contentModel.listSectors({ institutionId: req.institution.id, includeInactive });
        const payload = rows.map(serializeSector);
        if (req.user) return res.json(payload);
        return cacheableJson(req, res, payload, { maxAge: 60, staleWhileRevalidate: 300 });
      } catch (error) {
        return next(error);
      }
    },

    createSector: async (req, res, next) => {
      const sector = normalizeSectorPayload(req.body);
      try {
        validateSector(sector);
        const result = await contentModel.createSector({ institutionId: req.institution.id, sector });
        return res.status(201).json({ id: result.insertId });
      } catch (error) {
        return next(error);
      }
    },

    updateSector: async (req, res, next) => {
      const sector = normalizeSectorPayload(req.body);
      try {
        validateSector(sector);
        const result = await contentModel.updateSector({ id: req.params.id, institutionId: req.institution.id, sector });
        if (!result.affectedRows) throw httpError(404, "Setor não encontrado.");
        return res.json({ ok: true });
      } catch (error) {
        return next(error);
      }
    },

    deleteSector: async (req, res, next) => {
      try {
        const result = await contentModel.deleteSector({ id: req.params.id, institutionId: req.institution.id });
        if (!result.affectedRows) throw httpError(404, "Setor não encontrado.");
        return res.json({ ok: true });
      } catch (error) {
        return next(error);
      }
    },

    createManifestation: async (req, res, next) => {
      const manifestation = normalizeOuvidoriaPayload(req.body);
      try {
        const institutionId = req.institution.id;
        await validateOuvidoria(manifestation, institutionId);
        const result = await contentModel.createManifestation({ institutionId, manifestation });
        return res.status(201).json({ id: result.insertId, status: "NOVA" });
      } catch (error) {
        return next(error);
      }
    },

    listManifestations: async (req, res, next) => {
      try {
        const requestedStatus = String(req.query.status || "").toUpperCase();
        const status = allowedOuvidoriaStatuses.has(requestedStatus) ? requestedStatus : null;
        const requestedCategory = String(req.query.categoria || "").toUpperCase();
        const category = allowedOuvidoriaCategories.has(requestedCategory) ? requestedCategory : null;
        const page = positiveInt(req.query.page, 1, { max: 100000 });
        const pageSize = positiveInt(req.query.page_size, 100, { min: 10, max: 200 });
        const { rows, total } = await contentModel.listManifestations({
          institutionId: req.institution.id,
          status,
          category,
          page,
          pageSize,
        });
        return res.json({ items: rows, paginacao: { pagina: page, por_pagina: pageSize, total } });
      } catch (error) {
        return next(error);
      }
    },

    updateManifestationStatus: async (req, res, next) => {
      try {
        const status = String(req.body?.status || "").toUpperCase();
        if (!allowedOuvidoriaStatuses.has(status)) throw httpError(400, "Status inválido.");
        const result = await contentModel.updateManifestationStatus({
          id: req.params.id,
          institutionId: req.institution.id,
          status,
        });
        if (!result.affectedRows) throw httpError(404, "Manifestação não encontrada.");
        return res.json({ ok: true });
      } catch (error) {
        return next(error);
      }
    },
  };
};
