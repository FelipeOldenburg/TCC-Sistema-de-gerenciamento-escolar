import { describe, expect, it } from "vitest";

import { parseUraniaFiles } from "../../server/uraniaParser.js";

describe("parseUraniaFiles", () => {
  it("interpreta HTML latin1 do URANIA sem depender de Python", async () => {
    const html = `<HTML><HEAD><Title>Turmas Geral</Title>
      <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1" /></HEAD>
      <BODY><TABLE BORDER=1>
      <TR><TD></TD><TD></TD><TD>INFO&nbsp;63&nbsp;1</TD><TD>Coord&nbsp;INFO</TD></TR>
      <TR><TD rowspan=2>Seg</TD><TD>07:30</TD>
      <TD>Prática&nbsp;(Cleber&nbsp;Lino&nbsp;(LINO))</TD><TD>Reunião&nbsp;(Cândido)</TD></TR>
      <TR><TD>08:20</TD><TD>-</TD><TD>-</TD></TR>
      </TABLE></BODY></HTML>`;

    const result = await parseUraniaFiles([
      {
        originalname: "Turm_Geral.html",
        mimetype: "text/html",
        buffer: Buffer.from(html, "latin1"),
      },
    ]);

    expect(result.fonte).toBe("HTML");
    expect(result.total_turmas).toBe(1);
    expect(result.horarios).toHaveLength(2);
    expect(result.horarios[0]).toMatchObject({
      turma: "INFO 63 1",
      curso: "Informática",
      ano: "3",
      professor: "Cleber Lino (LINO)",
    });
    expect(result.horarios[1]).toMatchObject({
      categoria: "COORDENACAO",
      professor: "Cândido",
    });
  });
});
