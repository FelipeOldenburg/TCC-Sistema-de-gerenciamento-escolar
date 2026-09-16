import crypto from "crypto";
import { parseUraniaFiles } from "../uraniaParser.js";

const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const hashToken = (value) => crypto.createHash("sha256").update(value).digest("hex");
const publicBaseUrl = (req) => String(process.env.PUBLIC_ORIGIN || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");

const sendEmail = async ({ to, subject, text }) => {
  if (!process.env.SMTP_HOST) return { sent: false, reason: "SMTP_HOST ausente" };
  if (!process.env.SMTP_FROM && !process.env.SMTP_USER) return { sent: false, reason: "SMTP_FROM ausente" };
  const nodemailer = (await import("nodemailer")).default;
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE
      ? [true, 1, "1", "true", "on"].includes(process.env.SMTP_SECURE)
      : port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
      : undefined,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
  return { sent: true };
};

export const createScheduleController = ({
  db,
  httpError,
  positiveInt,
  roomAssignmentService,
  sanitizeFreeText,
  scheduleModel,
}) => {
  const notifyScheduleSubscribers = async ({ subscribers, comparison }) => {
    const result = { tentadas: subscribers.length, enviadas: 0, sem_smtp: 0, falhas: 0 };
    const changedClasses = new Set(comparison.turmas_afetadas);
    for (const subscriber of subscribers) {
      if (!changedClasses.has(subscriber.turma)) continue;
      try {
        const sent = await sendEmail({
          to: subscriber.email,
          subject: `Horário atualizado - turma ${subscriber.turma}`,
          text: [
            `A grade da turma ${subscriber.turma} foi atualizada.`,
            "",
            `Aulas com mudança: ${comparison.aulas_mudaram}`,
            `Turmas afetadas: ${comparison.turmas_afetadas.join(", ")}`,
            "",
            "Acesse o site do CIMOL para conferir os horários publicados.",
          ].join("\n"),
        });
        if (sent.sent) result.enviadas += 1;
        else result.sem_smtp += 1;
      } catch (error) {
        result.falhas += 1;
        console.error({ error, email: subscriber.email, turma: subscriber.turma }, "Falha ao enviar notificação de horário");
      }
    }
    return result;
  };

  const uploadUrania = async (req, res, next) => {
    if (!req.files?.length) return res.status(400).json({ message: "Selecione ao menos um arquivo do URÂNIA." });
    try {
      const parsed = await parseUraniaFiles(req.files);
      const payload = await scheduleModel.createImport({
        files: req.files,
        institutionId: req.institution.id,
        observations: String(req.body?.observacoes || "").trim() || null,
        parsed,
        userId: req.user.id,
      });
      return res.status(201).json(payload);
    } catch (error) {
      return next(error);
    }
  };

  const listImports = async (req, res, next) => {
    try {
      const statuses = ["PENDENTE", "APROVADA", "REJEITADA"];
      const requestedStatus = String(req.query.status || "").toUpperCase();
      const paginated = req.query.page || req.query.page_size;
      const page = positiveInt(req.query.page, 1, { max: 100000 });
      const pageSize = positiveInt(req.query.page_size, 50, { min: 10, max: 200 });
      const { rows, total } = await scheduleModel.listImports({
        institutionId: req.institution.id,
        status: statuses.includes(requestedStatus) ? requestedStatus : null,
        paginated,
        page,
        pageSize,
      });
      const items = rows.map((row) => ({ ...row, ativa: Boolean(row.ativa), avisos: parseJson(row.avisos_json, []) }));
      if (!paginated) return res.json(items);
      return res.json({ items, paginacao: { pagina: page, por_pagina: pageSize, total } });
    } catch (error) {
      return next(error);
    }
  };

  const getImport = async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(500, Math.max(20, Number(req.query.page_size) || 200));
      const detail = await scheduleModel.getImportDetail({
        importId: req.params.id,
        institutionId: req.institution.id,
        page,
        pageSize,
        turma: String(req.query.turma || "").trim(),
      });
      if (!detail) throw httpError(404, "Importação não encontrada.");
      return res.json({
        ...detail.item,
        ativa: Boolean(detail.item.ativa),
        avisos: parseJson(detail.item.avisos_json, []),
        arquivos: detail.files,
        turmas: detail.classes,
        horarios: detail.schedules,
        comparacao: detail.comparison,
        paginacao: { pagina: page, por_pagina: pageSize, total: detail.total },
      });
    } catch (error) {
      return next(error);
    }
  };

  const assignPendingRoom = async (req, res, next) => {
    const scheduleId = Number(req.params.id);
    const rawRoomId = req.body?.sala_id;
    const roomId = rawRoomId === null || rawRoomId === undefined || rawRoomId === "" ? null : Number(rawRoomId);
    if (!Number.isInteger(scheduleId) || scheduleId < 1) return next(httpError(400, "Horário inválido."));
    if (roomId !== null && (!Number.isInteger(roomId) || roomId < 1)) return next(httpError(400, "Sala inválida."));

    try {
      return res.json(
        await scheduleModel.assignPendingRoom({ institutionId: req.institution.id, roomId, scheduleId })
      );
    } catch (error) {
      return next(error);
    }
  };

  const approveImport = async (req, res, next) => {
    try {
      const { comparison, notificationSubscribers } = await scheduleModel.approveImport({
        importId: req.params.id,
        institutionId: req.institution.id,
        userId: req.user.id,
      });
      const notificacoes = comparison?.aulas_mudaram
        ? await notifyScheduleSubscribers({ subscribers: notificationSubscribers, comparison })
        : { tentadas: 0, enviadas: 0, sem_smtp: 0, falhas: 0 };
      return res.json({ ok: true, status: "APROVADA", ativa: true, notificacoes });
    } catch (error) {
      return next(error);
    }
  };

  const rejectImport = async (req, res, next) => {
    const reason = String(req.body?.motivo || "").trim();
    if (!reason) return res.status(400).json({ message: "Informe o motivo da rejeição." });
    try {
      const result = await scheduleModel.rejectImport({
        importId: req.params.id,
        institutionId: req.institution.id,
        reason,
        userId: req.user.id,
      });
      if (!result.affectedRows) throw httpError(409, "A importação não existe ou já foi revisada.");
      return res.json({ ok: true, status: "REJEITADA" });
    } catch (error) {
      return next(error);
    }
  };

  const subscribeToNotifications = async (req, res, next) => {
    const email = normalizeEmail(req.body?.email);
    const turma = sanitizeFreeText(req.body?.turma, 120);
    if (!isValidEmail(email)) return next(httpError(400, "Informe um e-mail válido."));
    if (!turma) return next(httpError(400, "Selecione uma turma."));

    try {
      const token = crypto.randomBytes(32).toString("base64url");
      await scheduleModel.createNotificationSubscription({
        email,
        institutionId: req.institution.id,
        tokenHash: hashToken(token),
        turma,
      });
      const confirmationUrl = `${publicBaseUrl(req)}/api/horarios/notificacoes/confirmar?token=${encodeURIComponent(token)}`;
      const sent = await sendEmail({
        to: email,
        subject: `Confirmar aviso de horário - turma ${turma}`,
        text: [
          `Confirme que você quer receber avisos quando a grade da turma ${turma} mudar.`,
          "",
          confirmationUrl,
          "",
          "Se você não pediu isso, ignore este e-mail.",
        ].join("\n"),
      });
      return res.status(201).json({ ok: true, pendente_confirmacao: true, email_enviado: sent.sent });
    } catch (error) {
      return next(error);
    }
  };

  const confirmNotification = async (req, res, next) => {
    const token = String(req.query.token || "");
    if (!token) return next(httpError(400, "Token inválido."));
    try {
      const result = await scheduleModel.confirmNotificationSubscription({
        institutionId: req.institution.id,
        tokenHash: hashToken(token),
      });
      if (!result.affectedRows) throw httpError(400, "Link de confirmação inválido ou expirado.");
      return res.type("html").send("<p>Notificação de horários ativada. Você já pode fechar esta página.</p>");
    } catch (error) {
      return next(error);
    }
  };

  const listPublishedSchedules = async (req, res, next) => {
    try {
      res.set("Cache-Control", "no-store");
      return res.json(
        await scheduleModel.listPublishedSchedules({
          institutionId: req.institution.id,
          onlyOptions: req.query.apenas_opcoes === "1" || req.query.apenas_opcoes === "true",
          query: req.query,
        })
      );
    } catch (error) {
      return next(error);
    }
  };

  const assignPublishedRoom = async (req, res, next) => {
    const scheduleId = Number(req.params.id);
    const rawRoomId = req.body?.sala_id;
    const roomId = rawRoomId === null || rawRoomId === undefined || rawRoomId === "" ? null : Number(rawRoomId);
    const rawStudentCount = req.body?.quantidade_alunos;
    const studentCount =
      rawStudentCount === null || rawStudentCount === undefined || rawStudentCount === ""
        ? null
        : Number(rawStudentCount);
    const reason = sanitizeFreeText(req.body?.motivo, 255) || null;

    if (!Number.isInteger(scheduleId) || scheduleId < 1) return next(httpError(400, "Horário inválido."));
    if (roomId !== null && (!Number.isInteger(roomId) || roomId < 1)) return next(httpError(400, "Sala inválida."));
    if (studentCount !== null && (!Number.isInteger(studentCount) || studentCount < 1)) {
      return next(httpError(400, "Informe uma quantidade de alunos válida."));
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const result = await roomAssignmentService.updatePublishedScheduleRoom(conn, {
        institutionId: req.institution.id,
        scheduleId,
        roomId,
        userId: req.user.id,
        studentCount,
        reason,
      });
      await conn.commit();
      return res.json(result);
    } catch (error) {
      await conn.rollback();
      return next(error);
    } finally {
      conn.release();
    }
  };

  const listAcademicGroups = async (req, res, next) => {
    try {
      return res.json(await scheduleModel.listAcademicGroups(req.institution.id));
    } catch (error) {
      return next(error);
    }
  };

  const listIntervals = async (req, res, next) => {
    try {
      const includeInactive = req.user?.papel === "CPD" &&
        (req.query.incluir_inativos === "1" || req.query.incluir_inativos === "true");
      return res.json(await scheduleModel.listIntervals({ institutionId: req.institution.id, includeInactive }));
    } catch (error) {
      return next(error);
    }
  };

  const saveInterval = async (req, res, next) => {
    const groupIds = Array.isArray(req.body?.grupo_ids)
      ? [...new Set(req.body.grupo_ids.map(Number))]
      : [];
    const interval = {
      nome: sanitizeFreeText(req.body?.nome, 120),
      hora_inicio: String(req.body?.hora_inicio || ""),
      hora_fim: String(req.body?.hora_fim || ""),
      ativo: ![false, 0, "0", "false"].includes(req.body?.ativo),
      grupo_ids: groupIds,
    };
    try {
      if (req.params.id && (!Number.isInteger(Number(req.params.id)) || Number(req.params.id) < 1)) {
        throw httpError(400, "Intervalo inválido.");
      }
      const validTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
      if (!interval.nome || !validTime(interval.hora_inicio) || !validTime(interval.hora_fim) ||
          interval.hora_inicio >= interval.hora_fim) {
        throw httpError(400, "Informe nome, início e fim válidos para o intervalo.");
      }
      if (!groupIds.length || groupIds.some((id) => !Number.isInteger(id) || id < 1)) {
        throw httpError(400, "Selecione ao menos um grupo acadêmico válido.");
      }
      const result = await scheduleModel.saveInterval({
        institutionId: req.institution.id,
        intervalId: req.params.id,
        interval,
      });
      if (result.invalidGroups) throw httpError(400, "Grupo acadêmico não encontrado nesta instituição.");
      if (result.notFound) throw httpError(404, "Intervalo não encontrado.");
      return res.status(req.params.id ? 200 : 201).json({ id: result.id });
    } catch (error) {
      return next(error);
    }
  };

  const deactivateInterval = async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) throw httpError(400, "Intervalo inválido.");
      const result = await scheduleModel.deactivateInterval({ institutionId: req.institution.id, intervalId: id });
      if (!result.affectedRows) throw httpError(404, "Intervalo não encontrado.");
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  };

  return {
    approveImport,
    assignPendingRoom,
    assignPublishedRoom,
    deactivateInterval,
    confirmNotification,
    getImport,
    listImports,
    listAcademicGroups,
    listIntervals,
    listPublishedSchedules,
    rejectImport,
    saveInterval,
    subscribeToNotifications,
    uploadUrania,
  };
};
