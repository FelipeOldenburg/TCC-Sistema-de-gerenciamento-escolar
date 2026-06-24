import cors from "cors";
import crypto from "crypto";
import "dotenv/config";
import express from "express";
import fs from "fs";
import multer from "multer";
import mysql from "mysql2/promise";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import {
  authenticateUser,
  clearSessionCookie,
  createAuthMiddleware,
  createSession,
  deleteSession,
  ensureBootstrapUsers,
  setSessionCookie,
} from "./auth.js";
import { parseUraniaFiles } from "./uraniaParser.js";

const app = express();
const port = Number(process.env.API_PORT || 3001);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerDocument = JSON.parse(fs.readFileSync(path.join(__dirname, "swagger.json"), "utf8"));

const databaseName = process.env.DB_NAME || "cimol";
if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  throw new Error("DB_NAME contém caracteres inválidos.");
}

const databaseConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
};

const initializeSchema = async () => {
  const connection = await mysql.createConnection({ ...databaseConfig, multipleStatements: true });
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.changeUser({ database: databaseName });
    const schema = fs
      .readFileSync(path.join(__dirname, "schema.sql"), "utf8")
      .replace(/CREATE DATABASE IF NOT EXISTS[\s\S]*?USE\s+[A-Za-z0-9_]+\s*;/i, "");
    await connection.query(schema);
  } finally {
    await connection.end();
  }
};

await initializeSchema();

const db = mysql.createPool({
  ...databaseConfig,
  database: databaseName,
  waitForConnections: true,
  connectionLimit: 10,
});

await ensureBootstrapUsers(db);

const { optionalAuth, requireAuth, requireRole } = createAuthMiddleware(db);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(optionalAuth);
app.use("/api-CIMOL/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/", (_req, res) => res.redirect("/api-CIMOL/docs"));
app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(204).end();
});

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const asBoolean = (value) => value === true || value === 1 || value === "1" || value === "true" || value === "on";
const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const normalizeLookup = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    cb(allowed.includes(file.mimetype) ? null : new Error("Tipo de arquivo não permitido. Use PDF, imagem ou Word."), allowed.includes(file.mimetype));
  },
});

const uraniaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowed = [".html", ".htm", ".xml"].includes(extension);
    cb(allowed ? null : new Error("Formato inválido. Envie arquivos HTML, HTM ou XML do URÂNIA UP."), allowed);
  },
});

// ---------------------------------------------------------------------------
// Autenticação e permissões
// ---------------------------------------------------------------------------
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const user = await authenticateUser(db, req.body?.usuario, req.body?.senha);
    if (!user) return res.status(401).json({ message: "Usuário ou senha inválidos." });
    const token = await createSession(db, user.id);
    setSessionCookie(res, token);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", async (req, res, next) => {
  try {
    await deleteSession(db, req);
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));

// Mantém compatibilidade temporária com consumidores antigos da API de reorganização.
const cpdOrLegacyAuth = (req, res, next) => {
  const secretKey = process.env.VITE_API_KEY;
  const providedKey = req.headers["x-api-key"];
  if (req.user?.papel === "CPD" || (secretKey && providedKey === secretKey)) return next();
  if (req.user) return res.status(403).json({ message: "Somente o CPD pode acessar esta função." });
  return res.status(401).json({ message: "Acesso não autorizado." });
};

