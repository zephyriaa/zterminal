from __future__ import annotations

import os
import time
from typing import Callable, Optional


class ResourceLimitExceeded(RuntimeError):
    """Raised when a quantitative computation exceeds allowed memory or time limits."""


class ExecutionLimiter:
    """
    Guards quant worker execution against runaway loops, excessive memory, or timeouts.
    """

    def __init__(
        self,
        max_wall_seconds: int = 180,
        max_memory_mb: int = 2048,
        is_cancelled: Optional[Callable[[], bool]] = None,
    ):
        self.max_wall_seconds = max_wall_seconds
        self.max_memory_mb = max_memory_mb
        self.is_cancelled = is_cancelled
        self.started_at = time.monotonic()

    def check(self):
        # 1. Check cancellation
        if self.is_cancelled and self.is_cancelled():
            raise ResourceLimitExceeded("Execution cancelled by user")

        # 2. Check wall clock timeout
        elapsed = time.monotonic() - self.started_at
        if elapsed > self.max_wall_seconds:
            raise ResourceLimitExceeded(
                f"Execution exceeded wall-clock limit of {self.max_wall_seconds}s (elapsed: {elapsed:.1f}s)"
            )

        # 3. Check memory if psutil is available
        try:
            import psutil
            process = psutil.Process(os.getpid())
            mem_mb = process.memory_info().rss / (1024 * 1024)
            if mem_mb > self.max_memory_mb:
                raise ResourceLimitExceeded(
                    f"Memory limit exceeded: process used {mem_mb:.1f}MB (limit: {self.max_memory_mb}MB)"
                )
        except ImportError:
            pass
