import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET as barsRoute } from "../src/app/api/bars/route";
import { GET as researchRoute } from "../src/app/api/research-data/route";
import { chartHistoryRange, normalizeChartBars, prependChartHistory } from "../src/lib/market/chart-data";
import { fetchBarsDeduplicated } from "../src/lib/market/bars-dedup";
import { fetchBybitHistoricalBars } from "../src/lib/market/bybit";
import { fetchOkxHistoricalBars } from "../src/lib/market/okx";
import { fetchGateioHistoricalBars } from "../src/lib/market/gateio";
import { alignToTimeframe } from "../src/lib/market/session";
import { validateDataset, sha256 } from "../src/lib/local-research/dataset";
import { TIMEFRAME_SECONDS } from "../src/lib/market/types";

test("2020 chart cutoff reaches the provider and cannot return recent candles", async () => {
  const original = globalThis.fetch;
  const cutoff = Date.UTC(2020, 0, 1);
  const urls: URL[] = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input)); urls.push(url);
    if (url.pathname.includes("/contracts/")) return Response.json({name:"BTC_USDT",quanto_multiplier:"0.0001",order_price_round:"0.1",enable_decimal:false});
    const t = url.searchParams.has("from") ? Number(url.searchParams.get("from")) : Date.now()/1000;
    return Response.json([{t:String(Math.floor(t)),o:"10",h:"11",l:"9",c:"10",v:"2"}]);
  };
  try {
    const response = await barsRoute(new NextRequest(`http://localhost/api/bars?provider=gateio&symbol=BTCUSDT&tf=1h&bars=5&to=${cutoff}`));
    assert.equal(response.status,200);
    const body=await response.json();
    assert.ok(body.bars.every((bar:{t:number})=>bar.t<cutoff));
    const query=urls.find(url=>url.pathname.endsWith("candlesticks"))!.searchParams;
    assert.equal(Number(query.get("to")),(cutoff-3600000)/1000);
    assert.equal(Number(query.get("from")),(cutoff-5*3600000)/1000);
  } finally { globalThis.fetch=original; }
});

test("five requested mock buckets are five, with an exclusive cutoff", async () => {
  const cutoff=Date.UTC(2026,9,1);
  const body=await (await barsRoute(new NextRequest(`http://localhost/api/bars?provider=mock&symbol=SPY&tf=1m&bars=5&to=${cutoff}`))).json();
  assert.equal(body.bars.length,5);
  assert.equal(body.bars.at(-1).t,cutoff-60000);
  assert.equal(body.sourceTimestamp,cutoff-60000);
});

test("malformed OHLCV and negative volume cannot be normalized into valid history", () => {
  const valid={t:1,o:10,h:11,l:9,c:10,v:2};
  for (const invalid of [{...valid,v:-1},{...valid,o:NaN},{...valid,h:8},{...valid,l:11},{...valid,c:Infinity},{...valid,t:-1}]) assert.throws(()=>normalizeChartBars([invalid]),/invalid/i);
});

test("weekly chart buckets start Monday UTC independent of display timezone", () => {
  assert.equal(alignToTimeframe(Date.UTC(2026,9,18,12),"1w"),Date.UTC(2026,9,12));
});

test("strict research rejects provider negative volume instead of taking its absolute value", async () => {
  const original=globalThis.fetch;
  globalThis.fetch=async input=>{
    const url=new URL(String(input)), from=Number(url.searchParams.get("from"));
    return Response.json([0,1].map(i=>({t:String(from+i*60),o:"10",h:"11",l:"9",c:"10",v:"-2"})));
  };
  try {
    const response=await researchRoute(new NextRequest("http://localhost/api/research-data?provider=gateio&symbol=BTC_USDT&timeframe=1m&from=1760000040000&to=1760000160000"));
    assert.equal(response.status,422);
  } finally {globalThis.fetch=original;}
});

test("all seven exposed research timeframes retain exact closed range and hash", async () => {
  const original=globalThis.fetch;
  try {
    for(const provider of ["gateio", "binance"]) for(const timeframe of ["1m","5m","15m","30m","1h","4h","1d"] as const) {
      const step=TIMEFRAME_SECONDS[timeframe]*1000;
      const from=Math.floor(Date.UTC(2025,0,1)/step)*step, to=from+5*step;
      globalThis.fetch=async input=>{
        const query=new URL(String(input)).searchParams;
        assert.equal(Number(query.get(provider === "gateio" ? "from" : "startTime"))*(provider === "gateio" ? 1000 : 1),from);assert.equal(Number(query.get(provider === "gateio" ? "to" : "endTime"))*(provider === "gateio" ? 1000 : 1),to-step);
        return Response.json(Array.from({length:5},(_,i)=>provider === "gateio" ? {t:String((from+i*step)/1000),o:"10",h:"11",l:"9",c:"10",v:"2"} : [from+i*step,"10","11","9","10","2"]));
      };
      const response=await researchRoute(new NextRequest(`http://localhost/api/research-data?provider=${provider}&symbol=${provider === "gateio" ? "BTC_USDT" : "BTCUSDT"}&timeframe=${timeframe}&from=${from}&to=${to}`));
      assert.equal(response.status,200);
      const body=await response.json();assert.equal(body.bars.length,5);assert.equal(body.to,to);assert.equal(body.from,from);assert.match(body.hash,/^[a-f0-9]{64}$/);
      const roundTrip=JSON.parse(JSON.stringify(body));
      assert.deepEqual(validateDataset(roundTrip.bars,{from,to,timeframe}),body.bars);
      assert.equal(await sha256(JSON.stringify(roundTrip.bars.map((bar:{t:number;o:number;h:number;l:number;c:number;v:number})=>[bar.t,bar.o,bar.h,bar.l,bar.c,bar.v]))),body.hash);
      assert.equal(roundTrip.retrievedAt,body.retrievedAt);
      assert.throws(()=>validateDataset(roundTrip.bars.slice(1),{from,to,timeframe}),/Incomplete/);
    }
  } finally {globalThis.fetch=original;}
});