// ---------------------------------------------------------------------------
// Saúde da API
// ---------------------------------------------------------------------------
app.get("/api/health", async (_req, res, next) => {
  try {
    await db.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Módulo existente: reorganização de salas
// ---------------------------------------------------------------------------
app.get("/api/reorganizacao", cpdOrLegacyAuth, async (_req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT r.id, a.nome AS aluno, a.ano, a.turma, a.curso, r.problema,
             r.arquivo_nome, DATE_FORMAT(r.data, '%Y-%m-%d') AS data,
             GROUP_CONCAT(sr.sala ORDER BY sr.sala SEPARATOR ', ') AS salas
        FROM reorganizacoes r
        JOIN alunos a ON r.aluno_id = a.id
        LEFT JOIN reorganizacao_salas_relacionadas sr ON r.id = sr.reorganizacao_id
       GROUP BY r.id
       ORDER BY r.id DESC
    `);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/reorganizacao",
  cpdOrLegacyAuth,
  documentUpload.single("arquivo"),
  async (req, res, next) => {
    const { aluno, ano, turma, curso, problema, salas } = req.body;
    if (!aluno || !ano || !turma || !curso || !problema || !salas) {
      return res.status(400).json({ message: "Preencha todos os campos obrigatórios." });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [existingStudents] = await conn.query(
        "SELECT id FROM alunos WHERE nome = ? AND ano = ? AND turma = ? AND curso = ?",
        [aluno, ano, turma, curso]
      );
      let studentId = existingStudents[0]?.id;
      if (!studentId) {
        const [newStudent] = await conn.query(
          "INSERT INTO alunos (nome, ano, turma, curso) VALUES (?, ?, ?, ?)",
          [aluno, ano, turma, curso]
        );
        studentId = newStudent.insertId;
      }

      const [newRequest] = await conn.query(
        `INSERT INTO reorganizacoes (aluno_id, problema, arquivo_nome, arquivo_dados, data)
         VALUES (?, ?, ?, ?, CURDATE())`,
        [studentId, problema, req.file?.originalname || null, req.file?.buffer || null]
      );
      const requestId = newRequest.insertId;
      for (const room of String(salas).split(",").map((value) => value.trim()).filter(Boolean)) {
        await conn.query(
          "INSERT INTO reorganizacao_salas_relacionadas (reorganizacao_id, sala) VALUES (?, ?)",
          [requestId, room]
        );
      }
      await conn.commit();
      res.status(201).json({ id: requestId });
    } catch (error) {
      await conn.rollback();
      next(error);
    } finally {
      conn.release();
    }
  }
);

app.get("/api/reorganizacao/:id/arquivo", cpdOrLegacyAuth, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      "SELECT arquivo_nome, arquivo_dados FROM reorganizacoes WHERE id = ?",
      [req.params.id]
    );
    if (!rows.length || !rows[0].arquivo_dados) {
      return res.status(404).json({ message: "Arquivo não encontrado." });
    }
    res.setHeader("Content-Disposition", `attachment; filename="${rows[0].arquivo_nome}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(rows[0].arquivo_dados);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/reorganizacao/:id", cpdOrLegacyAuth, async (req, res, next) => {
  try {
    await db.query("DELETE FROM reorganizacoes WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------------
app.get("/api/blocos", async (_req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT b.id, b.nome, b.descricao, b.created_at, b.updated_at,
             COUNT(s.id) AS total_salas
        FROM blocos b
        LEFT JOIN salas s ON s.bloco_id = b.id
       GROUP BY b.id
       ORDER BY b.nome
    `);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/blocos", requireRole("CPD"), async (req, res, next) => {
  try {
    const nome = String(req.body?.nome || "").trim();
    const descricao = String(req.body?.descricao || "").trim() || null;
    if (!nome) throw httpError(400, "Informe o nome do bloco.");
    const [result] = await db.query("INSERT INTO blocos (nome, descricao) VALUES (?, ?)", [nome, descricao]);
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    next(error);
  }
});

app.put("/api/blocos/:id", requireRole("CPD"), async (req, res, next) => {
  try {
    const nome = String(req.body?.nome || "").trim();
    const descricao = String(req.body?.descricao || "").trim() || null;
    if (!nome) throw httpError(400, "Informe o nome do bloco.");
    const [result] = await db.query("UPDATE blocos SET nome = ?, descricao = ? WHERE id = ?", [
      nome,
      descricao,
      req.params.id,
    ]);
    if (!result.affectedRows) throw httpError(404, "Bloco não encontrado.");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/blocos/:id", requireRole("CPD"), async (req, res, next) => {
  try {
    const [result] = await db.query("DELETE FROM blocos WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) throw httpError(404, "Bloco não encontrado.");
    res.json({ ok: true });
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      next(httpError(409, "O bloco possui salas e não pode ser excluído."));
    } else next(error);
  }
});

// ---------------------------------------------------------------------------
// Salas
// ---------------------------------------------------------------------------
const roomSelect = `
  SELECT s.id, s.nome, s.bloco_id, b.nome AS bloco_nome, s.andar, s.capacidade, s.tipo,
         s.possui_computadores, s.possui_data_show, s.possui_internet,
         s.possui_ar_condicionado, s.observacoes, s.created_at, s.updated_at,
         GROUP_CONCAT(sw.nome ORDER BY sw.nome SEPARATOR '||') AS softwares
    FROM salas s
    JOIN blocos b ON b.id = s.bloco_id
    LEFT JOIN sala_softwares ss ON ss.sala_id = s.id
    LEFT JOIN softwares sw ON sw.id = ss.software_id
`;

const serializeRoom = (row) => ({
  ...row,
  possui_computadores: Boolean(row.possui_computadores),
  possui_data_show: Boolean(row.possui_data_show),
  possui_internet: Boolean(row.possui_internet),
  possui_ar_condicionado: Boolean(row.possui_ar_condicionado),
  softwares: row.softwares ? row.softwares.split("||") : [],
});

app.get("/api/salas", async (req, res, next) => {
  try {
    const conditions = [];
    const params = [];
    if (req.query.bloco_id) {
      conditions.push("s.bloco_id = ?");
      params.push(req.query.bloco_id);
    }
    if (req.query.tipo) {
      conditions.push("s.tipo = ?");
      params.push(req.query.tipo);
    }
    if (req.query.capacidade_minima) {
      conditions.push("s.capacidade >= ?");
      params.push(Number(req.query.capacidade_minima));
    }
    for (const resource of [
      "possui_computadores",
      "possui_data_show",
      "possui_internet",
      "possui_ar_condicionado",
    ]) {
      if (req.query[resource] === "true" || req.query[resource] === "1") {
        conditions.push(`s.${resource} = TRUE`);
      }
    }
    if (req.query.software) {
      conditions.push(`EXISTS (
        SELECT 1 FROM sala_softwares filter_ss
        JOIN softwares filter_sw ON filter_sw.id = filter_ss.software_id
        WHERE filter_ss.sala_id = s.id AND filter_sw.nome LIKE ?
      )`);
      params.push(`%${req.query.software}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await db.query(`${roomSelect} ${where} GROUP BY s.id ORDER BY b.nome, s.nome`, params);
    res.json(rows.map(serializeRoom));
  } catch (error) {
    next(error);
  }
});

app.get("/api/salas/:id", async (req, res, next) => {
  try {
    const [rows] = await db.query(`${roomSelect} WHERE s.id = ? GROUP BY s.id`, [req.params.id]);
    if (!rows.length) throw httpError(404, "Sala não encontrada.");
    res.json(serializeRoom(rows[0]));
  } catch (error) {
    next(error);
  }
});

const normalizeRoomPayload = (body = {}) => {
  const softwares = Array.isArray(body.softwares)
    ? body.softwares
    : String(body.softwares || "").split(",");
  return {
    bloco_id: Number(body.bloco_id),
    nome: String(body.nome || "").trim(),
    andar: String(body.andar || "").trim(),
    capacidade: Number(body.capacidade),
    tipo: String(body.tipo || "").trim(),
    possui_computadores: asBoolean(body.possui_computadores),
    possui_data_show: asBoolean(body.possui_data_show),
    possui_internet: asBoolean(body.possui_internet),
    possui_ar_condicionado: asBoolean(body.possui_ar_condicionado),
    observacoes: String(body.observacoes || "").trim() || null,
    softwares: [...new Set(softwares.map((value) => String(value).trim()).filter(Boolean))],
  };
};

const validateRoom = (room) => {
  if (!room.bloco_id || !room.nome || !room.andar || !room.tipo || !Number.isInteger(room.capacidade) || room.capacidade < 1) {
    throw httpError(400, "Preencha bloco, nome, andar, capacidade e tipo da sala.");
  }
};

const saveRoomSoftwares = async (conn, roomId, softwares) => {
  await conn.query("DELETE FROM sala_softwares WHERE sala_id = ?", [roomId]);
  for (const software of softwares) {
    const [result] = await conn.query(
      `INSERT INTO softwares (nome) VALUES (?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), nome = VALUES(nome)`,
      [software]
    );
    await conn.query("INSERT INTO sala_softwares (sala_id, software_id) VALUES (?, ?)", [
      roomId,
      result.insertId,
    ]);
  }
  await conn.query(`DELETE FROM softwares WHERE NOT EXISTS (
    SELECT 1 FROM sala_softwares WHERE sala_softwares.software_id = softwares.id
  )`);
};

app.post("/api/salas", requireRole("CPD"), async (req, res, next) => {
  const room = normalizeRoomPayload(req.body);
  try {
    validateRoom(room);
  } catch (error) {
    return next(error);
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO salas
       (bloco_id, nome, andar, capacidade, tipo, possui_computadores, possui_data_show,
        possui_internet, possui_ar_condicionado, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        room.bloco_id,
        room.nome,
        room.andar,
        room.capacidade,
        room.tipo,
        room.possui_computadores,
        room.possui_data_show,
        room.possui_internet,
        room.possui_ar_condicionado,
        room.observacoes,
      ]
    );
    await saveRoomSoftwares(conn, result.insertId, room.softwares);
    await conn.commit();
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

app.put("/api/salas/:id", requireRole("CPD"), async (req, res, next) => {
  const room = normalizeRoomPayload(req.body);
  try {
    validateRoom(room);
  } catch (error) {
    return next(error);
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `UPDATE salas SET bloco_id = ?, nome = ?, andar = ?, capacidade = ?, tipo = ?,
       possui_computadores = ?, possui_data_show = ?, possui_internet = ?,
       possui_ar_condicionado = ?, observacoes = ? WHERE id = ?`,
      [
        room.bloco_id,
        room.nome,
        room.andar,
        room.capacidade,
        room.tipo,
        room.possui_computadores,
        room.possui_data_show,
        room.possui_internet,
        room.possui_ar_condicionado,
        room.observacoes,
        req.params.id,
      ]
    );
    if (!result.affectedRows) throw httpError(404, "Sala não encontrada.");
    await saveRoomSoftwares(conn, req.params.id, room.softwares);
    await conn.commit();
    res.json({ ok: true });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

app.delete("/api/salas/:id", requireRole("CPD"), async (req, res, next) => {
  try {
    const [result] = await db.query("DELETE FROM salas WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) throw httpError(404, "Sala não encontrada.");
    await db.query(`DELETE FROM softwares WHERE NOT EXISTS (
      SELECT 1 FROM sala_softwares WHERE sala_softwares.software_id = softwares.id
    )`);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Importações URÂNIA UP
// ---------------------------------------------------------------------------
const insertScheduleChunks = async (conn, importId, schedules, roomByName) => {
  const columns = [
    "importacao_id",
    "categoria",
    "turma",
    "curso",
    "ano",
    "dia",
    "periodo",
    "hora_inicio",
    "disciplina",
    "professor",
    "ambiente",
    "sala_id",
    "tipo_turma",
    "tipo_disciplina",
    "valor_original",
  ];
  for (let offset = 0; offset < schedules.length; offset += 200) {
    const chunk = schedules.slice(offset, offset + 200);
    const values = [];
    const placeholders = chunk.map((schedule) => {
      const roomId = schedule.ambiente ? roomByName.get(normalizeLookup(schedule.ambiente)) || null : null;
      values.push(
        importId,
        schedule.categoria,
        schedule.turma,
        schedule.curso || null,
        schedule.ano || null,
        schedule.dia,
        schedule.periodo,
        schedule.hora_inicio || null,
        schedule.disciplina,
        schedule.professor || null,
        schedule.ambiente || null,
        roomId,
        schedule.tipo_turma || null,
        schedule.tipo_disciplina || null,
        schedule.valor_original || null
      );
      return `(${columns.map(() => "?").join(",")})`;
    });
    await conn.query(
      `INSERT INTO horarios_importados (${columns.join(",")}) VALUES ${placeholders.join(",")}`,
      values
    );
  }
};

app.post(
  "/api/importacoes/urania",
  requireRole("ADMIN"),
  uraniaUpload.array("arquivos", 10),
  async (req, res, next) => {
    if (!req.files?.length) return res.status(400).json({ message: "Selecione ao menos um arquivo do URÂNIA." });
    try {
      const parsed = await parseUraniaFiles(req.files);
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        const [result] = await conn.query(
          `INSERT INTO importacoes_horarios
           (fonte, titulo, escopo_chave, codigo_escola, codigo_turno, nome_turno, lote_hash,
            total_arquivos, total_horarios, total_turmas, avisos_json, observacoes_envio, enviado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            parsed.fonte,
            parsed.titulo,
            parsed.escopo_chave,
            parsed.codigo_escola,
            parsed.codigo_turno,
            parsed.nome_turno,
            parsed.lote_hash,
            req.files.length,
            parsed.horarios.length,
            parsed.total_turmas,
            JSON.stringify(parsed.avisos || []),
            String(req.body?.observacoes || "").trim() || null,
            req.user.id,
          ]
        );
        const importId = result.insertId;
        for (const file of req.files) {
          await conn.query(
            `INSERT INTO importacao_arquivos
             (importacao_id, nome, mime_type, tamanho, sha256, conteudo)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              importId,
              file.originalname,
              file.mimetype || "application/octet-stream",
              file.size,
              crypto.createHash("sha256").update(file.buffer).digest("hex"),
              file.buffer,
            ]
          );
        }
        const [rooms] = await conn.query("SELECT id, nome FROM salas");
        const roomByName = new Map();
        for (const room of rooms) {
          const key = normalizeLookup(room.nome);
          roomByName.set(key, roomByName.has(key) ? null : room.id);
        }
        const importedEnvironments = [
          ...new Set(parsed.horarios.map((schedule) => schedule.ambiente).filter(Boolean)),
        ];
        const unmappedEnvironments = importedEnvironments.filter(
          (environment) => !roomByName.get(normalizeLookup(environment))
        );
        if (unmappedEnvironments.length) {
          parsed.avisos.push(
            `${unmappedEnvironments.length} ambientes não foram vinculados a uma sala cadastrada: ${unmappedEnvironments.join(", ")}`
          );
          await conn.query("UPDATE importacoes_horarios SET avisos_json = ? WHERE id = ?", [
            JSON.stringify(parsed.avisos),
            importId,
          ]);
        }
        await insertScheduleChunks(conn, importId, parsed.horarios, roomByName);
        await conn.commit();
        res.status(201).json({
          id: importId,
          status: "PENDENTE",
          resumo: {
            fonte: parsed.fonte,
            total_horarios: parsed.horarios.length,
            total_turmas: parsed.total_turmas,
            avisos: parsed.avisos,
          },
        });
      } catch (error) {
        await conn.rollback();
        next(error);
      } finally {
        conn.release();
      }
    } catch (error) {
      next(error);
    }
  }
);

app.get("/api/importacoes", requireRole("CPD"), async (req, res, next) => {
  try {
    const statuses = ["PENDENTE", "APROVADA", "REJEITADA"];
    const status = String(req.query.status || "").toUpperCase();
    const params = [];
    const where = statuses.includes(status) ? "WHERE i.status = ?" : "";
    if (where) params.push(status);
    const [rows] = await db.query(
      `SELECT i.id, i.fonte, i.titulo, i.escopo_chave, i.codigo_escola, i.codigo_turno,
              i.nome_turno, i.status, i.ativa, i.total_arquivos, i.total_horarios,
              i.total_turmas, i.avisos_json, i.observacoes_envio, i.motivo_rejeicao,
              i.created_at, i.revisado_em, i.publicado_em,
              sender.nome AS enviado_por_nome, sender.usuario AS enviado_por_usuario,
              reviewer.nome AS revisado_por_nome, reviewer.usuario AS revisado_por_usuario
         FROM importacoes_horarios i
         JOIN usuarios sender ON sender.id = i.enviado_por
         LEFT JOIN usuarios reviewer ON reviewer.id = i.revisado_por
         ${where}
        ORDER BY i.created_at DESC`,
      params
    );
    res.json(rows.map((row) => ({ ...row, ativa: Boolean(row.ativa), avisos: parseJson(row.avisos_json, []) })));
  } catch (error) {
    next(error);
  }
});

app.get("/api/importacoes/:id", requireRole("CPD"), async (req, res, next) => {
  try {
    const [imports] = await db.query(
      `SELECT i.*, sender.nome AS enviado_por_nome, sender.usuario AS enviado_por_usuario,
              reviewer.nome AS revisado_por_nome, reviewer.usuario AS revisado_por_usuario
         FROM importacoes_horarios i
         JOIN usuarios sender ON sender.id = i.enviado_por
         LEFT JOIN usuarios reviewer ON reviewer.id = i.revisado_por
        WHERE i.id = ?`,
      [req.params.id]
    );
    if (!imports.length) throw httpError(404, "Importação não encontrada.");

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(500, Math.max(20, Number(req.query.page_size) || 200));
    const turma = String(req.query.turma || "").trim();
    const scheduleParams = [req.params.id];
    const turmaWhere = turma ? "AND h.turma = ?" : "";
    if (turma) scheduleParams.push(turma);
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM horarios_importados h WHERE h.importacao_id = ? ${turmaWhere}`,
      scheduleParams
    );
    const [schedules] = await db.query(
      `SELECT h.id, h.categoria, h.turma, h.curso, h.ano, h.dia, h.periodo,
              TIME_FORMAT(h.hora_inicio, '%H:%i') AS hora_inicio, h.disciplina, h.professor,
              h.ambiente, h.sala_id, s.nome AS sala_nome, b.nome AS bloco_nome,
              h.tipo_turma, h.tipo_disciplina, h.valor_original
         FROM horarios_importados h
         LEFT JOIN salas s ON s.id = h.sala_id
         LEFT JOIN blocos b ON b.id = s.bloco_id
        WHERE h.importacao_id = ? ${turmaWhere}
        ORDER BY FIELD(h.dia, 'SEG','TER','QUA','QUI','SEX','SAB','DOM'), h.periodo, h.turma
        LIMIT ? OFFSET ?`,
      [...scheduleParams, pageSize, (page - 1) * pageSize]
    );
    const [classes] = await db.query(
      `SELECT DISTINCT turma, curso, ano, categoria
         FROM horarios_importados WHERE importacao_id = ? ORDER BY categoria, turma`,
      [req.params.id]
    );
    const [files] = await db.query(
      `SELECT id, nome, mime_type, tamanho, sha256, created_at
         FROM importacao_arquivos WHERE importacao_id = ? ORDER BY id`,
      [req.params.id]
    );
    const item = imports[0];
    res.json({
      ...item,
      ativa: Boolean(item.ativa),
      avisos: parseJson(item.avisos_json, []),
      arquivos: files,
      turmas: classes,
      horarios: schedules,
      paginacao: { pagina: page, por_pagina: pageSize, total: Number(countRows[0].total) },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/importacoes/:id/aprovar", requireRole("CPD"), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      "SELECT id, status, escopo_chave FROM importacoes_horarios WHERE id = ? FOR UPDATE",
      [req.params.id]
    );
    if (!rows.length) throw httpError(404, "Importação não encontrada.");
    if (rows[0].status !== "PENDENTE") throw httpError(409, "Somente importações pendentes podem ser aprovadas.");
    await conn.query(
      `UPDATE importacoes_horarios
          SET ativa = FALSE
        WHERE ativa = TRUE AND status = 'APROVADA' AND escopo_chave = ?`,
      [rows[0].escopo_chave]
    );
    await conn.query(
      `UPDATE importacoes_horarios
          SET status = 'APROVADA', ativa = TRUE, revisado_por = ?, revisado_em = NOW(),
              publicado_em = NOW(), motivo_rejeicao = NULL
        WHERE id = ?`,
      [req.user.id, req.params.id]
    );
    await conn.commit();
    res.json({ ok: true, status: "APROVADA", ativa: true });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

app.post("/api/importacoes/:id/rejeitar", requireRole("CPD"), async (req, res, next) => {
  const reason = String(req.body?.motivo || "").trim();
  if (!reason) return res.status(400).json({ message: "Informe o motivo da rejeição." });
  try {
    const [result] = await db.query(
      `UPDATE importacoes_horarios
          SET status = 'REJEITADA', ativa = FALSE, revisado_por = ?, revisado_em = NOW(),
              motivo_rejeicao = ?
        WHERE id = ? AND status = 'PENDENTE'`,
      [req.user.id, reason, req.params.id]
    );
    if (!result.affectedRows) throw httpError(409, "A importação não existe ou já foi revisada.");
    res.json({ ok: true, status: "REJEITADA" });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Horários publicados: endpoint público para alunos, professores e totens.
// ---------------------------------------------------------------------------
app.get("/api/horarios/publicados", async (req, res, next) => {
  try {
    const [options] = await db.query(
      `SELECT DISTINCT h.turma, h.curso, h.ano
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
        WHERE i.status = 'APROVADA' AND i.ativa = TRUE AND h.categoria = 'TURMA'
        ORDER BY h.curso, h.ano, h.turma`
    );
    if (req.query.apenas_opcoes === "1" || req.query.apenas_opcoes === "true") {
      return res.json({ turmas: options, horarios: [] });
    }
    const conditions = ["i.status = 'APROVADA'", "i.ativa = TRUE", "h.categoria = 'TURMA'"];
    const params = [];
    for (const [queryName, column] of [
      ["turma", "h.turma"],
      ["curso", "h.curso"],
      ["ano", "h.ano"],
      ["dia", "h.dia"],
    ]) {
      if (req.query[queryName]) {
        conditions.push(`${column} = ?`);
        params.push(String(req.query[queryName]));
      }
    }
    const [schedules] = await db.query(
      `SELECT h.id, h.turma, h.curso, h.ano, h.dia, h.periodo,
              TIME_FORMAT(h.hora_inicio, '%H:%i') AS hora_inicio,
              h.disciplina, h.professor, COALESCE(s.nome, h.ambiente) AS sala,
              b.nome AS bloco, i.id AS importacao_id, i.publicado_em
         FROM horarios_importados h
         JOIN importacoes_horarios i ON i.id = h.importacao_id
         LEFT JOIN salas s ON s.id = h.sala_id
         LEFT JOIN blocos b ON b.id = s.bloco_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY h.turma, FIELD(h.dia, 'SEG','TER','QUA','QUI','SEX','SAB','DOM'), h.periodo`,
      params
    );
    res.json({ turmas: options, horarios: schedules });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  let status = error.statusCode || 500;
  if (error instanceof multer.MulterError || error.message?.includes("Formato") || error.message?.includes("Tipo")) {
    status = 400;
  } else if (error.code === "ER_DUP_ENTRY") {
    status = 409;
  } else if (error.code === "ER_NO_REFERENCED_ROW_2") {
    status = 400;
  }
  res.status(status).json({
    message:
      status === 500
        ? "Não foi possível concluir a operação no banco de dados."
        : error.message || "Não foi possível concluir a operação.",
  });
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
