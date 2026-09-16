import { useEffect, useState } from "react";
import { MessageSquareWarning, Send } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export type ReportContext = {
  origem: "HORARIO" | "SALA" | "SETOR" | "MAPA";
  label: string;
  horario_id?: number;
  sala_id?: number;
  setor_id?: number;
  mapa_area_id?: number;
};

const categories = [
  ["HORARIO_INCORRETO", "Horário incorreto"],
  ["SALA_LOCAL_INCORRETO", "Sala ou local incorreto"],
  ["SALA_INDISPONIVEL", "Sala indisponível"],
  ["MUDANCA_NAO_ATUALIZADA", "Mudança não atualizada"],
  ["CONFLITO_HORARIO", "Conflito de horário"],
  ["LOCALIZACAO_INCORRETA", "Localização incorreta"],
  ["INFORMACAO_INCORRETA", "Outra informação incorreta"],
] as const;

type SetorOption = { id: number; nome: string };

const ReportForm = ({ context, onSuccess }: { context?: ReportContext; onSuccess?: () => void }) => {
  const [categoria, setCategoria] = useState("");
  const [setorId, setSetorId] = useState("sem_setor");
  const [setores, setSetores] = useState<SetorOption[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [nome, setNome] = useState("");
  const [perfil, setPerfil] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (context) return;
    apiFetch<SetorOption[]>("/api/setores").then(setSetores).catch(() => setSetores([]));
  }, [context]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoria) return setError("Selecione o problema encontrado.");
    setSending(true);
    setError("");
    try {
      await apiFetch("/api/relatos", {
        method: "POST",
        body: JSON.stringify({
          categoria,
          origem: context?.origem || "FORMULARIO",
          setor_id: context?.setor_id || (setorId === "sem_setor" ? null : Number(setorId)),
          sala_id: context?.sala_id,
          horario_id: context?.horario_id,
          mapa_area_id: context?.mapa_area_id,
          nome: nome.trim() || null,
          perfil: perfil || null,
          mensagem: mensagem.trim() || null,
        }),
      });
      toast.success("Problema relatado. Obrigado por ajudar a manter as informações corretas.");
      setCategoria("");
      setSetorId("sem_setor");
      setNome("");
      setPerfil("");
      setMensagem("");
      setShowDetails(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o relato.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {context && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contexto confirmado</span>
          <span className="font-medium text-foreground">{context.label}</span>
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="report-category" className="text-sm font-medium">O que está errado?</label>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger id="report-category" className="rounded-xl"><SelectValue placeholder="Selecione uma opção" /></SelectTrigger>
          <SelectContent>
            {categories.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {!context && setores.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor="report-sector" className="text-sm font-medium">Setor relacionado (opcional)</label>
          <Select value={setorId} onValueChange={setSetorId}>
            <SelectTrigger id="report-sector" className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sem_setor">Não sei informar</SelectItem>
              {setores.map((setor) => <SelectItem key={setor.id} value={String(setor.id)}>{setor.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        className="px-0"
        aria-expanded={showDetails}
        aria-controls="report-optional-details"
        onClick={() => setShowDetails((value) => !value)}
      >
        {showDetails ? "Ocultar detalhes" : "Adicionar detalhes (opcional)"}
      </Button>
      {showDetails && (
        <div id="report-optional-details" className="space-y-4 rounded-xl border p-4">
          <Textarea
            aria-label="Detalhes do problema"
            value={mensagem}
            onChange={(event) => setMensagem(event.target.value)}
            placeholder="Se quiser, conte mais sobre o problema."
            rows={4}
            maxLength={700}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input aria-label="Nome opcional" value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Nome (opcional)" maxLength={120} />
            <Select value={perfil} onValueChange={setPerfil}>
              <SelectTrigger aria-label="Perfil opcional"><SelectValue placeholder="Perfil (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALUNO">Aluno</SelectItem>
                <SelectItem value="DOCENTE">Docente</SelectItem>
                <SelectItem value="RESPONSAVEL">Responsável</SelectItem>
                <SelectItem value="COMUNIDADE">Comunidade escolar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={sending} className="w-full rounded-xl gap-2">
        <Send className="h-4 w-4" /> {sending ? "Enviando..." : "Relatar problema"}
      </Button>
    </form>
  );
};

export const ProblemReportDialog = ({ context, onOpenChange }: {
  context: ReportContext | null;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={Boolean(context)} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Relatar problema</DialogTitle>
        <DialogDescription>Escolha uma categoria. Escrever detalhes é opcional.</DialogDescription>
      </DialogHeader>
      {context && <ReportForm context={context} onSuccess={() => onOpenChange(false)} />}
    </DialogContent>
  </Dialog>
);

const ReclamacoesSection = () => (
  <div className="animate-fade-in">
    <div className="glass-card rounded-2xl p-6 md:p-10 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <MessageSquareWarning className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-2xl font-heading font-bold text-card-foreground">Relatar problema</h2>
      </div>
      <p className="text-muted-foreground mb-6 ml-[52px]">Avise rapidamente quando uma informação da escola estiver incorreta.</p>
      <ReportForm />
    </div>
  </div>
);

export default ReclamacoesSection;
