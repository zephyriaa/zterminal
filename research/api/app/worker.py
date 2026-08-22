from __future__ import annotations

import os
from dataclasses import dataclass


class WorkerIsolationUnavailable(RuntimeError):
    """Raised instead of executing user code in an unsafe process boundary."""


@dataclass(frozen=True)
class WorkerIsolationPolicy:
    network_disabled: bool
    filesystem_read_only: bool
    child_process_disabled: bool
    cpu_seconds: int
    memory_mb: int
    wall_seconds: int

    @classmethod
    def from_environment(cls) -> "WorkerIsolationPolicy":
        return cls(
            network_disabled=os.getenv("RESEARCH_WORKER_NETWORK_DISABLED") == "1",
            filesystem_read_only=os.getenv("RESEARCH_WORKER_FILESYSTEM_READONLY") == "1",
            child_process_disabled=os.getenv("RESEARCH_WORKER_CHILD_PROCESS_DISABLED") == "1",
            cpu_seconds=int(os.getenv("RESEARCH_WORKER_CPU_SECONDS", "0")),
            memory_mb=int(os.getenv("RESEARCH_WORKER_MEMORY_MB", "0")),
            wall_seconds=int(os.getenv("RESEARCH_WORKER_WALL_SECONDS", "0")),
        )

    def is_ready(self) -> bool:
        return (
            os.getenv("RESEARCH_WORKER_ISOLATED") == "1"
            and self.network_disabled
            and self.filesystem_read_only
            and self.child_process_disabled
            and self.cpu_seconds > 0
            and self.memory_mb > 0
            and self.wall_seconds > 0
        )


def require_isolated_worker() -> WorkerIsolationPolicy:
    policy = WorkerIsolationPolicy.from_environment()
    if not policy.is_ready():
        raise WorkerIsolationUnavailable(
            "user Python execution is disabled until the isolated worker runtime declares network, filesystem, "
            "child-process, CPU, memory, and wall-time restrictions"
        )
    return policy


def execute_artifact(*_args: object, **_kwargs: object) -> None:
    """Reserved worker entrypoint.

    The first deployed release deliberately refuses to execute an artifact until
    the container/namespace profile is present. This prevents an accidental
    fallback to executing untrusted code inside the FastAPI web process.
    """
    require_isolated_worker()
    raise NotImplementedError("isolated Python artifact execution is not enabled in this service image")
