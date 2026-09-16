import {
  authenticatePlatformUser,
  authenticateUser,
  clearPlatformSessionCookie,
  clearSessionCookie,
  createPlatformSession,
  createSession,
  deletePlatformSession,
  deleteSession,
  setPlatformSessionCookie,
  setSessionCookie,
} from "../auth.js";

export const createAuthController = (db) => ({
  login: async (req, res, next) => {
    try {
      const user = await authenticateUser(db, req.body?.usuario, req.body?.senha, req.institution.id);
      if (!user) return res.status(401).json({ message: "Usuário ou senha inválidos." });
      const token = await createSession(db, user.id);
      setSessionCookie(res, token);
      return res.json({ user });
    } catch (error) {
      return next(error);
    }
  },

  logout: async (req, res, next) => {
    try {
      await deleteSession(db, req);
      clearSessionCookie(res);
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  },

  currentUser: (req, res) => res.json({ user: req.user }),

  platformLogin: async (req, res, next) => {
    try {
      const user = await authenticatePlatformUser(db, req.body?.usuario, req.body?.senha);
      if (!user) return res.status(401).json({ message: "Usuário ou senha inválidos." });
      const token = await createPlatformSession(db, user.id);
      setPlatformSessionCookie(res, token);
      return res.json({ user });
    } catch (error) {
      return next(error);
    }
  },

  platformLogout: async (req, res, next) => {
    try {
      await deletePlatformSession(db, req);
      clearPlatformSessionCookie(res);
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  },

  currentPlatformUser: (req, res) => res.json({ user: req.platformUser }),
});
