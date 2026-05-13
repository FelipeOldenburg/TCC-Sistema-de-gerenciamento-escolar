import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, AlertCircle, Info } from "lucide-react";

export function AnunciosSection() {
  const announcements = [
    {
      id: 1,
      title: "Manutenção Programada",
      description: "Sistema em manutenção no próximo sábado de 14h às 16h",
      type: "warning",
      date: "2026-05-18"
    },
    {
      id: 2,
      title: "Novo Recurso: Dark Mode",
      description: "O modo escuro agora está disponível nas configurações",
      type: "info",
      date: "2026-05-13"
    },
    {
      id: 3,
      title: "Atualização de Segurança",
      description: "Implementamos melhorias nas políticas de segurança da plataforma",
      type: "info",
      date: "2026-05-10"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Anúncios</h2>
        <p className="text-muted-foreground mt-2">
          Últimas notícias e atualizações do Design Compass
        </p>
      </div>

      <div className="space-y-4">
        {announcements.map((announcement) => (
          <Alert key={announcement.id} className={announcement.type === "warning" ? "border-yellow-500 bg-yellow-50" : ""}>
            <div className="flex gap-4">
              <div className="mt-1">
                {announcement.type === "warning" ? (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                ) : (
                  <Bell className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{announcement.title}</h3>
                <AlertDescription className="mt-1">
                  {announcement.description}
                </AlertDescription>
                <p className="text-xs text-muted-foreground mt-2">{announcement.date}</p>
              </div>
            </div>
          </Alert>
        ))}
      </div>
    </div>
  );
}
