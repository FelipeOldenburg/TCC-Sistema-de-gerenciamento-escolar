const institutionDomain = "horariodaescola.com.br";

export const getPublicSeoHost = async (hostname, loadInstitutionBySlug) => {
  const host = String(hostname || "").toLowerCase();
  if (host === institutionDomain || host === `www.${institutionDomain}`) return `www.${institutionDomain}`;
  const match = host.match(/^([a-z0-9-]+)\.horariodaescola\.com\.br$/);
  if (!match || match[1] === "www") return null;
  const institution = await loadInstitutionBySlug(match[1]);
  return institution?.ativo && institution.slug === match[1] ? host : null;
};

export const registerSeoRoutes = (app, { loadInstitutionBySlug }) => {
  app.get("/robots.txt", async (req, res, next) => {
    try {
      const host = await getPublicSeoHost(req.hostname, loadInstitutionBySlug);
      if (!host) return res.status(404).type("text/plain").send("Not found");
      res.set("Cache-Control", "public, max-age=300").type("text/plain").send(
        `User-agent: *\nAllow: /\nSitemap: https://${host}/sitemap.xml\n`
      );
    } catch (error) {
      next(error);
    }
  });

  app.get("/sitemap.xml", async (req, res, next) => {
    try {
      const host = await getPublicSeoHost(req.hostname, loadInstitutionBySlug);
      if (!host) return res.status(404).type("application/xml").send("");
      res.set("Cache-Control", "public, max-age=300").type("application/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://${host}/</loc></url></urlset>`
      );
    } catch (error) {
      next(error);
    }
  });
};
