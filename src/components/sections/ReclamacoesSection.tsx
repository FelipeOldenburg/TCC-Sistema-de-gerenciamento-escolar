import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, MessageSquareWarning, Send } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SetorOption = { id: number; nome: string };

const NO_SECTOR_VALUE = "sem_setor";
const maxMessageLength = 700;

const inappropriateTerms = new Set([
  "arrombado",
  "bosta",
  "burro",
  "caralho",
  "desgracado",
  "fdp",
  "foda",
  "foder",
  "idiota",
  "imbecil",
  "merda",
  "otario",
  "porra",
  "puta",
  "puto",
  "vagabundo",
]);

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/@/g, "a")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/7/g, "t");

const hasInappropriateContent = (value: string) => {
  const normalized = normalizeText(value);
  const tokens = normalized.split(/[^a-z]+/).filter(Boolean);
  if (tokens.some((token) => inappropriateTerms.has(token))) return true;
  const compact = normalized.replace(/[^a-z]/g, "");
  return [...inappropriateTerms].some((term) => term.length >= 5 && compact.includes(term));
};

const ReclamacoesSection = () => {
  const [setores, setSetores] = useState<SetorOption[]>([]);
  const [nome, setNome] = useState("");
  const [perfil, setPerfil] = useState("");
  const [categoria, setCategoria] = useState("");
  const [setorId, setSetorId] = useState(NO_SECTOR_VALUE);
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<SetorOption[]>("/api/setores")
      .then(setSetores)
      .catch(() => setSetores([]));
  }, []);

  const contentWarning = useMemo(() => {
    const content = `${nome} ${assunto} ${mensagem}`;
    if (hasInappropriateContent(content)) return "Revise o texto: a ouvidoria não aceita termos ofensivos ou impróprios.";
    if (/https?:\/\/|www\./i.test(content)) return "Não envie links na manifestação.";
    if (/(.)\1{7,}/i.test(content)) return "Revise trechos com caracteres repetidos.";
    return "";
  }, [nome, assunto, mensagem]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!perfil || !categoria) {
      setError("Selecione seu perfil e a categoria.");
      return;
    }
    if (assunto.trim().length < 6 || mensagem.trim().length < 20) {
      setError("Preencha assunto e descrição com mais detalhes.");
      return;
    }
    if (contentWarning) {
      setError(contentWarning);
      return;
    }

    setSending(true);
    setError("");
    try {
      await apiFetch("/api/ouvidoria", {
        method: "POST",
        body: JSON.stringify({
          nome: nome.trim() || null,
          perfil,
          categoria,
          setor_id: setorId === NO_SECTOR_VALUE ? null : Number(setorId),
          assunto,
          mensagem,
        }),
      });
      toast.success("Manifestação enviada para a ouvidoria.");
      setNome("");
      setPerfil("");
      setCategoria("");
      setSetorId(NO_SECTOR_VALUE);
      setAssunto("");
      setMensagem("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a manifestação.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="glass-card rounded-2xl p-6 md:p-10 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageSquareWarning className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-card-foreground">Ouvidoria</h2>
        </div>
        <p className="text-muted-foreground mb-8 ml-[52px]">
          Envie ideias, melhorias e avisos sobre problemas encontrados na escola.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome (opcional)</label>
              <Input value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Seu nome" className="rounded-xl" maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perfil</label>
              <Select value={perfil} onValueChange={setPerfil}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALUNO">Aluno</SelectItem>
                  <SelectItem value="DOCENTE">Docente</SelectItem>
                  <SelectItem value="RESPONSAVEL">Responsável</SelectItem>
                  <SelectItem value="COMUNIDADE">Comunidade escolar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categoria</label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IDEIA">Ideia</SelectItem>
                  <SelectItem value="MELHORIA">Melhoria</SelectItem>
                  <SelectItem value="PROBLEMA">Problema encontrado</SelectItem>
                  <SelectItem value="AVISO">Aviso importante</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Setor</label>
              <Select value={setorId} onValueChange={setSetorId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SECTOR_VALUE}>Não sei informar</SelectItem>
                  {setores.map((setor) => (
                    <SelectItem key={setor.id} value={String(setor.id)}>{setor.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assunto</label>
            <Input value={assunto} onChange={(event) => setAssunto(event.target.value)} placeholder="Ex.: iluminação do corredor" className="rounded-xl" maxLength={120} required />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</label>
              <span className="text-xs text-muted-foreground">{mensagem.length}/{maxMessageLength}</span>
            </div>
            <Textarea
              value={mensagem}
              onChange={(event) => setMensagem(event.target.value)}
              placeholder="Descreva o ponto principal, local e impacto."
              rows={6}
              required
              maxLength={maxMessageLength}
              className="rounded-xl"
            />
          </div>

          {(contentWarning || error) && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error || contentWarning}</span>
            </div>
          )}

          <Button type="submit" disabled={sending || !!contentWarning} className="w-full rounded-xl gap-2">
            <Send className="w-4 h-4" />
            {sending ? "Enviando..." : "Enviar para a ouvidoria"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ReclamacoesSection;
