import assert from "node:assert/strict";
import test from "node:test";
import { newWorkspace, copyWorkspace, legacyWorkspace, workspaceSnapshotSchema } from "../src/lib/workspaces/model";
import { mergeDraftEnvelopes } from "../src/lib/local-research/drafts";
import { workspacePayloadSchema, parseCloudWorkspace } from "../src/lib/workspace-payload";
import { db } from "../src/lib/db";
import { deleteWorkspace, listWorkspaces, saveWorkspace } from "../src/server/workspaces/dal";
import { workspaceEditLock, editClosedWorkspace } from "../src/lib/workspaces/edit-lock";

test("starter snapshots and copies retain explicit identity and reject malformed v3 instead of downgrading", () => {
  const source = newWorkspace("BTC research", "research", "binance", "BTCUSDT", "1h");
  const copy = copyWorkspace(source);
  assert.notEqual(source.id, copy.id); assert.equal(copy.starter, "research"); assert.equal(copy.marketProvider, "binance"); assert.equal(copy.revision, 0);
  assert.equal(source.name, "BTC research");
  assert.equal(copyWorkspace({ ...source, name: "A".repeat(80) }).name.length, 80);
  assert.equal(workspaceSnapshotSchema.safeParse({ ...source, marketProvider: "unknown" }).success, false);
  assert.equal(workspacePayloadSchema.safeParse({ ...source, dockLayout: "invalid" }).success, false);
  assert.equal(workspacePayloadSchema.safeParse({ ...source, multiChart: { ...source.multiChart, layout: "100" } }).success, false);
});

test("legacy workspace versions preserve saved charts and require a venue when none was recorded", () => {
  const source = newWorkspace("Old chart", "chart");
  const legacy = { id:source.id, name:source.name, view:source.view, symbol:source.symbol, timeframe:source.timeframe, timezone:source.timezone, createdAt:source.createdAt };
  for (const version of [1,2]) {
    const parsed = parseCloudWorkspace({ id:source.id, name:source.name, cloudState:{payload:JSON.stringify({...legacy,version})} });
    assert.ok(parsed); assert.equal(legacyWorkspace(parsed)?.marketProvider, null);
  }
  assert.equal(legacyWorkspace({...legacy, chartDocuments:[{instrument:{provider:"binance"}}]})?.marketProvider,"binance");
});

test("shared source library merges independent edits, retains unseen scripts and rejects competing edits", () => {
  const envelope = (drafts:Record<string,unknown>) => JSON.stringify({version:1,state:{drafts}});
  const original=envelope({a:{source:"old a"},b:{source:"old b"}});
  const left=envelope({a:{source:"new a"},b:{source:"old b"}}), right=envelope({a:{source:"old a"},b:{source:"new b"}});
  const merged=mergeDraftEnvelopes(original,right,left);
  assert.deepEqual(JSON.parse(merged).state.drafts,{a:{source:"new a"},b:{source:"new b"}});
  const unseen=envelope({...JSON.parse(merged).state.drafts,c:{source:"added elsewhere"}});
  assert.ok(JSON.parse(mergeDraftEnvelopes(right,right,unseen)).state.drafts.c);
  assert.throws(()=>mergeDraftEnvelopes(original,envelope({a:{source:"competing a"},b:{source:"old b"}}),left),/another tab/);
});

test("cloud snapshots use owner-scoped revisions and reject stale writes and old-client downgrades", async () => {
  const first=await db.user.create({data:{email:`${crypto.randomUUID()}@workspace.test`}}), second=await db.user.create({data:{email:`${crypto.randomUUID()}@workspace.test`}});
  const snapshot=newWorkspace("Revision test","chart");
  try {
    const created=await saveWorkspace(first.id,snapshot,null);
    assert.ok("revision" in created.workspace.cloudState);
    assert.equal(created.workspace.cloudState.revision,1);
    const updated=await saveWorkspace(first.id,{...snapshot,name:"Updated"},1);
    assert.ok("revision" in updated.workspace.cloudState);
    assert.equal(updated.workspace.cloudState.revision,2);
    await assert.rejects(()=>saveWorkspace(first.id,{...snapshot,name:"Stale"},1),/changed elsewhere/);
    await assert.rejects(()=>saveWorkspace(second.id,snapshot,2),/another account/);
    const {version:_version,...legacy}=snapshot;
    await assert.rejects(()=>saveWorkspace(first.id,legacy),/newer browser/);
    const current=(await listWorkspaces(first.id,snapshot.id))[0];
    assert.equal(current.name,"Updated"); assert.equal(JSON.parse(current.cloudState!.payload!).revision,2);
    assert.equal((await listWorkspaces(second.id,snapshot.id)).length,0);
  } finally { await deleteWorkspace(first.id,snapshot.id).catch(()=>{}); await db.user.deleteMany({where:{id:{in:[first.id,second.id]}}}); }
});

test("one tab owns editing; takeover waits for a successful flush and closed-workspace operations respect the lock", async () => {
  const original=Object.getOwnPropertyDescriptor(globalThis,"navigator");
  const held=new Set<string>();
  Object.defineProperty(globalThis,"navigator",{configurable:true,value:{locks:{request:async(name:string,_options:unknown,callback:(lock:object|null)=>Promise<unknown>)=>{
    if(held.has(name)) return callback(null);
    held.add(name); try{return await callback({});}finally{held.delete(name);}
  }}}});
  const id=crypto.randomUUID(), changes:boolean[]=[], order:string[]=[];
  const first=workspaceEditLock(id,()=>{},async()=>{await new Promise(resolve=>setTimeout(resolve,10));order.push("flushed");});
  const second=workspaceEditLock(id,editing=>{changes.push(editing);if(editing)order.push("acquired");},async()=>{});
  try {
    assert.equal(await first.ready,true); assert.equal(await second.ready,false);
    await assert.rejects(()=>editClosedWorkspace(id,async()=>true),/another tab/);
    await second.takeover();
    assert.deepEqual(order,["flushed","acquired"]); assert.equal(first.owns(),false); assert.equal(second.owns(),true); assert.deepEqual(changes,[true]);
  } finally {first.close();second.close();if(original)Object.defineProperty(globalThis,"navigator",original);else Reflect.deleteProperty(globalThis,"navigator");}
});
