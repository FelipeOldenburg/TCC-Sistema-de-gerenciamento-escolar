import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("proxy da API", () => {
  it("preserva a origem pública ao encaminhar requisições autenticadas", () => {
    const apiProxy = JSON.parse(execFileSync(process.execPath, [
      "--input-type=module",
      "-e",
      'import { loadConfigFromFile } from "vite";'
        + 'const loaded = await loadConfigFromFile({ command: "serve", mode: "test" }, "vite.config.ts");'
        + 'process.stdout.write(JSON.stringify(loaded?.config.server?.proxy?.["/api"]));',
    ], { cwd: process.cwd(), encoding: "utf8" }));

    expect(apiProxy).toMatchObject({ changeOrigin: false });
  });
});
