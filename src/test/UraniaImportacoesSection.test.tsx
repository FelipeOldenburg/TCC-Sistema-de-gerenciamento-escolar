import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import UraniaImportacoesSection from "@/components/admin/UraniaImportacoesSection";

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;

describe("UraniaImportacoesSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("carrega e mostra todos os registros da amostra geral, sem o limite de 200", async () => {
    const horarios = Array.from({ length: 205 }, (_, index) => ({
      id: index + 1,
      categoria: "TURMA",
      turma: "1A",
      curso: "Informática",
      ano: "1",
      dia: "SEG",
      periodo: index + 1,
      hora_inicio: "07:30",
      disciplina: `Disciplina ${index + 1}`,
      professor: "Ana",
      ambiente: null,
      sala_id: null,
      sala_nome: null,
      bloco_nome: null,
    }));
    const imported = {
      id: 7,
      fonte: "HTML",
      titulo: "Horários manhã",
      status: "PENDENTE",
      ativa: false,
      total_arquivos: 1,
      total_horarios: horarios.length,
      total_turmas: 1,
      avisos: [],
      observacoes_envio: null,
      motivo_rejeicao: null,
      created_at: "2026-09-24T12:00:00.000Z",
      revisado_em: null,
      publicado_em: null,
      enviado_por_nome: "Admin",
      revisado_por_nome: null,
      nome_turno: null,
      turmas: [{ turma: "1A", curso: "Informática", ano: "1", categoria: "TURMA" }],
      horarios,
      arquivos: [],
      comparacao: null,
      paginacao: { pagina: 1, por_pagina: horarios.length, total: horarios.length },
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/importacoes?page_size=100")) return ok([imported]);
      if (url.endsWith("/api/importacoes/7?todos=1")) return ok(imported);
      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<UraniaImportacoesSection user={{ id: 1, instituicao_id: 1, instituicao_slug: "cimol", nome: "CPD", usuario: "cpd", papel: "CPD", gerencia_instituicoes: false }} />);
    fireEvent.click(await screen.findByRole("button", { name: /Visualizar/ }));

    expect(await screen.findByText("Disciplina 205")).toBeInTheDocument();
    expect(screen.getByText("Mostrando todos os 205 horários desta importação.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/importacoes/7?todos=1", expect.any(Object));
  }, 10000);
});
