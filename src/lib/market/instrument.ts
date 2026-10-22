import { GATEIO_REST_URL, normalizeGateioSymbol, parseGateDecimal } from "./gateio";
import { BINANCE_FUTURES_REST_URL } from "./binance";
import type { ContractMetadata } from "./types";

/** Only verified USDT perpetual identities are admitted to the terminal history path. */
export async function fetchInstrument(provider: string, input: string, signal?: AbortSignal, fetcher: (input: string | URL, init?: RequestInit) => Promise<Response> = fetch): Promise<ContractMetadata> {
  if (input.includes(":") && !input.toUpperCase().startsWith(`${provider.toUpperCase()}:`)) throw new Error("Instrument alias belongs to a different venue");
  const gate = normalizeGateioSymbol(input);
  if (!gate) throw new Error(`Unsupported perpetual instrument: ${input}`);
  const canonical = gate.replace("_", "");
  const options = { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000), cache: "no-store" as const, headers: { Accept: "application/json" } };
  let symbol = canonical, multiplier = 1, tickSize: number, quantityStep: number | undefined;
  let exchange: ContractMetadata["exchange"];
  if (provider === "gateio") {
    const response = await fetcher(`${GATEIO_REST_URL}/futures/usdt/contracts/${gate}`, options);
    if (!response.ok) throw new Error(`Gate.io instrument unavailable (${response.status})`);
    const raw = await response.json();
    if (raw.name !== gate || raw.in_delisting) throw new Error("Unavailable Gate.io contract");
    symbol = gate; exchange = "GATEIO";
    multiplier = parseGateDecimal(raw.quanto_multiplier, "multiplier");
    tickSize = parseGateDecimal(raw.order_price_round, "tick");
    // Decimal support and minimum size do not establish a quantity increment.
    quantityStep = raw.enable_decimal ? undefined : 1;
  } else if (provider === "binance") {
    const response = await fetcher(`${BINANCE_FUTURES_REST_URL}/fapi/v1/exchangeInfo`, options);
    if (!response.ok) throw new Error(`Binance instrument unavailable (${response.status})`);
    const raw = await response.json();
    const contract = raw.symbols?.find((item: { symbol: string }) => item.symbol === canonical);
    if (contract?.contractType !== "PERPETUAL" || contract.quoteAsset !== "USDT" || contract.status !== "TRADING") throw new Error("Unavailable Binance USDT perpetual");
    exchange = "BINANCE";
    tickSize = Number(contract.filters?.find((f: { filterType: string }) => f.filterType === "PRICE_FILTER")?.tickSize);
    quantityStep = Number(contract.filters?.find((f: { filterType: string }) => f.filterType === "LOT_SIZE")?.stepSize);
  } else if (provider === "bybit") {
    const response = await fetcher(`https://api.bybit.com/v5/market/instruments-info?category=linear&symbol=${canonical}`, options);
    if (!response.ok) throw new Error(`Bybit instrument unavailable (${response.status})`);
    const raw = await response.json();
    const contract = raw.result?.list?.find((item: { symbol: string }) => item.symbol === canonical);
    if (raw.retCode !== 0 || contract?.contractType !== "LinearPerpetual" || contract.quoteCoin !== "USDT" || contract.status !== "Trading") throw new Error("Unavailable Bybit USDT perpetual");
    exchange = "BYBIT"; tickSize = Number(contract.priceFilter?.tickSize); quantityStep = Number(contract.lotSizeFilter?.qtyStep);
  } else if (provider === "okx") {
    symbol = `${gate.replace("_", "-")}-SWAP`;
    const response = await fetcher(`https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=${symbol}`, options);
    if (!response.ok) throw new Error(`OKX instrument unavailable (${response.status})`);
    const raw = await response.json();
    const contract = raw.data?.find((item: { instId: string }) => item.instId === symbol);
    if (raw.code !== "0" || contract?.instType !== "SWAP" || contract.ctType !== "linear" || contract.settleCcy !== "USDT" || contract.state !== "live" || contract.ctValCcy !== gate.split("_")[0]) throw new Error("Unavailable OKX linear USDT swap");
    exchange = "OKX"; tickSize = Number(contract.tickSz); quantityStep = Number(contract.lotSz); multiplier = Number(contract.ctVal) * Number(contract.ctMult || 1);
  } else throw new Error(`No verified perpetual mapping for ${provider}`);
  if (![tickSize, multiplier].every(value => Number.isFinite(value) && value > 0) || (quantityStep !== undefined && (!Number.isFinite(quantityStep) || quantityStep <= 0))) throw new Error("Invalid provider instrument precision or units");
  return { root: gate.split("_")[0], symbol, description: `${gate.replace("_", "/")} perpetual`, exchange, product: "perpetual", tickSize, tickValue: tickSize * multiplier, multiplier, quantityStep, currency: "USDT", session: "crypto", supportsDepth: true, supportsMBO: false, verified: true };
}
