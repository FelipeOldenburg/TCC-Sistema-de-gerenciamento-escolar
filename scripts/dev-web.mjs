import { createServer } from "vite";

const port = Number(process.env.WEB_PORT || 8080);
const host = process.env.WEB_HOST || "0.0.0.0";
const allowedHosts = String(process.env.WEB_ALLOWED_HOSTS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (process.argv.includes("--wait-for-api")) {
  const healthUrl = new URL("/api/health", process.env.VITE_API_PROXY_TARGET || "http://localhost:3001");
  console.log(`Aguardando API em ${healthUrl}...`);
  while (!(await fetch(healthUrl).then((response) => response.ok).catch(() => false))) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

const vite = await createServer({
  server: {
    host,
    port,
    strictPort: false,
    allowedHosts: allowedHosts.length ? allowedHosts : true,
  },
});

await vite.listen();
vite.printUrls();

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  await vite.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
