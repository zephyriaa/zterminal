import WebSocket from "ws";
import { BinanceOrderBook, type BinanceBookDelta, type BinanceBookSnapshot } from "../mini-services/market-data/binance-order-book";

const deltas: BinanceBookDelta[] = [];
const ws = new WebSocket("wss://fstream.binance.com/public/stream");

ws.on("open", () => {
  ws.send(JSON.stringify({ method: "SUBSCRIBE", params: ["btcusdt@depth@100ms"], id: 1 }));
});
ws.on("message", (message) => {
  const envelope = JSON.parse(message.toString()) as { data?: Record<string, unknown> };
  const data = envelope.data;
  if (data?.e !== "depthUpdate") return;
  deltas.push({
    U: Number(data.U),
    u: Number(data.u),
    pu: Number(data.pu),
    E: Number(data.E),
    b: data.b as [string, string][],
    a: data.a as [string, string][],
  });
});

setTimeout(async () => {
  const response = await fetch("https://fapi.binance.com/fapi/v1/depth?symbol=BTCUSDT&limit=500");
  const raw = await response.json() as BinanceBookSnapshot;
  await new Promise((resolve) => setTimeout(resolve, 350));
  const book = new BinanceOrderBook();
  for (const delta of deltas) book.apply(delta);
  const bridged = book.bootstrap(raw);
  console.log(JSON.stringify({
    snapshotId: raw.lastUpdateId,
    count: deltas.length,
    first: deltas.at(0) && { U: deltas[0].U, u: deltas[0].u, pu: deltas[0].pu },
    last: deltas.at(-1) && { U: deltas.at(-1)?.U, u: deltas.at(-1)?.u, pu: deltas.at(-1)?.pu },
    bridgeCandidates: deltas.filter((delta) => delta.U <= raw.lastUpdateId + 1 && delta.u >= raw.lastUpdateId + 1).length,
    bridged,
    ready: book.isReady(),
    sequence: book.lastSequence(),
  }, null, 2));
  ws.close();
  process.exit(bridged ? 0 : 1);
}, 1_000);
