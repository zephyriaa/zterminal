let worker: Worker | null = null;
let nextJobId = 1;

type ResolveReject = {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
};

const callbacks = new Map<number, ResolveReject>();

function getWorker(): Worker {
    if (!worker) {
        // Must use new URL with import.meta.url for Next.js/Webpack worker support
        worker = new Worker(new URL("../../workers/research.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (e: MessageEvent) => {
            const { id, type, payload, error } = e.data;
            const cb = callbacks.get(id);
            if (cb) {
                if (type === "BACKTEST_RESULT") {
                    cb.resolve(payload);
                } else if (type === "BACKTEST_ERROR") {
                    cb.reject(new Error(error));
                }
                callbacks.delete(id);
            }
        };
    }
    return worker;
}

export function runLocalBacktest(bars: any[], intents: any[], initialCapital: string, policy: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const id = nextJobId++;
        callbacks.set(id, { resolve, reject });
        getWorker().postMessage({
            id,
            type: "BACKTEST_JOB",
            payload: { bars, intents, initialCapital, policy }
        });
    });
}
