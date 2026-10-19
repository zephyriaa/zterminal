import assert from "node:assert/strict";
import test from "node:test";
import { GateOrderBook } from "../mini-services/market-data/order-book";
import { BinanceOrderBook } from "../mini-services/market-data/binance-order-book";
import { GET as healthRoute } from "../src/app/api/market-data/health/route";
import { freshFeedHealth } from "../src/lib/market/provenance";
import { publicGatewayOrigin, validateSubscriptionRequest } from "../src/lib/market/gateway-policy";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { io } from "socket.io-client";
import { GateioFuturesProvider } from "../mini-services/market-data/gateio-provider";

test("both books invalidate old depth immediately on a sequence gap", () => {
  const gate = new GateOrderBook();
  gate.buffer({U:11,u:11,t:Date.now(),b:[],a:[]});
  assert.equal(gate.bootstrap({id:10,current:1,update:1,bids:[["9","1"]],asks:[["11","1"]]}),true);
  assert.equal(gate.apply({U:13,u:13,t:Date.now(),b:[],a:[]}),false);
  assert.equal(gate.isReady(),false);
  assert.deepEqual(gate.levels(),[]);
  const binance = new BinanceOrderBook();
  binance.apply({U:10,u:11,pu:9,E:1,b:[],a:[]});
  assert.equal(binance.bootstrap({lastUpdateId:10,bids:[["9","1"]],asks:[["11","1"]]}),true);
  assert.equal(binance.apply({U:13,u:13,pu:12,E:1,b:[],a:[]}),false);
  assert.equal(binance.isReady(),false);
  assert.deepEqual(binance.levels(),[]);
});

test("health refuses HTML, oversize and invalid JSON without exposing upstream diagnostics", async () => {
 const original=globalThis.fetch;
 try {
  for (const response of [new Response("<html>secret-upstream-token</html>",{headers:{"content-type":"text/html"}}),Response.json({ok:true,state:"live"}),new Response("x".repeat(65537),{headers:{"content-type":"application/json"}})]) {
   globalThis.fetch=async (_input, init) => {assert.ok(init?.signal);return response;};
   const result=await healthRoute();const json=await result.json();
   assert.equal(result.status,503);assert.equal(json.dataStatus,"UNAVAILABLE");assert.ok(!JSON.stringify(json).includes("secret-upstream-token"));
  }
  globalThis.fetch=async ()=>{throw new Error("credential=secret-upstream-token");};
  assert.ok(!JSON.stringify(await (await healthRoute()).json()).includes("secret-upstream-token"));
 } finally { globalThis.fetch=original; }
});

test("Gate health requires symbol-specific fresh messages and reconstructed depth", () => {
 const provider=new GateioFuturesProvider();
 assert.notEqual(provider.health("BTC_USDT").state,"LIVE");
 assert.equal(provider.health("BTC_USDT").lastMessageAt,undefined);
 provider.close();
});

test("health expires without new messages and public origin config cannot carry secrets or directives", () => {
 const now=Date.now();
 const health={provider:"gateio",symbol:"BTC_USDT",state:"LIVE",updatedAt:now,lastMessageAt:now,lastDepthAt:now,depthReady:true} as const;
 assert.equal(freshFeedHealth(health,now)?.state,"LIVE");
 assert.equal(freshFeedHealth(health,now+7000)?.state,"STALE");
 assert.equal(freshFeedHealth({...health,depthReady:false},now)?.state,"STALE");
 assert.equal(publicGatewayOrigin("https://gateway.example/"),"https://gateway.example");
 for(const bad of ["https://token:secret@gateway.example","https://gateway.example/path","https://gateway.example/?secret=1","wss://gateway.example"]) assert.throws(()=>publicGatewayOrigin(bad));
 assert.equal(validateSubscriptionRequest({types: "trade" as unknown as string[]},{activeSubscriptionCount:0,maximumSubscriptions:2}).ok,false);
});

