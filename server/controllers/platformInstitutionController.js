import { defaultInstitutionColors, hslColorPattern } from "../models/institutionModel.js";

export const createPlatformInstitutionController = ({
  asBoolean,
  createPassword,
  ensureDefaultPublicContent,
  httpError,
  model,
  normalizeUsername,
  sanitizeFreeText,
}) => {
  const normalizeInstitutionSlug = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

  const normalizeInstitutionPayload = (body = {}) => ({
    slug: normalizeInstitutionSlug(body.slug),
    nome: sanitizeFreeText(body.nome, 120),
    nome_admin: sanitizeFreeText(body.nome_admin, 120),
    nome_sistema: sanitizeFreeText(body.nome_sistema, 160),
    subtitulo_admin: sanitizeFreeText(body.subtitulo_admin, 160),
    logo_url: sanitizeFreeText(body.logo_url, 500) || null,
    cor_primaria_hsl: sanitizeFreeText(body.cor_primaria_hsl, 40) || defaultInstitutionColors.cor_primaria_hsl,
    cor_acento_hsl: sanitizeFreeText(body.cor_acento_hsl, 40) || defaultInstitutionColors.cor_acento_hsl,
    cor_header_hsl: sanitizeFreeText(body.cor_header_hsl, 40) || defaultInstitutionColors.cor_header_hsl,
    cor_nav_hsl: sanitizeFreeText(body.cor_nav_hsl, 40) || defaultInstitutionColors.cor_nav_hsl,
    cor_nav_ativa_hsl: sanitizeFreeText(body.cor_nav_ativa_hsl, 40) || defaultInstitutionColors.cor_nav_ativa_hsl,
    ativo: body.ativo == null ? true : asBoolean(body.ativo),
  });

  const validateInstitutionPayload = (institution) => {
    if (!institution.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(institution.slug)) {
      throw httpError(400, "Informe um slug válido para o subdomínio.");
    }
    if (!institution.nome || !institution.nome_admin || !institution.nome_sistema || !institution.subtitulo_admin) {
      throw httpError(400, "Preencha nome, nome administrativo, nome do sistema e subtítulo.");
    }
    if (institution.logo_url && !/^https?:\/\//i.test(institution.logo_url)) {
      throw httpError(400, "Informe uma URL de logo iniciando com http:// ou https://.");
    }
    for (const field of Object.keys(defaultInstitutionColors)) {
      if (!hslColorPattern.test(institution[field])) throw httpError(400, "Informe cores HSL válidas.");
    }
  };

  const parseInstitutionId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) throw httpError(400, "Instituição inválida.");
    return id;
  };

  const parseUserId = (value) => {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) throw httpError(400, "Usuário inválido.");
    return id;
  };

  const ensureInstitutionExists = async (institutionId) => {
    if (!(await model.institutionExists(institutionId))) throw httpError(404, "Instituição não encontrada.");
  };

  const normalizeInstitutionUserPayload = (body = {}) => ({
    nome: sanitizeFreeText(body.nome, 120),
    usuario: normalizeUsername(body.usuario).slice(0, 60),
    senha: String(body.senha || ""),
    papel: String(body.papel || "ADMIN").trim().toUpperCase(),
    gerencia_instituicoes: false,
    ativo: body.ativo == null ? true : asBoolean(body.ativo),
  });

  const normalizeInitialInstitutionAdmin = (body = {}) =>
    normalizeInstitutionUserPayload({
      nome: body.admin_nome,
      usuario: body.admin_usuario,
      senha: body.admin_senha,
      papel: "CPD",
      gerencia_instituicoes: false,
      ativo: true,
    });

  const validateInstitutionUserPayload = (user, { creating = false } = {}) => {
    if (!user.nome) throw httpError(400, "Informe o nome do usuário.");
    if (!/^[a-z0-9._-]{3,60}$/.test(user.usuario)) {
      throw httpError(400, "Informe um usuário com 3 a 60 letras, números, pontos, hífens ou sublinhados.");
    }
    if (!["ADMIN", "CPD"].includes(user.papel)) throw httpError(400, "Papel inválido.");
    if ((creating || user.senha) && user.senha.length < 6) {
      throw httpError(400, "Informe uma senha com pelo menos 6 caracteres.");
    }
  };

  const serializeAdminInstitution = (row) => ({
    ...row,
    ativo: Boolean(row.ativo),
    total_usuarios: Number(row.total_usuarios || 0),
    total_salas: Number(row.total_salas || 0),
    total_importacoes: Number(row.total_importacoes || 0),
  });

  const serializeInstitutionUser = (row) => ({
    id: row.id,
    instituicao_id: row.instituicao_id,
    nome: row.nome,
    usuario: row.usuario,
    papel: row.papel,
    ativo: Boolean(row.ativo),
    created_at: row.created_at,
    updated_at: row.updated_at,
  });

  return {
    listInstitutions: async (_req, res, next) => {
      try {
        const rows = await model.listInstitutions();
        return res.json(rows.map(serializeAdminInstitution));
      } catch (error) {
        return next(error);
      }
    },

    createInstitution: async (req, res, next) => {
      const institution = normalizeInstitutionPayload(req.body);
      const adminUser = normalizeInitialInstitutionAdmin(req.body);
      try {
        validateInstitutionPayload(institution);
        validateInstitutionUserPayload(adminUser, { creating: true });
        const result = await model.withTransaction(async (conn) => {
          const institutionResult = await model.createInstitution({ institution, targetDb: conn });
          await ensureDefaultPublicContent(institutionResult.insertId, conn);
          const password = await createPassword(adminUser.senha);
          const adminResult = await model.createUser({
            institutionId: institutionResult.insertId,
            user: adminUser,
            password,
            targetDb: conn,
          });
          return { id: institutionResult.insertId, usuarioInicialId: adminResult.insertId };
        });
        return res.status(201).json({ id: result.id, usuario_inicial_id: result.usuarioInicialId });
      } catch (error) {
        return next(error);
      }
    },

    updateInstitution: async (req, res, next) => {
      const institution = normalizeInstitutionPayload(req.body);
      try {
        validateInstitutionPayload(institution);
        const result = await model.updateInstitution({ id: req.params.id, institution });
        if (!result.affectedRows) throw httpError(404, "Instituição não encontrada.");
        return res.json({ ok: true });
      } catch (error) {
        return next(error);
      }
    },

    listUsers: async (req, res, next) => {
      try {
        const institutionId = parseInstitutionId(req.params.institutionId);
        await ensureInstitutionExists(institutionId);
        const rows = await model.listUsers(institutionId);
        return res.json(rows.map(serializeInstitutionUser));
      } catch (error) {
        return next(error);
      }
    },

    createUser: async (req, res, next) => {
      const user = normalizeInstitutionUserPayload(req.body);
      try {
        const institutionId = parseInstitutionId(req.params.institutionId);
        validateInstitutionUserPayload(user, { creating: true });
        await ensureInstitutionExists(institutionId);
        const password = await createPassword(user.senha);
        const result = await model.createUser({ institutionId, user, password });
        return res.status(201).json({ id: result.insertId });
      } catch (error) {
        return next(error);
      }
    },

    updateUser: async (req, res, next) => {
      const user = normalizeInstitutionUserPayload(req.body);
      try {
        const institutionId = parseInstitutionId(req.params.institutionId);
        const userId = parseUserId(req.params.userId);
        validateInstitutionUserPayload(user);
        await ensureInstitutionExists(institutionId);
        const password = user.senha ? await createPassword(user.senha) : null;
        const result = await model.withTransaction(async (conn) => {
          const update = await model.updateUser({ institutionId, userId, user, password, targetDb: conn });
          if (update.affectedRows && (!user.ativo || password)) await model.deleteUserSessions(userId, conn);
          return update;
        });
        if (!result.affectedRows) throw httpError(404, "Usuário não encontrado.");
        return res.json({ ok: true });
      } catch (error) {
        return next(error);
      }
    },
  };
};
