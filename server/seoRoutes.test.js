import assert from "node:assert/strict";
import test from "node:test";
import { getPublicSeoHost } from "./routes/seoRoutes.js";

test("SEO host usa o domínio canônico e aceita somente subdomínios de instituições ativas", async () => {
  const loadInstitutionBySlug = async (slug) =>
    slug === "cimol" ? { slug, ativo: true } : { slug, ativo: false };

  assert.equal(await getPublicSeoHost("HORARIODAESCOLA.COM.BR", loadInstitutionBySlug), "www.horariodaescola.com.br");
  assert.equal(await getPublicSeoHost("www.horariodaescola.com.br", loadInstitutionBySlug), "www.horariodaescola.com.br");
  assert.equal(await getPublicSeoHost("cimol.horariodaescola.com.br", loadInstitutionBySlug), "cimol.horariodaescola.com.br");
  assert.equal(await getPublicSeoHost("inativa.horariodaescola.com.br", loadInstitutionBySlug), null);
  assert.equal(await getPublicSeoHost("cimol.preview.vercel.app", loadInstitutionBySlug), null);
});
