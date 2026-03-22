import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const ReclamacoesSection = () => {
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [mensagem, setMensagem] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Reclamação enviada com sucesso!");
    setNome("");
    setCategoria("");
    setMensagem("");
  };

  return (
    <div className="animate-fade-in">
      <div className="bg-card rounded-xl border border-border p-6 md:p-10 shadow-sm max-w-2xl mx-auto">
        <h2 className="text-2xl font-heading font-bold text-card-foreground mb-2">Reclamações e Feedback</h2>
        <p className="text-muted-foreground mb-6">
          Envie sua sugestão, reclamação ou elogio. Sua opinião é importante para melhorarmos.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-card-foreground">Nome (opcional)</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-card-foreground">Categoria</label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sugestao">Sugestão</SelectItem>
                <SelectItem value="reclamacao">Reclamação</SelectItem>
                <SelectItem value="elogio">Elogio</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-card-foreground">Mensagem</label>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Descreva aqui..."
              rows={5}
              required
            />
          </div>
          <Button type="submit" className="w-full">Enviar</Button>
        </form>
      </div>
    </div>
  );
};

export default ReclamacoesSection;
