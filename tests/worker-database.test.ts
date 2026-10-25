import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

test("Worker database clients are lazy, request-scoped and disconnected after response", async () => {
  const clients: Client[] = [], cleanup: (() => Promise<void>)[] = [];
  let context = {};
  class Client {
    user = {};
    disconnected = false;
    constructor() { clients.push(this); }
    async $disconnect() { this.disconnected = true; }
    async $transaction() { return this; }
  }
  const loaded = { exports: {} as { db: Client } };
  const code = ts.transpileModule(readFileSync("src/lib/db.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(code, {
    module: loaded, exports: loaded.exports, caches: {},
    process: { env: { NODE_ENV: "production", DATABASE_URL: "postgresql://test:test@localhost/test" } },
    require(name: string) {
      if (name === "@prisma/client" || name === "@prisma/client/wasm.js") return { PrismaClient: Client };
      if (name === "@prisma/adapter-pg") return { PrismaPg: class {} };
      if (name === "@opennextjs/cloudflare") return { getCloudflareContext: () => ({ ctx: context }) };
      if (name === "next/server") return { after: (callback: () => Promise<void>) => cleanup.push(callback) };
      if (name === "node:path") return path;
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const { db } = loaded.exports;
  assert.equal(clients.length, 0, "Module loading must not allocate a Worker pool");
  const first = db.user;
  assert.equal(db.user, first, "Queries in one request share its client");
  assert.equal(await db.$transaction(), clients[0], "Prisma methods keep their receiver");
  context = {};
  assert.notEqual(db.user, first, "A later request must not reuse the earlier pool");
  assert.equal(clients.length, 2);
  assert.equal(cleanup.length, 2);
  assert.equal(clients.some(client => client.disconnected), false);
  await cleanup[0]();
  assert.equal(clients[0].disconnected, true);
  assert.equal(clients[1].disconnected, false, "One request cannot close another client's pool");
  await cleanup[1]();
  assert.equal(clients[1].disconnected, true);
});
