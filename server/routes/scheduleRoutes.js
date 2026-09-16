export const registerScheduleRoutes = (
  app,
  controller,
  { notificationRateLimit, requireRole, uploadRateLimit, uraniaUpload }
) => {
  app.post(
    "/api/importacoes/urania",
    uploadRateLimit,
    requireRole("ADMIN"),
    uraniaUpload.array("arquivos", 10),
    controller.uploadUrania
  );
  app.get("/api/importacoes", requireRole("CPD"), controller.listImports);
  app.get("/api/importacoes/:id", requireRole("CPD"), controller.getImport);
  app.patch("/api/importacoes/horarios/:id/sala", requireRole("CPD"), controller.assignPendingRoom);
  app.post("/api/importacoes/:id/aprovar", requireRole("CPD"), controller.approveImport);
  app.post("/api/importacoes/:id/rejeitar", requireRole("CPD"), controller.rejectImport);

  app.post("/api/horarios/notificacoes", notificationRateLimit, controller.subscribeToNotifications);
  app.get("/api/horarios/notificacoes/confirmar", controller.confirmNotification);
  app.get("/api/horarios/publicados", controller.listPublishedSchedules);
  app.patch("/api/horarios/publicados/:id/sala", requireRole("CPD"), controller.assignPublishedRoom);

  app.get("/api/grupos-academicos", requireRole("CPD"), controller.listAcademicGroups);
  app.get("/api/intervalos", controller.listIntervals);
  app.post("/api/intervalos", requireRole("CPD"), controller.saveInterval);
  app.put("/api/intervalos/:id", requireRole("CPD"), controller.saveInterval);
  app.delete("/api/intervalos/:id", requireRole("CPD"), controller.deactivateInterval);
};
