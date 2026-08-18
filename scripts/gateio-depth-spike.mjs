import WebSocket from "ws";

const endpoint = "wss://fx-ws.gateio.ws/v4/ws/usdt";
const restEndpoint = "https://api.gateio.ws/api/v4/futures/usdt/order_book?contract=BTC_USDT&limit=100&with_id=true";
const symbol = "BTC_USDT";
const timeoutMs = 20_000;
const updates = [];
let settled = false;
let snapshotPromise = null;

function numberOrNull(value) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeUpdate(value) {
  if (!value || typeof value !== "object") return null;
  const result = value;
  const U = numberOrNull(result.U);
  const u = numberOrNull(result.u);
  if (U === null || u === null) return null;
  return {
    U,
    u,
    t: numberOrNull(result.t),
    symbol: result.s ?? null,
    bidCount: Array.isArray(result.b) ? result.b.length : null,
    askCount: Array.isArray(result.a) ? result.a.length : null,
    firstBidSizeType: Array.isArray(result.b) && result.b[0] ? typeof result.b[0].s : null,
    firstAskSizeType: Array.isArray(result.a) && result.a[0] ? typeof result.a[0].s : null,
  };
}

async function fetchSnapshot() {
  const response = await fetch(restEndpoint, { headers: { Accept: "application/json", "X-Gate-Size-Decimal": "1" } });
  if (!response.ok) throw new Error(`snapshot HTTP ${response.status}`);
  const body = await response.json();
  const id = numberOrNull(body.id);
  if (id === null) throw new Error("snapshot did not contain a finite id");
  return {
    id,
    bidCount: Array.isArray(body.bids) ? body.bids.length : null,
    askCount: Array.isArray(body.asks) ? body.asks.length : null,
    firstBidSizeType: Array.isArray(body.bids) && body.bids[0] ? typeof body.bids[0].s : null,
    firstAskSizeType: Array.isArray(body.asks) && body.asks[0] ? typeof body.asks[0].s : null,
  };
}

function reconciliation(snapshot) {
  const candidateIndex = updates.findIndex(update => update.U <= snapshot.id + 1 && update.u >= snapshot.id + 1);
  if (candidateIndex < 0) return { candidateIndex: null, contiguousAfterCandidate: false };
  const remaining = updates.slice(candidateIndex);
  const contiguousAfterCandidate = remaining.slice(1).every((update, index) => update.U <= remaining[index].u + 1 && update.u >= remaining[index].u + 1);
  return { candidateIndex, contiguousAfterCandidate };
}

function finish(code, detail, snapshot = null) {
  if (settled) return;
  settled = true;
  clearTimeout(timeout);
  socket.close();
  const reconciliationResult = snapshot ? reconciliation(snapshot) : null;
  console.log(JSON.stringify({
    probe: "gateio-order-book-reconciliation",
    endpoint,
    restEndpoint,
    symbol,
    requestedHeaders: { "X-Gate-Size-Decimal": "1" },
    snapshot,
    updates,
    reconciliation: reconciliationResult,
    detail,
  }, null, 2));
  process.exitCode = code;
}

const socket = new WebSocket(endpoint, { headers: { "X-Gate-Size-Decimal": "1" } });
const timeout = setTimeout(() => finish(1, "capture timeout before a reconciled snapshot-plus-delta sequence"), timeoutMs);

socket.on("open", () => {
  socket.send(JSON.stringify({
    time: Math.floor(Date.now() / 1000),
    channel: "futures.order_book_update",
    event: "subscribe",
    payload: [symbol, "100ms", "100"],
  }));
});

socket.on("message", async payload => {
  let message;
  try {
    message = JSON.parse(payload.toString());
  } catch {
    return;
  }
  if (message.channel !== "futures.order_book_update") return;
  if (message.event === "subscribe" && message.error) return finish(1, "subscription error");
  if (message.event !== "update") return;
  const update = sanitizeUpdate(message.result);
  if (!update) return;
  updates.push(update);
  if (!snapshotPromise) snapshotPromise = fetchSnapshot();
  if (updates.length < 5) return;
  try {
    const snapshot = await snapshotPromise;
    const result = reconciliation(snapshot);
    if (result.candidateIndex !== null && result.contiguousAfterCandidate) finish(0, "captured reconciled snapshot-plus-delta evidence", snapshot);
  } catch (error) {
    finish(1, error instanceof Error ? error.message : "snapshot request failed");
  }
});

socket.on("error", () => finish(1, "public WebSocket connection error"));
socket.on("close", () => {
  if (!settled) finish(1, "public WebSocket closed before depth capture completed");
});
