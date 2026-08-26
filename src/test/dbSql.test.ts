import { describe, expect, it } from "vitest";
import { toPostgresQuery } from "../../server/db.js";

describe("toPostgresQuery", () => {
  it("converte placeholders interrogacao para parametros postgres", () => {
    expect(toPostgresQuery("SELECT * FROM salas WHERE bloco_id = ? AND nome ILIKE ?", [1, "%lab%"])).toEqual({
      text: "SELECT * FROM salas WHERE bloco_id = $1 AND nome ILIKE $2",
      values: [1, "%lab%"],
    });
  });
});
