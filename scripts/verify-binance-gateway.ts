import { io } from "socket.io-client";

const url = process.env.GATEWAY_URL ?? "http://127.0.0.1:3004";
const durationMs = Math.max(5_000, Number(process.env.VERIFY_DURATION_MS ?? 15_000) || 15_000);
const socket = io(url, { path: "/socket.io", transports: ["websocket"], timeout: 10_000 });
const counts = { trade: 0, quote: 0, depth: 0, derivatives: 0, liquidation: 0, state: 0 };
const states: unknown[] = [];
let subscriptionError: string | undefined;

socket.on("state", (state) => { counts.state += 1; if (states.length < 12) states.push(state); });
socket.on("trade", () => { counts.trade += 1; });
socket.on("quote", () => { counts.quote += 1; });
socket.on("depth", () => { counts.depth += 1; });
socket.on("derivatives", () => { counts.derivatives += 1; });
socket.on("liquidation", () => { counts.liquidation += 1; });
socket.on("connect_error", (error) => { subscriptionError = error.message; });

socket.on("connect", () => {
  socket.emit(
    "subscribe",
    { symbol: "BTCUSDT", types: ["trade", "quote", "depth", "derivatives", "liquidation"] },
    (result: { ok?: boolean; error?: string }) => {
      if (!result?.ok) subscriptionError = result?.error ?? "subscription rejected";
    },
  );
});

setTimeout(() => {
  socket.close();
  const required = ["trade", "quote", "depth", "derivatives"] as const;
  const missing = required.filter((type) => counts[type] === 0);
  console.log(JSON.stringify({ url, counts, missing, subscriptionError, states }, null, 2));
  process.exit(subscriptionError || missing.length ? 1 : 0);
}, durationMs);
