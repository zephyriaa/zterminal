"use client";
import { Component, type ReactNode } from "react";
import { discardWorkspaceLayout } from "@/lib/workspace-dock-layout";
import { useWorkspace } from "@/stores/workspace";

export class TerminalErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; generation: number }> {
  state = { failed: false, generation: 0, instrumentError: "" };
  static getDerivedStateFromError(error: Error) { return { failed: true, instrumentError: error.message.startsWith("Unknown or unsupported instrument:") ? error.message : "" }; }
  render() {
    if (this.state.instrumentError) return <div className="zt-workspace-error" role="alert"><h1>Instrument unavailable</h1><p>{this.state.instrumentError}. Saved workspaces and drawings remain unchanged.</p><button type="button" onClick={() => { useWorkspace.getState().setSymbol("BTCUSDT"); this.setState(state => ({ failed: false, instrumentError: "", generation: state.generation + 1 })); }}>Select BTC/USDT</button></div>;
    if (this.state.failed) return <div className="zt-workspace-error" role="alert"><h1>The workspace could not be opened.</h1><p>Reset the panel layout to recover. Your research and chart data remain saved.</p><button type="button" onClick={() => { discardWorkspaceLayout(); this.setState(state => ({ failed: false, generation: state.generation + 1 })); }}>Reset workspace</button></div>;
    return <div key={this.state.generation} className="contents">{this.props.children}</div>;
  }
}
