import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginForm from "@/components/LoginForm";

describe("LoginForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("copia usuario e senha separadamente", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<LoginForm />, { wrapper: MemoryRouter });

    fireEvent.click(screen.getByRole("button", { name: "Copiar usuario admin" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("admin"));

    fireEvent.click(screen.getByRole("button", { name: "Copiar senha de cpd" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("cpd123"));
  });
});
