import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiFetch: apiFetchMock, INSTITUTION_DOMAIN: "horariodaescola.com.br" }));

import InstitutionDirectory from "@/components/InstitutionDirectory";

afterEach(() => vi.clearAllMocks());

describe("InstitutionDirectory", () => {
  it("lista instituições com links para selecionar cada slug", async () => {
    apiFetchMock.mockResolvedValue([{ slug: "escola-nova", nome_sistema: "Escola Nova" }]);
    render(<InstitutionDirectory />);

    const link = await screen.findByRole("link", { name: /Escola Nova/ });
    expect(link).toHaveAttribute("href", "/?instituicao=escola-nova");
  });
});
