"""ZTerminal Python Research SDK.

This package is deliberately small. It is imported only inside the future isolated
research worker and does not expose network, filesystem, brokerage, subprocess,
or host-environment access.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Literal, Sequence


@dataclass(frozen=True)
class InputSpec:
    kind: Literal["int", "float", "bool", "str"]
    default: int | float | bool | str
    minimum: int | float | None = None
    maximum: int | float | None = None


class inputs:
    @staticmethod
    def int(default: int, min: int | None = None, max: int | None = None) -> InputSpec:
        return InputSpec("int", default, min, max)

    @staticmethod
    def float(default: float, min: float | None = None, max: float | None = None) -> InputSpec:
        return InputSpec("float", default, min, max)

    @staticmethod
    def bool(default: bool) -> InputSpec:
        return InputSpec("bool", default)

    @staticmethod
    def string(default: str) -> InputSpec:
        return InputSpec("str", default)


Series = Sequence[float | None]


@dataclass(frozen=True)
class ArtifactMetadata:
    name: str
    kind: Literal["indicator", "strategy"]
    overlay: bool = True


def _decorate(kind: Literal["indicator", "strategy"], name: str, overlay: bool = True) -> Callable[[Callable[..., object]], Callable[..., object]]:
    def apply(function: Callable[..., object]) -> Callable[..., object]:
        setattr(function, "__zterminal_metadata__", ArtifactMetadata(name=name, kind=kind, overlay=overlay))
        return function
    return apply


def indicator(*, name: str, overlay: bool = True) -> Callable[[Callable[..., object]], Callable[..., object]]:
    return _decorate("indicator", name, overlay)


def strategy(*, name: str, overlay: bool = True) -> Callable[[Callable[..., object]], Callable[..., object]]:
    return _decorate("strategy", name, overlay)


@dataclass(frozen=True)
class Intent:
    action: Literal["ENTER_LONG", "ENTER_SHORT", "CLOSE"]
    quantity: float
    reason: str


@dataclass
class Context:
    """A current-bar context with no future-series or execution capabilities."""

    index: int
    open: Series
    high: Series
    low: Series
    close: Series
    volume: Series
    intents: list[Intent] = field(default_factory=list)

    def _current(self, values: Series) -> float | None:
        return values[self.index] if 0 <= self.index < len(values) else None

    @property
    def current_close(self) -> float | None:
        return self._current(self.close)

    def enter_long(self, *, quantity: float, reason: str) -> None:
        self._append("ENTER_LONG", quantity, reason)

    def enter_short(self, *, quantity: float, reason: str) -> None:
        self._append("ENTER_SHORT", quantity, reason)

    def close_position(self, *, reason: str) -> None:
        self._append("CLOSE", 1.0, reason)

    def _append(self, action: Literal["ENTER_LONG", "ENTER_SHORT", "CLOSE"], quantity: float, reason: str) -> None:
        if quantity <= 0:
            raise ValueError("quantity must be positive")
        if not reason or len(reason) > 160:
            raise ValueError("reason must be a non-empty bounded string")
        self.intents.append(Intent(action=action, quantity=quantity, reason=reason))


class ta:
    @staticmethod
    def sma(values: Series, length: int) -> list[float | None]:
        _positive_length(length)
        output: list[float | None] = []
        for index in range(len(values)):
            window = values[max(0, index - length + 1): index + 1]
            if len(window) != length or any(value is None for value in window):
                output.append(None)
            else:
                output.append(sum(float(value) for value in window) / length)
        return output

    @staticmethod
    def ema(values: Series, length: int) -> list[float | None]:
        _positive_length(length)
        alpha = 2.0 / (length + 1)
        output: list[float | None] = []
        previous: float | None = None
        for value in values:
            if value is None:
                output.append(None)
                continue
            previous = float(value) if previous is None else alpha * float(value) + (1.0 - alpha) * previous
            output.append(previous)
        return output

    @staticmethod
    def crossover(left: Series, right: Series) -> list[bool]:
        return _cross(left, right, up=True)

    @staticmethod
    def crossunder(left: Series, right: Series) -> list[bool]:
        return _cross(left, right, up=False)


def _positive_length(length: int) -> None:
    if not isinstance(length, int) or length < 1 or length > 10_000:
        raise ValueError("indicator length must be an integer between 1 and 10000")


def _cross(left: Series, right: Series, *, up: bool) -> list[bool]:
    if len(left) != len(right):
        raise ValueError("series lengths must match")
    output = [False] * len(left)
    for index in range(1, len(left)):
        before_left, before_right = left[index - 1], right[index - 1]
        current_left, current_right = left[index], right[index]
        if None in {before_left, before_right, current_left, current_right}:
            continue
        output[index] = (before_left <= before_right and current_left > current_right) if up else (before_left >= before_right and current_left < current_right)
    return output
