import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Edit, History, Plus, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Bloco = { id: number; nome: string };
type RoomStatus = "ATIVA" | "INATIVA" | "MANUTENCAO";
type Sala = {
  id: number;
  nome: string;
  bloco_id: number;
  bloco_nome: string;
  andar: string;
  capacidade: number | null;
  tipo: string;
  status: RoomStatus;
  acessivel: boolean;
  possui_computadores: boolean;
  possui_data_show: boolean;
  possui_internet: boolean;
  possui_ar_condicionado: boolean;
  softwares: string[];
  observacoes: string | null;
};

type Shift = "manha" | "tarde";

type RoomOccupancy = {
  id: number;
  sala_id: number | null;
  turma: string;
  curso: string | null;
  ano: string | null;
  dia: string;
  periodo: number;
  hora_inicio: string | null;
  disciplina: string;
  professor: string | null;
  ambiente?: string | null;
  sala?: string | null;
  bloco?: string | null;
};

type ChangeHistory = {
  id: number;
  turma: string;
  dia: string;
  periodo: number;
  hora_inicio: string | null;
  quantidade_alunos: number | null;
  motivo: string | null;
  created_at: string;
  sala_anterior: string | null;
  sala_nova: string | null;
  usuario_nome: string;
};

const emptyForm = {
  bloco_id: "",
  nome: "",
  andar: "",
  capacidade: "",
  tipo: "",
  status: "ATIVA" as RoomStatus,
  acessivel: false,
  possui_computadores: false,
  possui_data_show: false,
  possui_internet: false,
  possui_ar_condicionado: false,
  softwares: "",
  observacoes: "",
};

const statusLabel: Record<RoomStatus, string> = {
  ATIVA: "Ativa",
  INATIVA: "Inativa",
  MANUTENCAO: "Manutenção",
};

const statusClass: Record<RoomStatus, string> = {
  ATIVA: "bg-emerald-100 text-emerald-800 border-emerald-200",
  INATIVA: "bg-slate-100 text-slate-700 border-slate-200",
  MANUTENCAO: "bg-amber-100 text-amber-800 border-amber-200",
};

const sheetPeriods = [1, 2, 3, 4, 5];
const dayOrder = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
const dayLabels: Record<string, string> = {
  SEG: "Segunda",
  TER: "Terça",
  QUA: "Quarta",
  QUI: "Quinta",
  SEX: "Sexta",
  SAB: "Sábado",
  DOM: "Domingo",
};

const getHour = (time: string | null) => {
  const hour = Number(time?.slice(0, 2));
  return Number.isFinite(hour) ? hour : null;
};

const getShift = (item: RoomOccupancy): Shift => {
  const hour = getHour(item.hora_inicio);
  if (hour !== null) return hour >= 12 ? "tarde" : "manha";
  return item.periodo > 5 ? "tarde" : "manha";
};

const getSheetPeriod = (item: RoomOccupancy) => ((item.periodo - 1) % 5) + 1;
const isSameSlot = (item: RoomOccupancy, day: string, shift: Shift, period: number) =>
  item.dia === day && getShift(item) === shift && getSheetPeriod(item) === period;

const sortOccupancy = (a: RoomOccupancy, b: RoomOccupancy) => {
  const dayA = dayOrder.indexOf(a.dia);
  const dayB = dayOrder.indexOf(b.dia);
  return (dayA === -1 ? 99 : dayA) - (dayB === -1 ? 99 : dayB)
    || getSheetPeriod(a) - getSheetPeriod(b)
    || (a.hora_inicio || "").localeCompare(b.hora_inicio || "")
    || a.turma.localeCompare(b.turma, "pt-BR");
};

