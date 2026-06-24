import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const parserPath = path.join(__dirname, "parsers", "urania_up.py");

const runParser = (command, args, payload) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, [...args, parserPath], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      child.kill();
      if (!settled) {
        settled = true;
        const error = new Error("O parser do URÂNIA excedeu o tempo limite.");
        error.statusCode = 504;
        reject(error);
      }
    }, 30_000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      if (code !== 0) {
        const parsedError = (() => {
          try {
            return JSON.parse(stderr.trim()).error;
          } catch {
            return stderr.trim();
          }
        })();
        const error = new Error(parsedError || "Não foi possível interpretar os arquivos do URÂNIA.");
        error.statusCode = /beautifulsoup|bs4/i.test(stderr) ? 503 : 422;
        reject(error);
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        const error = new Error("O parser do URÂNIA retornou uma resposta inválida.");
        error.statusCode = 502;
        reject(error);
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });

export const parseUraniaFiles = async (files) => {
  const payload = {
    files: files.map((file) => ({
      name: file.originalname,
      mime_type: file.mimetype,
      content_base64: file.buffer.toString("base64"),
    })),
  };

  const configured = process.env.PYTHON_BIN;
  const commonWindowsPython = [
    "C:\\Program Files\\Python313\\python.exe",
    "C:\\Program Files\\Python312\\python.exe",
    "C:\\Program Files\\Python311\\python.exe",
    "C:\\Program Files\\Python310\\python.exe",
  ].filter((candidate) => fs.existsSync(candidate));
  const candidates = configured
    ? [{ command: configured, args: [] }]
    : [
        ...commonWindowsPython.map((command) => ({ command, args: [] })),
        { command: "python", args: [] },
        { command: "py", args: ["-3"] },
      ];
  let lastError;

  for (const candidate of candidates) {
    try {
      return await runParser(candidate.command, candidate.args, payload);
    } catch (error) {
      lastError = error;
      if (error.code !== "ENOENT" && error.statusCode !== 422) throw error;
    }
  }

  const error = new Error(
    "Python 3 com BeautifulSoup não está disponível. Instale Python e execute: pip install -r server/requirements.txt"
  );
  error.statusCode = 503;
  error.cause = lastError;
  throw error;
};
