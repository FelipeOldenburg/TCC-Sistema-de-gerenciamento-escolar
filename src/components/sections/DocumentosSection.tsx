import { FileText, Download } from "lucide-react";

const documentos = [
  { nome: "Regimento Escolar 2025", tipo: "PDF", tamanho: "2.3 MB" },
  { nome: "Calendário Acadêmico", tipo: "PDF", tamanho: "450 KB" },
  { nome: "Manual do Aluno", tipo: "PDF", tamanho: "1.8 MB" },
  { nome: "Plano Pedagógico", tipo: "PDF", tamanho: "3.1 MB" },
  { nome: "Normas de Segurança - Laboratórios", tipo: "PDF", tamanho: "890 KB" },
  { nome: "Formulário de Matrícula", tipo: "PDF", tamanho: "320 KB" },
];

const DocumentosSection = () => {
  return (
    <div className="animate-fade-in">
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h2 className="text-2xl font-heading font-bold text-card-foreground mb-6">Documentos</h2>
        <div className="space-y-3">
          {documentos.map((doc, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-card-foreground text-sm">{doc.nome}</p>
                  <p className="text-xs text-muted-foreground">{doc.tipo} • {doc.tamanho}</p>
                </div>
              </div>
              <button className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors">
                <Download className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DocumentosSection;
