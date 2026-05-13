import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, MapPin, Calendar, ArrowRight } from "lucide-react";

export function ComunidadeSection() {
  const communityEvents = [
    {
      title: "Encontro de Desenvolvedores",
      description: "Networking e apresentações de projetos",
      date: "2026-05-20",
      attendees: 45,
      location: "Online"
    },
    {
      title: "Workshop: Design Systems",
      description: "Aprenda a criar um design system profissional",
      date: "2026-05-25",
      attendees: 62,
      location: "Sala 101"
    },
    {
      title: "Hackathon 2026",
      description: "48 horas de desenvolvimento intenso",
      date: "2026-06-01",
      attendees: 120,
      location: "Campus Principal"
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Comunidade</h2>
        <p className="text-muted-foreground mt-2">
          Conecte-se com outros usuários e participe de eventos
        </p>
      </div>

      <div className="space-y-4">
        {communityEvents.map((event, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle>{event.title}</CardTitle>
                  <CardDescription className="mt-1">{event.description}</CardDescription>
                </div>
                <Badge variant="secondary">Próximo</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>{new Date(event.date).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{event.location}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{event.attendees} inscritos</span>
                </div>
              </div>
              <Button className="w-full" variant="outline">
                Saiba Mais
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-primary/5 border-primary">
        <CardHeader>
          <CardTitle>Crie seu próprio evento</CardTitle>
          <CardDescription>Organize um encontro ou workshop na comunidade</CardDescription>
        </CardHeader>
        <CardContent>
          <Button>Criar Evento</Button>
        </CardContent>
      </Card>
    </div>
  );
}
