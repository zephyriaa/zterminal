import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { defaultDrawingStyle, drawingAnchorCount, type DrawingObject, type DrawingType } from "../src/lib/chart/contracts";
import { DRAWING_LABELS, type DrawingTool, type ProjectedDrawing } from "../src/lib/chart/drawings/contracts";
import { distance, drawingHit, moveAnchors, nearestAnchor } from "../src/lib/chart/drawings/geometry";
import { snapDrawingPoint } from "../src/lib/chart/drawings/snapping";
import { useChartDocuments } from "../src/stores/chart-documents";

const source = readFileSync(new URL("../src/components/terminal/drawing-interaction-layer.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("drawing.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const effects: ts.CallExpression[] = [];
let preview = "";
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && node.expression.getText(tree) === "useEffect") effects.push(node);
  if (ts.isFunctionDeclaration(node) && node.name?.text === "preview") preview = node.getText(tree);
  ts.forEachChild(node, visit);
}
visit(tree);
const code = (value: string) => ts.transpileModule(value, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function harness(tool: DrawingTool, persistent = false) {
  const handlers = new Map<string, (event: any) => void>(), windowHandlers = new Map<string, (event: any) => void>();
  const captured = new Set<number>(), previews: unknown[] = [], created: { type: DrawingType; anchors: { time: number; price: number }[] }[] = [];
  const document = { activeElement: null as unknown };
  const element = { parentElement: { style: {}, getBoundingClientRect: () => ({ left: 0, top: 0 }), addEventListener: (name: string, fn: any) => handlers.set(name, fn), removeEventListener: (name: string) => handlers.delete(name) },
    addEventListener: (name: string, fn: any) => handlers.set(name, fn), removeEventListener: (name: string) => handlers.delete(name), focus() { document.activeElement = element; }, hasPointerCapture: (id: number) => captured.has(id), setPointerCapture: (id: number) => captured.add(id), releasePointerCapture: (id: number) => { captured.delete(id); handlers.get("lostpointercapture")?.({ pointerId: id }); } };
  const props = { tool, scopeKey: "BTC:primary", magnet: "off", bars: [], drawings: [] as DrawingObject[], selectedId: null, persistent,
    viewport: () => ({ width: 500, height: 300 }), coordinates: () => ({ project: (p: any) => ({ x: p.time, y: p.price }), unproject: (p: any) => ({ time: p.x, price: p.y }) }), projected: () => [] as ProjectedDrawing[],
    onPreview: (value: unknown) => previews.push(value), onSnap() {}, onTool() {}, onSelect() {}, onUpdate() {}, onDelete() {}, onDuplicate() {}, onCreate: (type: DrawingType, anchors: { time: number; price: number }[]) => { created.push({ type, anchors }); return "created"; } };
  const cancelRef = { current: () => {} }, live = { current: props }, queue = new Map<number, () => void>(); let frame = 0;
  const context = vm.createContext({ input: { current: element }, live, cancelRef, setMenu() {}, document, window: { addEventListener: (name: string, fn: any) => windowHandlers.set(name, fn), removeEventListener: (name: string) => windowHandlers.delete(name) },
    Element: class {}, requestAnimationFrame: (fn: () => void) => { queue.set(++frame, fn); return frame; }, cancelAnimationFrame: (id: number) => queue.delete(id),
    distance, drawingHit, moveAnchors, nearestAnchor, snapDrawingPoint, defaultDrawingStyle, drawingAnchorCount });
  vm.runInContext(code(preview), context);
  const cleanup = vm.runInContext(code(`(${effects[0].arguments[0].getText(tree)})()`), context);
  const event = (name: string, x = 20, y = 20) => {
    let prevented = false;
    const value = { clientX: x, clientY: y, button: 0, buttons: name === "pointermove" ? 1 : 0, isPrimary: true, pointerId: 1, target: {}, shiftKey: false, detail: 1, preventDefault() { prevented = true; }, stopPropagation() {} };
    handlers.get(name)?.(value); for (const fn of queue.values()) fn(); queue.clear();
    return prevented;
  };
  const key = (key: string) => windowHandlers.get("keydown")?.({ key, target: {}, preventDefault() {} });
  return { props, created, event, key, cleanup, cancelRef, previews, blur() { document.activeElement = null; }, scopeChange() { const call = effects.find(effect => effect.arguments[1]?.getText(tree).includes("props.scopeKey")); assert.ok(call, "scope changes must cancel the actual interaction effect"); vm.runInContext(code(`(${call.arguments[0].getText(tree)})()`), context); } };
}

for (const type of Object.keys(DRAWING_LABELS) as DrawingType[]) test(`${type}: real creation callback commits its required anchors once`, () => {
  const h = harness(type);
  const count = drawingAnchorCount(type);
  for (let i = 0; i < count; i++) { h.event("pointerdown", 20 + i * 30, 20 + i * 20); h.event("pointerup", 20 + i * 30, 20 + i * 20); }
  if (type === "polyline") h.key("Enter");
  assert.equal(h.created.length, 1); assert.equal(h.created[0].anchors.length, count); h.cleanup();
});

test("unexpected lost capture cancels creation; intentional click release preserves multi-anchor tools", () => {
  const h = harness("trend-line"); h.event("pointerdown"); h.event("lostpointercapture"); h.event("pointermove", 100, 100); h.event("pointerup", 100, 100);
  assert.equal(h.created.length, 0); h.cleanup();
});
test("release outside the price pane cancels a drag instead of committing out-of-bounds anchors", () => {
  const h = harness("rectangle"); h.event("pointerdown"); h.event("pointermove", 600, 400); h.event("pointerup", 600, 400);
  assert.equal(h.created.length, 0); h.cleanup();
});
test("market/pane scope change cancels a pending creation before new-document callbacks", () => {
  const h = harness("trend-line"); h.event("pointerdown"); h.event("pointerup"); h.props.scopeKey = "ETH:secondary"; h.scopeChange(); h.event("pointermove", 100, 100); h.event("pointerup", 100, 100);
  assert.equal(h.created.length, 0); h.cleanup();
});
test("Escape, pointer cancel and unmount leave previews outside committed state", () => {
  for (const action of ["Escape", "pointercancel", "unmount"]) { const h = harness("rectangle"); h.event("pointerdown"); h.event("pointermove", 100, 100); if (action === "Escape") h.key(action); else if (action === "unmount") h.cleanup(); else h.event(action); h.event("pointerup", 100, 100); assert.equal(h.created.length, 0); assert.equal(h.previews.at(-1), null); h.cleanup(); }
});
test("Enter in another pane cannot commit an unfocused pending path", () => {
  const h = harness("polyline"); h.event("pointerdown"); h.event("pointerup"); h.event("pointerdown", 50, 50); h.event("pointerup", 50, 50); h.blur(); h.key("Enter");
  assert.equal(h.created.length, 0); h.cleanup();
});
for (const tool of ["crosshair", "cursor", "eraser"] as const) test(`${tool}: idle preserves native chart ownership; eraser respects locks`, () => {
  const h = harness(tool); let deletes = 0, updates = 0;
  h.props.onDelete = () => { deletes++; }; h.props.onUpdate = () => { updates++; };
  assert.equal(h.event("pointerdown"), false); h.event("pointermove", 40, 40); h.event("pointerup", 40, 40);
  assert.equal(h.created.length, 0); assert.equal(deletes, 0); assert.equal(updates, 0);
  const drawing: DrawingObject = { schemaVersion: 1, id: "locked", type: "horizontal-line", chartId: "primary", instrument: { provider: "gateio", exchange: "GATEIO", product: "perpetual", nativeSymbol: "BTC_USDT" }, anchors: [{ time: 20, price: 20 }], style: defaultDrawingStyle("horizontal-line"), visibility: { timeframes: "all" }, locked: true, hidden: false, zOrder: 1, createdAt: 0, updatedAt: 0 };
  h.props.projected = () => [{ drawing, points: [{ x: 20, y: 20 }], viewport: { width: 500, height: 300 } }];
  h.event("pointerdown"); h.event("pointermove", 40, 40); h.event("pointerup", 40, 40);
  assert.equal(deletes, 0); assert.equal(updates, 0); h.cleanup();
});
test("all creation tools retain semantic edits, duplicate IDs, undo/redo and document isolation", () => {
  const instrument = { provider: "gateio" as const, exchange: "GATEIO" as const, product: "perpetual" as const, nativeSymbol: "BTC_USDT" };
  for (const type of Object.keys(DRAWING_LABELS) as DrawingType[]) {
    useChartDocuments.setState({ documents: {}, drawingHistory: {} }); const store = useChartDocuments.getState();
    const id = store.ensure({ workspaceId: "fixture", chartId: "primary", instrument, timeframe: "1h" });
    const other = store.ensure({ workspaceId: "fixture", chartId: "secondary", instrument, timeframe: "1h" });
    const anchors = Array.from({ length: drawingAnchorCount(type) }, (_, i) => ({ time: 1000 + i * 1000, price: 10 + i }));
    const created = store.createDrawing(id, type, anchors)!; assert.ok(created, type);
    store.updateDrawing(id, created, { anchors: anchors.map(a => ({ ...a, price: a.price + 1 })) });
    const duplicate = store.duplicateDrawing(id, created)!; assert.ok(duplicate); assert.notEqual(created, duplicate);
    store.deleteDrawing(id, duplicate); store.undoDrawings(id); assert.equal(useChartDocuments.getState().documents[id].drawings.length, 2);
    store.redoDrawings(id); assert.equal(useChartDocuments.getState().documents[id].drawings.length, 1);
    assert.equal(useChartDocuments.getState().documents[other].drawings.length, 0);
    const saved = JSON.parse(JSON.stringify(useChartDocuments.getState().documents[id])); assert.deepEqual(saved.drawings[0].anchors, anchors.map(a => ({ ...a, price: a.price + 1 })));
  }
});
