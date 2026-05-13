import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send } from "lucide-react";

export function FeedbackSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Feedback & Sugestões</h2>
        <p className="text-muted-foreground mt-2">
          Compartilhe suas ideias e sugestões para melhorar o Design Compass
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Enviar Feedback
          </CardTitle>
          <CardDescription>
            Sua opinião é importante para nós
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Categoria</label>
              <select className="w-full mt-2 px-3 py-2 border rounded-md">
                <option>Sugestão</option>
                <option>Bug</option>
                <option>Outro</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Mensagem</label>
              <textarea 
                className="w-full mt-2 px-3 py-2 border rounded-md" 
                rows={5}
                placeholder="Descreva seu feedback..."
              />
            </div>
            <Button className="w-full">
              <Send className="w-4 h-4 mr-2" />
              Enviar Feedback
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
