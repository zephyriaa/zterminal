import init, { replay_wasm } from "zterminal-research-wasm";

export type BacktestJobPayload = {
    bars: any[];
    intents: any[];
    initialCapital: string;
    policy: any;
};

export type BacktestResultMessage = {
    id: number;
    type: "BACKTEST_RESULT";
    payload: any;
};

export type BacktestErrorMessage = {
    id: number;
    type: "BACKTEST_ERROR";
    error: string;
};

self.onmessage = async (e: MessageEvent) => {
    const { id, type, payload } = e.data;
    if (type === "BACKTEST_JOB") {
        try {
            await init();
            const { bars, intents, initialCapital, policy } = payload as BacktestJobPayload;
            
            // Invoke the WASM Rust engine
            const result = replay_wasm(bars, intents, initialCapital, policy);
            
            self.postMessage({ id, type: "BACKTEST_RESULT", payload: result });
        } catch (error) {
            console.error("Local backtest failed:", error);
            self.postMessage({ id, type: "BACKTEST_ERROR", error: String(error) });
        }
    }
};
