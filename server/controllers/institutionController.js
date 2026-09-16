import { serializeInstitutionBrand } from "../models/institutionModel.js";

export const createInstitutionController = ({
  institutionModel,
  normalizeInstitutionBrandPayload,
  validateInstitutionBrandPayload,
}) => ({
  getBrand: (req, res) => {
    res.set("Cache-Control", "no-store");
    return res.json(serializeInstitutionBrand(req.institution));
  },

  updateBrand: async (req, res, next) => {
    const brand = normalizeInstitutionBrandPayload(req.body);
    try {
      validateInstitutionBrandPayload(brand);
      await institutionModel.updateBrand(req.institution.id, brand);
      const institution = await institutionModel.loadBySlug(req.institution.slug);
      return res.json(serializeInstitutionBrand(institution));
    } catch (error) {
      return next(error);
    }
  },
});
