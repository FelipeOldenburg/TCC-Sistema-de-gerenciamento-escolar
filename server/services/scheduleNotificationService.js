const dayLabels = {
  SEG: "Segunda-feira",
  TER: "Terça-feira",
  QUA: "Quarta-feira",
  QUI: "Quinta-feira",
  SEX: "Sexta-feira",
  SAB: "Sábado",
  DOM: "Domingo",
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const parsePayload = (value) => {
  if (typeof value !== "string") return value || {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const scheduleLabel = (schedule) => [
  dayLabels[schedule.dia] || schedule.dia,
  schedule.horario || schedule.hora_inicio || (schedule.periodo ? `${schedule.periodo}ª aula` : null),
  schedule.disciplina,
  schedule.sala || "Sem sala definida",
].filter(Boolean).join(" | ");

const changedLabel = (change) => {
  const fields = [];
  if (change.horario_alterado) fields.push(`horário: ${change.antes.horario || change.antes.hora_inicio || "—"} → ${change.depois.horario || change.depois.hora_inicio || "—"}`);
  if (change.disciplina_alterada) fields.push(`disciplina: ${change.antes.disciplina || "—"} → ${change.depois.disciplina || "—"}`);
  if (change.sala_alterada) fields.push(`sala: ${change.antes.sala || "—"} → ${change.depois.sala || "—"}`);
  if (change.professor_alterado) fields.push(`professor: ${change.antes.professor || "—"} → ${change.depois.professor || "—"}`);
  const slot = [
    dayLabels[change.depois.dia] || change.depois.dia,
    change.depois.horario || change.depois.hora_inicio || (change.depois.periodo ? `${change.depois.periodo}ª aula` : null),
    change.depois.disciplina,
  ].filter(Boolean).join(" | ");
  return `${slot}${fields.length ? ` | ${fields.join("; ")}` : ""}`;
};

export const buildScheduleNotificationText = ({ turma, payload }) => {
  const details = parsePayload(payload);
  const lines = [`A grade da turma ${turma} foi atualizada.`, "", "Alterações:"];
  for (const item of details.alteradas || []) lines.push(`- ${changedLabel(item)}`);
  for (const item of details.adicionadas || []) lines.push(`- Aula incluída: ${scheduleLabel(item)}`);
  for (const item of details.removidas || []) lines.push(`- Aula removida: ${scheduleLabel(item)}`);
  lines.push("", "Consulte a grade atualizada no sistema.");
  return lines.join("\n");
};

export const buildScheduleNotificationHtml = ({ turma, payload }) => {
  const text = buildScheduleNotificationText({ turma, payload });
  const lines = text.split("\n").map((line) => escapeHtml(line));
  return `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;max-width:640px;margin:auto;padding:24px"><h2 style="color:#1d4ed8">Alteração na grade da sua turma</h2><p>${lines.join("<br>")}</p></div>`;
};

export const createScheduleNotificationService = ({ scheduleModel }) => {
  const sendEmail = async ({ to, subject, text, html }) => {
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
      html,
    });
    return { sent: true };
  };

  const sendVerificationEmail = async ({ to, turma, code, confirmationUrl }) => sendEmail({
    to,
    subject: `Confirmar avisos da grade - turma ${turma}`,
    text: [
      `Use o código ${code} para confirmar os avisos da turma ${turma}.`,
      "",
      `O código vale por 2 dias e pode ser usado uma única vez.`,
      confirmationUrl ? `Você também pode confirmar por este link: ${confirmationUrl}` : "",
    ].filter(Boolean).join("\n"),
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;max-width:640px;margin:auto;padding:24px"><h2 style="color:#1d4ed8">Confirmar avisos da grade</h2><p>Use este código para ativar os avisos da turma <strong>${escapeHtml(turma)}</strong>:</p><p style="font-size:30px;letter-spacing:8px;font-weight:700;text-align:center">${escapeHtml(code)}</p><p>O código vale por 2 dias e pode ser usado uma única vez.</p>${confirmationUrl ? `<p><a href="${escapeHtml(confirmationUrl)}">Confirmar automaticamente</a></p>` : ""}</div>`,
  });

  const processPendingEvents = async ({ institutionId = null, limit = 100 } = {}) => {
    const events = await scheduleModel.claimNotificationEvents({ institutionId, limit });
    const result = { tentadas: events.length, enviadas: 0, sem_smtp: 0, falhas: 0 };
    for (const event of events) {
      try {
        const payload = parsePayload(event.payload_json);
        const expiration = event.tipo === "EXPIRACAO";
        const text = expiration
          ? "O período de 1 ano das notificações de alterações da sua turma foi encerrado.\n\nCaso queira continuar recebendo atualizações, acesse o sistema e realize uma nova ativação."
          : buildScheduleNotificationText({ turma: event.turma, payload });
        const sent = await sendEmail({
          to: event.email,
          subject: expiration ? "Suas notificações de horários expiraram" : "Alteração na grade da sua turma",
          text,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;max-width:640px;margin:auto;padding:24px"><h2 style="color:#1d4ed8">${expiration ? "Suas notificações de horários expiraram" : "Alteração na grade da sua turma"}</h2><p>${escapeHtml(text).replaceAll("\n", "<br>")}</p></div>`,
        });
        if (!sent.sent) {
          await scheduleModel.failNotificationEvent({ eventId: event.id, error: sent.reason });
          result.sem_smtp += 1;
          continue;
        }
        await scheduleModel.completeNotificationEvent(event.id);
        result.enviadas += 1;
      } catch (error) {
        await scheduleModel.failNotificationEvent({ eventId: event.id, error: error.message });
        result.falhas += 1;
        console.error({ error, eventId: event.id }, "Falha ao enviar notificação de horário");
      }
    }
    return result;
  };

  const runMaintenance = async () => {
    await scheduleModel.expireNotificationSubscriptions();
    return processPendingEvents();
  };

  return { processPendingEvents, runMaintenance, sendVerificationEmail };
};

export const startScheduleNotificationScheduler = ({ notificationService }) => {
  const intervalMs = Math.max(60_000, Number(process.env.NOTIFICATION_SCHEDULER_INTERVAL_MS || 300_000));
  const run = () => notificationService.runMaintenance().catch((error) => console.error(error, "Falha no scheduler de notificações"));
  void run();
  const interval = setInterval(run, intervalMs);
  interval.unref?.();
  return () => clearInterval(interval);
};
