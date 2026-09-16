export const registerAuthRoutes = (
  app,
  controller,
  { authRateLimit, requireAuth, requirePlatformAuth }
) => {
  app.post("/api/auth/login", authRateLimit, controller.login);
  app.post("/api/auth/logout", controller.logout);
  app.get("/api/auth/me", requireAuth, controller.currentUser);

  app.post("/api/plataforma/auth/login", authRateLimit, controller.platformLogin);
  app.post("/api/plataforma/auth/logout", controller.platformLogout);
  app.get("/api/plataforma/auth/me", requirePlatformAuth, controller.currentPlatformUser);
};
