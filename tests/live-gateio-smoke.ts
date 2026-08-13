import { io } from "socket.io-client";

const timeoutMs = Number(process.env.LIVE_SMOKE_TIMEOUT_MS ?? 25_000);
const socket = io("http://127.0.0.1:3003", {
  path: "/socket.io",
  transports: ["websocket"],
  reconnection: false,
});

let sawContract = false;
let sawTrade = false;
let sawDepth = false;
let latestState = "unknown";

const timer = setTimeout(() => finish(new Error(`timed out; state=${latestState}, contract=${sawContract}, trade=${sawTrade}, depth=${sawDepth}`)), timeoutMs);

socket.on("contracts", (contracts: Array<{ symbol: string }>) => {
  sawContract = contracts.some((contract) => contract.symbol === "QQQX_USDT");
});
socket.on("state", (state: { state?: string }) => {
  latestState = state.state ?? latestState;
});
socket.on("connect", () => socket.emit("subscribe", { symbol: "QQQX_USDT", types: ["trade", "quote", "depth"] }));
socket.on("trade", (trade: { symbol: string; provider: string; environment: string }) => {
  if (trade.symbol === "QQQX_USDT" && trade.provider === "gateio" && trade.environment === "live") sawTrade = true;
  if (sawContract && sawTrade && sawDepth) finish();
});
socket.on("depth", (depth: { symbol: string; levels: unknown[] }) => {
  if (depth.symbol === "QQQX_USDT" && depth.levels.length) sawDepth = true;
  if (sawContract && sawTrade && sawDepth) finish();
});
socket.on("connect_error", (error) => finish(error));

function finish(error?: Error) {
  clearTimeout(timer);
  socket.disconnect();
  if (error) {
    console.error(`LIVE GATE.IO SMOKE FAILED: ${error.message}`);
    process.exitCode = 1;
  } else {
    console.log("LIVE GATE.IO SMOKE PASSED: discovered QQQX_USDT, received live trade and synchronized depth.");
  }
}
