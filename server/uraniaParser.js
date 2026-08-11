import crypto from "crypto";

const COURSES = {
  ELO: "Eletrônica",
  ELE: "Eletrotécnica",
  ELETRO: "Eletrotécnica",
  MEC: "Mecânica",
  DES: "Design de Móveis",
  MOV: "Móveis",
  INFO: "Informática",
  QUI: "Química",
  MAB: "Meio Ambiente",
};

const DAY_CODES = {
  SEG: "SEG",
  TER: "TER",
  QUA: "QUA",
  QUI: "QUI",
  SEX: "SEX",
  SAB: "SAB",
  DOM: "DOM",
};

const ENTITIES = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  agrave: "à",
  atilde: "ã",
  otilde: "õ",
  acirc: "â",
  ecirc: "ê",
  ocirc: "ô",
  ccedil: "ç",
};

const decodeEntities = (value) =>
  String(value || "").replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (_, entity) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return ENTITIES[entity.toLowerCase()] || `&${entity};`;
  });

const cleanText = (value) =>
  decodeEntities(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeDay = (value) => {
  const key = cleanText(value).toUpperCase().slice(0, 3);
  return DAY_CODES[key] || key;
};

const classifyHeader = (header) => {
  if (/^coord\b/i.test(header)) return "COORDENACAO";
  if (/^reun/i.test(header)) return "REUNIAO";
  return "TURMA";
};

const classMetadata = (label) => {
  const prefix = label.match(/^([A-Za-zÀ-ÿ]+)/)?.[1]?.toUpperCase() || "";
  const code = label.match(/(\d{2})/)?.[1];
  return { course: COURSES[prefix] || null, year: code ? code[1] : null };
};

const splitLesson = (value) => {
  if (!value.endsWith(")")) return { subject: value, teacher: null };

  let depth = 0;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    if (value[index] === ")") depth += 1;
    if (value[index] === "(") {
      depth -= 1;
      if (depth === 0) {
        return {
          subject: cleanText(value.slice(0, index)) || value,
          teacher: cleanText(value.slice(index + 1, -1)) || null,
        };
      }
    }
  }
  return { subject: value, teacher: null };
};

