"use client";
import { useEffect, useRef } from "react";
import Editor, { loader, type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor, IDisposable } from "monaco-editor";
import { useResearch } from "@/stores/research";
loader.config({ paths: { vs: "/vendor/monaco-0.55.1/vs" } });

export default function ResearchEditor() {
  const script = useResearch(s => s.drafts[s.activeId]);
  const minimap = useResearch(s => s.minimap);
  const diagnostic = useResearch(s => s.diagnostic);
  const captured = useResearch(s => s.capturedScript);
  const instance = useRef<editor.IStandaloneCodeEditor | null>(null);
  const api = useRef<Monaco | null>(null);
  const disposables = useRef<IDisposable[]>([]);
  useEffect(() => () => { disposables.current.forEach(item => item.dispose()); }, []);
  useEffect(() => {
    const model = instance.current?.getModel();
    if (!model || !api.current) return;
    const matches = captured?.id === script.id && captured.source === script.source;
    api.current.editor.setModelMarkers(model, "zterminal", diagnostic && matches ? [{ severity: api.current.MarkerSeverity.Error, message: diagnostic.message, startLineNumber: diagnostic.line ?? 1, endLineNumber: diagnostic.line ?? 1, startColumn: diagnostic.column ?? 1, endColumn: (diagnostic.column ?? 1) + 1 }] : []);
    if (diagnostic?.line && matches) instance.current?.revealLineInCenter(diagnostic.line);
  }, [diagnostic, script.id, script.source, captured]);
  const mount: OnMount = (editor, monaco) => {
    instance.current = editor; api.current = monaco;
    disposables.current.push(editor.addAction({ id: "zterminal.backtest", label: "Backtest strategy", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter], run: () => { void useResearch.getState().run(); } }));
    disposables.current.push(editor.addAction({ id: "zterminal.save", label: "Save script", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS], run: () => { void useResearch.getState().save(); } }));
    disposables.current.push(monaco.languages.registerCompletionItemProvider("python", { triggerCharacters: ["."], provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      return { suggestions: [
        ["Strategy", "Strategy(entries, exits, short_entries=None, short_exits=None, plots={})", "Aligned boolean pandas Series. Entries and exits are shifted to the next open by the engine."],
        ["ema", "ema(data.close, 20)", "Exponential moving average. Uses a full warm-up window."],
        ["sma", "sma(data.close, 20)", "Rolling arithmetic average of closing prices."],
        ["rsi", "rsi(data.close, 14)", "RSI with exponentially smoothed gains and losses."],
        ["crossover", "crossover(fast, slow)", "True where the first series crosses above the second."],
        ["crossunder", "crossunder(fast, slow)", "True where the first series crosses below the second."],
      ].map(([label, insertText, documentation]) => ({ label, insertText, documentation, detail: "ZTerminal SDK v1", kind: monaco.languages.CompletionItemKind.Function, range })) };
    } }));
    editor.focus();
  };
  return <Editor height="100%" path={`zterminal://scripts/${script.id}.py`} defaultLanguage="python" theme="vs-dark" value={script.source} onChange={value => useResearch.getState().setSource(value ?? "")} onMount={mount} loading={<p className="p-4 text-xs text-muted-foreground">Loading Python editor…</p>} options={{ fontSize: 12, lineHeight: 20, fontFamily: "var(--font-geist-mono), Consolas, monospace", minimap: { enabled: minimap }, automaticLayout: true, scrollBeyondLastLine: false, wordWrap: "off", padding: { top: 12 }, tabSize: 4, renderLineHighlight: "line", ariaLabel: "Python strategy editor", accessibilitySupport: "auto" }} />;
}
