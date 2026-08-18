import WebSocket from "ws";

const deadline = Date.now() + 20_000;
const captures = {};
const sockets = [];

function finish() {
  for (const socket of sockets) socket.close();
  const ready = captures.binance && captures.bybit;
  process.stdout.write(`${JSON.stringify({ capturedAt: Date.now(), ready, captures }, null, 2)}\n`);
  process.exit(ready ? 0 : 1);
}

function captureBinance() {
  const socket = new WebSocket("wss://fstream.binance.com/ws/btcusdt@aggTrade");
  sockets.push(socket);
  socket.on("error", error => { captures.binanceError = error.message; });
  socket.on("close", (code, reason) => { if (!captures.binance) captures.binanceClose = { code, reason: reason.toString() }; });
  socket.on("message", raw => {
    const data = JSON.parse(raw.toString());
    if (!data || data.e !== "aggTrade") return;
    captures.binance = { event: data.e, aggregateId: data.a, symbol: data.s, price: data.p, size: data.q, tradeTime: data.T, buyerIsMaker: data.m };
    if (captures.bybit) finish();
  });
}

function captureBybit() {
  const socket = new WebSocket("wss://stream.bybit.com/v5/public/linear");
  sockets.push(socket);
  socket.on("open", () => socket.send(JSON.stringify({ op: "subscribe", args: ["publicTrade.BTCUSDT"] })));
  socket.on("error", error => { captures.bybitError = error.message; });
  socket.on("close", (code, reason) => { if (!captures.bybit) captures.bybitClose = { code, reason: reason.toString() }; });
  socket.on("message", raw => {
    const message = JSON.parse(raw.toString());
    const trade = Array.isArray(message?.data) ? message.data.find(item => item?.s === "BTCUSDT" && item?.S && item?.p && item?.v) : null;
    if (!trade) return;
    captures.bybit = { topic: message.topic, tradeId: trade.i, symbol: trade.s, takerSide: trade.S, price: trade.p, size: trade.v, tradeTime: trade.T };
    if (captures.binance) finish();
  });
}

captureBinance();
captureBybit();
setTimeout(finish, Math.max(1, deadline - Date.now()));
