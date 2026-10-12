import { describe, expect, it } from "vitest";
import { pathPieces, snapAreaBounds } from "@/lib/mapSnap";

const box = (x: number, y: number, width = 20, height = 20) => ({ x, y, width, height });
const options = { tolerance: 4, handle: "move" as const, allowOverlap: false };

describe("encaixe de áreas do mapa", () => {
  it("separa o L do Bloco C sem preencher o pátio vazio", () => {
    const pieces = pathPieces("M 0 0 L 100 0 L 100 20 L 20 20 L 20 100 L 0 100 Z", {});
    expect(pieces).toEqual([box(0, 0, 100, 20), box(0, 20, 20, 80)]);
    expect(pathPieces("M 10 10 h 20 v 30 h -20 Z", { ajuste_x: 5, escala_y: 2 }))
      .toEqual([box(15, 20, 20, 60)]);
    expect(pathPieces("M 0 0 C 10 0 10 10 20 10 Z", {})).toBeNull();
  });

  it("impede que B atravesse as partes reais de C sem bloquear o vazio do L", () => {
    const c = { ...box(0, 0, 100, 100), pieces: pathPieces("M 0 0 L 100 0 L 100 20 L 20 20 L 20 100 L 0 100 Z", {})! };
    const b = box(20, 60, 60, 20);
    expect(snapAreaBounds(box(20, 40, 60, 20), [c], { ...options, previous: b })).toEqual(box(20, 40, 60, 20));
    expect(snapAreaBounds(box(20, 10, 60, 20), [c], { ...options, previous: b })).toEqual(box(20, 20, 60, 20));
    expect(snapAreaBounds(box(10, 60, 60, 20), [c], { ...options, previous: b })).toEqual(b);
    expect(snapAreaBounds(box(20, 10, 60, 20), [c], { ...options, previous: b, allowOverlap: true }))
      .toEqual(box(20, 10, 60, 20));
    expect(snapAreaBounds(box(0, 50, 100, 100), [b], { ...options, previous: c }))
      .toEqual(box(0, 40, 100, 100));
    expect(snapAreaBounds(box(0, 0, 150, 100), [box(25, 60, 60, 20)], {
      ...options, handle: "se", previous: c,
    })).toEqual(box(0, 0, 125, 100));
    expect(snapAreaBounds(box(80, 0, 20, 100), [box(40, 60, 10, 20)], {
      ...options, handle: "nw", previous: c,
    })).toEqual(box(25, 0, 75, 100));
  });

  it("gruda bordas próximas e alinha áreas da mesma faixa", () => {
    expect(snapAreaBounds(box(27, 10), [box(10, 10, 20)], { ...options, previous: box(40, 10) }))
      .toEqual(box(30, 10));
    expect(snapAreaBounds(box(12, 11), [box(10, 10)], { ...options, allowOverlap: true }))
      .toEqual(box(10, 10));
  });

  it("não atrai uma área distante no eixo perpendicular", () => {
    expect(snapAreaBounds(box(27, 60), [box(10, 10)], options)).toEqual(box(27, 60));
  });

  it("impede atravessar uma área sólida ao mover, sem teleportar para o outro lado", () => {
    expect(snapAreaBounds(box(40, 10), [box(30, 10)], { ...options, previous: box(0, 10) }))
      .toEqual(box(10, 10));
    expect(snapAreaBounds(box(60, 10), [box(30, 10)], { ...options, previous: box(0, 10) }))
      .toEqual(box(10, 10));
    expect([box(10, 60), box(60, 10)])
      .toContainEqual(snapAreaBounds(box(60, 60), [box(30, 30)], { ...options, previous: box(0, 0) }));
  });

  it("mantém as sobreposições preexistentes editáveis", () => {
    expect(snapAreaBounds(box(12, 10), [box(10, 10, 50)], { ...options, previous: box(11, 10) }))
      .toEqual(box(12, 10));
  });

  it("permite sobrepor quando a opção está ativa ou quando o peer é só guia", () => {
    const candidate = box(35, 10);
    const peer = box(30, 10);
    expect(snapAreaBounds(candidate, [peer], { ...options, allowOverlap: true })).toEqual(candidate);
    expect(snapAreaBounds(candidate, [peer], { ...options, blockers: [] })).toEqual(candidate);
  });

  it("encaixa a alça de tamanho sem mover a borda oposta", () => {
    const candidate = box(10, 10, 18);
    const peer = box(30, 10);
    expect(snapAreaBounds(candidate, [peer], { ...options, handle: "se", previous: box(10, 10, 15) }))
      .toEqual(box(10, 10, 20));
  });

  it("bloqueia expansão sobre outro bloco sem inverter ou reduzir além do mínimo", () => {
    const candidate = box(10, 10, 30);
    const peer = box(30, 10);
    expect(snapAreaBounds(candidate, [peer], { ...options, handle: "se", previous: box(10, 10, 15), minimum: { width: 5, height: 5 } }))
      .toEqual(box(10, 10, 20));
  });

  it("não encaixa a alça além da escala máxima", () => {
    expect(snapAreaBounds(box(10, 10, 18), [box(30, 10)], {
      ...options, handle: "se", maximum: { width: 19, height: 20 },
    })).toEqual(box(10, 10, 18));
  });
});
