import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, Circle, AlertCircle } from "lucide-react";

export function RoadmapSection() {
  const roadmapItems = [
    {
      quarter: "Q2 2026",
      items: [
        { title: "Dark Mode", status: "completed", icon: CheckCircle2 },
        { title: "Mobile App", status: "in-progress", icon: Circle },
        { title: "API Documentation", status: "in-progress", icon: Circle }
      ]
    },
    {
      quarter: "Q3 2026",
      items: [
        { title: "Advanced Analytics", status: "planned", icon: Circle },
        { title: "AI Integration", status: "planned", icon: Circle },
        { title: "Enterprise Features", status: "planned", icon: Circle }
      ]
    },
    {
      quarter: "Q4 2026",
      items: [
        { title: "Global Expansion", status: "planned", icon: Circle },
        { title: "Multi-language Support", status: "planned", icon: Circle },
        { title: "Marketplace", status: "planned", icon: Circle }
      ]
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Concluído</Badge>;
      case "in-progress":
        return <Badge className="bg-blue-100 text-blue-800">Em Progresso</Badge>;
      case "planned":
        return <Badge className="bg-gray-100 text-gray-800">Planejado</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Roadmap</h2>
        <p className="text-muted-foreground mt-2">
          Conheça nossos planos futuros para o Design Compass
        </p>
      </div>

      <div className="space-y-6">
        {roadmapItems.map((quarter, index) => (
          <div key={index}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">{quarter.quarter}</h3>
            </div>
            <div className="space-y-2 ml-8">
              {quarter.items.map((item, itemIndex) => (
                <div key={itemIndex} className="flex items-center gap-3 p-3 rounded-lg border">
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium flex-1">{item.title}</span>
                  {getStatusBadge(item.status)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
