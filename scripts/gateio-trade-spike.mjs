import WebSocket from "ws";

const endpoint = "wss://fx-ws.gateio.ws/v4/ws/usdt";
const symbol = "BTC_USDT";
const timeoutMs = 20_000;
const captured = [];
let settled = false;

function tradeCount() {
  return captured.filter(item => item.kind === "trade").length;
}

function hasBothTakerSigns() {
  const sizes = captured
    .filter(item => item.kind === "trade")
    .map(item => Number(item.size))
    .filter(Number.isFinite);
  return sizes.some(size => size > 0) && sizes.some(size => size < 0);
}

function finish(code, detail) {
  if (settled) return;
  settled = true;
  clearTimeout(timeout);
  socket.close();
  console.log(JSON.stringify({
    probe: "gateio-public-trades",
    endpoint,
    symbol,
    requestedHeaders: { "X-Gate-Size-Decimal": "1" },
    captured,
    observed: {
      tradeCount: tradeCount(),
      bothTakerSigns: hasBothTakerSigns(),
      decimalSizeStrings: captured.filter(item => item.kind === "trade").every(item => typeof item.size === "string"),
    },
    detail,
  }, null, 2));
  process.exitCode = code;
}

const socket = new WebSocket(endpoint, {
  headers: { "X-Gate-Size-Decimal": "1" },
});
const timeout = setTimeout(() => finish(hasBothTakerSigns() ? 0 : 1, hasBothTakerSigns() ? "captured public trade events with both documented taker signs" : "capture timeout before observing both documented taker signs"), timeoutMs);

socket.on("open", () => {
  socket.send(JSON.stringify({
    time: Math.floor(Date.now() / 1000),
    channel: "futures.trades",
    event: "subscribe",
    payload: [symbol],
  }));
});

socket.on("message", payload => {
  let message;
  try {
    message = JSON.parse(payload.toString());
  } catch {
    return;
  }
  if (message.channel !== "futures.trades") return;
  if (message.event === "subscribe") {
    captured.push({ kind: "subscription", error: message.error ?? null, result: message.result ?? null });
    return;
  }
  if (message.event !== "update" || !Array.isArray(message.result)) return;
  for (const trade of message.result) {
    if (!trade || typeof trade !== "object") continue;
    captured.push({
      kind: "trade",
      id: trade.id ?? null,
      contract: trade.contract ?? null,
      price: trade.price ?? null,
      size: trade.size ?? null,
      createTimeMs: trade.create_time_ms ?? null,
      isInternal: trade.is_internal ?? null,
    });
  }
  if (hasBothTakerSigns()) finish(0, "captured public trade events with both documented taker signs");
});

socket.on("error", () => finish(1, "public WebSocket connection error"));
socket.on("close", () => {
  if (!settled) finish(1, "public WebSocket closed before capture completed");
});