test("server and coalesced memory caches never mix cutoffs and preserve retrieval observations", async () => {
  const original=globalThis.fetch;
  let calls=0;
  const end=Date.UTC(2025,2,1);
  globalThis.fetch=async input=>{calls++;return barsRoute(new NextRequest(`http://localhost${input}`));};
  try {
    const [first,coalesced]=await Promise.all([fetchBarsDeduplicated("mock","SPY","1m",end,5),fetchBarsDeduplicated("mock","SPY","1m",end,5)]);
    assert.equal(calls,1);assert.deepEqual(first,coalesced);
    const older=await fetchBarsDeduplicated("mock","SPY","1m",end-60000,5);
    assert.equal(calls,2);assert.equal(older.bars.at(-1)!.t,first.bars.at(-1)!.t-60000);
    const reused=await fetchBarsDeduplicated("mock","SPY","1m",end,5);
    assert.equal(reused.cache,"memory");assert.equal(reused.retrievedAt,first.retrievedAt);assert.equal(reused.sourceTimestamp,first.sourceTimestamp);
    assert.equal(chartHistoryRange(end,5,"1m").lastOpen,end-60000);
  } finally {globalThis.fetch=original;}
});

test("older pages preserve newer live values and cannot overlap or synthesize gaps", () => {
  const bar=(t:number,c=10)=>({t,o:10,h:12,l:9,c,v:2});
  const result=prependChartHistory([bar(300000,11),bar(360000)],[bar(120000),bar(60000)]);
  assert.deepEqual(result.map(b=>b.t),[60000,120000,300000,360000]);assert.equal(result[2].c,11);
  assert.throws(()=>prependChartHistory([bar(300000)],[bar(300000)]),/overlap/);
});

test("Bybit and OKX range pagination respects boundaries, page limits and UTC day intervals", async () => {
  const bybitUrls:URL[]=[];
  const from=Date.UTC(2025,0,1), step=60000, to=from+1000*step;
  const bybit=await fetchBybitHistoricalBars("BTCUSDT","1m",from,to,async input=>{
    const url=new URL(String(input));bybitUrls.push(url);
    const start=Number(url.searchParams.get("start")), end=Number(url.searchParams.get("end"));
    const list=Array.from({length:(end-start)/step+1},(_,i)=>[String(start+i*step),"10","11","9","10","2"]).reverse();
    return Response.json({retCode:0,result:{list}});
  });
  assert.equal(bybitUrls.length,2);assert.equal(bybit.length,1001);assert.equal(bybit[0].t,from);assert.equal(bybit.at(-1)!.t,to);
  let calls=0;
  const okx=await fetchOkxHistoricalBars("BTC-USDT-SWAP","1d",from,from+300*86400000,async input=>{
    const url=new URL(String(input));assert.equal(url.pathname,"/api/v5/market/history-candles");assert.equal(url.searchParams.get("bar"),"1Dutc");
    const after=Number(url.searchParams.get("after"));calls++;
    const newest=Math.floor((after-1)/86400000)*86400000;
    const list=Array.from({length:calls===1?300:1},(_,i)=>[String(newest-i*86400000),"10","11","9","10","2","2","20","1"]);
    return Response.json({code:"0",data:list});
  });
  assert.equal(calls,2);assert.equal(okx.length,301);assert.ok(okx.every(bar=>bar.t>=from && bar.t<=from+300*86400000));
});

test("chart history distinguishes unfinished candles and rejects a future cutoff", async () => {
  const cutoff=Date.now();
  const partial=await (await barsRoute(new NextRequest(`http://localhost/api/bars?provider=mock&symbol=SPY&tf=1h&bars=5&to=${cutoff}`))).json();
  assert.equal(partial.bars.length,5);assert.equal(partial.hasOpenCandle,true);
  const future=await barsRoute(new NextRequest(`http://localhost/api/bars?provider=mock&symbol=SPY&tf=1h&to=${cutoff+86400000}`));
  assert.equal(future.status,422);
});

test("a single Gate candle has a nonzero upstream window and no extra output bucket", async () => {
  const from=Date.UTC(2025,1,1);
  const bars=await fetchGateioHistoricalBars("BTC_USDT","5m",from,from,async input=>{
    const query=new URL(String(input)).searchParams;
    assert.ok(Number(query.get("to"))>Number(query.get("from")));
    return Response.json([{t:String(from/1000),o:"10",h:"11",l:"9",c:"10",v:"2"},{t:String((from+300000)/1000),o:"10",h:"11",l:"9",c:"10",v:"2"}]);
  });
  assert.equal(bars.length,1);assert.equal(bars[0].t,from);
});
