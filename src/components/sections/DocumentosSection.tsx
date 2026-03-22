import { FileText, Download, Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

const documentos = [
  { nome: "Regimento Escolar 2025", tipo: "PDF", tamanho: "2.3 MB" },
  { nome: "Calendário Acadêmico", tipo: "PDF", tamanho: "450 KB" },
  { nome: "Manual do Aluno", tipo: "PDF", tamanho: "1.8 MB" },
  { nome: "Plano Pedagógico", tipo: "PDF", tamanho: "3.1 MB" },
  { nome: "Normas de Segurança - Laboratórios", tipo: "PDF", tamanho: "890 KB" },
  { nome: "Formulário de Matrícula", tipo: "PDF", tamanho: "320 KB" },
];

const DocumentosSection = () => {
  const [busca, setBusca] = useState("");
  const filtrados = documentos.filter(d => d.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="animate-fade-in">
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-heading font-bold text-card-foreground">Documentos</h2>
              <p className="text-sm text-muted-foreground">{documentos.length} arquivos disponíveis</p>
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar documento..."
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-2">
          {filtrados.map((doc, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-card-foreground text-sm">{doc.nome}</p>
                  <p className="text-xs text-muted-foreground">{doc.tipo} • {doc.tamanho}</p>
                </div>
              </div>
              <button className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground transition-all opacity-0 group-hover:opacity-100">
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
