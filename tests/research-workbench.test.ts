import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, mock, test } from "node:test";
import { useResearch } from "../src/stores/research";
import { helper } from "../src/lib/local-research/client";
import { defaultResearchConfig, type Dataset, type ResearchConfig, type RunRequest, type ScriptInspection } from "../src/lib/local-research/contracts";
import { publicResearchInstrument, researchRangeIssue } from "../src/lib/local-research/market-data";

const initial = useResearch.getState();
const originalWindow = Object.getOwnPropertyDescriptor(globalThis,"window");
const features = ["synthetic_next_open_v2","research_analyses_v1","indicator_dataset_v2","adaptive_execution_v1","local_market_data_v1","script_inspection_v1","strategy_health_v1"];
const inspection: ScriptInspection = { parameters:{},resolvedParams:{},warmupBars:0,lookbacks:[],diagnostics:[],warnings:[],policy:"fixture",profiles:{custom:{label:"Custom",provider:null,makerBps:null,takerBps:null,source:"fixture"}} };
const instrument = {provider:"gateio",symbol:"BTC_USDT",multiplier:.0001,quantityStep:1,tickSize:.1,minimumQuantity:1,minimumNotional:0,verifiedAt:Date.now()};
function dataset(config: ResearchConfig): Dataset {
  const bars = Array.from({length:(config.to-config.from)/3600000},(_,i)=>({t:config.from+i*3600000,o:100,h:101,l:99,c:100,v:1000}));
  return {version:1,provider:config.provider,product:"perpetual",symbol:config.symbol,timeframe:config.timeframe,from:config.from,to:config.to,retrievedAt:Date.now(),bars,hash:createHash("sha256").update(JSON.stringify(bars.map(b=>[b.t,b.o,b.h,b.l,b.c,b.v]))).digest("hex")};
}
beforeEach(()=>{
  Object.defineProperty(globalThis,"window",{configurable:true,value:{dispatchEvent:()=>true}});
  useResearch.persist.setOptions({storage:{getItem:()=>null,setItem:()=>undefined,removeItem:()=>undefined}});
  const config = defaultResearchConfig(); config.from=config.to-6*3600000; Object.assign(config,instrument,{impactModel:"fixed"});
  useResearch.setState({...initial,config,instrument,connection:"connected",helperFeatures:features},true);
  mock.method(globalThis,"fetch",async()=>Response.json({protocol:1,platform:"windows-x64",version:"fixture",researchSchemas:[1,2],features}));
  mock.method(helper,"inspect",async()=>structuredClone(inspection));
  mock.method(helper,"instrument",async()=>instrument);
  mock.method(helper,"dataset",async()=>null);
  mock.method(helper,"history",async config=>dataset(config));
  mock.method(helper,"run",async()=>({id:"fixture",stage:"running_strategy"}));
  mock.method(helper,"job",async id=>({id,stage:"cancelled"}));
});
afterEach(()=>{mock.restoreAll();if(originalWindow) Object.defineProperty(globalThis,"window",originalWindow);else Reflect.deleteProperty(globalThis,"window");});

test("an unverified connected run prepares real units instead of silently doing nothing",async()=>{
  useResearch.setState(s=>({instrument:null,config:{...s.config,symbol:"BTCUSDT",multiplier:1,quantityStep:.000001}}));
  await useResearch.getState().run();
  const request = (helper.run as unknown as {mock:{calls:{arguments:[RunRequest]}[]}}).mock.calls[0].arguments[0];
  assert.equal(request.config.symbol,"BTC_USDT");assert.equal(request.config.multiplier,.0001);assert.equal(useResearch.getState().error,"");
});

test("automatic pre-roll captures earlier data without changing visible dates or parameter source",async()=>{
  const from=useResearch.getState().config.from;
  mock.method(helper,"inspect",async()=>({...inspection,warmupBars:3,resolvedParams:{length:5}}));
  await useResearch.getState().run();
  const request = (helper.run as unknown as {mock:{calls:{arguments:[RunRequest]}[]}}).mock.calls[0].arguments[0];
  assert.equal(request.config.from,from-3*3600000);assert.equal(request.config.evaluationFrom,from);assert.equal(request.config.warmupBars,3);
  assert.equal(useResearch.getState().config.from,from);assert.equal(request.params.length,5);assert.equal(request.dataset.bars.length,9);
});

test("AST future-data finding blocks execution with an editor location",async()=>{
  mock.method(helper,"inspect",async()=>({...inspection,diagnostics:[{message:"Future shift",line:7,column:12}]}));
  await useResearch.getState().run();
  assert.equal((helper.run as unknown as {mock:{callCount:()=>number}}).mock.callCount(),0);
  assert.equal(useResearch.getState().diagnostic?.line,7);assert.match(useResearch.getState().error,/Future shift/);
});

test("unsupported default history produces a specific recovery rather than an oversized download",()=>{
  const config = defaultResearchConfig();config.timeframe="15m";config.from=config.to-730*86400000;
  assert.match(researchRangeIssue(config)!,/70,080/);assert.match(researchRangeIssue(config)!,/10,000/);
});

test("public metadata fallback binds exact venue and actual contract multiplier",async()=>{
  mock.method(globalThis,"fetch",async()=>Response.json({name:"BTC_USDT",in_delisting:false,enable_decimal:false,quanto_multiplier:"0.0001",order_price_round:"0.1",order_size_min:1,maker_fee_rate:"0.0002",taker_fee_rate:"0.0005"}));
  const result=await publicResearchInstrument("gateio","BTCUSDT");assert.equal(result.symbol,"BTC_USDT");assert.equal(result.multiplier,.0001);assert.equal(result.takerFeeBps,5);
  await assert.rejects(()=>publicResearchInstrument("gateio","ETH_USDT"));
});
