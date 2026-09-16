import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import IntervalosAdminSection from "@/components/admin/IntervalosAdminSection";

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;

describe("IntervalosAdminSection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("cria, edita e desativa um intervalo", async () => {
    const requests: { url: string; method: string; body?: Record<string, unknown> }[] = [];
    let interval: Record<string, unknown> | null = null;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || "GET";
      if (url.endsWith("/api/grupos-academicos")) {
        return ok([{ id: 7, tipo: "TURMA", nome: "T1", ativo: true }]);
      }
      if (url.includes("/api/intervalos") && method === "GET") return ok(interval ? [interval] : []);

      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ url, method, body });
      if (method === "POST") {
        interval = { id: 9, ...body, grupos: [{ id: 7, tipo: "TURMA", nome: "T1" }] };
        return ok({ id: 9 });
      }
      if (method === "PUT") {
        interval = { ...interval, ...body };
        return ok({ id: 9 });
      }
      if (method === "DELETE") {
        interval = { ...interval, ativo: false };
        return ok({ ok: true });
      }
      throw new Error(`Requisição inesperada: ${method} ${url}`);
    }));

    render(<IntervalosAdminSection />);
    const newButton = await screen.findByRole("button", { name: "Novo intervalo" });
    await waitFor(() => expect(newButton).toBeEnabled());
    fireEvent.click(newButton);

    let dialog = await screen.findByRole("dialog", { name: "Novo intervalo" });
    fireEvent.change(within(dialog).getByLabelText("Nome"), { target: { value: "Recreio UI" } });
    fireEvent.change(within(dialog).getByLabelText("Início"), { target: { value: "09:30" } });
    fireEvent.change(within(dialog).getByLabelText("Fim"), { target: { value: "09:45" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Turma T1" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Recreio UI")).toBeInTheDocument();
    expect(requests[0]).toMatchObject({ method: "POST", body: { nome: "Recreio UI", hora_inicio: "09:30", hora_fim: "09:45", grupo_ids: [7] } });

    fireEvent.click(screen.getByRole("button", { name: "Editar Recreio UI" }));
    dialog = await screen.findByRole("dialog", { name: "Editar intervalo" });
    fireEvent.change(within(dialog).getByLabelText("Fim"), { target: { value: "09:50" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(requests.some((request) => request.method === "PUT" && request.body?.hora_fim === "09:50")).toBe(true));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Desativar Recreio UI" }));
    await waitFor(() => expect(requests.some((request) => request.method === "DELETE")).toBe(true));
    expect(screen.getByText("Inativo")).toBeInTheDocument();
  });
});
