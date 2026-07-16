import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Armchair, Clock, Cpu, FlaskConical, Leaf, Monitor, Paintbrush, Settings, Wrench, Zap } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, type SessionUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ClassOption = { turma: string; curso: string | null; ano: string | null };
type RoomOption = {
  id: number;
  nome: string;
  bloco_nome: string;
  andar: string;
  capacidade: number | null;
  tipo: string;
  status: "ATIVA" | "INATIVA" | "MANUTENCAO";
  acessivel: boolean;
};
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
  sala_id: number | null;
  ambiente: string | null;
  sala: string | null;
  bloco: string | null;
};
type PublishedResponse = { turmas: ClassOption[]; horarios: PublishedSchedule[] };

const NO_ROOM_VALUE = "__usar_ambiente_importado__";

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
  SEG: "Segunda-feira",
  TER: "Terça-feira",
  QUA: "Quarta-feira",
  QUI: "Quinta-feira",
  SEX: "Sexta-feira",
  SAB: "Sábado",
  DOM: "Domingo",
};

const weekdayOrder = ["SEG", "TER", "QUA", "QUI", "SEX"];

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
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<PublishedSchedule | null>(null);
  const [roomValue, setRoomValue] = useState(NO_ROOM_VALUE);
  const [roomError, setRoomError] = useState("");
  const [savingRoom, setSavingRoom] = useState(false);
  const [studentCount, setStudentCount] = useState("");
  const [roomReason, setRoomReason] = useState("");

  const isCpd = user?.papel === "CPD";

  useEffect(() => {
    apiFetch<PublishedResponse>("/api/horarios/publicados?apenas_opcoes=1")
      .then((data) => setOptions(data.turmas))
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar horários."))
      .finally(() => setLoadingOptions(false));
  }, []);

  useEffect(() => {
    apiFetch<{ user: SessionUser }>("/api/auth/me")
      .then((response) => setUser(response.user))
      .catch(() => setUser(null));
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
  const schedulesByDay = useMemo(() => {
    const extraDays = ["SAB", "DOM"].filter((day) => schedules.some((schedule) => schedule.dia === day));
    return [...weekdayOrder, ...extraDays].map((day) => ({
      day,
      schedules: schedules.filter((schedule) => schedule.dia === day),
    }));
  }, [schedules]);
  const selectedRoom = useMemo(
    () => rooms.find((room) => String(room.id) === roomValue) || null,
    [rooms, roomValue]
  );
  const selectedRoomCapacity = selectedRoom?.capacidade ?? null;
  const parsedStudentCount = studentCount ? Number(studentCount) : null;
  const capacityWarning = selectedRoom && parsedStudentCount && selectedRoomCapacity !== null && parsedStudentCount > selectedRoomCapacity;

  const ensureRoomsLoaded = async () => {
    if (roomsLoaded || loadingRooms) return;
    setLoadingRooms(true);
    setRoomError("");
    try {
      const data = await apiFetch<RoomOption[]>("/api/salas");
      setRooms(data);
      setRoomsLoaded(true);
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : "Erro ao carregar salas.");
    } finally {
      setLoadingRooms(false);
    }
  };

  const openRoomConfig = (schedule: PublishedSchedule) => {
    setSelectedSchedule(schedule);
    setRoomValue(schedule.sala_id ? String(schedule.sala_id) : NO_ROOM_VALUE);
    setRoomError("");
    setStudentCount("");
    setRoomReason("");
    void ensureRoomsLoaded();
  };

  const closeRoomConfig = () => {
    if (savingRoom) return;
    setSelectedSchedule(null);
    setRoomError("");
  };

  const saveRoomConfig = async () => {
    if (!selectedSchedule) return;
    const salaId = roomValue === NO_ROOM_VALUE ? null : Number(roomValue);
    setSavingRoom(true);
    setRoomError("");
    try {
      await apiFetch(`/api/horarios/publicados/${selectedSchedule.id}/sala`, {
        method: "PATCH",
        body: JSON.stringify({
          sala_id: salaId,
          quantidade_alunos: studentCount ? Number(studentCount) : null,
          motivo: roomReason,
        }),
      });
      setSchedules((current) =>
        current.map((schedule) =>
          schedule.id === selectedSchedule.id
            ? {
                ...schedule,
                sala_id: salaId,
                sala: selectedRoom?.nome || schedule.ambiente || null,
                bloco: selectedRoom?.bloco_nome || null,
              }
            : schedule
        )
      );
      toast.success("Sala configurada para o horário.");
      setSelectedSchedule(null);
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : "Erro ao configurar a sala.");
    } finally {
      setSavingRoom(false);
    }
  };

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
        {loadingSchedules && <div className="rounded-xl border border-border py-10 text-center text-muted-foreground">Carregando...</div>}
        {!loadingSchedules && !schedules.length && <div className="rounded-xl border border-border py-10 text-center text-muted-foreground">Nenhuma aula encontrada para esta turma.</div>}
        {!loadingSchedules && !!schedules.length && (
          <div className="space-y-5">
            {schedulesByDay.map(({ day, schedules: daySchedules }) => (
              <section key={day} className="rounded-xl overflow-hidden border border-border">
                <div className="bg-primary px-4 py-3 text-primary-foreground">
                  <h3 className="font-heading font-bold">{dayLabels[day] || day}</h3>
                  <p className="text-xs text-primary-foreground/70">{daySchedules.length} aula(s)</p>
                </div>
                {daySchedules.length ? (
                  <>
                  <div className="space-y-3 p-3 md:hidden">
                    {daySchedules.map((schedule) => (
                      <div key={schedule.id} className="rounded-xl border border-border bg-background/70 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-primary">{schedule.hora_inicio || `${schedule.periodo}ª aula`}</p>
                          {isCpd && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => openRoomConfig(schedule)}
                              className="h-8 w-8 shrink-0"
                              title="Configurar sala"
                              aria-label={`Configurar sala de ${schedule.disciplina}`}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <p className="mt-1 font-medium text-foreground">{schedule.disciplina}</p>
                        <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                          <p><span className="font-medium text-foreground">Sala:</span> {schedule.sala || "—"}</p>
                          <p><span className="font-medium text-foreground">Professor:</span> {schedule.professor || "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Horário</TableHead>
                          <TableHead>Disciplina</TableHead>
                          <TableHead>Sala</TableHead>
                          <TableHead>Professor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {daySchedules.map((schedule) => (
                          <TableRow key={schedule.id} className="hover:bg-primary/5">
                            <TableCell className="font-semibold text-primary">{schedule.hora_inicio || `${schedule.periodo}ª aula`}</TableCell>
                            <TableCell className="font-medium">{schedule.disciplina}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 min-w-[9rem]">
                                <span className="truncate">{schedule.sala || "—"}</span>
                                {isCpd && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openRoomConfig(schedule)}
                                    className="h-8 w-8 shrink-0"
                                    title="Configurar sala"
                                    aria-label={`Configurar sala de ${schedule.disciplina}`}
                                  >
                                    <Settings className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{schedule.professor || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  </>
                ) : (
                  <p className="px-4 py-6 text-sm text-center text-muted-foreground">Nenhuma aula neste dia.</p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
      <Dialog open={!!selectedSchedule} onOpenChange={(open) => { if (!open) closeRoomConfig(); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Configurar sala</DialogTitle>
            <DialogDescription>
              Defina a sala vinculada a esta turma e disciplina.
            </DialogDescription>
          </DialogHeader>

          {selectedSchedule && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <p><span className="font-medium text-foreground">Turma:</span> {selectedSchedule.turma}</p>
                  <p><span className="font-medium text-foreground">Horário:</span> {dayLabels[selectedSchedule.dia] || selectedSchedule.dia} · {selectedSchedule.hora_inicio || `${selectedSchedule.periodo}ª aula`}</p>
                  <p className="sm:col-span-2"><span className="font-medium text-foreground">Disciplina:</span> {selectedSchedule.disciplina}</p>
                  <p className="sm:col-span-2"><span className="font-medium text-foreground">Sala atual:</span> {selectedSchedule.sala || "Sem sala definida"}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Sala</label>
                <Select value={roomValue} onValueChange={setRoomValue} disabled={loadingRooms || savingRoom}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingRooms ? "Carregando salas..." : "Selecione uma sala"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ROOM_VALUE}>
                      {selectedSchedule.ambiente ? `Usar ambiente importado (${selectedSchedule.ambiente})` : "Sem sala definida"}
                    </SelectItem>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={String(room.id)} disabled={room.status !== "ATIVA"}>
                        {room.nome} · {room.bloco_nome} · {room.tipo}{room.status !== "ATIVA" ? " · indisponível" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRoom && (
                  <p className="text-xs text-muted-foreground">
                    {selectedRoom.bloco_nome}, {selectedRoom.andar} · {selectedRoom.capacidade == null ? "capacidade a conferir" : `${selectedRoom.capacidade} lugares`} · {selectedRoom.tipo}{selectedRoom.acessivel ? " · acessível" : ""}
                  </p>
                )}
                {!loadingRooms && roomsLoaded && !rooms.length && (
                  <p className="text-xs text-muted-foreground">Nenhuma sala cadastrada no painel do CPD.</p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-foreground">Quantidade de alunos</label>
                  <Input type="number" min={1} value={studentCount} onChange={(event) => setStudentCount(event.target.value)} placeholder="Opcional" />
                  {capacityWarning && <p className="mt-1 text-xs text-destructive">A sala comporta {selectedRoomCapacity} alunos.</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Motivo</label>
                  <Input value={roomReason} onChange={(event) => setRoomReason(event.target.value)} placeholder="Opcional" />
                </div>
              </div>

              {roomError && <p className="text-sm text-destructive">{roomError}</p>}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeRoomConfig} disabled={savingRoom}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveRoomConfig} disabled={savingRoom || loadingRooms || !!capacityWarning}>
              {savingRoom ? "Salvando..." : "Salvar sala"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HorariosSection;
