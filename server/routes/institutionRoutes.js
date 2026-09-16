export const registerInstitutionRoutes = (app, controller, { requireRole }) => {
  app.get("/api/instituicao", controller.getBrand);
  app.put("/api/instituicao", requireRole("CPD"), controller.updateBrand);
};
