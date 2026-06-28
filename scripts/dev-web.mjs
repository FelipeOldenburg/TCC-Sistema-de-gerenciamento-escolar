import { createServer } from "vite";

const port = Number(process.env.WEB_PORT || 8080);
const host = process.env.WEB_HOST || "0.0.0.0";
const allowedHosts = String(process.env.WEB_ALLOWED_HOSTS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

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
