#!/usr/bin/env python3
"""Normaliza arquivos HTML/XML do URÂNIA UP para o contrato da API CIMOL."""

from __future__ import annotations

import base64
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
from typing import Any

from bs4 import BeautifulSoup


COURSES = {
    "ELO": "Eletrônica",
    "ELE": "Eletrotécnica",
    "ELETRO": "Eletrotécnica",
    "MEC": "Mecânica",
    "DES": "Design de Móveis",
    "MOV": "Móveis",
    "INFO": "Informática",
    "QUI": "Química",
    "MAB": "Meio Ambiente",
}

DAY_CODES = {
    "SEG": "SEG",
    "TER": "TER",
    "QUA": "QUA",
    "QUI": "QUI",
    "SEX": "SEX",
    "SAB": "SAB",
    "DOM": "DOM",
}


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def classify_header(header: str) -> str:
    if re.match(r"^coord\b", header, re.IGNORECASE):
        return "COORDENACAO"
    if re.match(r"^reun", header, re.IGNORECASE):
        return "REUNIAO"
    return "TURMA"


def class_metadata(label: str) -> tuple[str | None, str | None]:
    prefix_match = re.match(r"^([A-Za-zÀ-ÿ]+)", label)
    prefix = prefix_match.group(1).upper() if prefix_match else ""
    course = COURSES.get(prefix)
    code_match = re.search(r"(\d{2})", label)
    year = code_match.group(1)[1] if code_match else None
    return course, year


def split_lesson(value: str) -> tuple[str, str | None]:
    """Divide Disciplina (Professor), respeitando apelidos com parênteses internos."""
    if not value.endswith(")"):
        return value, None

    depth = 0
    for index in range(len(value) - 1, -1, -1):
        character = value[index]
        if character == ")":
            depth += 1
        elif character == "(":
            depth -= 1
            if depth == 0:
                subject = clean_text(value[:index])
                teacher = clean_text(value[index + 1 : -1])
                return subject or value, teacher or None
    return value, None


def normalize_day(value: str) -> str:
    key = clean_text(value).upper()[:3]
    return DAY_CODES.get(key, key)


def parse_html(file: dict[str, Any], content: bytes) -> dict[str, Any]:
    meta_match = re.search(br"charset\s*=\s*['\"]?([A-Za-z0-9._-]+)", content[:4096], re.IGNORECASE)
    encoding = meta_match.group(1).decode("ascii", "ignore") if meta_match else "iso-8859-1"
    soup = BeautifulSoup(content, "html.parser", from_encoding=encoding)
    table = soup.find("table")
    if table is None:
        raise ValueError(f"{file['name']}: nenhuma tabela de horários encontrada.")

    rows = table.find_all("tr")
    if len(rows) < 2:
        raise ValueError(f"{file['name']}: tabela sem linhas de horários.")

    header_cells = rows[0].find_all(["td", "th"])
    if len(header_cells) < 3:
        raise ValueError(f"{file['name']}: cabeçalho de turmas inválido.")

    headers = [clean_text(cell.get_text(" ", strip=True)) for cell in header_cells[2:]]
    schedules: list[dict[str, Any]] = []
    warnings: list[str] = []
    current_day: str | None = None
    period = 0

    for row_number, row in enumerate(rows[1:], start=2):
        cells = row.find_all(["td", "th"])
        if not cells:
            continue

        has_day = cells[0].has_attr("rowspan")
        if has_day:
            current_day = normalize_day(cells[0].get_text(" ", strip=True))
            period = 1
            time_index = 1
            lesson_start = 2
        else:
            if current_day is None:
                warnings.append(f"Linha {row_number} ignorada: dia da semana não identificado.")
                continue
            period += 1
            time_index = 0
            lesson_start = 1

        start_time = clean_text(cells[time_index].get_text(" ", strip=True)) or None
        lesson_cells = cells[lesson_start:]
        if len(lesson_cells) != len(headers):
            warnings.append(
                f"Linha {row_number}: {len(lesson_cells)} células para {len(headers)} colunas; valores ausentes foram ignorados."
            )

        for index, cell in enumerate(lesson_cells[: len(headers)]):
            value = clean_text(cell.get_text(" ", strip=True))
            if not value or value == "-":
                continue

            header = headers[index]
            subject, teacher = split_lesson(value)
            if teacher is None:
                warnings.append(f"Célula não reconhecida em {header}, {current_day}, período {period}: {value}")
            course, year = class_metadata(header)
            schedules.append(
                {
                    "categoria": classify_header(header),
                    "turma": header,
                    "curso": course,
                    "ano": year,
                    "dia": current_day,
                    "periodo": period,
                    "hora_inicio": start_time,
                    "disciplina": subject,
                    "professor": teacher,
                    "ambiente": None,
                    "tipo_turma": None,
                    "tipo_disciplina": None,
                    "valor_original": value,
                    "escopo": "HTML:TURMAS_GERAL",
                }
            )

    administrative = [header for header in headers if classify_header(header) != "TURMA"]
    if administrative:
        warnings.append(
            f"{len(administrative)} colunas administrativas foram preservadas e não serão exibidas como turmas: "
            + ", ".join(administrative)
        )
    warnings.append("O relatório HTML não informa ambientes/salas; esses vínculos permanecerão vazios.")

    return {
        "format": "HTML",
        "title": clean_text(soup.title.string if soup.title and soup.title.string else "Turmas Geral"),
        "scope": "HTML:TURMAS_GERAL",
        "school_code": None,
        "shift_code": None,
        "shift_name": None,
        "schedules": schedules,
        "warnings": warnings,
        "headers": headers,
        "encoding": encoding,
    }


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].upper()


