const institutionSelect = `
  id, slug, nome, nome_admin, nome_sistema, subtitulo_admin, logo_url,
  cor_primaria_hsl, cor_acento_hsl, cor_header_hsl, cor_nav_hsl, cor_nav_ativa_hsl, ativo
`;

export const defaultInstitutionColors = {
  cor_primaria_hsl: "220 9% 46%",
  cor_acento_hsl: "215 16% 47%",
  cor_header_hsl: "222 10% 24%",
  cor_nav_hsl: "220 9% 32%",
  cor_nav_ativa_hsl: "220 8% 42%",
};

export const hslColorPattern = /^\d{1,3}(?:\.\d+)?\s+\d{1,3}(?:\.\d+)?%\s+\d{1,3}(?:\.\d+)?%$/;

export const serializeInstitutionBrand = (row) => ({
  slug: row.slug,
  name: row.nome,
  adminName: row.nome_admin,
  systemName: row.nome_sistema,
  adminSubtitle: row.subtitulo_admin,
  logoUrl: row.logo_url,
  colors: {
    primary: row.cor_primaria_hsl,
    accent: row.cor_acento_hsl,
    header: row.cor_header_hsl,
    nav: row.cor_nav_hsl,
    navActive: row.cor_nav_ativa_hsl,
  },
});

export const createInstitutionModel = (db) => ({
  loadBySlug: async (slug) => {
    const [rows] = await db.query(
      `SELECT ${institutionSelect}
         FROM instituicoes
        WHERE slug = ?
        LIMIT 1`,
      [slug]
    );
    return rows[0] || null;
  },

  updateBrand: (institutionId, brand) =>
    db.query(
      `UPDATE instituicoes
          SET nome_admin = ?, nome_sistema = ?, subtitulo_admin = ?, logo_url = ?,
              cor_primaria_hsl = ?, cor_acento_hsl = ?, cor_header_hsl = ?, cor_nav_hsl = ?,
              cor_nav_ativa_hsl = ?
        WHERE id = ?`,
      [
        brand.nome_admin,
        brand.nome_sistema,
        brand.subtitulo_admin,
        brand.logo_url,
        brand.cor_primaria_hsl,
        brand.cor_acento_hsl,
        brand.cor_header_hsl,
        brand.cor_nav_hsl,
        brand.cor_nav_ativa_hsl,
        institutionId,
      ]
    ),
});
