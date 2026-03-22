import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MessageSquareWarning, Send } from "lucide-react";

const ReclamacoesSection = () => {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [mensagem, setMensagem] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Mensagem enviada com sucesso! Obrigado pelo seu feedback.");
    setNome("");
    setCategoria("");
    setMensagem("");
  };

  return (
    <div className="animate-fade-in">
      <div className="glass-card rounded-2xl p-6 md:p-10 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageSquareWarning className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-card-foreground">Feedback</h2>
        </div>
        <p className="text-muted-foreground mb-8 ml-[52px]">
          Sua opinião é importante para melhorarmos cada vez mais.
        </p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome (opcional)</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categoria</label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sugestao">💡 Sugestão</SelectItem>
                <SelectItem value="reclamacao">⚠️ Reclamação</SelectItem>
                <SelectItem value="elogio">⭐ Elogio</SelectItem>
                <SelectItem value="outro">📝 Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mensagem</label>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Descreva aqui..."
              rows={5}
              required
              className="rounded-xl"
            />
          </div>
          <Button type="submit" className="w-full rounded-xl gap-2">
            <Send className="w-4 h-4" />
            Enviar
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ReclamacoesSection;
