import cors from "cors";
import "dotenv/config";
import express from "express";
import fs from "fs";
import multer from "multer";
import mysql from "mysql2/promise";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";

const app = express();
const port = Number(process.env.API_PORT || 3001);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerDocument = JSON.parse(
  fs.readFileSync(path.join(__dirname, "swagger.json"), "utf8")
);

app.use(cors());
app.use(express.json());

// Servir documentação da API via Swagger
app.use("/api-CIMOL/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Redirecionar rota raiz para a documentação
app.get("/", (_req, res) => {
  res.redirect("/api-CIMOL/docs");
});

// Multer: armazena arquivo em memória (buffer) para salvar no MySQL
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // máx 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido. Use PDF, imagem ou Word."));
    }
  },
});

app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.status(204).end();
});

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "cimol",
  waitForConnections: true,
  connectionLimit: 10,
});

// Middleware de Autenticação para proteger a API
const authMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-api-key"] || req.query.key;
  const secretKey = process.env.VITE_API_KEY || "cimol_secure_token_abc123";
  if (apiKey !== secretKey) {
    return res.status(401).json({ message: "Acesso não autorizado." });
  }
  next();
};

// ─── Health check ────────────────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  await db.query("SELECT 1");
  res.json({ ok: true });
});

// ─── Listar todos os registros (Com JOIN e GROUP_CONCAT) ─────────────────────
app.get("/api/reorganizacao", authMiddleware, async (_req, res, next) => {
  try {
    // Usamos JOIN para juntar as tabelas e GROUP_CONCAT para manter a 1FN intacta na resposta para a interface
    const [rows] = await db.query(`
      SELECT
        r.id,
        a.nome AS aluno,
        a.ano,
        a.turma,
        a.curso,
        r.problema,
        r.arquivo_nome,
        DATE_FORMAT(r.data, '%Y-%m-%d') AS data,
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

// ─── Criar novo registro (Transação para garantir integridade) ───────────────
app.post("/api/reorganizacao", authMiddleware, upload.single("arquivo"), async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { aluno, ano, turma, curso, problema, salas } = req.body;

    if (!aluno || !ano || !turma || !curso || !problema || !salas) {
      return res.status(400).json({ message: "Preencha todos os campos obrigatórios." });
    }

    const arquivoNome = req.file ? req.file.originalname : null;
    const arquivoDados = req.file ? req.file.buffer : null;

    // 1) 3FN: Verifica se o aluno já existe para evitar duplicação (ou cria se não existir)
    const [alunosExistentes] = await conn.query(
      "SELECT id FROM alunos WHERE nome = ? AND ano = ? AND turma = ? AND curso = ?",
      [aluno, ano, turma, curso]
    );

    let alunoId;
    if (alunosExistentes.length > 0) {
      alunoId = alunosExistentes[0].id;
    } else {
      const [novoAluno] = await conn.query(
        "INSERT INTO alunos (nome, ano, turma, curso) VALUES (?, ?, ?, ?)",
        [aluno, ano, turma, curso]
      );
      alunoId = novoAluno.insertId;
    }

    // 2) Insere o registro na tabela principal
    const [novaReorganizacao] = await conn.query(
      `INSERT INTO reorganizacoes (aluno_id, problema, arquivo_nome, arquivo_dados, data)
       VALUES (?, ?, ?, ?, CURDATE())`,
      [alunoId, problema, arquivoNome, arquivoDados]
    );
    const reorganizacaoId = novaReorganizacao.insertId;

    // 3) 1FN: Remove a string multivalorada. Splita as salas e insere uma a uma na tabela relacional
    const salasArray = salas
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const sala of salasArray) {
      await conn.query(
        "INSERT INTO reorganizacao_salas_relacionadas (reorganizacao_id, sala) VALUES (?, ?)",
        [reorganizacaoId, sala]
      );
    }

    await conn.commit();
    res.status(201).json({ id: reorganizacaoId });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
});

// ─── Baixar arquivo de um registro ──────────────────────────────────────────
app.get("/api/reorganizacao/:id/arquivo", authMiddleware, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      "SELECT arquivo_nome, arquivo_dados FROM reorganizacoes WHERE id = ?",
      [req.params.id]
    );

    if (!rows.length || !rows[0].arquivo_dados) {
      return res.status(404).json({ message: "Arquivo não encontrado." });
    }

    const { arquivo_nome, arquivo_dados } = rows[0];
    res.setHeader("Content-Disposition", `attachment; filename="${arquivo_nome}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(arquivo_dados);
  } catch (error) {
    next(error);
  }
});

// ─── Deletar registro ────────────────────────────────────────────────────────
app.delete("/api/reorganizacao/:id", authMiddleware, async (req, res, next) => {
  try {
    // A deleção em cascata (ON DELETE CASCADE) nas FKs se encarrega de limpar a tabela relacional
    await db.query("DELETE FROM reorganizacoes WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ─── Error handler ───────────────────────────────────────────────────────────
app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error instanceof multer.MulterError || error.message?.includes("Tipo") ? 400 : 500;
  res.status(status).json({ message: error.message || "Erro ao acessar o banco de dados." });
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
