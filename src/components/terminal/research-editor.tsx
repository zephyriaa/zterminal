"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import Editor, { loader, type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor, IDisposable } from "monaco-editor";
import { useResearch } from "@/stores/research";
import { AlertCircle, RefreshCw } from "lucide-react";

// Configure local self-hosted Monaco vendor assets
loader.config({ paths: { vs: "/vendor/monaco-0.55.1/vs" } });

export default function ResearchEditor() {
  const script = useResearch((s) => s.drafts[s.activeId]);
  const minimap = useResearch((s) => s.minimap);
  const diagnostic = useResearch((s) => s.diagnostic);
  const captured = useResearch((s) => s.capturedScript);
  const instance = useRef<editor.IStandaloneCodeEditor | null>(null);
  const api = useRef<Monaco | null>(null);
  const disposables = useRef<IDisposable[]>([]);

  const [monacoFailed, setMonacoFailed] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Fallback timer: if Monaco takes longer than 6 seconds to mount, switch gracefully to native editor
  useEffect(() => {
    if (instance.current) return;
    const timer = setTimeout(() => {
      if (!instance.current) {
        setLoadTimedOut(true);
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [retryKey]);

  useEffect(() => {
    return () => {
      disposables.current.forEach((item) => item.dispose());
    };
  }, []);

  useEffect(() => {
    const model = instance.current?.getModel();
    if (!model || !api.current) return;
    const matches = captured?.id === script?.id && captured.source === script?.source;
    api.current.editor.setModelMarkers(
      model,
      "zterminal",
      diagnostic && matches
        ? [
            {
              severity: api.current.MarkerSeverity.Error,
              message: diagnostic.message,
              startLineNumber: diagnostic.line ?? 1,
              endLineNumber: diagnostic.line ?? 1,
              startColumn: diagnostic.column ?? 1,
              endColumn: (diagnostic.column ?? 1) + 1,
            },
          ]
        : []
    );
    if (diagnostic?.line && matches) {
      instance.current?.revealLineInCenter(diagnostic.line);
    }
  }, [diagnostic, script?.id, script?.source, captured]);

  const mount: OnMount = (editor, monaco) => {
    instance.current = editor;
    api.current = monaco;
    setLoadTimedOut(false);
    setMonacoFailed(false);

    disposables.current.push(
      editor.addAction({
        id: "zterminal.run",
        label: "Run strategy or indicator",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => {
          void useResearch.getState().run();
        },
      })
    );

    disposables.current.push(
      editor.addAction({
        id: "zterminal.save",
        label: "Save artifact",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: () => {
          void useResearch.getState().save();
        },
      })
    );

    disposables.current.push(
      monaco.languages.registerCompletionItemProvider("python", {
        triggerCharacters: ["."],
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          return {
            suggestions: [
              [
                "Strategy",
                "Strategy(entries, exits, short_entries=None, short_exits=None, plots={})",
                "Aligned boolean pandas Series. Entries and exits are shifted to the next open by the engine.",
              ],
              [
                "Indicator",
                "Indicator(outputs={})",
                "Named numeric pandas Series aligned exactly to the selected dataset.",
              ],
              [
                "ema",
                "ema(data.close, 20)",
                "Exponential moving average. Uses a full warm-up window.",
              ],
              [
                "sma",
                "sma(data.close, 20)",
                "Rolling arithmetic average of closing prices.",
              ],
              [
                "rsi",
                "rsi(data.close, 14)",
                "RSI with exponentially smoothed gains and losses.",
              ],
              [
                "crossover",
                "crossover(fast, slow)",
                "True where the first series crosses above the second.",
              ],
              [
                "crossunder",
                "crossunder(fast, slow)",
                "True where the first series crosses below the second.",
              ],
            ].map(([label, insertText, documentation]) => ({
              label,
              insertText,
              documentation,
              detail: "ZTerminal SDK v1",
              kind: monaco.languages.CompletionItemKind.Function,
              range,
            })),
          };
        },
      })
    );

    editor.focus();
  };

  const prepare = (monaco: Monaco) =>
    monaco.editor.defineTheme("zterminal-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [{ token: "comment", foreground: "82A774" }],
      colors: { "editor.background": "#1e1e1e" },
    });

  if (!script) {
    return <div className="p-4 text-xs text-muted-foreground">No script selected.</div>;
  }

  // If Monaco fails or times out, provide a rich accessible fallback
  if (monacoFailed || loadTimedOut) {
    return (
      <FallbackEditor
        script={script}
        diagnostic={diagnostic}
        captured={captured}
        onRetry={() => {
          setMonacoFailed(false);
          setLoadTimedOut(false);
          setRetryKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <div className="relative h-full w-full" key={retryKey}>
      <Editor
        height="100%"
        path={`zterminal://scripts/${script.id}.py`}
        defaultLanguage="python"
        theme="zterminal-dark"
        value={script.source}
        onChange={(value) => useResearch.getState().setSource(value ?? "")}
        beforeMount={prepare}
        onMount={mount}
        loading={
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-xs text-muted-foreground">
            <p>Loading Python editor…</p>
            <button
              type="button"
              className="text-[11px] underline hover:text-white"
              onClick={() => setLoadTimedOut(true)}
            >
              Switch to native editor
            </button>
          </div>
        }
        options={{
          fontSize: 12,
          lineHeight: 20,
          fontFamily: "var(--font-geist-mono), Consolas, monospace",
          minimap: { enabled: minimap },
          automaticLayout: true,
          scrollBeyondLastLine: false,
          wordWrap: "off",
          padding: { top: 12 },
          tabSize: 4,
          renderLineHighlight: "line",
          ariaLabel: "Python strategy editor",
          accessibilitySupport: "auto",
        }}
      />
    </div>
  );
}

function FallbackEditor({
  script,
  diagnostic,
  captured,
  onRetry,
}: {
  script: { id: string; source: string; name: string };
  diagnostic: { message: string; line?: number; column?: number } | null;
  captured: { id: string; source: string } | null;
  onRetry: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lines = useMemo(() => script.source.split("\n"), [script.source]);
  const hasDiag = diagnostic && captured?.id === script.id && captured.source === script.source;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void useResearch.getState().run();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void useResearch.getState().save();
    } else if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      ta.value = val.substring(0, start) + "    " + val.substring(end);
      ta.selectionStart = ta.selectionEnd = start + 4;
      useResearch.getState().setSource(ta.value);
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#1e1e1e] font-mono text-xs text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[11px] bg-[#161616] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <AlertCircle size={12} className="text-amber-400" />
          <span>Native Python editor active (Monaco fallback)</span>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1 text-zinc-300 hover:text-white"
          title="Retry loading Monaco editor"
        >
          <RefreshCw size={11} />
          <span>Retry Monaco</span>
        </button>
      </div>

      {hasDiag && (
        <div className="border-b border-red-500/30 bg-red-950/40 px-3 py-1.5 text-[11px] text-red-300">
          Line {diagnostic.line}: {diagnostic.message}
        </div>
      )}

      <div className="relative flex flex-1 overflow-hidden">
        {/* Line Numbers */}
        <div
          aria-hidden="true"
          className="select-none bg-[#1a1a1a] px-2.5 py-3 text-right text-[11px] text-zinc-600 border-r border-white/5 overflow-hidden"
          style={{ minWidth: "2.5rem" }}
        >
          {lines.map((_, i) => (
            <div
              key={i}
              className={`leading-5 ${hasDiag && diagnostic?.line === i + 1 ? "font-bold text-red-400" : ""}`}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Editor Textarea */}
        <textarea
          ref={textareaRef}
          value={script.source}
          onChange={(e) => useResearch.getState().setSource(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          aria-label={`Python source code for ${script.name}`}
          className="flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-5 text-zinc-200 outline-none select-text"
          style={{ tabSize: 4 }}
        />
      </div>
    </div>
  );
}
