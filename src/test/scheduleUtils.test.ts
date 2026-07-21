import { describe, expect, it } from "vitest";
import { buildScheduleComparison, floorNumberFromRoom, isFirstFloorRoom, isUpperFloorRoom } from "../../server/scheduleUtils.js";

describe("scheduleUtils", () => {
  it("identifica salas de primeiro andar e andares superiores", () => {
    expect(floorNumberFromRoom({ nome: "C303", andar: "3º andar" })).toBe(3);
    expect(isUpperFloorRoom({ nome: "C303", andar: "3º andar" })).toBe(true);
    expect(isFirstFloorRoom({ nome: "B101", andar: "1º andar" })).toBe(true);
  });

  it("compara a importacao pendente com a publicacao ativa", () => {
    const active = [
      { categoria: "TURMA", turma: "62-1", dia: "SEG", periodo: 1, hora_inicio: "07:30", disciplina: "Matematica", professor: "Ana", sala_nome: "C303" },
      { categoria: "TURMA", turma: "62-1", dia: "TER", periodo: 1, hora_inicio: "07:30", disciplina: "Fisica", professor: "Beto", sala_nome: "A201" },
    ];
    const candidate = [
      { categoria: "TURMA", turma: "62-1", dia: "SEG", periodo: 1, hora_inicio: "07:30", disciplina: "Matematica", professor: "Carla", sala_nome: "B101" },
      { categoria: "TURMA", turma: "62-1", dia: "QUA", periodo: 1, hora_inicio: "07:30", disciplina: "Quimica", professor: "Dani", sala_nome: "B102" },
    ];

    const comparison = buildScheduleComparison(candidate, active, { id: 1, titulo: "Atual", publicado_em: null });

    expect(comparison.aulas_mudaram).toBe(3);
    expect(comparison.aulas_adicionadas).toBe(1);
    expect(comparison.aulas_removidas).toBe(1);
    expect(comparison.aulas_alteradas).toBe(1);
    expect(comparison.salas_alteradas).toBe(1);
    expect(comparison.professores_alterados).toBe(1);
  });
});
