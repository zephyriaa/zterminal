import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({});
// The Cloudflare script generates the PostgreSQL client first. Avoid npm's
// prebuild hook, which regenerates the SQLite development client.
config.buildCommand = "npx next build";

export default config;

