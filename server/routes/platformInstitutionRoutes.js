import { Router } from "express";
import { createPlatformInstitutionController } from "../controllers/platformInstitutionController.js";
import { createPlatformInstitutionModel } from "../models/platformInstitutionModel.js";

export const createPlatformInstitutionRoutes = ({
  asBoolean,
  createPassword,
  db,
  ensureDefaultPublicContent,
  httpError,
  normalizeUsername,
  requirePlatformManager,
  sanitizeFreeText,
}) => {
  const model = createPlatformInstitutionModel({ db });
  const controller = createPlatformInstitutionController({
    asBoolean,
    createPassword,
    ensureDefaultPublicContent,
    httpError,
    model,
    normalizeUsername,
    sanitizeFreeText,
  });
  const router = Router();

  router.get("/", requirePlatformManager, controller.listInstitutions);
  router.post("/", requirePlatformManager, controller.createInstitution);
  router.put("/:id", requirePlatformManager, controller.updateInstitution);
  router.get("/:institutionId/usuarios", requirePlatformManager, controller.listUsers);
  router.post("/:institutionId/usuarios", requirePlatformManager, controller.createUser);
  router.put("/:institutionId/usuarios/:userId", requirePlatformManager, controller.updateUser);

  return router;
};
