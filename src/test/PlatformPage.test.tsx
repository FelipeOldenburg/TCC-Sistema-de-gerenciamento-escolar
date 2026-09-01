import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PlatformPage from "@/pages/PlatformPage";
import { apiFetch } from "@/lib/api";

vi.mock("@/components/admin/InstituicoesSection", () => ({ default: () => <div /> }));
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

describe("PlatformPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("corrige o titulo ao abrir a gestao da plataforma", async () => {
    document.title = "Escola Teste";
    vi.mocked(apiFetch).mockRejectedValue(new Error("sem sessao"));

    render(<PlatformPage />);

    await waitFor(() => expect(document.title).toBe("Gestão da plataforma"));
  });
});