const textFromBuffer = (content) => {
  const head = content.subarray(0, 4096).toString("ascii");
  const encoding = head.match(/charset\s*=\s*['"]?([A-Za-z0-9._-]+)/i)?.[1] || "iso-8859-1";
  return {
    encoding,
    text: /utf-?8/i.test(encoding) ? content.toString("utf8") : content.toString("latin1"),
  };
};

const firstTagText = (html, tagName, fallback = "") =>
  cleanText(html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"))?.[1] || fallback);

const htmlRows = (fileName, html) => {
  const table = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/i)?.[0];
  if (!table) throw new Error(`${fileName}: nenhuma tabela de horários encontrada.`);
  return table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
};

const htmlCells = (row) =>
  [...row.matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map((match) => ({
    attrs: match[2],
    text: cleanText(match[3]),
    hasRowspan: /\browspan\s*=/i.test(match[2]),
  }));

const parseHtml = (file, content) => {
  const { text: html, encoding } = textFromBuffer(content);
  const rows = htmlRows(file.name, html);
  if (rows.length < 2) throw new Error(`${file.name}: tabela sem linhas de horários.`);

  const headerCells = htmlCells(rows[0]);
  if (headerCells.length < 3) throw new Error(`${file.name}: cabeçalho de turmas inválido.`);

  const headers = headerCells.slice(2).map((cell) => cell.text);
  const schedules = [];
  const warnings = [];
  let currentDay = null;
  let period = 0;

  rows.slice(1).forEach((row, rowIndex) => {
    const cells = htmlCells(row);
    if (!cells.length) return;

    const firstCellDay = normalizeDay(cells[0].text);
    const hasDay = cells[0].hasRowspan || DAY_CODES[firstCellDay];
    let timeIndex = 0;
    let lessonStart = 1;
    if (hasDay) {
      currentDay = firstCellDay;
      period = 1;
      timeIndex = 1;
      lessonStart = 2;
    } else {
      if (!currentDay) {
        warnings.push(`Linha ${rowIndex + 2} ignorada: dia da semana não identificado.`);
        return;
      }
      period += 1;
    }

    const startTime = cleanText(cells[timeIndex]?.text) || null;
    const lessonCells = cells.slice(lessonStart);
    if (lessonCells.length !== headers.length) {
      warnings.push(`Linha ${rowIndex + 2}: ${lessonCells.length} células para ${headers.length} colunas; valores ausentes foram ignorados.`);
    }

    lessonCells.slice(0, headers.length).forEach((cell, index) => {
      const value = cleanText(cell.text);
      if (!value || value === "-") return;

      const header = headers[index];
      const { subject, teacher } = splitLesson(value);
      if (!teacher) warnings.push(`Célula não reconhecida em ${header}, ${currentDay}, período ${period}: ${value}`);
      const { course, year } = classMetadata(header);
      schedules.push({
        categoria: classifyHeader(header),
        turma: header,
        curso: course,
        ano: year,
        dia: currentDay,
        periodo: period,
        hora_inicio: startTime,
        disciplina: subject,
        professor: teacher,
        ambiente: null,
        tipo_turma: null,
        tipo_disciplina: null,
        valor_original: value,
        escopo: "HTML:TURMAS_GERAL",
      });
    });
  });

  const administrative = headers.filter((header) => classifyHeader(header) !== "TURMA");
  if (administrative.length) {
    warnings.push(`${administrative.length} colunas administrativas foram preservadas e não serão exibidas como turmas: ${administrative.join(", ")}`);
  }
  warnings.push("O relatório HTML não informa ambientes/salas; esses vínculos permanecerão vazios.");

  return {
    format: "HTML",
    title: firstTagText(html, "title", "Turmas Geral"),
    scope: "HTML:TURMAS_GERAL",
    school_code: null,
    shift_code: null,
    shift_name: null,
    schedules,
    warnings,
    headers,
    encoding,
  };
};

const localName = (tag) => tag.split(":").pop().split("}").pop().toUpperCase();

const rootName = (text) => {
  const tag = text.match(/<([A-Za-z_][\w:.-]*)\b/)?.[1];
  if (!tag) throw new Error("XML inválido.");
  return localName(tag);
};

const sectionRecords = (xml, sectionName) => {
  const section = xml.match(new RegExp(`<([\\w:.-]*${sectionName})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, "i"))?.[2] || "";
  return [...section.matchAll(/<([\w:.-]*REGISTRO)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]);
};

const childText = (record, name) =>
  cleanText(record.match(new RegExp(`<([\\w:.-]*${name})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, "i"))?.[2] || "") || null;

const collectExportMaps = (xmlFiles) => {
  const maps = { disciplines: {}, teachers: {}, classes: {} };
  xmlFiles
    .filter(({ text }) => rootName(text) === "EXPORT_URANIA_INSERT")
    .forEach(({ text }) => {
      sectionRecords(text, "DISCIPLINAS").forEach((record) => {
        const code = childText(record, "CODIGO");
        const name = childText(record, "NOME") || childText(record, "ABREVIATURA");
        if (code && name) maps.disciplines[code] = name;
      });
      sectionRecords(text, "PROFESSORES").forEach((record) => {
        const code = childText(record, "CODIGO");
        const name = childText(record, "NOME") || childText(record, "ABREVIATURA");
        if (code && name) maps.teachers[code] = name;
      });
      sectionRecords(text, "TURMAS").forEach((record) => {
        const code = childText(record, "CODIGO");
        const name = childText(record, "ABREVIATURA") || childText(record, "NOME");
        if (code && name) maps.classes[code] = name;
      });
    });
  return maps;
};

const parseImportXml = (file, text, maps) => {
  const schoolCode = text.match(/<([\w:.-]*CODESCOLA)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2];
  const shiftCode = text.match(/<([\w:.-]*CODTURNO)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2];
  const shiftName = text.match(/<([\w:.-]*NOMETURNO)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2];
  const cleanSchoolCode = cleanText(schoolCode);
  const cleanShiftCode = cleanText(shiftCode);
  const cleanShiftName = cleanText(shiftName);
  const scope = `XML:${cleanSchoolCode || "SEM_ESCOLA"}:${cleanShiftCode || "GERAL"}`;
  const schedules = [];
  const warnings = [];
  const missingClasses = new Set();
  const missingTeachers = new Set();
  const missingDisciplines = new Set();

  sectionRecords(text, "HORARIO").forEach((record) => {
    const classCode = childText(record, "CODTURMA") || "SEM_TURMA";
    const teacherCode = childText(record, "CODPROF");
    const disciplineCode = childText(record, "CODDISC") || "SEM_DISCIPLINA";
    const className = maps.classes[classCode] || classCode;
    const teacher = teacherCode ? maps.teachers[teacherCode] || teacherCode : null;
    const discipline = maps.disciplines[disciplineCode] || disciplineCode;
    if (!maps.classes[classCode]) missingClasses.add(classCode);
    if (teacherCode && !maps.teachers[teacherCode]) missingTeachers.add(teacherCode);
    if (!maps.disciplines[disciplineCode]) missingDisciplines.add(disciplineCode);
    const { course, year } = classMetadata(className);
    const period = Number.parseInt(childText(record, "HOR") || "0", 10) || 0;
    schedules.push({
      categoria: "TURMA",
      turma: className,
      curso: course,
      ano: year,
      dia: normalizeDay(childText(record, "DIA") || ""),
      periodo: period,
      hora_inicio: null,
      disciplina: discipline,
      professor: teacher,
      ambiente: childText(record, "AMBIENTE"),
      tipo_turma: childText(record, "TIPOTURMA"),
      tipo_disciplina: childText(record, "TIPODISC"),
      valor_original: `${disciplineCode} (${teacherCode || "sem professor"})`,
      escopo: scope,
    });
  });

  if (missingClasses.size) warnings.push(`Turmas sem nome no URANEXP.XML: ${[...missingClasses].sort().join(", ")}`);
  if (missingTeachers.size) warnings.push(`Professores sem nome no URANEXP.XML: ${[...missingTeachers].sort().join(", ")}`);
  if (missingDisciplines.size) warnings.push(`Disciplinas sem nome no URANEXP.XML: ${[...missingDisciplines].sort().join(", ")}`);

  return {
    format: "XML",
    title: `Horários ${cleanShiftName || cleanShiftCode || "URÂNIA"}`,
    scope,
    school_code: cleanSchoolCode || null,
    shift_code: cleanShiftCode || null,
    shift_name: cleanShiftName || null,
    schedules,
    warnings,
    headers: [...new Set(schedules.map((schedule) => schedule.turma))].sort(),
    encoding: "XML",
  };
};

const parsePayload = (files) => {
  if (!files.length) throw new Error("Nenhum arquivo recebido.");

  const decoded = files.map((file) => ({ file, content: file.buffer }));
  const xmlFiles = decoded
    .filter(({ file }) => file.name.toLowerCase().endsWith(".xml"))
    .map(({ file, content }) => ({ file, text: content.toString("utf8") }));
  const exportMaps = collectExportMaps(xmlFiles);
  const parsedFiles = decoded.flatMap(({ file, content }) => {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) return [parseHtml(file, content)];
    if (lowerName.endsWith(".xml")) {
      const text = content.toString("utf8");
      return rootName(text) === "IMPORT_URANIA" ? [parseImportXml(file, text, exportMaps)] : [];
    }
    throw new Error(`${file.name}: extensão não suportada.`);
  });

  const schedules = [];
  const warnings = [];
  const seen = new Set();
  parsedFiles.forEach((parsed) => {
    warnings.push(...parsed.warnings.map((warning) => `${parsed.title}: ${warning}`));
    parsed.schedules.forEach((schedule) => {
      const key = [
        schedule.escopo,
        schedule.categoria,
        schedule.turma,
        schedule.dia,
        schedule.periodo,
        schedule.disciplina,
        schedule.professor,
        schedule.ambiente,
      ].join("\u0000");
      if (seen.has(key)) return;
      seen.add(key);
      schedules.push(schedule);
    });
  });

  if (!schedules.length) throw new Error("Os arquivos não contêm horários importáveis.");

  const formats = new Set(parsedFiles.map((parsed) => parsed.format));
  const scopes = [...new Set(schedules.map((schedule) => schedule.escopo))].sort();
  const schoolCodes = parsedFiles.map((parsed) => parsed.school_code).filter(Boolean);
  const shiftCodes = parsedFiles.map((parsed) => parsed.shift_code).filter(Boolean);
  const shiftNames = parsedFiles.map((parsed) => parsed.shift_name).filter(Boolean);

  return {
    fonte: formats.size === 1 ? [...formats][0] : "MISTO",
    titulo: [...new Set(parsedFiles.map((parsed) => parsed.title))].join(" + "),
    escopo_chave: scopes.join("+"),
    codigo_escola: new Set(schoolCodes).size === 1 ? schoolCodes[0] : null,
    codigo_turno: new Set(shiftCodes).size === 1 ? shiftCodes[0] : null,
    nome_turno: new Set(shiftNames).size === 1 ? shiftNames[0] : null,
    lote_hash: crypto.createHash("sha256").update(Buffer.concat(decoded.map(({ content }) => content))).digest("hex"),
    avisos: [...new Set(warnings)],
    horarios: schedules,
    total_turmas: new Set(schedules.filter((schedule) => schedule.categoria === "TURMA").map((schedule) => schedule.turma)).size,
  };
};

export const parseUraniaFiles = async (files) =>
  parsePayload(
    files.map((file) => ({
      name: file.originalname,
      mime_type: file.mimetype,
      buffer: file.buffer,
    }))
  );
