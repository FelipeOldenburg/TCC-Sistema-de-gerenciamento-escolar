import cors from "cors";
import "dotenv/config";
import express from "express";
import mysql from "mysql2/promise";

const app = express();
const port = Number(process.env.API_PORT || 3001);

app.use(cors());
app.use(express.json());

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

app.get("/api/health", async (_req, res) => {
  await db.query("SELECT 1");
  res.json({ ok: true });
});

app.get("/api/reorganizacao", async (_req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT
        id,
        aluno,
        ano,
        turma,
        curso,
        problema,
        salas,
        DATE_FORMAT(data, '%Y-%m-%d') AS data
      FROM reorganizacao_salas
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/reorganizacao", async (req, res, next) => {
  try {
    const { aluno, ano, turma, curso, problema, salas } = req.body;

    if (!aluno || !ano || !turma || !curso || !problema || !salas) {
      return res.status(400).json({ message: "Preencha todos os campos." });
    }

    const [result] = await db.query(
      `
        INSERT INTO reorganizacao_salas
          (aluno, ano, turma, curso, problema, salas, data)
        VALUES (?, ?, ?, ?, ?, ?, CURDATE())
      `,
      [aluno, ano, turma, curso, problema, salas]
    );

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/reorganizacao/:id", async (req, res, next) => {
  try {
    await db.query("DELETE FROM reorganizacao_salas WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Erro ao acessar o banco de dados." });
});

app.listen(port, () => {
  console.log(`API rodando em http://localhost:${port}`);
});