test("actual isolated gateway performs 101, bounded subscriptions, reconnect and cleanup in explicit simulation", {timeout:20000}, async () => {
 let logs="";
 const child=spawn(process.execPath,["--import","tsx","mini-services/market-data/index.ts"],{env:{...process.env,MARKET_PROVIDER:"mock",MARKET_DATA_PORT:"0",MAX_SUBSCRIPTIONS_PER_CLIENT:"1",NODE_ENV:"test"},windowsHide:true,stdio:["ignore","pipe","pipe"]});
 let socket: ReturnType<typeof io> | undefined;
 try {
  const port=await new Promise<number>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error("gateway startup timeout: "+logs)),6000);
   child.stdout!.on("data",chunk=>{logs+=String(chunk);const match=logs.match(/listening on (\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
   child.stderr!.on("data",chunk=>logs+=String(chunk));
   child.once("exit",code=>{clearTimeout(timer);reject(Error("gateway exit "+code+": "+logs));});
  });
  const origin=`http://127.0.0.1:${port}`;
  const { WebSocket }=await import("ws");
  for(const path of ["/socket.io/","/socket.io"]) await new Promise<void>((resolve,reject)=>{
   const ws=new WebSocket(`${origin.replace("http","ws")}${path}?EIO=4&transport=websocket`,{handshakeTimeout:3000});
   ws.once("upgrade",r=>{assert.equal(r.statusCode,101);resolve();ws.close();});ws.once("error",reject);
  });
  socket=io(origin,{path:"/socket.io",transports:["websocket"],autoConnect:false,reconnection:false});
  const nextEvent = (name: string) => new Promise<Record<string, string>>(resolve => socket!.once(name, resolve));
  const connected=nextEvent("connect");socket.connect();await connected;
  const request=(message: unknown)=>socket!.timeout(2000).emitWithAck("subscribe",message) as Promise<{ok:boolean;error?:string}>;
  assert.equal((await request({symbol:"BTCUSDT",provider:"gateio"})).ok,false);
  assert.equal((await request({symbol:"BTCUSDT",provider:"mock",types:"trade"})).ok,false);
  assert.equal((await request({symbol:"BTCUSDT",provider:"mock"})).ok,true);
  assert.equal((await request({symbol:"BTCUSDT",provider:"mock"})).ok,true); // same symbol does not consume another slot
  assert.equal((await request({symbol:"ETHUSDT",provider:"mock"})).ok,false);
  for(const name of ["trade","quote","depth"]) {
   const event=await nextEvent(name);
   assert.equal(event.provider,"mock");assert.equal(event.environment,"simulation");assert.equal(event.symbol,"BTCUSDT");
  }
  assert.equal((await (await fetch(origin+"/healthz")).json()).dataStatus,"SIMULATED");
  socket.disconnect();
  const reconnected=nextEvent("connect");socket.connect();await reconnected;
  assert.equal((await request({symbol:"ETHUSDT",provider:"mock"})).ok,true);
  const trade=await nextEvent("trade");assert.equal(trade.symbol,"ETHUSDT");
  socket.emit("unsubscribe",{symbol:"ETHUSDT"});
  // Acknowledged health round-trip is ordered after unsubscribe on the same socket.
  await socket.timeout(2000).emitWithAck("health",{symbol:"ETHUSDT"});
  const final=await (await fetch(origin+"/healthz")).json();assert.deepEqual(final.activeSymbols,[]);
 } finally { socket?.close();child.kill();await once(child,"exit").catch(()=>undefined); }
});

test("a snapshot received before its bridging delta becomes usable when that delta arrives", () => {
 const gate=new GateOrderBook();
 assert.equal(gate.bootstrap({id:100,current:1,update:1,bids:[["9","1"]],asks:[["11","1"]]}),false);
 gate.apply({U:101,u:102,t:1,b:[],a:[]});assert.equal(gate.isReady(),true);
 const binance=new BinanceOrderBook();
 assert.equal(binance.bootstrap({lastUpdateId:100,bids:[["9","1"]],asks:[["11","1"]]}),false);
 binance.apply({U:100,u:102,pu:99,E:1,b:[],a:[]});assert.equal(binance.isReady(),true);
});

