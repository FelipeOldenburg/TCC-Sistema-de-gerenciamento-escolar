import { describe, expect, it } from "vitest";
import { buildScheduleNotificationText } from "../../server/services/scheduleNotificationService.js";

describe("notificações de horários", () => {
  it("resume a alteração com os valores anterior e novo", () => {
    const text = buildScheduleNotificationText({
      turma: "3A",
      payload: {
        alteradas: [{
          antes: { dia: "SEG", horario: "08:00", disciplina: "Matemática", sala: "Sala 12" },
          depois: { dia: "SEG", horario: "08:00", disciplina: "Matemática", sala: "Sala 18" },
          sala_alterada: true,
          horario_alterado: false,
          disciplina_alterada: false,
          professor_alterado: false,
        }],
        adicionadas: [],
        removidas: [],
      },
    });

    expect(text).toContain("turma 3A");
    expect(text).toContain("sala: Sala 12 → Sala 18");
  });
});
