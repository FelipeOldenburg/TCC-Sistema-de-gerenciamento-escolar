export const registerFacilitiesRoutes = (app, controller, { requireRole }) => {
  app.get("/api/mapas", controller.listMaps);
  app.post("/api/mapas", requireRole("CPD"), controller.saveMap);
  app.put("/api/mapas/:id", requireRole("CPD"), controller.saveMap);

  app.get("/api/blocos", controller.listBlocks);
  app.post("/api/blocos", requireRole("CPD"), controller.createBlock);
  app.put("/api/blocos/:id", requireRole("CPD"), controller.updateBlock);
  app.delete("/api/blocos/:id", requireRole("CPD"), controller.deleteBlock);

  app.get("/api/salas", controller.listRooms);
  app.get("/api/salas/ocupacoes", controller.listRoomOccupations);
  app.get("/api/salas/:id", controller.getRoom);
  app.get("/api/salas/:id/ocupacao", controller.getRoomOccupation);
  app.get("/api/sala-alteracoes", requireRole("CPD"), controller.listRoomChanges);
  app.post("/api/salas", requireRole("CPD"), controller.createRoom);
  app.put("/api/salas/:id", requireRole("CPD"), controller.updateRoom);
  app.delete("/api/salas/:id", requireRole("CPD"), controller.deleteRoom);
};