def child_text(element: ET.Element, name: str) -> str | None:
    expected = name.upper()
    for child in list(element):
        if local_name(child.tag) == expected:
            value = clean_text(child.text)
            return value or None
    return None


def section_records(root: ET.Element, section_name: str) -> list[ET.Element]:
    expected = section_name.upper()
    for element in root.iter():
        if local_name(element.tag) == expected:
            return [child for child in list(element) if local_name(child.tag) == "REGISTRO"]
    return []


def parse_xml_root(file: dict[str, Any], content: bytes) -> ET.Element:
    try:
        return ET.fromstring(content)
    except ET.ParseError as error:
        raise ValueError(f"{file['name']}: XML inválido ({error}).") from error


def collect_export_maps(roots: list[tuple[dict[str, Any], ET.Element]]) -> dict[str, dict[str, str]]:
    maps = {"disciplines": {}, "teachers": {}, "classes": {}}
    for _, root in roots:
        if local_name(root.tag) != "EXPORT_URANIA_INSERT":
            continue
        for record in section_records(root, "DISCIPLINAS"):
            code = child_text(record, "CODIGO")
            name = child_text(record, "NOME") or child_text(record, "ABREVIATURA")
            if code and name:
                maps["disciplines"][code] = name
        for record in section_records(root, "PROFESSORES"):
            code = child_text(record, "CODIGO")
            name = child_text(record, "NOME") or child_text(record, "ABREVIATURA")
            if code and name:
                maps["teachers"][code] = name
        for record in section_records(root, "TURMAS"):
            code = child_text(record, "CODIGO")
            name = child_text(record, "ABREVIATURA") or child_text(record, "NOME")
            if code and name:
                maps["classes"][code] = name
    return maps


def parse_import_xml(
    file: dict[str, Any], root: ET.Element, maps: dict[str, dict[str, str]]
) -> dict[str, Any]:
    school_code = next((clean_text(el.text) for el in root.iter() if local_name(el.tag) == "CODESCOLA"), None)
    shift_code = next((clean_text(el.text) for el in root.iter() if local_name(el.tag) == "CODTURNO"), None)
    shift_name = next((clean_text(el.text) for el in root.iter() if local_name(el.tag) == "NOMETURNO"), None)
    scope = f"XML:{school_code or 'SEM_ESCOLA'}:{shift_code or 'GERAL'}"
    schedules: list[dict[str, Any]] = []
    warnings: list[str] = []
    missing_classes: set[str] = set()
    missing_teachers: set[str] = set()
    missing_disciplines: set[str] = set()

    for record in section_records(root, "HORARIO"):
        class_code = child_text(record, "CODTURMA") or "SEM_TURMA"
        teacher_code = child_text(record, "CODPROF")
        discipline_code = child_text(record, "CODDISC") or "SEM_DISCIPLINA"
        class_name = maps["classes"].get(class_code, class_code)
        teacher = maps["teachers"].get(teacher_code, teacher_code) if teacher_code else None
        discipline = maps["disciplines"].get(discipline_code, discipline_code)
        if class_code not in maps["classes"]:
            missing_classes.add(class_code)
        if teacher_code and teacher_code not in maps["teachers"]:
            missing_teachers.add(teacher_code)
        if discipline_code not in maps["disciplines"]:
            missing_disciplines.add(discipline_code)
        course, year = class_metadata(class_name)
        period_text = child_text(record, "HOR") or "0"
        try:
            period = int(period_text)
        except ValueError:
            period = 0
        schedules.append(
            {
                "categoria": "TURMA",
                "turma": class_name,
                "curso": course,
                "ano": year,
                "dia": normalize_day(child_text(record, "DIA") or ""),
                "periodo": period,
                "hora_inicio": None,
                "disciplina": discipline,
                "professor": teacher,
                "ambiente": child_text(record, "AMBIENTE"),
                "tipo_turma": child_text(record, "TIPOTURMA"),
                "tipo_disciplina": child_text(record, "TIPODISC"),
                "valor_original": f"{discipline_code} ({teacher_code or 'sem professor'})",
                "escopo": scope,
            }
        )

    if missing_classes:
        warnings.append("Turmas sem nome no URANEXP.XML: " + ", ".join(sorted(missing_classes)))
    if missing_teachers:
        warnings.append("Professores sem nome no URANEXP.XML: " + ", ".join(sorted(missing_teachers)))
    if missing_disciplines:
        warnings.append("Disciplinas sem nome no URANEXP.XML: " + ", ".join(sorted(missing_disciplines)))

    return {
        "format": "XML",
        "title": f"Horários {shift_name or shift_code or 'URÂNIA'}",
        "scope": scope,
        "school_code": school_code,
        "shift_code": shift_code,
        "shift_name": shift_name,
        "schedules": schedules,
        "warnings": warnings,
        "headers": sorted({schedule["turma"] for schedule in schedules}),
        "encoding": "XML",
    }


