import { useEffect, useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, INSTITUTION_DOMAIN } from "@/lib/api";

type PublicInstitution = { slug: string; nome_sistema: string };

const InstitutionDirectory = () => {
  const [institutions, setInstitutions] = useState<PublicInstitution[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<PublicInstitution[]>("/api/instituicoes/public")
      .then(setInstitutions)
      .catch(() => setError("Não foi possível carregar as instituições."));
  }, []);

  const isPublicDomain = window.location.hostname === INSTITUTION_DOMAIN || window.location.hostname.endsWith(`.${INSTITUTION_DOMAIN}`);

  return (
    <main className="min-h-screen bg-background px-4 py-16 text-foreground">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 text-center">
          <h1 className="font-heading text-3xl font-bold sm:text-4xl">Horário da Escola</h1>
          <p className="mt-3 text-muted-foreground">Escolha sua instituição para acessar horários e informações.</p>
        </header>
        {institutions === null && !error && <p className="text-center" role="status">Carregando instituições...</p>}
        {error && <p className="text-center text-destructive" role="alert">{error}</p>}
        {institutions?.length === 0 && <p className="text-center text-muted-foreground">Nenhuma instituição disponível no momento.</p>}
        {institutions && institutions.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {institutions.map(({ slug, nome_sistema }) => (
              <li key={slug}>
                <a
                  className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  href={isPublicDomain ? `https://${slug}.${INSTITUTION_DOMAIN}/` : `/?instituicao=${encodeURIComponent(slug)}`}
                >
                  <Card className="h-full transition-colors group-hover:border-primary">
                    <CardHeader>
                      <CardTitle className="text-lg">{nome_sistema}</CardTitle>
                      <CardDescription>{slug}.{INSTITUTION_DOMAIN}</CardDescription>
                    </CardHeader>
                  </Card>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
};

export default InstitutionDirectory;
