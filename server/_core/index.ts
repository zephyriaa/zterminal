import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { getMarketReadiness } from "../marketReadiness";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  // Render terminates TLS before one trusted reverse-proxy hop; Express may then use req.ip for bounded public API limits.
  app.set("trust proxy", 1);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    next();
  });
  // The terminal does not accept file uploads; retain only bounded JSON/form payloads for public diagnostics and draft metadata.
  app.use(express.json({ limit: "256kb" }));
  app.use(express.urlencoded({ limit: "32kb", extended: true, parameterLimit: 100 }));
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok", service: "zterminal-research-terminal", execution: "disabled" });
  });
  app.get("/readyz", async (_req, res) => {
    const readiness = await getMarketReadiness();
    res.status(readiness.status === "READY" ? 200 : 503).json({
      status: readiness.status === "READY" ? "ready" : "not_ready",
      service: "zterminal-research-terminal",
      execution: "disabled",
      readiness,
    });
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
