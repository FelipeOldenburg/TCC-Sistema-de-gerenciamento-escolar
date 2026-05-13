import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, TrendingUp, Users, Activity } from "lucide-react";

export function AnalyticsSection() {
  const stats = [
    { label: "Usuários Ativos", value: "1,234", icon: Users, change: "+12%" },
    { label: "Sessões Hoje", value: "856", icon: Activity, change: "+8%" },
    { label: "Taxa de Retenção", value: "92%", icon: TrendingUp, change: "+5%" }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground mt-2">
          Visualize métricas e dados da plataforma
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-green-600 mt-1">{stat.change} vs ontem</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gráfico de Atividade</CardTitle>
          <CardDescription>Atividade dos últimos 7 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-muted rounded-lg">
            <div className="text-center">
              <BarChart className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Gráfico será renderizado aqui</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
