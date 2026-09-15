import assert from "node:assert/strict";
import test from "node:test";
import { BinanceDepthSynchronizer } from "../src/lib/market/public-stream/binance-depth";
const event = (U:number,u:number,b:[string,string][]=[],a:[string,string][]=[]): any => ({U,u,pu:U-1,b,a});
test("bridges snapshot and deletes a level through a buffered Binance delta", () => { const s=new BinanceDepthSynchronizer(); s.push(event(98,99)); const bridge=event(100,101,[["100","0"]]); bridge.pu=100; s.push(bridge); assert.equal(s.bridge({lastUpdateId:100,bids:[["100","2"]],asks:[["101","2"]]}),true); assert.equal(s.status,"LIVE"); assert.equal(s.book.bestBid(),undefined); });
test("never becomes live without a bridge or across a buffered gap", () => { const a=new BinanceDepthSynchronizer(); a.push(event(102,103)); assert.equal(a.bridge({lastUpdateId:100,bids:[["100","1"]],asks:[["101","1"]]}),false); const b=new BinanceDepthSynchronizer(); b.push(event(100,101)); b.push(event(103,104)); assert.equal(b.bridge({lastUpdateId:100,bids:[["100","1"]],asks:[["101","1"]]}),false); });
