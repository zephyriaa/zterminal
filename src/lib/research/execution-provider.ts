"use client";

import {
  capabilities,
  helper,
  HelperError,
} from "@/lib/local-research/client";
import type {
  ResearchConfig,
  ResearchResult,
  Dataset,
  Diagnostic,
} from "@/lib/local-research/contracts";

export class RuntimeUnavailableError extends Error {
  readonly code = "runtime_unavailable";
  constructor(message = "Python runtime unavailable — connect ZTerminal Local Runtime to execute this strategy.") {
    super(message);
    this.name = "RuntimeUnavailableError";
  }
}

export class ExecutionFailedError extends Error {
  readonly code = "execution_failed";
  readonly diagnostic?: Diagnostic | null;
  constructor(message: string, diagnostic?: Diagnostic | null) {
    super(message);
    this.name = "ExecutionFailedError";
    this.diagnostic = diagnostic;
  }
}

export class ExecutionCancelledError extends Error {
  readonly code = "execution_cancelled";
  constructor(message = "Strategy execution was cancelled.") {
    super(message);
    this.name = "ExecutionCancelledError";
  }
}

export interface StrategyExecutionCapabilities {
  provider: "local_helper" | "cloud" | "browser";
  available: boolean;
  version?: string;
  platform?: string;
  protocol?: number;
  activeJob?: string | null;
  reason?: string;
}

export interface StrategyExecutionRequest {
  runId: string;
  name?: string;
  strategy: {
    language: "python";
    source: string;
    sourceHash: string;
    entrypoint?: string;
    kind?: "strategy" | "indicator";
    artifact?: {
      id: string;
      revision: number;
      name: string;
    };
  };
  dataset: Dataset;
  parameters: Record<string, number | string | boolean>;
  execution: {
    initialCapital: number;
    feeBps: number;
    slippageBps: number;
    allocation: number;
    direction: "long" | "both";
    multiplier: number;
    quantityStep: number;
  };
  reproducedFrom?: string;
}

export interface StrategyExecutionProvider {
  readonly name: string;
  capabilities(): Promise<StrategyExecutionCapabilities>;
  execute(request: StrategyExecutionRequest, signal?: AbortSignal): Promise<ResearchResult>;
}

/**
 * Canonical v0.1 research execution provider executing real Python
 * via the local ZTerminal CPython Helper process.
 */
export class LocalHelperExecutionProvider implements StrategyExecutionProvider {
  readonly name = "local_helper";

  async capabilities(): Promise<StrategyExecutionCapabilities> {
    try {
      const caps = await capabilities();
      return {
        provider: "local_helper",
        available: true,
        version: caps.version,
        platform: caps.platform,
        protocol: caps.protocol,
        activeJob: caps.activeJob,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Helper unavailable";
      return {
        provider: "local_helper",
        available: false,
        reason: message,
      };
    }
  }

  async execute(request: StrategyExecutionRequest, signal?: AbortSignal): Promise<ResearchResult> {
    if (signal?.aborted) {
      throw new ExecutionCancelledError();
    }

    // 1. Verify runtime availability
    const caps = await this.capabilities();
    if (!caps.available) {
      throw new RuntimeUnavailableError(
        `Python runtime unavailable — connect ZTerminal Local Runtime to execute this strategy. (${caps.reason ?? "Connection refused"})`
      );
    }

    const { strategy, dataset, parameters, execution, name } = request;
    const config: ResearchConfig = {
      provider: dataset.provider,
      symbol: dataset.symbol,
      timeframe: dataset.timeframe,
      from: dataset.from,
      to: dataset.to,
      initialCapital: execution.initialCapital,
      feeBps: execution.feeBps,
      slippageBps: execution.slippageBps,
      allocation: execution.allocation,
      direction: execution.direction,
      multiplier: execution.multiplier,
      quantityStep: execution.quantityStep,
    };

    // 2. Dispatch to Local Helper CPython process
    let job: { id: string; stage: string };
    try {
      if (strategy.kind === "indicator" && strategy.artifact) {
        job = await helper.evaluateIndicator({
          operation: "indicator",
          name: name ?? "Untitled Indicator",
          source: strategy.source,
          config,
          dataset,
          params: parameters,
          artifact: {
            id: strategy.artifact.id,
            kind: "indicator",
            revision: strategy.artifact.revision,
            name: strategy.artifact.name,
          },
          outputs: {},
        });
      } else {
        job = await helper.run({
          name: name ?? "Untitled Strategy",
          source: strategy.source,
          config,
          dataset,
          params: parameters,
        });
      }
    } catch (error) {
      if (error instanceof HelperError && error.code === "unavailable") {
        throw new RuntimeUnavailableError();
      }
      throw new ExecutionFailedError(
        error instanceof Error ? error.message : "Failed to start execution job"
      );
    }

    // 3. Watch job until complete or cancelled
    const onAbort = () => {
      void helper.cancel(job.id).catch(() => {});
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    try {
      while (true) {
        if (signal?.aborted) {
          await helper.cancel(job.id).catch(() => {});
          throw new ExecutionCancelledError();
        }

        const status = await helper.job(job.id);
        if (status.stage === "complete") {
          if (!status.resultId) {
            throw new ExecutionFailedError("Execution completed without a valid result ID.");
          }
          const result = await helper.result(status.resultId);
          if (request.reproducedFrom) {
            result.reproducedFrom = request.reproducedFrom;
          }
          return result;
        }

        if (status.stage === "failed") {
          throw new ExecutionFailedError(
            status.diagnostic?.message ?? "Strategy execution failed. No result was substituted.",
            status.diagnostic
          );
        }

        if (status.stage === "cancelled") {
          throw new ExecutionCancelledError();
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
  }
}

export const defaultExecutionProvider: StrategyExecutionProvider = new LocalHelperExecutionProvider();