def parse_payload(payload: dict[str, Any]) -> dict[str, Any]:
    files = payload.get("files") or []
    if not files:
        raise ValueError("Nenhum arquivo recebido.")

    decoded: list[tuple[dict[str, Any], bytes]] = []
    xml_roots: list[tuple[dict[str, Any], ET.Element]] = []
    for file in files:
        content = base64.b64decode(file.get("content_base64") or "", validate=True)
        decoded.append((file, content))
        if file["name"].lower().endswith(".xml"):
            xml_roots.append((file, parse_xml_root(file, content)))

    export_maps = collect_export_maps(xml_roots)
    parsed_files: list[dict[str, Any]] = []
    for file, content in decoded:
        lower_name = file["name"].lower()
        if lower_name.endswith((".html", ".htm")):
            parsed_files.append(parse_html(file, content))
        elif lower_name.endswith(".xml"):
            root = next(root for source, root in xml_roots if source is file)
            if local_name(root.tag) == "IMPORT_URANIA":
                parsed_files.append(parse_import_xml(file, root, export_maps))
        else:
            raise ValueError(f"{file['name']}: extensão não suportada.")

    schedules: list[dict[str, Any]] = []
    warnings: list[str] = []
    seen: set[tuple[Any, ...]] = set()
    for parsed in parsed_files:
        warnings.extend(f"{parsed['title']}: {warning}" for warning in parsed["warnings"])
        for schedule in parsed["schedules"]:
            key = (
                schedule["escopo"],
                schedule["categoria"],
                schedule["turma"],
                schedule["dia"],
                schedule["periodo"],
                schedule["disciplina"],
                schedule.get("professor"),
                schedule.get("ambiente"),
            )
            if key not in seen:
                seen.add(key)
                schedules.append(schedule)

    if not schedules:
        raise ValueError("Os arquivos não contêm horários importáveis.")

    formats = {parsed["format"] for parsed in parsed_files}
    scopes = sorted({schedule["escopo"] for schedule in schedules})
    school_codes = {parsed["school_code"] for parsed in parsed_files if parsed["school_code"]}
    shift_codes = {parsed["shift_code"] for parsed in parsed_files if parsed["shift_code"]}
    shift_names = {parsed["shift_name"] for parsed in parsed_files if parsed["shift_name"]}
    source_hash = hashlib.sha256(b"".join(content for _, content in decoded)).hexdigest()

    return {
        "fonte": next(iter(formats)) if len(formats) == 1 else "MISTO",
        "titulo": " + ".join(dict.fromkeys(parsed["title"] for parsed in parsed_files)),
        "escopo_chave": "+".join(scopes),
        "codigo_escola": next(iter(school_codes)) if len(school_codes) == 1 else None,
        "codigo_turno": next(iter(shift_codes)) if len(shift_codes) == 1 else None,
        "nome_turno": next(iter(shift_names)) if len(shift_names) == 1 else None,
        "lote_hash": source_hash,
        "avisos": list(dict.fromkeys(warnings)),
        "horarios": schedules,
        "total_turmas": len({s["turma"] for s in schedules if s["categoria"] == "TURMA"}),
    }


def main() -> None:
    try:
        payload = json.load(sys.stdin)
        print(json.dumps(parse_payload(payload), ensure_ascii=False))
    except Exception as error:  # noqa: BLE001 - contrato CLI precisa devolver erro serializado
        print(json.dumps({"error": str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
