import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Monitor, Wrench, FlaskConical, Cpu, Zap, Armchair, Paintbrush, Leaf } from "lucide-react";

const cursos = [
  { id: "informatica", nome: "Informática", icon: Monitor },
  { id: "mecanica", nome: "Mecânica", icon: Wrench },
  { id: "quimica", nome: "Química", icon: FlaskConical },
  { id: "eletronica", nome: "Eletrônica", icon: Cpu },
  { id: "eletrotecnica", nome: "Eletrotécnica", icon: Zap },
  { id: "moveis", nome: "Móveis", icon: Armchair },
  { id: "design-moveis", nome: "Design de Móveis", icon: Paintbrush },
  { id: "meio-ambiente", nome: "Meio Ambiente", icon: Leaf },
];

const horariosMock = [
  { horario: "07:30 - 08:20", disciplina: "Matemática", turma: "62-1", sala: "Lab 01", professor: "Prof. Silva" },
  { horario: "08:20 - 09:10", disciplina: "Programação Web", turma: "62-1", sala: "Lab Info 02", professor: "Prof. Santos" },
  { horario: "09:10 - 10:00", disciplina: "Banco de Dados", turma: "62-1", sala: "Lab Info 01", professor: "Prof. Oliveira" },
  { horario: "10:20 - 11:10", disciplina: "Redes", turma: "62-1", sala: "Lab Info 03", professor: "Prof. Costa" },
  { horario: "11:10 - 12:00", disciplina: "Português", turma: "62-1", sala: "Sala 15", professor: "Prof. Lima" },
];

const HorariosSection = () => {
  const [view, setView] = useState<"cursos" | "tabela">("cursos");
  const [cursoSelecionado, setCursoSelecionado] = useState("");
  const [ano, setAno] = useState("");
  const [turma, setTurma] = useState("");

  if (view === "cursos") {
    return (
      <div className="animate-fade-in">
        <h2 className="text-2xl font-heading font-bold text-foreground mb-6">Horários de Aula</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cursos.map((curso) => {
            const Icon = curso.icon;
            return (
              <button
                key={curso.id}
                onClick={() => {
                  setCursoSelecionado(curso.id);
                  setView("tabela");
                }}
                className="bg-card rounded-lg p-6 flex flex-col items-center gap-3 shadow-sm border border-border hover:shadow-md hover:border-primary/30 transition-all group"
              >
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Icon className="w-8 h-8 text-primary" />
                </div>
                <span className="font-semibold text-card-foreground text-sm text-center">{curso.nome}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => setView("cursos")}
        className="text-primary hover:underline text-sm mb-4 inline-block"
      >
        ← Voltar aos cursos
      </button>
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <h2 className="text-2xl font-heading font-bold text-card-foreground mb-6">Selecionar a turma</h2>
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Curso</label>
            <Select value={cursoSelecionado} onValueChange={setCursoSelecionado}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {cursos.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Ano</label>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1° Ano</SelectItem>
                <SelectItem value="2">2° Ano</SelectItem>
                <SelectItem value="3">3° Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Turma</label>
            <Select value={turma} onValueChange={setTurma}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="62-1">62-1</SelectItem>
                <SelectItem value="62-2">62-2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rounded-lg overflow-hidden border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/10">
                <TableHead className="text-primary font-semibold">Horário</TableHead>
                <TableHead className="text-primary font-semibold">Disciplina</TableHead>
                <TableHead className="text-primary font-semibold">Turma</TableHead>
                <TableHead className="text-primary font-semibold">Sala</TableHead>
                <TableHead className="text-primary font-semibold">Professor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {horariosMock.map((h, i) => (
                <TableRow key={i} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{h.horario}</TableCell>
                  <TableCell>{h.disciplina}</TableCell>
                  <TableCell>{h.turma}</TableCell>
                  <TableCell>{h.sala}</TableCell>
                  <TableCell>{h.professor}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default HorariosSection;
