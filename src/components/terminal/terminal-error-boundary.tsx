"use client";
import { Component, type ReactNode } from "react";
import { discardWorkspaceLayout } from "@/lib/workspace-dock-layout";

export class TerminalErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; generation: number }> {
  state = { failed: false, generation: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="zt-workspace-error" role="alert"><h1>The workspace could not be opened.</h1><p>Reset the panel layout to recover. Your research and chart data remain saved.</p><button type="button" onClick={() => { discardWorkspaceLayout(); this.setState(state => ({ failed: false, generation: state.generation + 1 })); }}>Reset workspace</button></div>;
    return <div key={this.state.generation} className="contents">{this.props.children}</div>;
  }
}
