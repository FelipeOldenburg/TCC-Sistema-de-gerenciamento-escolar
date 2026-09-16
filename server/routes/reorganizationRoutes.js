export const registerReorganizationRoutes = (
  app,
  controller,
  { documentUpload, requireRole, uploadRateLimit }
) => {
  const requireCpd = requireRole("CPD");
  app.get("/api/reorganizacao", requireCpd, controller.list);
  app.post(
    "/api/reorganizacao",
    uploadRateLimit,
    requireCpd,
    documentUpload.single("arquivo"),
    controller.create
  );
  app.get("/api/reorganizacao/:id/arquivo", requireCpd, controller.downloadAttachment);
  app.delete("/api/reorganizacao/:id", requireCpd, controller.remove);
};
