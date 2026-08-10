import { describe, expect, it } from "vitest";

import eventoFeira from "@/assets/evento-feira.jpg";
import eventoPingpong from "@/assets/evento-pingpong.jpg";
import { getEventoImage } from "@/lib/eventoImages";

describe("getEventoImage", () => {
  it("usa imagem neutra quando o evento nao tem imagem propria", () => {
    expect(
      getEventoImage({
        titulo: "Semana academica",
        descricao: "Mostra de projetos dos cursos",
        local: "Auditorio",
        imagem_url: null,
      })
    ).toBe(eventoFeira);
  });

  it("usa ping-pong apenas para evento esportivo", () => {
    expect(
      getEventoImage({
        titulo: "Torneio de tenis de mesa",
        descricao: null,
        local: null,
        imagem_url: null,
      })
    ).toBe(eventoPingpong);
  });

  it("mantem a URL cadastrada quando existir", () => {
    expect(
      getEventoImage({
        titulo: "Evento",
        descricao: null,
        local: null,
        imagem_url: "https://example.com/evento.jpg",
      })
    ).toBe("https://example.com/evento.jpg");
  });
});
