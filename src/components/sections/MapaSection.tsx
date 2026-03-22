import mapaEscola from "@/assets/mapa-escola.png";

const MapaSection = () => {
  return (
    <div className="animate-fade-in">
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h2 className="text-2xl font-heading font-bold text-card-foreground mb-6">Mapa da Escola</h2>
        <div className="rounded-lg overflow-hidden border border-border bg-muted/30 flex items-center justify-center">
          <img
            src={mapaEscola}
            alt="Mapa 3D da Escola Técnica Monteiro Lobato"
            className="w-full max-w-3xl object-contain"
          />
        </div>
        <p className="text-sm text-muted-foreground mt-4 text-center">
          Visualização da estrutura física da escola — modelo simplificado
        </p>
      </div>
    </div>
  );
};

export default MapaSection;
