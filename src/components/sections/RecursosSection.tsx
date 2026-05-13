import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Download, Star, Eye } from "lucide-react";

export function RecursosSection() {
  const resources = [
    {
      title: "Guia de Início Rápido",
      description: "Aprenda como começar com o Design Compass",
      type: "guide",
      views: 1200,
      rating: 4.8
    },
    {
      title: "API Documentation",
      description: "Documentação completa da API REST",
      type: "documentation",
      views: 3450,
      rating: 4.9
    },
    {
      title: "Vídeo Tutorial",
      description: "Tutorial em vídeo de 10 minutos",
      type: "video",
      views: 2100,
      rating: 4.7
    },
    {
      title: "Componentes UI",
      description: "Biblioteca de componentes reutilizáveis",
      type: "library",
      views: 4200,
      rating: 4.9
    }
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case "guide":
        return "bg-blue-100 text-blue-800";
      case "documentation":
        return "bg-purple-100 text-purple-800";
      case "video":
        return "bg-red-100 text-red-800";
      case "library":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Recursos</h2>
        <p className="text-muted-foreground mt-2">
          Acesse guias, documentação e ferramentas
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resources.map((resource, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{resource.title}</CardTitle>
                  <CardDescription>{resource.description}</CardDescription>
                </div>
                <Badge className={getTypeColor(resource.type)}>
                  {resource.type}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {resource.views}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    {resource.rating}
                  </span>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-1" />
                  Acessar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
