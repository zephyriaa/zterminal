import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({});
// The Cloudflare script generates the PostgreSQL client first. Avoid npm's
// prebuild hook, which regenerates the SQLite development client.
config.buildCommand = "node scripts/prepare-monaco.mjs && npx next build";

export default config;

