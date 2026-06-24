import { Bonjour } from "bonjour-service";
import { createServer } from "vite";

const port = 80;
const hostname = "cimol-horarios.local";

const vite = await createServer({
  server: {
    host: "0.0.0.0",
    port,
    strictPort: true,
    allowedHosts: [hostname],
  },
});

await vite.listen();

const bonjour = new Bonjour();
const service = bonjour.publish({
  name: "CIMOL Horarios",
  type: "http",
  protocol: "tcp",
  host: hostname,
  port,
});

console.log("\n  ➜  Local:   http://localhost/");
console.log(`  ➜  Network: http://${hostname}/\n`);

let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  service.stop(() => bonjour.destroy());
  await vite.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
