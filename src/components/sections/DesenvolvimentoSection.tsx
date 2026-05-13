import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Code2, Zap, Target } from "lucide-react";

export function DesenvolvimentoSection() {
  const projects = [
    {
      name: "Nova Interface de Usuário",
      description: "Redesign completo da plataforma",
      progress: 75,
      status: "em-progresso"
    },
    {
      name: "Integração com API Externa",
      description: "Conectar com serviço de analytics",
      progress: 40,
      status: "planejado"
    },
    {
      name: "Testes Automatizados",
      description: "Cobertura de testes e2e completa",
      progress: 60,
      status: "em-progresso"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "concluido":
        return "bg-green-100 text-green-800";
      case "em-progresso":
        return "bg-blue-100 text-blue-800";
      case "planejado":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Desenvolvimento</h2>
        <p className="text-muted-foreground mt-2">
          Acompanhe o progresso dos projetos em desenvolvimento
        </p>
      </div>

      <div className="space-y-4">
        {projects.map((project, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Code2 className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>{project.description}</CardDescription>
                  </div>
                </div>
                <Badge className={getStatusColor(project.status)}>
                  {project.status === "em-progresso" ? "Em Progresso" : "Planejado"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso</span>
                  <span className="font-semibold">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
