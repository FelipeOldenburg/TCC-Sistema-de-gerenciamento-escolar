import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Monitor, Wrench, FlaskConical, Cpu, Zap, Armchair, Paintbrush, Leaf, ArrowLeft, Clock } from "lucide-react";

const cursos = [
  { id: "informatica", nome: "Informática", icon: Monitor, cor: "from-blue-500 to-cyan-400" },
  { id: "mecanica", nome: "Mecânica", icon: Wrench, cor: "from-gray-600 to-gray-400" },
  { id: "quimica", nome: "Química", icon: FlaskConical, cor: "from-emerald-500 to-teal-400" },
  { id: "eletronica", nome: "Eletrônica", icon: Cpu, cor: "from-violet-500 to-purple-400" },
  { id: "eletrotecnica", nome: "Eletrotécnica", icon: Zap, cor: "from-amber-500 to-yellow-400" },
  { id: "moveis", nome: "Móveis", icon: Armchair, cor: "from-orange-500 to-amber-400" },
  { id: "design-moveis", nome: "Design de Móveis", icon: Paintbrush, cor: "from-pink-500 to-rose-400" },
  { id: "meio-ambiente", nome: "Meio Ambiente", icon: Leaf, cor: "from-green-600 to-emerald-400" },
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
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-heading font-bold text-foreground">Horários de Aula</h2>
            <p className="text-sm text-muted-foreground">Selecione o curso para ver os horários</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cursos.map((curso, i) => {
            const Icon = curso.icon;
            return (
              <button
                key={curso.id}
                onClick={() => {
                  setCursoSelecionado(curso.id);
                  setView("tabela");
                }}
                className="glass-card glass-card-hover rounded-xl p-6 flex flex-col items-center gap-4 group"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${curso.cor} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-7 h-7 text-primary-foreground" />
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
        className="flex items-center gap-2 text-primary hover:text-primary/80 text-sm mb-4 font-medium transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar aos cursos
      </button>
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-xl font-heading font-bold text-card-foreground mb-6">Selecionar a turma</h2>
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Curso</label>
            <Select value={cursoSelecionado} onValueChange={setCursoSelecionado}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {cursos.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ano</label>
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
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Turma</label>
            <Select value={turma} onValueChange={setTurma}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="62-1">62-1</SelectItem>
                <SelectItem value="62-2">62-2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rounded-xl overflow-hidden border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary text-primary-foreground">
                <TableHead className="text-primary-foreground font-semibold">Horário</TableHead>
                <TableHead className="text-primary-foreground font-semibold">Disciplina</TableHead>
                <TableHead className="text-primary-foreground font-semibold">Turma</TableHead>
                <TableHead className="text-primary-foreground font-semibold">Sala</TableHead>
                <TableHead className="text-primary-foreground font-semibold">Professor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {horariosMock.map((h, i) => (
                <TableRow key={i} className="hover:bg-primary/5 transition-colors">
                  <TableCell className="font-semibold text-primary">{h.horario}</TableCell>
                  <TableCell className="font-medium">{h.disciplina}</TableCell>
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
