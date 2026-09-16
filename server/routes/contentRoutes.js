export const registerContentRoutes = (app, controller, { ouvidoriaRateLimit, requireRole }) => {
  app.get("/api/eventos", controller.listEvents);
  app.post("/api/eventos", requireRole("CPD"), controller.createEvent);
  app.put("/api/eventos/:id", requireRole("CPD"), controller.updateEvent);
  app.delete("/api/eventos/:id", requireRole("CPD"), controller.deleteEvent);

  app.get("/api/setores", controller.listSectors);
  app.post("/api/setores", requireRole("CPD"), controller.createSector);
  app.put("/api/setores/:id", requireRole("CPD"), controller.updateSector);
  app.delete("/api/setores/:id", requireRole("CPD"), controller.deleteSector);

  app.post("/api/ouvidoria", ouvidoriaRateLimit, controller.createManifestation);
  app.get("/api/ouvidoria", requireRole("CPD"), controller.listManifestations);
  app.patch("/api/ouvidoria/:id", requireRole("CPD"), controller.updateManifestationStatus);

  app.post("/api/relatos", ouvidoriaRateLimit, controller.createManifestation);
  app.get("/api/relatos", requireRole("CPD"), controller.listManifestations);
  app.patch("/api/relatos/:id", requireRole("CPD"), controller.updateManifestationStatus);
};
