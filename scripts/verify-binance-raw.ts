import WebSocket from "ws";

const ws = new WebSocket("wss://fstream.binance.com/public/stream");
const counts = new Map<string, number>();
const samples: unknown[] = [];

ws.on("open", () => {
  ws.send(JSON.stringify({
    method: "SUBSCRIBE",
    params: ["btcusdt@depth@100ms", "btcusdt@trade", "btcusdt@bookTicker", "btcusdt@markPrice@1s", "btcusdt@forceOrder"],
    id: 1,
  }));
});
ws.on("message", (data) => {
  try {
    const payload = JSON.parse(data.toString()) as { e?: string; data?: { e?: string } };
    const key = payload.data?.e ?? payload.e ?? "control";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (samples.length < 5) samples.push(payload);
  } catch {
    counts.set("invalid", (counts.get("invalid") ?? 0) + 1);
  }
});
ws.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
setTimeout(() => {
  ws.close();
  console.log(JSON.stringify({ counts: Object.fromEntries(counts), samples }, null, 2));
  process.exit(counts.get("trade") && counts.get("depthUpdate") ? 0 : 1);
}, 8_000);