test("canonical shared client resumes one subscription after transport loss without duplicate listeners", {timeout:10000}, async () => {
 const http=createServer();const server=new Server(http,{path:"/socket.io",addTrailingSlash:false});
 await new Promise<void>(resolve=>http.listen(0,"127.0.0.1",resolve));
 const address=http.address() as {port:number};
 const previous=process.env.NEXT_PUBLIC_MARKET_GATEWAY_URL;
 process.env.NEXT_PUBLIC_MARKET_GATEWAY_URL=`http://127.0.0.1:${address.port}`;
 let subscriptions=0, connections=0;
 server.on("connection",socket=>{
  connections++;
  const state={provider:"mock",environment:"simulation",state:"simulated",dataStatus:"SIMULATED"};
  socket.emit("state",state);
  socket.on("subscribe",()=>{ subscriptions++;socket.emit("state",state);socket.emit("trade",{symbol:"SPY",provider:"mock",environment:"simulation",timestamp:Date.now()+10,price:subscriptions}); });
 });
 const { useWorkspace }=await import("../src/stores/workspace");
 const { subscribeMarketTrades }=await import("../src/hooks/use-market-stream");
 const previousProvider=useWorkspace.getState().marketProvider;
 const previousWindow=Object.getOwnPropertyDescriptor(globalThis,"window"), previousDocument=Object.getOwnPropertyDescriptor(globalThis,"document"), previousNavigator=Object.getOwnPropertyDescriptor(globalThis,"navigator");
 const browserWindow=Object.assign(new EventTarget(),{location:{hostname:"127.0.0.1",protocol:"http:"}});
 const browserDocument=Object.assign(new EventTarget(),{hidden:false});const network={onLine:true};
 let remove=()=>{};let removeSecond=()=>{};
 try {
  Object.defineProperty(globalThis,"window",{value:browserWindow,configurable:true});Object.defineProperty(globalThis,"document",{value:browserDocument,configurable:true});Object.defineProperty(globalThis,"navigator",{value:network,configurable:true});
  useWorkspace.getState().setMarketProvider("mock");
  const seen:number[]=[];
  let notify=()=>{};
  const waitFor=()=>new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("shared stream timeout")),5000);notify=()=>{clearTimeout(timer);resolve();};});
  const first=waitFor();
  remove=subscribeMarketTrades("SPY",trade=>{seen.push(trade.price);notify();});
  removeSecond=subscribeMarketTrades("SPY",()=>{});
  await first;assert.equal(subscriptions,1);
  const next=waitFor();for(const socket of server.sockets.sockets.values())socket.conn.close();
  await next;assert.equal(connections,2);assert.equal(subscriptions,2);assert.deepEqual(seen,[1,2]);
  network.onLine=false;browserWindow.dispatchEvent(new Event("offline"));
  network.onLine=true;const online=waitFor();browserWindow.dispatchEvent(new Event("online"));await online;assert.equal(subscriptions,3);
  browserWindow.dispatchEvent(new Event("offline"));const visible=waitFor();browserDocument.dispatchEvent(new Event("visibilitychange"));await visible;assert.equal(subscriptions,4);
 } finally {
  remove();removeSecond();assert.equal(useWorkspace.getState().connection.dataStatus,"DISCONNECTED");useWorkspace.getState().setMarketProvider(previousProvider);
  if(previous===undefined)delete process.env.NEXT_PUBLIC_MARKET_GATEWAY_URL;else process.env.NEXT_PUBLIC_MARKET_GATEWAY_URL=previous;
  for(const [key,descriptor] of [["window",previousWindow],["document",previousDocument],["navigator",previousNavigator]] as const) { if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key); }
  await new Promise<void>(resolve=>server.close(()=>resolve()));
 }
});

test("Gate snapshot rate limit backs off and an unsubscribed snapshot cannot publish into a new book", async context => {
 const original=globalThis.fetch;const provider=new GateioFuturesProvider();let calls=0;
 context.mock.timers.enable({apis:["setTimeout"]});
 try {
  provider["symbols"].add("BTC_USDT");provider["books"].set("BTC_USDT",new GateOrderBook());
  globalThis.fetch=async()=>{calls++;return calls===1 ? new Response("rate limited",{status:429}) : Response.json({id:100,current:1,update:1,bids:[["9","1"]],asks:[["11","1"]]});};
  await provider["rebuildBook"]("BTC_USDT");assert.equal(calls,1);
  context.mock.timers.tick(20000);await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(calls,2);
  provider["handleBookDelta"]({s:"BTC_USDT",U:101,u:102,t:Date.now(),b:[],a:[]});
  assert.equal(provider["books"].get("BTC_USDT")?.isReady(),true);
  let finish!: (value:Response)=>void;
  globalThis.fetch=()=>new Promise<Response>(resolve=>{finish=resolve;});
  const pending=provider["rebuildBook"]("BTC_USDT");provider.unsubscribe("BTC_USDT");
  provider["symbols"].add("BTC_USDT");const next=new GateOrderBook();provider["books"].set("BTC_USDT",next);
  finish(Response.json({id:200,current:1,update:1,bids:[["90","1"]],asks:[["110","1"]]}));
  await pending;assert.equal(next.lastSequence(),0);assert.equal(next.isReady(),false);
 }finally{provider.close();globalThis.fetch=original;context.mock.timers.reset();}
});

test("upstream heartbeat timeout terminates a silent socket and stops its monitor on close", context => {
 const provider=new GateioFuturesProvider();let terminated=0,statuses=0;
 provider.on(event=>{if(event.type==="status")statuses++;});provider["symbols"].add("BTC_USDT");
 context.mock.timers.enable({apis:["setInterval","Date"],now:1000});
 const transport={readyState:1,ping(){},terminate(){terminated++;this.readyState=3;},close(){this.readyState=3;}};
 try {
  provider["ws"]=transport as unknown as NonNullable<typeof provider["ws"]>;
  provider["lastFrameAt"]=Date.now();provider["ensureStaleMonitor"]();
  context.mock.timers.tick(35000);assert.equal(terminated,1);
  const beforeClose=statuses;provider.close();context.mock.timers.tick(35000);assert.equal(statuses,beforeClose);
 } finally {provider.close();context.mock.timers.reset();}
});

test("development CSP permits the actual localhost gateway origin", async () => {
 const {default: config}=await import("../next.config");
 const headers=await config.headers!();const csp=headers.flatMap(entry=>entry.headers).find(header=>header.key==="Content-Security-Policy")?.value;
 assert.ok(csp?.includes("ws://localhost:3003"));assert.ok(csp?.includes("ws://127.0.0.1:3003"));
});