export default function SalasSection() {
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [ocupacoes, setOcupacoes] = useState<RoomOccupancy[]>([]);
  const [allSchedules, setAllSchedules] = useState<RoomOccupancy[]>([]);
  const [historico, setHistorico] = useState<ChangeHistory[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todas");
  const [selectedDay, setSelectedDay] = useState("SEG");
  const [transfer, setTransfer] = useState<{
    schedule: RoomOccupancy;
    salaId: string;
    quantidadeAlunos: string;
    motivo: string;
  } | null>(null);
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [slotPicker, setSlotPicker] = useState<{
    sala: Sala;
    shift: Shift;
    period: number;
    scheduleId: string;
    quantidadeAlunos: string;
    motivo: string;
  } | null>(null);
  const [savingSlot, setSavingSlot] = useState(false);
  const [slotError, setSlotError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [blockData, roomData, scheduleData, historyData] = await Promise.all([
        apiFetch<Bloco[]>("/api/blocos"),
        apiFetch<Sala[]>("/api/salas"),
        apiFetch<{ horarios: RoomOccupancy[] }>(`/api/horarios/publicados?dia=${encodeURIComponent(selectedDay)}`),
        apiFetch<ChangeHistory[]>("/api/sala-alteracoes?limit=20"),
      ]);
      const schedules = scheduleData.horarios || [];
      setBlocos(blockData);
      setSalas(roomData);
      setAllSchedules(schedules);
      setOcupacoes(schedules.filter((item) => item.sala_id));
      setHistorico(historyData);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar salas.");
    } finally {
      setLoading(false);
    }
  }, [selectedDay]);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError("");
  };

  const openNew = () => {
    setForm({ ...emptyForm, bloco_id: blocos[0]?.id ? String(blocos[0].id) : "" });
    setEditingId(null);
    setShowForm(true);
    setError("");
  };

  const edit = (sala: Sala) => {
    setForm({
      bloco_id: String(sala.bloco_id),
      nome: sala.nome,
      andar: sala.andar,
      capacidade: sala.capacidade == null ? "" : String(sala.capacidade),
      tipo: sala.tipo,
      status: sala.status,
      acessivel: sala.acessivel,
      possui_computadores: sala.possui_computadores,
      possui_data_show: sala.possui_data_show,
      possui_internet: sala.possui_internet,
      possui_ar_condicionado: sala.possui_ar_condicionado,
      softwares: sala.softwares.join(", "),
      observacoes: sala.observacoes || "",
    });
    setEditingId(sala.id);
    setShowForm(true);
    setError("");
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch(editingId ? `/api/salas/${editingId}` : "/api/salas", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          bloco_id: Number(form.bloco_id),
          capacidade: form.capacidade === "" ? null : Number(form.capacidade),
          softwares: form.softwares.split(",").map((value) => value.trim()).filter(Boolean),
        }),
      });
      toast.success(editingId ? "Sala atualizada." : "Sala cadastrada.");
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar sala.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (sala: Sala) => {
    if (!window.confirm(`Desativar a sala "${sala.nome}"?`)) return;
    try {
      await apiFetch(`/api/salas/${sala.id}`, { method: "DELETE" });
      toast.success("Sala desativada.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desativar sala.");
    }
  };

  const ocupacoesPorSala = useMemo(() => {
    const map = new Map<number, RoomOccupancy[]>();
    ocupacoes.forEach((item) => {
      if (!item.sala_id) return;
      const items = map.get(item.sala_id) || [];
      items.push(item);
      map.set(item.sala_id, items);
    });
    return map;
  }, [ocupacoes]);

  const salasFiltradas = useMemo(() => {
    const term = search.trim().toLowerCase();
    return salas.filter((sala) => {
      const roomOccupancy = ocupacoesPorSala.get(sala.id) || [];
      const text = `${sala.nome} ${sala.bloco_nome} ${sala.tipo} ${sala.capacidade ?? ""}`.toLowerCase();
      if (term && !text.includes(term)) return false;
      if (filter === "livres" && roomOccupancy.length) return false;
      if (filter === "ocupadas" && !roomOccupancy.length) return false;
      if (filter === "laboratorios" && !sala.tipo.toLowerCase().includes("lab")) return false;
      if (filter === "aulas" && !sala.tipo.toLowerCase().includes("sala")) return false;
      return true;
    });
  }, [filter, ocupacoesPorSala, salas, search]);

  const salasPorBloco = useMemo(() => {
    const map = new Map<string, Sala[]>();
    salasFiltradas.forEach((sala) => {
      const items = map.get(sala.bloco_nome) || [];
      items.push(sala);
      map.set(sala.bloco_nome, items);
    });
    return [...map.entries()];
  }, [salasFiltradas]);

  const salasAtivas = useMemo(() => salas.filter((sala) => sala.status === "ATIVA"), [salas]);
  const targetRoom = transfer ? salas.find((sala) => String(sala.id) === transfer.salaId) || null : null;
  const targetCapacity = targetRoom?.capacidade ?? null;
  const studentCount = transfer?.quantidadeAlunos ? Number(transfer.quantidadeAlunos) : null;
  const capacityWarning = targetRoom && studentCount && targetCapacity !== null && studentCount > targetCapacity;
  const slotCandidates = useMemo(() => {
    if (!slotPicker) return [];
    return allSchedules
      .filter((item) => isSameSlot(item, selectedDay, slotPicker.shift, slotPicker.period))
      .sort(sortOccupancy);
  }, [allSchedules, selectedDay, slotPicker]);
  const selectedSlotSchedule = slotCandidates.find((item) => String(item.id) === slotPicker?.scheduleId) || null;
  const slotStudentCount = slotPicker?.quantidadeAlunos ? Number(slotPicker.quantidadeAlunos) : null;
  const slotCapacityWarning = Boolean(slotPicker && slotStudentCount && slotPicker.sala.capacidade !== null && slotStudentCount > slotPicker.sala.capacidade);

  const openTransfer = (schedule: RoomOccupancy) => {
    setTransfer({
      schedule,
      salaId: schedule.sala_id ? String(schedule.sala_id) : "",
      quantidadeAlunos: "",
      motivo: "",
    });
  };

  const saveTransfer = async () => {
    if (!transfer) return;
    setSavingTransfer(true);
    try {
      await apiFetch(`/api/horarios/publicados/${transfer.schedule.id}/sala`, {
        method: "PATCH",
        body: JSON.stringify({
          sala_id: Number(transfer.salaId),
          quantidade_alunos: transfer.quantidadeAlunos ? Number(transfer.quantidadeAlunos) : null,
          motivo: transfer.motivo,
        }),
      });
      toast.success("Turma transferida neste horário.");
      setTransfer(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao transferir turma.");
    } finally {
      setSavingTransfer(false);
    }
  };

  const openSlotPicker = (sala: Sala, shift: Shift, period: number) => {
    setSlotPicker({ sala, shift, period, scheduleId: "", quantidadeAlunos: "", motivo: "" });
    setSlotError("");
  };

  const saveSlotAssignment = async () => {
    if (!slotPicker || !slotPicker.scheduleId) {
      setSlotError("Selecione uma turma para este período.");
      return;
    }
    setSavingSlot(true);
    setSlotError("");
    try {
      await apiFetch(`/api/horarios/publicados/${slotPicker.scheduleId}/sala`, {
        method: "PATCH",
        body: JSON.stringify({
          sala_id: slotPicker.sala.id,
          quantidade_alunos: slotPicker.quantidadeAlunos ? Number(slotPicker.quantidadeAlunos) : null,
          motivo: slotPicker.motivo,
        }),
      });
      toast.success("Turma definida para o período.");
      setSlotPicker(null);
      await load();
    } catch (err) {
      setSlotError(err instanceof Error ? err.message : "Erro ao definir turma no período.");
    } finally {
      setSavingSlot(false);
    }
  };

  const renderShiftGrid = (sala: Sala, roomOccupancy: RoomOccupancy[], shift: Shift) => (
    <div className="w-full rounded-md border border-slate-300 bg-white text-xs shadow-sm">
      <div className="grid grid-cols-5 border-b border-slate-300 bg-slate-100 font-semibold text-slate-700">
        {sheetPeriods.map((period) => (
          <div key={period} className="border-r border-slate-300 px-2 py-1 text-center last:border-r-0">
            {period}ª
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5">
        {sheetPeriods.map((period) => {
          const items = roomOccupancy.filter((item) => isSameSlot(item, selectedDay, shift, period));
          const candidates = allSchedules.filter((item) => isSameSlot(item, selectedDay, shift, period));
          return (
            <div key={period} className="min-h-20 border-r border-slate-200 p-1.5 last:border-r-0">
              {items.length ? (
                <div className="space-y-1">
                  {items.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant="ghost"
                      onClick={() => openTransfer(item)}
                      title={`${item.dia} · ${item.hora_inicio || `${item.periodo}ª aula`} · ${item.turma} · ${item.disciplina}`}
                      className="h-auto w-full justify-start whitespace-normal rounded border border-blue-200 bg-blue-50 px-1.5 py-1 text-left text-[11px] leading-tight text-blue-950 hover:bg-blue-100"
                    >
                      <ArrowRightLeft className="mr-1 mt-0.5 h-3 w-3 shrink-0" />
                      <span className="min-w-0">
                        <span className="block break-words font-semibold">{item.turma}</span>
                        <span className="block break-words text-[10px] font-normal text-blue-800">{item.hora_inicio || `${item.periodo}ª`}</span>
                      </span>
                    </Button>
                  ))}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!candidates.length}
                  onClick={() => openSlotPicker(sala, shift, period)}
                  className="flex min-h-16 w-full items-center justify-center whitespace-normal rounded border border-dashed border-emerald-200 bg-emerald-50 px-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-100"
                >
                  {candidates.length ? "+ Turma" : "Sem aula"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const resourceFields = [
    ["possui_computadores", "Computadores"],
    ["possui_data_show", "Data show"],
    ["possui_internet", "Internet"],
    ["possui_ar_condicionado", "Ar-condicionado"],
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-heading font-bold">Controle de Salas</h2>
          <p className="text-sm text-muted-foreground">Visualize ocupação por bloco e transfira turmas sem conflito de horário.</p>
        </div>
        <Button onClick={openNew} disabled={!blocos.length} className="gap-2">
          <Plus className="w-4 h-4" /> Nova sala
        </Button>
      </div>

      {!blocos.length && !loading && (
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm">
          Cadastre ao menos um bloco antes de criar uma sala.
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="glass-card rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold">{editingId ? "Editar sala" : "Nova sala"}</h3>
            <Button type="button" variant="ghost" size="sm" onClick={reset} className="gap-2">
              <X className="w-4 h-4" /> Cancelar
            </Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Bloco *</label>
              <select
                value={form.bloco_id}
                onChange={(event) => setForm({ ...form, bloco_id: event.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione</option>
                {blocos.map((bloco) => <option key={bloco.id} value={bloco.id}>{bloco.nome}</option>)}
              </select>
            </div>
            <div><label className="text-sm font-medium mb-1 block">Nome *</label><Input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Ex.: C 303" /></div>
            <div><label className="text-sm font-medium mb-1 block">Andar *</label><Input value={form.andar} onChange={(event) => setForm({ ...form, andar: event.target.value })} placeholder="Ex.: 3º andar" /></div>
            <div><label className="text-sm font-medium mb-1 block">Capacidade</label><Input type="number" min={1} value={form.capacidade} onChange={(event) => setForm({ ...form, capacidade: event.target.value })} placeholder="Deixe em branco se ilegível" /></div>
            <div><label className="text-sm font-medium mb-1 block">Tipo *</label><Input value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value })} placeholder="Sala de aula, laboratório..." /></div>
            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as RoomStatus })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="ATIVA">Ativa</option>
                <option value="MANUTENCAO">Manutenção</option>
                <option value="INATIVA">Inativa</option>
              </select>
            </div>
            <div><label className="text-sm font-medium mb-1 block">Softwares instalados</label><Input value={form.softwares} onChange={(event) => setForm({ ...form, softwares: event.target.value })} placeholder="AutoCAD, VS Code, Blender" /></div>
          </div>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={form.acessivel} onCheckedChange={(checked) => setForm({ ...form, acessivel: checked === true })} />
              Acessível
            </label>
            {resourceFields.map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form[field]} onCheckedChange={(checked) => setForm({ ...form, [field]: checked === true })} />
                {label}
              </label>
            ))}
          </div>
          <div><label className="text-sm font-medium mb-1 block">Observações</label><Textarea value={form.observacoes} onChange={(event) => setForm({ ...form, observacoes: event.target.value })} rows={3} /></div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button disabled={saving} className="gap-2"><Save className="w-4 h-4" />{saving ? "Salvando..." : "Salvar sala"}</Button>
        </form>
      )}

      {error && !showForm && <p className="text-sm text-destructive">{error}</p>}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b space-y-4">
          <div>
            <h3 className="font-heading font-bold">Controle de salas</h3>
            <p className="text-xs text-muted-foreground">{salasFiltradas.length} de {salas.length} registros</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar por sala, bloco, tipo ou capacidade" className="pl-9" />
            </div>
            <select value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
              {dayOrder.map((day) => <option key={day} value={day}>{dayLabels[day]}</option>)}
            </select>
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="todas">Todas</option>
              <option value="livres">Livres</option>
              <option value="ocupadas">Ocupadas</option>
              <option value="laboratorios">Laboratórios</option>
              <option value="aulas">Salas de aula</option>
            </select>
          </div>
        </div>

        {loading && <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>}
        {!loading && !salasFiltradas.length && <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma sala encontrada.</div>}
        {!loading && salasPorBloco.map(([bloco, rooms]) => (
          <section key={bloco} className="border-b last:border-b-0">
            <div className="bg-muted/40 px-5 py-3">
              <h4 className="font-heading font-bold">{bloco}</h4>
              <p className="text-xs text-muted-foreground">{rooms.length} sala(s)</p>
            </div>
            <div className="divide-y">
              {rooms.map((sala) => {
                const resources = [sala.acessivel && "Acessível", sala.possui_computadores && "Computadores", sala.possui_data_show && "Data show", sala.possui_internet && "Internet", sala.possui_ar_condicionado && "Ar"].filter(Boolean);
                const roomOccupancy = [...(ocupacoesPorSala.get(sala.id) || [])].sort(sortOccupancy);
                return (
                  <div key={sala.id} className="p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{sala.nome}</p>
                          <Badge className={statusClass[sala.status]}>{statusLabel[sala.status]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{sala.tipo} · {sala.andar} · {sala.capacidade == null ? "Capacidade a conferir" : `${sala.capacidade} lugares`}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{resources.join(", ") || "Sem recursos marcados"}{sala.softwares.length ? ` · ${sala.softwares.join(", ")}` : ""}</p>
                        {sala.observacoes && <p className="mt-1 text-xs text-muted-foreground">{sala.observacoes}</p>}
                      </div>
                      <div className="flex shrink-0 justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => edit(sala)}><Edit className="w-4 h-4" /></Button>
                        {sala.status !== "INATIVA" && <Button variant="ghost" size="icon" onClick={() => remove(sala)} title="Desativar"><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                      </div>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-semibold text-muted-foreground">Manhã</p>
                        {renderShiftGrid(sala, roomOccupancy, "manha")}
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold text-muted-foreground">Tarde</p>
                        {renderShiftGrid(sala, roomOccupancy, "tarde")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b">
          <h3 className="font-heading font-bold flex items-center gap-2"><History className="h-4 w-4" /> Histórico de trocas</h3>
          <p className="text-xs text-muted-foreground">Últimas alterações feitas pelo CPD</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Turma</TableHead><TableHead>Troca</TableHead><TableHead>Responsável</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
            <TableBody>
              {!historico.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Nenhuma troca registrada.</TableCell></TableRow>}
              {historico.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}</TableCell>
                  <TableCell>{item.turma}<br /><span className="text-xs text-muted-foreground">{item.dia} · {item.hora_inicio || `${item.periodo}ª aula`}{item.quantidade_alunos ? ` · ${item.quantidade_alunos} alunos` : ""}</span></TableCell>
                  <TableCell>{item.sala_anterior || "Sem sala"} → {item.sala_nova || "Sem sala"}</TableCell>
                  <TableCell>{item.usuario_nome}</TableCell>
                  <TableCell className="max-w-72 text-sm">{item.motivo || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!transfer} onOpenChange={(open) => { if (!open && !savingTransfer) setTransfer(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Trocar turma de sala</DialogTitle>
            <DialogDescription>Selecione a nova sala e confirme a alteração neste horário específico.</DialogDescription>
          </DialogHeader>
          {transfer && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/40 p-4 text-sm">
                <p><span className="font-medium">Turma:</span> {transfer.schedule.turma}</p>
                <p><span className="font-medium">Horário:</span> {transfer.schedule.dia} · {transfer.schedule.hora_inicio || `${transfer.schedule.periodo}ª aula`}</p>
                <p><span className="font-medium">Disciplina:</span> {transfer.schedule.disciplina}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Nova sala</label>
                <select value={transfer.salaId} onChange={(event) => setTransfer({ ...transfer, salaId: event.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  {salasAtivas.map((sala) => <option key={sala.id} value={sala.id}>{sala.nome} · {sala.bloco_nome} · {sala.capacidade == null ? "capacidade a conferir" : `${sala.capacidade} lugares`}</option>)}
                </select>
                {targetRoom && <p className="mt-1 text-xs text-muted-foreground">{targetRoom.tipo} · {targetRoom.andar}</p>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Quantidade de alunos</label>
                <Input type="number" min={1} value={transfer.quantidadeAlunos} onChange={(event) => setTransfer({ ...transfer, quantidadeAlunos: event.target.value })} placeholder="Opcional para validar capacidade" />
                {capacityWarning && <p className="mt-1 text-xs text-destructive">A sala comporta {targetCapacity} alunos.</p>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Motivo</label>
                <Textarea value={transfer.motivo} onChange={(event) => setTransfer({ ...transfer, motivo: event.target.value })} rows={3} placeholder="Opcional" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTransfer(null)} disabled={savingTransfer}>Cancelar</Button>
            <Button type="button" onClick={saveTransfer} disabled={savingTransfer || !!capacityWarning}>{savingTransfer ? "Salvando..." : "Confirmar troca"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!slotPicker} onOpenChange={(open) => { if (!open && !savingSlot) setSlotPicker(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Escolher turma do período</DialogTitle>
            <DialogDescription>Esta escolha altera a sala da turma neste horário específico.</DialogDescription>
          </DialogHeader>
          {slotPicker && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/40 p-4 text-sm">
                <p><span className="font-medium">Sala:</span> {slotPicker.sala.nome}</p>
                <p><span className="font-medium">Horário:</span> {dayLabels[selectedDay]} · {slotPicker.shift === "manha" ? "Manhã" : "Tarde"} · {slotPicker.period}ª período</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Turma</label>
                <select
                  value={slotPicker.scheduleId}
                  onChange={(event) => setSlotPicker({ ...slotPicker, scheduleId: event.target.value })}
                  disabled={!slotCandidates.length}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Selecione a turma</option>
                  {slotCandidates.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.turma} · {schedule.disciplina} · {schedule.hora_inicio || `${schedule.periodo}ª`}{schedule.sala ? ` · atual: ${schedule.sala}` : " · sem sala"}
                    </option>
                  ))}
                </select>
                {!slotCandidates.length && <p className="mt-1 text-xs text-muted-foreground">Nenhuma aula publicada para este dia e período.</p>}
                {selectedSlotSchedule?.sala_id && selectedSlotSchedule.sala_id !== slotPicker.sala.id && (
                  <p className="mt-1 text-xs text-muted-foreground">A turma sairá de {selectedSlotSchedule.sala || "outra sala"} e irá para {slotPicker.sala.nome}.</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Quantidade de alunos</label>
                <Input type="number" min={1} value={slotPicker.quantidadeAlunos} onChange={(event) => setSlotPicker({ ...slotPicker, quantidadeAlunos: event.target.value })} placeholder="Opcional para validar capacidade" />
                {slotCapacityWarning && <p className="mt-1 text-xs text-destructive">A sala comporta {slotPicker.sala.capacidade} alunos.</p>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Motivo</label>
                <Textarea value={slotPicker.motivo} onChange={(event) => setSlotPicker({ ...slotPicker, motivo: event.target.value })} rows={3} placeholder="Opcional" />
              </div>
              {slotError && <p className="text-sm text-destructive">{slotError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSlotPicker(null)} disabled={savingSlot}>Cancelar</Button>
            <Button type="button" onClick={saveSlotAssignment} disabled={savingSlot || !!slotCapacityWarning || !slotCandidates.length}>{savingSlot ? "Salvando..." : "Salvar turma"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
