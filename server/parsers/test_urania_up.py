import base64
import unittest

from urania_up import parse_payload


class UraniaParserTests(unittest.TestCase):
    def test_html_latin1_and_nested_teacher_parentheses(self):
        html = """<HTML><HEAD><Title>Turmas Geral</Title>
        <meta http-equiv="Content-Type" content="text/html; charset=ISO-8859-1" /></HEAD>
        <BODY><TABLE BORDER=1>
        <TR><TD></TD><TD></TD><TD>INFO&nbsp;63&nbsp;1</TD><TD>Coord&nbsp;INFO</TD></TR>
        <TR><TD rowspan=2>Seg</TD><TD>07:30</TD>
        <TD>Prática&nbsp;(Cleber&nbsp;Lino&nbsp;(LINO))</TD><TD>Reunião&nbsp;(Cândido)</TD></TR>
        <TR><TD>08:20</TD><TD>-</TD><TD>-</TD></TR>
        </TABLE></BODY></HTML>""".encode("iso-8859-1")
        result = parse_payload(
            {
                "files": [
                    {
                        "name": "Turm_Geral.html",
                        "mime_type": "text/html",
                        "content_base64": base64.b64encode(html).decode(),
                    }
                ]
            }
        )

        self.assertEqual(result["fonte"], "HTML")
        self.assertEqual(result["total_turmas"], 1)
        self.assertEqual(len(result["horarios"]), 2)
        lesson = result["horarios"][0]
        self.assertEqual(lesson["turma"], "INFO 63 1")
        self.assertEqual(lesson["curso"], "Informática")
        self.assertEqual(lesson["ano"], "3")
        self.assertEqual(lesson["professor"], "Cleber Lino (LINO)")
        self.assertEqual(result["horarios"][1]["categoria"], "COORDENACAO")
        self.assertIn("Cândido", result["horarios"][1]["professor"])

    def test_official_xml_resolves_codes_and_room(self):
        export_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
        <EXPORT_URANIA_INSERT>
          <DISCIPLINAS><REGISTRO><CODIGO>MAT</CODIGO><NOME>Matematica</NOME></REGISTRO></DISCIPLINAS>
          <TURMAS><REGISTRO><CODIGO>T63</CODIGO><ABREVIATURA>INFO 63 1</ABREVIATURA></REGISTRO></TURMAS>
          <PROFESSORES><REGISTRO><CODIGO>P01</CODIGO><NOME>Maria Silva</NOME></REGISTRO></PROFESSORES>
        </EXPORT_URANIA_INSERT>"""
        import_xml = b"""<?xml version="1.0" encoding="UTF-8"?>
        <IMPORT_URANIA>
          <CODESCOLA>CIMOL</CODESCOLA><CODTURNO>001</CODTURNO><NOMETURNO>Matutino</NOMETURNO>
          <HORARIO><REGISTRO><CODTURMA>T63</CODTURMA><TIPOTURMA>1</TIPOTURMA>
          <AMBIENTE>C 303</AMBIENTE><DIA>SEG</DIA><HOR>01</HOR><CODPROF>P01</CODPROF>
          <CODDISC>MAT</CODDISC><TIPODISC>TIPO 01</TIPODISC></REGISTRO></HORARIO>
        </IMPORT_URANIA>"""
        files = []
        for name, content in [("URANEXP.XML", export_xml), ("IMPORT_URANIA.XML", import_xml)]:
            files.append(
                {
                    "name": name,
                    "mime_type": "application/xml",
                    "content_base64": base64.b64encode(content).decode(),
                }
            )
        result = parse_payload({"files": files})

        self.assertEqual(result["fonte"], "XML")
        self.assertEqual(result["codigo_escola"], "CIMOL")
        self.assertEqual(result["codigo_turno"], "001")
        self.assertEqual(result["escopo_chave"], "XML:CIMOL:001")
        self.assertEqual(result["total_turmas"], 1)
        lesson = result["horarios"][0]
        self.assertEqual(lesson["turma"], "INFO 63 1")
        self.assertEqual(lesson["disciplina"], "Matematica")
        self.assertEqual(lesson["professor"], "Maria Silva")
        self.assertEqual(lesson["ambiente"], "C 303")


if __name__ == "__main__":
    unittest.main()
