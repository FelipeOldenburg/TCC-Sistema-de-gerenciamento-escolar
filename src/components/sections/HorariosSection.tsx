import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Armchair, Clock, Cpu, FlaskConical, Leaf, Monitor, Paintbrush, Wrench, Zap } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ClassOption = { turma: string; curso: string | null; ano: string | null };
type PublishedSchedule = {
  id: number;
  turma: string;
  curso: string | null;
  ano: string | null;
  dia: string;
  periodo: number;
  hora_inicio: string | null;
  disciplina: string;
  professor: string | null;
  sala: string | null;
  bloco: string | null;
};
type PublishedResponse = { turmas: ClassOption[]; horarios: PublishedSchedule[] };

const courseVisuals = {
  "Informática": { icon: Monitor, color: "from-blue-500 to-cyan-400" },
  "Mecânica": { icon: Wrench, color: "from-gray-600 to-gray-400" },
  "Química": { icon: FlaskConical, color: "from-emerald-500 to-teal-400" },
  "Eletrônica": { icon: Cpu, color: "from-violet-500 to-purple-400" },
  "Eletrotécnica": { icon: Zap, color: "from-amber-500 to-yellow-400" },
  "Móveis": { icon: Armchair, color: "from-orange-500 to-amber-400" },
  "Design de Móveis": { icon: Paintbrush, color: "from-pink-500 to-rose-400" },
  "Meio Ambiente": { icon: Leaf, color: "from-green-600 to-emerald-400" },
} as const;

const dayLabels: Record<string, string> = {
  SEG: "Segunda",
  TER: "Terça",
  QUA: "Quarta",
  QUI: "Quinta",
  SEX: "Sexta",
  SAB: "Sábado",
  DOM: "Domingo",
};

const HorariosSection = () => {
  const [view, setView] = useState<"cursos" | "tabela">("cursos");
  const [options, setOptions] = useState<ClassOption[]>([]);
  const [schedules, setSchedules] = useState<PublishedSchedule[]>([]);
  const [course, setCourse] = useState("");
  const [year, setYear] = useState("");
  const [className, setClassName] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<PublishedResponse>("/api/horarios/publicados?apenas_opcoes=1")
      .then((data) => setOptions(data.turmas))
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar horários."))
      .finally(() => setLoadingOptions(false));
  }, []);

  useEffect(() => {
    if (!className) {
      setSchedules([]);
      return;
    }
    setLoadingSchedules(true);
    apiFetch<PublishedResponse>(`/api/horarios/publicados?turma=${encodeURIComponent(className)}`)
      .then((data) => {
        setSchedules(data.horarios);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar a turma."))
      .finally(() => setLoadingSchedules(false));
  }, [className]);

  const courses = useMemo(
    () => [...new Set(options.map((item) => item.curso || "Outros"))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [options]
  );
  const years = useMemo(
    () => [...new Set(options.filter((item) => (item.curso || "Outros") === course).map((item) => item.ano || "Não informado"))].sort(),
    [options, course]
  );
  const classes = useMemo(
    () => options.filter((item) => (item.curso || "Outros") === course && (!year || (item.ano || "Não informado") === year)),
    [options, course, year]
  );

  const openCourse = (selectedCourse: string) => {
    const first = options.find((item) => (item.curso || "Outros") === selectedCourse);
    setCourse(selectedCourse);
    setYear(first?.ano || "Não informado");
    setClassName(first?.turma || "");
    setView("tabela");
  };

  const changeCourse = (selectedCourse: string) => {
    const first = options.find((item) => (item.curso || "Outros") === selectedCourse);
    setCourse(selectedCourse);
    setYear(first?.ano || "Não informado");
    setClassName(first?.turma || "");
  };

  const changeYear = (selectedYear: string) => {
    const first = options.find((item) => (item.curso || "Outros") === course && (item.ano || "Não informado") === selectedYear);
    setYear(selectedYear);
    setClassName(first?.turma || "");
  };

  if (view === "cursos") {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Clock className="w-5 h-5 text-primary" /></div>
          <div><h2 className="text-2xl font-heading font-bold text-foreground">Horários de Aula</h2><p className="text-sm text-muted-foreground">Somente horários aprovados pelo CPD</p></div>
        </div>
        {loadingOptions && <div className="glass-card rounded-xl p-12 text-center text-muted-foreground">Carregando horários publicados...</div>}
        {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
        {!loadingOptions && !error && !courses.length && <div className="glass-card rounded-xl p-12 text-center"><p className="font-medium">Nenhum horário publicado.</p><p className="text-sm text-muted-foreground mt-1">Os horários aparecerão aqui após aprovação do CPD.</p></div>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {courses.map((courseName, index) => {
            const visual = courseVisuals[courseName as keyof typeof courseVisuals] || { icon: Clock, color: "from-slate-500 to-slate-400" };
            const Icon = visual.icon;
            return <button key={courseName} onClick={() => openCourse(courseName)} className="glass-card glass-card-hover rounded-xl p-6 flex flex-col items-center gap-4 group" style={{ animationDelay: `${index * 60}ms` }}>
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${visual.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}><Icon className="w-7 h-7 text-primary-foreground" /></div>
              <span className="font-semibold text-card-foreground text-sm text-center">{courseName}</span>
            </button>;
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <button onClick={() => setView("cursos")} className="flex items-center gap-2 text-primary hover:text-primary/80 text-sm mb-4 font-medium"><ArrowLeft className="w-4 h-4" /> Voltar aos cursos</button>
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-xl font-heading font-bold text-card-foreground mb-6">Selecionar a turma</h2>
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Curso</label><Select value={course} onValueChange={changeCourse}><SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger><SelectContent>{courses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ano</label><Select value={year} onValueChange={changeYear}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent>{years.map((item) => <SelectItem key={item} value={item}>{item === "Não informado" ? item : `${item}º ano`}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Turma</label><Select value={className} onValueChange={setClassName}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{classes.map((item) => <SelectItem key={item.turma} value={item.turma}>{item.turma}</SelectItem>)}</SelectContent></Select></div>
        </div>
        {error && <p className="text-sm text-destructive mb-4">{error}</p>}
        <div className="rounded-xl overflow-hidden border border-border overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-primary text-primary-foreground"><TableHead className="text-primary-foreground">Dia</TableHead><TableHead className="text-primary-foreground">Horário</TableHead><TableHead className="text-primary-foreground">Disciplina</TableHead><TableHead className="text-primary-foreground">Turma</TableHead><TableHead className="text-primary-foreground">Sala</TableHead><TableHead className="text-primary-foreground">Professor</TableHead></TableRow></TableHeader>
            <TableBody>
              {loadingSchedules && <TableRow><TableCell colSpan={6} className="text-center py-8">Carregando...</TableCell></TableRow>}
              {!loadingSchedules && !schedules.length && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma aula encontrada para esta turma.</TableCell></TableRow>}
              {schedules.map((schedule) => <TableRow key={schedule.id} className="hover:bg-primary/5"><TableCell className="font-medium">{dayLabels[schedule.dia] || schedule.dia}</TableCell><TableCell className="font-semibold text-primary">{schedule.hora_inicio || `${schedule.periodo}ª aula`}</TableCell><TableCell>{schedule.disciplina}</TableCell><TableCell>{schedule.turma}</TableCell><TableCell>{schedule.sala || "—"}</TableCell><TableCell>{schedule.professor || "—"}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default HorariosSection;
